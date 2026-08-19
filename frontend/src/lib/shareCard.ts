const W = 1200;
const PAD = 72;
const RING_COL = 380;

const PAPER = "#fbf9f5";
const INK = "#1b1c1a";
const INK_SOFT = "#434840";
const INK_FAINT = "#8b9086";
const PRIMARY = "#4c6546";
const SECONDARY_CONTAINER = "#dbe6d3";
const SURFACE_HIGH = "#eae8e4";
const PRIMARY_LIGHT = "#89a481";
const TERTIARY_CONTAINER = "#f2e2e7";
const WHITE = "#ffffff";

const FACES = [
  "400 16px 'Plus Jakarta Sans'",
  "600 16px 'Plus Jakarta Sans'",
  "700 16px 'Plus Jakarta Sans'",
  "800 16px 'Plus Jakarta Sans'",
];

export type SummaryRow = { tone: "good" | "warn"; text: string };

export type CardData = {
  courseTitle: string;
  score: number;
  outOf: number;
  percentage: number;
  mastered: boolean;
  analysis?: string;
  summary: SummaryRow[];
};

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** Greedy wrap over as many lines as the words need. */
function wrap(c: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (c.measureText(next).width <= width || !line) {
      line = next;
      continue;
    }
    lines.push(line);
    line = word;
  }
  if (line) lines.push(line);
  return lines;
}

function dots(c: CanvasRenderingContext2D, height: number) {
  c.fillStyle = "rgba(27, 28, 26, 0.10)";
  for (let y = 26; y < height; y += 52) {
    for (let x = 26; x < W; x += 52) {
      c.beginPath();
      c.arc(x, y, 2.4, 0, Math.PI * 2);
      c.fill();
    }
  }
}

function ring(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, pct: number) {
  c.lineWidth = 14;
  c.lineCap = "round";
  const START = -Math.PI / 2;
  const GAP = 0.14;
  const sweep = (Math.PI * 2 * Math.min(Math.max(pct, 0), 100)) / 100;
  const trackSweep = Math.PI * 2 - sweep - GAP * 2;

  c.strokeStyle = SURFACE_HIGH;
  c.beginPath();
  if (sweep <= 0) c.arc(cx, cy, r, 0, Math.PI * 2);
  else if (trackSweep > 0) c.arc(cx, cy, r, START + sweep + GAP, START + sweep + GAP + trackSweep);
  c.stroke();

  if (sweep <= 0) return;
  c.strokeStyle = PRIMARY;
  c.beginPath();
  c.arc(cx, cy, r, START, START + sweep);
  c.stroke();
}

function ornaments(c: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  const half = size / 2;
  c.save();
  c.translate(cx, cy);
  c.rotate((6 * Math.PI) / 180);

  c.globalAlpha = 0.35;
  c.strokeStyle = PRIMARY_LIGHT;
  c.lineWidth = 4;
  c.setLineDash([14, 12]);
  roundRect(c, -half, -half, size, size, 62);
  c.stroke();
  c.setLineDash([]);
  c.globalAlpha = 1;

  c.fillStyle = TERTIARY_CONTAINER;
  c.beginPath();
  c.arc(half, -half, 22, 0, Math.PI * 2);
  c.fill();

  c.save();
  c.translate(-half, half);
  c.rotate((12 * Math.PI) / 180);
  c.fillStyle = SECONDARY_CONTAINER;
  roundRect(c, -28, -28, 56, 56, 14);
  c.fill();
  c.restore();

  c.restore();
}

/** The pill that straddles the top edge of the analysis card on the page. */
function edgePill(c: CanvasRenderingContext2D, label: string, x: number, edgeY: number) {
  c.font = "700 18px 'Plus Jakarta Sans', sans-serif";
  c.letterSpacing = "1.6px";
  const w = c.measureText(label).width + 44;
  c.fillStyle = PRIMARY_LIGHT;
  roundRect(c, x, edgeY - 17, w, 34, 17);
  c.fill();
  c.fillStyle = WHITE;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(label, x + w / 2, edgeY + 1);
  c.textAlign = "left";
  c.textBaseline = "top";
  c.letterSpacing = "0px";
}

/** The three-star mark the page sets beside the tutor's words. */
function sparkles(c: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const paths = [
    "M9 2L10.09 7.26L15 9L10.09 10.74L9 16L7.91 10.74L3 9L7.91 7.26L9 2Z",
    "M19 12L19.72 14.78L22.5 15.5L19.72 16.22L19 19L18.28 16.22L15.5 15.5L18.28 14.78L19 12Z",
    "M5 17L5.54 19.21L7.75 19.75L5.54 20.29L5 22.5L4.46 20.29L2.25 19.75L4.46 19.21L5 17Z",
  ];
  c.save();
  c.translate(x, y);
  c.scale(size / 24, size / 24);
  c.fillStyle = PRIMARY;
  for (const d of paths) c.fill(new Path2D(d));
  c.restore();
}

/** A summary row's icon: the page sets each glyph in its own filled circle. */
function rowIcon(c: CanvasRenderingContext2D, tone: SummaryRow["tone"], cx: number, cy: number) {
  c.fillStyle = tone === "good" ? PRIMARY : "rgba(27, 28, 26, 0.1)";
  c.beginPath();
  c.arc(cx, cy, 17, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = tone === "good" ? WHITE : INK_SOFT;
  c.font = "700 17px 'Plus Jakarta Sans', sans-serif";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(tone === "good" ? "\u2713" : "\u2192", cx, cy + 1);
  c.textAlign = "left";
  c.textBaseline = "top";
}

function wordmark(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = "/parcourse-wordmark.svg";
  });
}

export async function drawResultCard(data: CardData): Promise<Blob> {
  // Everything the drawing needs is fetched before a word is measured. A face
  // that arrives later would widen text that was measured in the fallback, and
  // it would arrive during the wordmark's await.
  await Promise.all(FACES.map((f) => document.fonts?.load(f).catch(() => [])));
  if (document.fonts?.ready) await document.fonts.ready;
  const mark = await wordmark();

  const canvas = document.createElement("canvas");
  canvas.width = W;
  const c = canvas.getContext("2d");
  if (!c) throw new Error("Canvas is unavailable in this browser.");
  c.textBaseline = "top";

  const bodyWidth = W - PAD * 2;
  const sideX = PAD + RING_COL + 24;
  const sideWidth = W - PAD - sideX;

  c.font = "800 44px 'Plus Jakarta Sans', sans-serif";
  const titleLines = wrap(c, data.courseTitle, bodyWidth - (data.mastered ? 260 : 0));

  const ROW_TEXT_X = sideX + 82;
  const rowTextWidth = sideWidth - 82 - 34;
  c.font = "600 23px 'Plus Jakarta Sans', sans-serif";
  const rows = data.summary.map((r) => ({ ...r, lines: wrap(c, r.text, rowTextWidth) }));

  const ANALYSIS_TEXT_X = PAD + 88;
  c.font = "italic 400 25px 'Plus Jakarta Sans', sans-serif";
  const analysisLines = data.analysis ? wrap(c, data.analysis, bodyWidth - 128) : [];

  const headerH = 46 + 34;
  const titleH = titleLines.length * 56;
  const rowsH = rows.reduce((h, r) => h + r.lines.length * 34 + 18, 0) - (rows.length ? 18 : 0);
  const summaryH = rows.length ? 30 + 34 + 22 + rowsH + 30 : 0;
  const bandH = Math.max(summaryH, 340);
  const analysisH = analysisLines.length ? 46 + analysisLines.length * 42 + 36 : 0;
  const H = PAD + headerH + titleH + 44 + bandH + (analysisH ? 40 + analysisH : 0) + PAD;
  // Sizing the canvas resets the context, so the baseline is set again here
  // rather than once at the top.
  canvas.height = H;
  c.textBaseline = "top";

  c.fillStyle = PAPER;
  c.fillRect(0, 0, W, H);
  dots(c, H);

  if (mark) {
    const h = 44;
    c.drawImage(mark, PAD, PAD, (mark.width / mark.height) * h, h);
  } else {
    c.fillStyle = PRIMARY;
    c.font = "800 36px 'Plus Jakarta Sans', sans-serif";
    c.fillText("Parcourse", PAD, PAD + 4);
  }

  if (data.mastered) {
    const label = "MASTERY EARNED";
    c.font = "800 20px 'Plus Jakarta Sans', sans-serif";
    const w = c.measureText(label).width + 52;
    c.fillStyle = PRIMARY;
    roundRect(c, W - PAD - w, PAD + 1, w, 44, 22);
    c.fill();
    c.fillStyle = WHITE;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(label, W - PAD - w / 2, PAD + 23);
    c.textAlign = "left";
    c.textBaseline = "top";
  }

  let y = PAD + headerH;
  c.fillStyle = INK;
  c.font = "800 44px 'Plus Jakarta Sans', sans-serif";
  for (const line of titleLines) {
    c.fillText(line, PAD, y);
    y += 56;
  }

  y += 44;

  const cx = PAD + RING_COL / 2;
  const cy = y + bandH / 2;
  ornaments(c, cx, cy, 280);
  ring(c, cx, cy, 96, data.percentage);

  const scoreText = `${data.score}`;
  const outOfText = `/${data.outOf}`;
  c.textBaseline = "alphabetic";
  c.font = "800 72px 'Plus Jakarta Sans', sans-serif";
  const scoreWidth = c.measureText(scoreText).width;
  c.font = "700 34px 'Plus Jakarta Sans', sans-serif";
  const outOfWidth = c.measureText(outOfText).width;
  const groupX = cx - (scoreWidth + outOfWidth) / 2;
  c.fillStyle = INK;
  c.font = "800 72px 'Plus Jakarta Sans', sans-serif";
  c.fillText(scoreText, groupX, cy + 12);
  c.fillStyle = INK_FAINT;
  c.font = "700 34px 'Plus Jakarta Sans', sans-serif";
  c.fillText(outOfText, groupX + scoreWidth, cy + 12);

  c.textBaseline = "top";
  c.textAlign = "center";
  c.fillStyle = INK_FAINT;
  c.font = "700 18px 'Plus Jakarta Sans', sans-serif";
  c.fillText("SCORE", cx, cy + 30);
  c.textAlign = "left";

  if (rows.length) {
    const boxY = y + (bandH - summaryH) / 2;
    c.fillStyle = SECONDARY_CONTAINER;
    roundRect(c, sideX, boxY, sideWidth, summaryH, 34);
    c.fill();

    c.fillStyle = PRIMARY;
    c.font = "800 26px 'Plus Jakarta Sans', sans-serif";
    c.fillText("Performance Summary", sideX + 34, boxY + 30);

    let ty = boxY + 30 + 34 + 22;
    for (const row of rows) {
      rowIcon(c, row.tone, sideX + 51, ty + 15);
      c.fillStyle = INK_SOFT;
      c.font = "600 23px 'Plus Jakarta Sans', sans-serif";
      for (const line of row.lines) {
        c.fillText(line, ROW_TEXT_X, ty + 4);
        ty += 34;
      }
      ty += 18;
    }
  }

  if (analysisLines.length) {
    const ay = y + bandH + 40;
    c.fillStyle = WHITE;
    roundRect(c, PAD, ay, bodyWidth, analysisH, 34);
    c.fill();
    c.strokeStyle = "rgba(137, 164, 129, 0.18)";
    c.lineWidth = 2;
    c.stroke();

    edgePill(c, "AI TUTOR ANALYSIS", PAD + 40, ay);
    sparkles(c, PAD + 38, ay + 46, 34);

    c.fillStyle = INK_SOFT;
    c.font = "italic 400 25px 'Plus Jakarta Sans', sans-serif";
    let ty = ay + 46;
    for (const line of analysisLines) {
      c.fillText(line, ANALYSIS_TEXT_X, ty);
      ty += 42;
    }
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The card could not be drawn."))), "image/png");
  });
}
