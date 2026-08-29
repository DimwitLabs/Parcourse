const HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "gaming.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
  "youtu.be",
  "www.youtu.be",
]);

const PATH_PREFIXES = new Set(["shorts", "embed", "live", "v"]);

// Copied into extension/lib/youtube.js; scripts/check-youtube-parsers.mjs keeps the two in step.
const VIDEO_ID = /^[\w-]{11}$/;

/** Null unless id is a bare video id: the extension hands one over rather than a whole URL. */
export function youTubeWatchUrl(id: string): string | null {
  return VIDEO_ID.test(id.trim()) ? `https://www.youtube.com/watch?v=${id.trim()}` : null;
}

export function youTubeVideoId(input: string): string | null {
  const text = input.trim();
  if (!text) return null;

  let url: URL;
  try {
    url = new URL(/^[a-z][a-z\d+.-]*:/i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!HOSTS.has(url.hostname.toLowerCase())) return null;

  const parts = url.pathname.split("/").filter(Boolean);
  const id = url.hostname.toLowerCase().endsWith("youtu.be")
    ? parts[0]
    : parts[0] === "watch"
      ? url.searchParams.get("v")
      : PATH_PREFIXES.has(parts[0])
        ? parts[1]
        : null;

  return id && VIDEO_ID.test(id) ? id : null;
}
