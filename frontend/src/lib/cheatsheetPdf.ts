import { jsPDF } from "jspdf";

import { fileNameOf, watchUrl } from "./cheatsheet";
import type { Cheatsheet } from "./cheatsheet";
import { lightColors } from "./palette";

type RGB = [number, number, number];

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 56;
const CONTENT = PAGE.width - MARGIN * 2;
const INDENT = 22;

function rgb(value: string): RGB {
  const parts = value.match(/[\d.]+/g) ?? [];
  return [Number(parts[0]) || 0, Number(parts[1]) || 0, Number(parts[2]) || 0];
}

function palette() {
  const raw = lightColors({
    ink: "--color-ink",
    faint: "--color-ink-faint",
    primary: "--color-primary",
    chip: "--color-secondary-container",
    dot: "--color-tertiary",
    rule: "--color-border",
  });
  return {
    ink: rgb(raw.ink),
    faint: rgb(raw.faint),
    primary: rgb(raw.primary),
    chip: rgb(raw.chip),
    dot: rgb(raw.dot),
    rule: rgb(raw.rule),
  };
}

export function cheatsheetPdf(sheet: Cheatsheet) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const c = palette();
  let y = MARGIN;

  function room(needed: number) {
    if (y + needed <= PAGE.height - MARGIN) return false;
    doc.addPage();
    y = MARGIN;
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

  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(...c.ink);
  doc.text("Cheatsheet", MARGIN, y + 16);
  y += 34;

  doc.setFont("helvetica", "normal");
  paragraph(sheet.title, 11, c.faint, MARGIN, CONTENT, 15);

  y += 10;
  doc.setDrawColor(...c.rule);
  doc.setLineWidth(0.75);
  doc.line(MARGIN, y, PAGE.width - MARGIN, y);
  y += 26;

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
    const stamp = section.stamp;
    const stampWidth = doc.getTextWidth(stamp);
    doc.textWithLink(stamp, PAGE.width - MARGIN - stampWidth, headTop, {
      url: watchUrl(sheet.videoId, section.startSeconds),
    });

    paragraph(section.title, 13, c.ink, MARGIN + INDENT, CONTENT - INDENT - stampWidth - 12, 17);
    y += 4;

    doc.setFont("helvetica", "normal");
    paragraph(section.summary, 10, c.faint, MARGIN + INDENT, CONTENT - INDENT, 14);
    y += 6;

    for (const point of section.points) {
      room(14);
      const bulletTop = y;
      paragraph(point, 10.5, c.ink, MARGIN + INDENT + 14, CONTENT - INDENT - 14, 14);
      doc.setFillColor(...c.dot);
      doc.circle(MARGIN + INDENT + 4, bulletTop - 3.5, 2.2, "F");
      y += 4;
    }
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...c.faint);
    doc.text(`Parcourse  ·  ${page} of ${pages}`, MARGIN, PAGE.height - MARGIN + 24);
  }

  doc.save(fileNameOf(sheet));
}
