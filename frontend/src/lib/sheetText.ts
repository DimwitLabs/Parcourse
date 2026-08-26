export function escaped(text: string) {
  const node = document.createElement("div");
  node.textContent = text;
  return node.innerHTML;
}

export function sheetFileName(kind: string, title: string, extension: string) {
  const clean = title
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return `[Parcourse] ${kind} - ${clean || "Untitled course"}.${extension}`;
}
