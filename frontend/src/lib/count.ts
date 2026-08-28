const COMPACT = new Intl.NumberFormat("en", { notation: "compact", compactDisplay: "short" });

export function compactCount(value: number): string {
  return COMPACT.format(value);
}
