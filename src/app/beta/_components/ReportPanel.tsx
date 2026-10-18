'use client';
// The outing report, in the crew drawer's Report tab: five fields, read and edit in place.
// ⌘↵ / Ctrl+↵ saves. Conflicts keep the draft and offer "Keep mine" or "Use theirs".
import { REPORT_FIELDS, REPORT_MAX, useReport } from './useReport';

export function ReportPanel({ outingId }: { outingId: string }) {
  const r = useReport(outingId);

  if (r.loadState === 'loading') return <p className="b-note">Loading report…</p>;
  if (r.loadState === 'error') return <p className="b-note">Couldn&apos;t load the report. Check your connection and reopen it.</p>;

  const empty = REPORT_FIELDS.every((f) => !r.draft[f.key].trim());
  const updated = r.row?.updated_at && r.row.version > 0 ? new Date(r.row.updated_at) : null;

  return (
    <form
      className="b-report"
      aria-label="Outing report"
      onSubmit={(e) => {
        e.preventDefault();
        void r.save();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          if (r.dirty && !r.saving) void r.save();
        }
      }}
    >
      {r.conflict && (
        <div className="b-banner warn" role="alert">
          <span>
            {r.conflict.by ?? 'Someone'} saved the report first. Your edits are still here.
          </span>
          <span className="acts">
            <button type="button" className="b-btn" onClick={() => void r.save(r.conflict!.current)} disabled={r.saving}>
              Keep mine
            </button>
            <button type="button" className="b-btn" onClick={r.discard} disabled={r.saving}>
              Use theirs
            </button>
          </span>
        </div>
      )}
      {r.stale && (
        <div className="b-banner" role="status">
          <span>Someone else just saved this report. Saving now will ask what to keep.</span>
          <span className="acts">
            <button type="button" className="b-btn" onClick={r.discard}>
              Load theirs
            </button>
          </span>
        </div>
      )}
      {REPORT_FIELDS.map((f) => (
        <label key={f.key} className="b-field">
          <span className="lb">{f.label}</span>
          <textarea
            rows={3}
            value={r.draft[f.key]}
            placeholder={f.placeholder}
            maxLength={REPORT_MAX}
            onChange={(e) => r.edit(f.key, e.target.value)}
          />
        </label>
      ))}
      <div className="b-report-foot">
        <span className="b-muted">
          {r.dirty ? 'Unsaved changes' : updated ? `Saved ${updated.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/London' })}` : empty ? 'No report yet' : ''}
        </span>
        <span className="sp" />
        {r.dirty && (
          <button type="button" className="b-btn" onClick={r.discard} disabled={r.saving}>
            Discard
          </button>
        )}
        <button type="submit" className="b-btn primary" disabled={!r.dirty || r.saving} title="Save (⌘↵)">
          {r.saving ? 'Saving…' : 'Save report'}
        </button>
      </div>
    </form>
  );
}
