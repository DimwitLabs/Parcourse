import { jsPDF } from "jspdf";

import { fileNameOf, watchUrl } from "./cheatsheet";
import type { Cheatsheet } from "./cheatsheet";
import { lightColors } from "./palette";

type RGB = [number, number, number];

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 56;
const CONTENT = PAGE.width - MARGIN * 2;
const INDENT = 22;
const WORDMARK = { src: "/parcourse-wordmark.svg", width: 96, height: 25.6, scale: 4 };

function rgb(value: string): RGB {
  const parts = value.match(/[\d.]+/g) ?? [];
  return [Number(parts[0]) || 0, Number(parts[1]) || 0, Number(parts[2]) || 0];
}

function palette() {
  const raw = lightColors({
    paper: "--color-paper",
    sheet: "--color-surface-lowest",
    ink: "--color-ink",
    faint: "--color-ink-faint",
    primary: "--color-primary",
    chip: "--color-secondary-container",
    dot: "--color-tertiary",
    rule: "--color-border",
  });
  return {
    paper: rgb(raw.paper),
    sheet: rgb(raw.sheet),
    ink: rgb(raw.ink),
    faint: rgb(raw.faint),
    primary: rgb(raw.primary),
    chip: rgb(raw.chip),
    dot: rgb(raw.dot),
    rule: rgb(raw.rule),
  };
}

async function wordmark(): Promise<string | null> {
  try {
    const response = await fetch(WORDMARK.src);
    if (!response.ok) return null;
    const source = await response.text();
    const url = URL.createObjectURL(new Blob([source], { type: "image/svg+xml" }));
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = WORDMARK.width * WORDMARK.scale;
      canvas.height = WORDMARK.height * WORDMARK.scale;
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/png");
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return null;
  }
}

export async function cheatsheetPdf(sheet: Cheatsheet) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const c = palette();
  const mark = await wordmark();
  let y = MARGIN + 54;

  function paper() {
    doc.setFillColor(...c.paper);
    doc.rect(0, 0, PAGE.width, PAGE.height, "F");
  }

  function room(needed: number) {
    if (y + needed <= PAGE.height - MARGIN - 20) return false;
    doc.addPage();
    paper();
    y = MARGIN + 20;
    return true;
  }

  function paragraph(text: string, size: number, colour: RGB, x: number, width: number, leading: number) {
    doc.setFontSize(size);
    doc.setTextColor(...colour);
    for (const line of doc.splitTextToSize(text, width) as string[]) {
      room(leading);
      doc.text(line, x, y);
      y += leading;
    }
  }

  paper();

  if (mark) {
    doc.addImage(mark, "PNG", MARGIN, MARGIN - 4, WORDMARK.width, WORDMARK.height);
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...c.primary);
    doc.text("Parcourse", MARGIN, MARGIN + 14);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...c.faint);
  doc.text("CHEATSHEET", PAGE.width - MARGIN, MARGIN + 12, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...c.ink);
  paragraph(sheet.title, 20, c.ink, MARGIN, CONTENT, 25);

  y += 12;
  doc.setDrawColor(...c.rule);
  doc.setLineWidth(0.75);
  doc.line(MARGIN, y, PAGE.width - MARGIN, y);
  y += 28;

  sheet.sections.forEach((section, index) => {
    if (index > 0) y += 22;
    const brokePage = room(70);
    if (index > 0 && !brokePage) {
      doc.setDrawColor(...c.rule);
      doc.line(MARGIN, y - 14, PAGE.width - MARGIN, y - 14);
    }
    const headTop = y;

    doc.setFillColor(...c.chip);
    doc.circle(MARGIN + 8, headTop - 4, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...c.primary);
    doc.text(String(section.number), MARGIN + 8, headTop - 1, { align: "center" });

    doc.setFontSize(9);
    doc.setTextColor(...c.faint);
    const stampWidth = doc.getTextWidth(section.stamp);
    doc.textWithLink(section.stamp, PAGE.width - MARGIN - stampWidth, headTop, {
      url: watchUrl(sheet.videoId, section.startSeconds),
    });

    paragraph(section.title, 13, c.ink, MARGIN + INDENT, CONTENT - INDENT - stampWidth - 12, 17);
    y += 8;

    doc.setFont("helvetica", "normal");
    for (const point of section.points) {
      room(14);
      const bulletTop = y;
      paragraph(point, 10.5, c.ink, MARGIN + INDENT + 14, CONTENT - INDENT - 14, 14);
      doc.setFillColor(...c.dot);
      doc.circle(MARGIN + INDENT + 4, bulletTop - 3.5, 2.2, "F");
      y += 5;
    }
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    const base = PAGE.height - MARGIN + 16;
    doc.setDrawColor(...c.rule);
    doc.setLineWidth(0.75);
    doc.line(MARGIN, base - 12, PAGE.width - MARGIN, base - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...c.faint);
    doc.text("Made with Parcourse", MARGIN, base);
    doc.text(`${page} of ${pages}`, PAGE.width - MARGIN, base, { align: "right" });
  }

  doc.save(fileNameOf(sheet));
}
