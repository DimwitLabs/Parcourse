import source from "../../../shared/tokens.css?raw";

function named(prefix: string): string[] {
  return [...new Set([...source.matchAll(new RegExp(`(--${prefix}-[a-z0-9-]+)\\s*:`, "g"))].map((match) => match[1]))];
}

const FAMILIES: [string, RegExp][] = [
  ["Surfaces", /^(paper|surface|border)/],
  ["Ink", /^(ink|on-accent)/],
  ["Accents", /^(primary|secondary|sage|tertiary)/],
  ["Status", /^(danger|warn|info)/],
  ["Knowledge graph", /^node-/],
  ["Texture", /^(dot|hairline|deco|scrim)/],
];

/** Every colour token, grouped by what it is for; a token no family claims lands in "Other". */
export const COLOUR_FAMILIES: { name: string; tokens: string[] }[] = (() => {
  const colours = named("color");
  const families = FAMILIES.map(([name, pattern]) => ({
    name,
    tokens: colours.filter((token) => pattern.test(token.replace("--color-", ""))),
  }));
  const claimed = new Set(families.flatMap((family) => family.tokens));
  const rest = colours.filter((token) => !claimed.has(token));
  return rest.length > 0 ? [...families, { name: "Other", tokens: rest }] : families;
})();

export const SHADOWS = named("shadow");
export const RADII = named("radius");
