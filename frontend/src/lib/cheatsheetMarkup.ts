import { stampOf } from "./cheatsheet";
import type { Cheatsheet } from "./cheatsheet";
import { creditOf } from "./credit";
import { escaped } from "./sheetText";
import type { SheetSource } from "./sheetImage";

function imprint(sheet: Cheatsheet) {
  const credit = creditOf({
    video_id: sheet.videoId,
    video_title: sheet.title,
    channel: sheet.channel,
    channel_url: sheet.channelUrl,
  });
  const row = credit.named
    ? `<dt>Creator</dt><dd><b>${escaped(credit.name)}</b></dd>`
    : `<dt>Source</dt><dd>${escaped(credit.url.replace(/^https?:\/\//, ""))}</dd>`;
  return `
    <div class="cheatsheet-export-credit">
      <dl class="source-imprint">${row}</dl>
    </div>`;
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
    ${imprint(sheet)}
    <div class="cheatsheet-export-body">${sections}</div>
    <footer class="cheatsheet-export-footer">
      <span>Made with Parcourse</span>
      <span>${sheet.sections.length} section${sheet.sections.length === 1 ? "" : "s"}</span>
    </footer>`;
}


export function cheatsheetSource(sheet: Cheatsheet): SheetSource {
  return {
    html: markup(sheet),
    className: "cheatsheet-export",
    seamSelector: ".cheatsheet-export-section",
  };
}
