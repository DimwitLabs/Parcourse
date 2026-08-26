import MarkdownIt from "markdown-it";

/** Anything the drawer does not list as a mark is switched off rather than
 *  left to render something the notepad never offered. */
const notepad = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
})
  .disable(["table", "code", "fence", "image", "reference"]);

export function markdownToHtml(source: string) {
  return notepad.render(source);
}
