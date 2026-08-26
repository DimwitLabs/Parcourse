export async function exportNotes(title: string, body: string, kind: "png" | "pdf") {
  // Imported here rather than at the top so the markdown renderer stays out of
  // the bundle everyone loads and rides with the export instead.
  const { notesFileName, notesSource } = await import("./notesMarkup");
  const source = notesSource(title, body);
  const name = notesFileName(title, kind);
  if (kind === "png") {
    const { sheetPng } = await import("./sheetImage");
    await sheetPng(source, name);
  } else {
    const { sheetPdf } = await import("./sheetPdf");
    await sheetPdf(source, name);
  }
}
