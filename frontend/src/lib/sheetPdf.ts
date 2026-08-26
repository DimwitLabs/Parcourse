import { jsPDF } from "jspdf";

import { paintPaper, sheetCanvas } from "./sheetImage";
import type { SheetShot, SheetSource } from "./sheetImage";

const PAGE = { width: 595.28, height: 841.89 };

function pageTops(shot: SheetShot, pageHeight: number) {
  const tops = [0];
  while (true) {
    const top = tops[tops.length - 1];
    if (top + pageHeight >= shot.canvas.height) return tops;
    const fits = shot.seamsInCanvasPixels.filter((seam) => seam > top && seam <= top + pageHeight);
    const next = fits.length > 0 ? fits[fits.length - 1] : top + pageHeight;
    tops.push(next);
  }
}

export async function sheetPdf(source: SheetSource, name: string) {
  const shot = await sheetCanvas(source);
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });

  const scale = PAGE.width / shot.canvas.width;
  const pageHeight = PAGE.height / scale;
  const tops = pageTops(shot, pageHeight);

  const slice = document.createElement("canvas");
  slice.width = shot.canvas.width;
  slice.height = Math.round(pageHeight);
  const context = slice.getContext("2d");
  if (!context) throw new Error("The page could not be drawn.");

  tops.forEach((top, page) => {
    const ends = tops[page + 1] ?? shot.canvas.height;
    const height = Math.min(ends - top, pageHeight);
    paintPaper(context, slice.width, slice.height, shot, top);
    context.drawImage(shot.canvas, 0, top, shot.canvas.width, height, 0, 0, shot.canvas.width, height);
    if (page > 0) doc.addPage();
    doc.addImage(slice.toDataURL("image/png"), "PNG", 0, 0, PAGE.width, PAGE.height);
  });

  doc.save(name);
}
