/** Ambiguous glyphs (0/O, 1/l/I) are left out so a password read off a screen
 *  or copied by hand does not get mistyped. */
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const ALL = LOWER + UPPER + DIGITS;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_RULE =
  `At least ${PASSWORD_MIN_LENGTH} characters, with an uppercase letter, a lowercase letter and a number.`;

/** Mirrors the server rule in schemas/auth.py. Returns null when valid. */
export function passwordError(value: string): string | null {
  if (value.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (!/[A-Z]/.test(value)) return "Include an uppercase letter.";
  if (!/[a-z]/.test(value)) return "Include a lowercase letter.";
  if (!/[0-9]/.test(value)) return "Include a number.";
  return null;
}

function randomIndex(max: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % max;
}

function pick(set: string): string {
  return set[randomIndex(set.length)];
}

/** Seeds one character of each required class, then shuffles, so the result
 *  always satisfies passwordError(). */
export function generatePassword(length = 16): string {
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS)];
  while (chars.length < length) chars.push(pick(ALL));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
