import { youTubeWatchUrl } from "./youtube";

export type CreditSource = {
  video_id: string;
  video_title?: string;
  channel?: string;
  channel_url?: string;
};

export type Credit = {
  name: string;
  url: string;
  title: string;
  named: boolean;
};

export function creditOf(source: CreditSource): Credit {
  const watch = youTubeWatchUrl(source.video_id) ?? "";
  const name = (source.channel ?? "").trim();
  const title = (source.video_title ?? "").trim();
  return {
    name: name || "Watch on YouTube",
    url: (source.channel ?? "").trim() ? (source.channel_url ?? "").trim() || watch : watch,
    title,
    named: Boolean(name),
  };
}

export function creditClipboard(credit: Credit): string {
  const named = credit.title ? `“${credit.title}”` : "";
  const author = credit.named ? ` by ${credit.name}` : "";
  const link = credit.url ? ` (${credit.url})` : "";
  const source = `${named}${author}${link}`.trim();
  return source ? `${source}. Study notes made with Parcourse.` : "Study notes made with Parcourse.";
}
