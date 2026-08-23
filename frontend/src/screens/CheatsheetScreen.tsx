import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { toast } from "../components/Toast";
import { apiFetch, errMsg } from "../lib/api";
import { useAuth } from "../lib/auth";
import { buildCheatsheet, watchUrl } from "../lib/cheatsheet";
import type { Cheatsheet } from "../lib/cheatsheet";

export default function CheatsheetScreen() {
  const { courseId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<Cheatsheet | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!courseId) return;
    let ignore = false;
    apiFetch(`/courses/${courseId}`, token)
      .then((course) => {
        if (!ignore) setSheet(buildCheatsheet(course));
      })
      .catch((err) => {
        if (ignore) return;
        toast(errMsg(err), "error");
        navigate("/notebook", { replace: true });
      });
    return () => {
      ignore = true;
    };
  }, [courseId, token, navigate]);

  async function savePdf() {
    if (!sheet) return;
    setSaving(true);
    try {
      const { cheatsheetPdf } = await import("../lib/cheatsheetPdf");
      cheatsheetPdf(sheet);
    } catch {
      toast("Couldn't build the PDF. Try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="cheatsheet-view">
      <div className="page-header cheatsheet-head">
        <div className="cheatsheet-head-text">
          <h1 className="page-header-title">Cheatsheet</h1>
          <p className="page-header-sub">{sheet ? sheet.title : "One page per section, ready for a refresher."}</p>
        </div>
        <div className="cheatsheet-actions">
          <button className="button secondary" onClick={savePdf} disabled={!sheet || saving}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {saving ? "Building PDF…" : "Save as PDF"}
          </button>
        </div>
      </div>

      {!sheet && <p className="status-message">Loading your cheatsheet…</p>}

      {sheet && (
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
              <p className="cheatsheet-summary">{section.summary}</p>
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
