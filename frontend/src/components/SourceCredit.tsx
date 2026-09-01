import type { Credit } from "../lib/credit";

const YOUTUBE_MARK = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M23 12s0-3.9-.5-5.8a3 3 0 0 0-2.1-2.1C18.5 3.6 12 3.6 12 3.6s-6.5 0-8.4.5a3 3 0 0 0-2.1 2.1C1 8.1 1 12 1 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 8.4.5 8.4.5s6.5 0 8.4-.5a3 3 0 0 0 2.1-2.1C23 15.9 23 12 23 12zM9.9 15.4V8.6l5.8 3.4z" />
  </svg>
);

export default function SourceCredit({ credit }: { credit: Credit }) {
  if (!credit.url) return null;
  return (
    <div className="source-credit">
      <a className="source-chip" href={credit.url} target="_blank" rel="noreferrer noopener">
        {YOUTUBE_MARK}
        {credit.name}
      </a>
      {credit.title && <span className="source-credit-note">{credit.title}</span>}
    </div>
  );
}
