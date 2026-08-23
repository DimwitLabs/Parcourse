import { snapdom } from "@zumer/snapdom";

import { stampOf } from "./cheatsheet";
import type { Cheatsheet } from "./cheatsheet";

const SHEET_WIDTH = 900;
const PIXEL_RATIO = 2;
const DOT_STEP = 26;
const DOT_RADIUS = 1.4;
const DOT_OFFSET = 13;
const TALLEST_CANVAS_CHROME_WILL_DRAW = 16000;

function escaped(text: string) {
  const node = document.createElement("div");
  node.textContent = text;
  return node.innerHTML;
}

function markup(sheet: Cheatsheet) {
  const sections = sheet.sections
    .map(
      (section) => `
      <section class="cheatsheet-export-section">
        <div class="cheatsheet-export-head">
          <span class="cheatsheet-export-num">${section.number}</span>
          <h2 class="cheatsheet-export-title">${escaped(section.title)}</h2>
          <span class="cheatsheet-export-stamp">${escaped(stampOf(section.startSeconds))}</span>
        </div>
        <ul class="cheatsheet-export-points">
          ${section.points.map((point) => `<li>${escaped(point)}</li>`).join("")}
        </ul>
      </section>`,
    )
    .join("");

  return `
    <header class="cheatsheet-export-masthead">
      <img class="cheatsheet-export-logo" src="/parcourse-wordmark.svg" alt="Parcourse" />
      <span class="cheatsheet-export-eyebrow">Cheatsheet</span>
    </header>
    <h1 class="cheatsheet-export-course">${escaped(sheet.title)}</h1>
    <div class="cheatsheet-export-body">${sections}</div>
    <footer class="cheatsheet-export-footer">
      <span>Made with Parcourse</span>
      <span>${sheet.sections.length} section${sheet.sections.length === 1 ? "" : "s"}</span>
    </footer>`;
}

async function mounted(sheet: Cheatsheet): Promise<HTMLDivElement> {
  const host = document.createElement("div");
  host.className = "cheatsheet-export";
  host.style.width = `${SHEET_WIDTH}px`;
  // Saying this on the node rather than the document keeps the page the reader
  // is looking at from flashing light while the capture runs.
  host.style.colorScheme = "light";
  host.style.setProperty("--dark", "0");
  host.innerHTML = markup(sheet);
  document.body.appendChild(host);

  const logo = host.querySelector("img");
  if (logo && !logo.complete) {
    await new Promise((resolve) => {
      logo.onload = resolve;
      logo.onerror = resolve;
    });
  }
  await document.fonts?.ready;
  return host;
}

function seamsOf(host: HTMLElement, scale: number) {
  const cards = [...host.querySelectorAll(".cheatsheet-export-section")];
  const top = host.getBoundingClientRect().top;
  const seams: number[] = [];
  for (let card = 1; card < cards.length; card += 1) {
    const above = cards[card - 1].getBoundingClientRect().bottom - top;
    const below = cards[card].getBoundingClientRect().top - top;
    seams.push(((above + below) / 2) * scale);
  }
  return seams;
}

function colorOf(host: HTMLElement, token: string) {
  const probe = document.createElement("span");
  probe.style.color = `var(${token})`;
  host.appendChild(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value;
}

// A repeating radial-gradient does not survive the capture, so the paper and
// its dots are drawn here rather than asked for in CSS.
export function paintPaper(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  shot: SheetShot,
  fromSheetY = 0,
) {
  context.fillStyle = shot.paper;
  context.fillRect(0, 0, width, height);

  context.fillStyle = shot.dot;
  const step = DOT_STEP * shot.scale;
  const radius = DOT_RADIUS * shot.scale;
  const start = DOT_OFFSET * shot.scale;
  for (let row = Math.max(0, Math.ceil((fromSheetY - start) / step)); ; row += 1) {
    const y = start + row * step - fromSheetY;
    if (y - radius > height) break;
    for (let x = start; x < width; x += step) {
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
  }
}

function onPaper(shot: SheetShot) {
  const sheet = document.createElement("canvas");
  sheet.width = shot.canvas.width;
  sheet.height = shot.canvas.height;
  const context = sheet.getContext("2d");
  if (!context) throw new Error("The image could not be drawn.");

  paintPaper(context, sheet.width, sheet.height, shot);
  context.drawImage(shot.canvas, 0, 0);
  return sheet;
}

export type SheetShot = {
  canvas: HTMLCanvasElement;
  scale: number;
  paper: string;
  dot: string;
  /** Where a page may be cut without splitting a section, in canvas pixels. */
  seams: number[];
};

export async function sheetCanvas(sheet: Cheatsheet): Promise<SheetShot> {
  const host = await mounted(sheet);
  try {
    const paper = getComputedStyle(host).backgroundColor;
    const dot = colorOf(host, "--color-dot");
    host.style.backgroundColor = "transparent";

    const height = host.getBoundingClientRect().height;
    const scale =
      height * PIXEL_RATIO > TALLEST_CANVAS_CHROME_WILL_DRAW
        ? Math.max(1, TALLEST_CANVAS_CHROME_WILL_DRAW / height)
        : PIXEL_RATIO;
    const captured = await snapdom.toCanvas(host, {
      scale,
      dpr: 1,
      embedFonts: true,
    });
    const shot: SheetShot = { canvas: captured, scale, paper, dot, seams: seamsOf(host, scale) };
    return { ...shot, canvas: onPaper(shot) };
  } finally {
    host.remove();
  }
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export async function sheetPng(sheet: Cheatsheet, name: string) {
  const { canvas } = await sheetCanvas(sheet);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("The image could not be written.");
  save(blob, name);
}
