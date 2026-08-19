export function withLightPalette(read: () => void) {
  const root = document.documentElement;
  const previous = root.getAttribute("data-theme");
  root.setAttribute("data-theme", "light");
  try {
    read();
  } finally {
    if (previous === null) root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", previous);
  }
}

export function lightColors<K extends string>(tokens: Record<K, string>): Record<K, string> {
  const probe = document.createElement("span");
  probe.style.cssText = "position:absolute;left:-9999px";
  document.body.appendChild(probe);
  const resolved = {} as Record<K, string>;
  withLightPalette(() => {
    for (const name of Object.keys(tokens) as K[]) {
      probe.style.color = `var(${tokens[name]})`;
      resolved[name] = window.getComputedStyle(probe).color;
    }
  });
  probe.remove();
  return resolved;
}
