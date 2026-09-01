import { useEffect } from "react";

import { creditClipboard } from "./credit";
import type { Credit } from "./credit";
import { escaped } from "./sheetText";

const LEAST_WORTH_CREDITING = 60;

function inScope(selection: Selection | null): boolean {
  const anchor = selection?.anchorNode ?? null;
  const node = anchor instanceof Element ? anchor : anchor?.parentElement;
  return Boolean(node?.closest("[data-credit-scope]"));
}

export function useCopyCredit(credit: Credit | null) {
  const { name, url, title, named } = credit ?? { name: "", url: "", title: "", named: false };

  useEffect(() => {
    if (!url) return;

    function onCopy(event: ClipboardEvent) {
      const selection = window.getSelection();
      const text = selection?.toString() ?? "";
      if (text.trim().length < LEAST_WORTH_CREDITING || !inScope(selection)) return;

      const note = creditClipboard({ name, url, title, named });
      event.clipboardData?.setData("text/plain", `${text}\n\n—\n\n${note}`);
      event.clipboardData?.setData(
        "text/html",
        `<div>${escaped(text).replace(/\n/g, "<br>")}</div><hr><div>${escaped(note).replace(/\n/g, "<br>")}</div>`,
      );
      event.preventDefault();
    }

    document.addEventListener("copy", onCopy);
    return () => document.removeEventListener("copy", onCopy);
  }, [name, url, title, named]);
}
