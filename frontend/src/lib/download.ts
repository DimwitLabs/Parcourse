export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking straight away can beat the browser to the file, so the URL is let
  // go on the next turn instead.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
