import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import SourceCredit from "../components/SourceCredit";
import { toast, useLoadingToast } from "../components/Toast";
import { apiFetch, errMsg } from "../lib/api";
import { useAuth } from "../lib/auth";
import { POLL_MS, buildCheatsheet, fileNameOf, watchUrl } from "../lib/cheatsheet";
import type { Cheatsheet } from "../lib/cheatsheet";
import { useCopyCredit } from "../lib/copyCredit";
import { creditOf } from "../lib/credit";

export default function CheatsheetScreen() {
  const { courseId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<Cheatsheet | null>(null);
  const [saving, setSaving] = useState<"pdf" | "png" | null>(null);
  const timer = useRef<number | null>(null);

  const credit = sheet
    ? creditOf({
        video_id: sheet.videoId,
        video_title: sheet.title,
        channel: sheet.channel,
        channel_url: sheet.channelUrl,
      })
    : null;

  useCopyCredit(credit);

  useEffect(() => {
    if (!courseId) return;
    let ignore = false;

    function load() {
      apiFetch(`/courses/${courseId}/cheatsheet`, token)
        .then((data) => {
          if (ignore) return;
          const next = buildCheatsheet(data);
          setSheet(next);
          if (next.status === "pending") timer.current = window.setTimeout(load, POLL_MS);
        })
        .catch((err) => {
          if (ignore) return;
          toast(errMsg(err), "error");
          navigate("/notebook", { replace: true });
        });
    }

    load();
    return () => {
      ignore = true;
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [courseId, token, navigate]);

  useLoadingToast(!sheet, "Loading your cheatsheet…");

  async function save(kind: "pdf" | "png") {
    if (!sheet || sheet.status !== "ready" || saving) return;
    setSaving(kind);
    try {
      const { cheatsheetSource } = await import("../lib/cheatsheetMarkup");
      const source = cheatsheetSource(sheet);
      if (kind === "pdf") {
        const { sheetPdf } = await import("../lib/sheetPdf");
        await sheetPdf(source, fileNameOf(sheet, "pdf"));
      } else {
        const { sheetPng } = await import("../lib/sheetImage");
        await sheetPng(source, fileNameOf(sheet, "png"));
      }
    } catch {
      toast(`Couldn't build the ${kind.toUpperCase()}. Try again.`, "error");
    } finally {
      setSaving(null);
    }
  }

  const ready = sheet?.status === "ready";
  const failed = sheet?.status === "failed";

  return (
    <div className="cheatsheet-view" data-credit-scope>
      <div className="page-header cheatsheet-head">
        <div className="cheatsheet-head-text">
          <h1 className="page-header-title">Cheatsheet</h1>
          <p className="page-header-sub">Everything worth remembering, on one page.</p>
          {credit && <SourceCredit credit={credit} />}
        </div>
        <div className="cheatsheet-actions">
          <button className="button secondary" onClick={() => save("png")} disabled={!ready || saving !== null}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
            </svg>
            {saving === "png" ? "Drawing…" : "PNG"}
          </button>
          <button className="button secondary" onClick={() => save("pdf")} disabled={!ready || saving !== null}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {saving === "pdf" ? "Building…" : "PDF"}
          </button>
        </div>
      </div>


      {sheet?.status === "pending" && (
        <div className="card cheatsheet-waiting">
          <span className="gen-pill-spinner" />
          <div>
            <h2 className="cheatsheet-waiting-title">Writing your cheatsheet</h2>
            <p className="cheatsheet-waiting-body">
              Going back over the video for the points worth keeping. This page will fill in on its own.
            </p>
          </div>
        </div>
      )}

      {failed && (
        <div className="card cheatsheet-waiting">
          <div>
            <h2 className="cheatsheet-waiting-title">That didn't work</h2>
            <p className="cheatsheet-waiting-body">
              The cheatsheet couldn't be written. Reload this page to try again.
            </p>
          </div>
        </div>
      )}

      {ready && (
        <div className="card cheatsheet-sheet">
          {sheet.sections.map((section) => (
            <section className="cheatsheet-section" key={section.number}>
              <div className="cheatsheet-section-head">
                <span className="cheatsheet-num">{section.number}</span>
                <h2 className="cheatsheet-section-title">{section.title}</h2>
                <a
                  className="cheatsheet-stamp"
                  href={watchUrl(sheet.videoId, section.startSeconds)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {section.stamp}
                </a>
              </div>
              {section.points.length > 0 && (
                <ul className="cheatsheet-points">
                  {section.points.map((point, idx) => (
                    <li key={idx}>{point}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      <Link className="attempt-row attempt-back card" to={`/course/${courseId}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
        </svg>
        Back to the course
      </Link>
    </div>
  );
}
