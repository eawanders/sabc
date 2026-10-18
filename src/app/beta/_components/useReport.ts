'use client';
// One outing's report, live: read with the anon key, Realtime on outing_reports, saved through
// /api/live/outing-report with the version the user started editing from. A save sends only the
// fields the user changed; a conflict keeps their draft and says who saved first.
import { useCallback, useEffect, useRef, useState } from 'react';
import { getBrowserClient, subscribeToTable } from '@/lib/live/realtime';
import { saveOutingReport, undoChange } from '@/lib/live/write';
import type { OutingReportRow } from '@/lib/live/types';
import { useIdentity } from './Identity';
import { useToast } from './Toasts';

export const REPORT_FIELDS = [
  { key: 'outingSummary', column: 'outing_summary', label: 'Summarise the outing', placeholder: 'Describe what was covered in this outing session…' },
  { key: 'boatFeel', column: 'boat_feel', label: 'How did the boat feel?', placeholder: 'Comment on the boat balance, timing, power…' },
  { key: 'outingSuccesses', column: 'outing_successes', label: 'What went well?', placeholder: 'Highlight the positive aspects of the session…' },
  { key: 'nextFocus', column: 'next_focus', label: 'What are you going to build on next session?', placeholder: 'Identify areas for improvement and next steps…' },
  { key: 'coachFeedback', column: 'coach_feedback', label: 'Feedback from the coach', placeholder: 'Enter feedback from the coach…' },
] as const;

export type ReportKey = (typeof REPORT_FIELDS)[number]['key'];
export type ReportDraft = Record<ReportKey, string>;

export const REPORT_MAX = 2000; // a Notion rich_text object

export function draftFrom(row: OutingReportRow | null): ReportDraft {
  const d = {} as ReportDraft;
  for (const f of REPORT_FIELDS) d[f.key] = (row?.[f.column] as string | null) ?? '';
  return d;
}

/** Fields that differ from `base`; an emptied field is sent as null. */
export function changedFields(base: ReportDraft, draft: ReportDraft): Partial<Record<ReportKey, string | null>> {
  const out: Partial<Record<ReportKey, string | null>> = {};
  for (const f of REPORT_FIELDS) {
    const next = draft[f.key].trim();
    if (next !== base[f.key].trim()) out[f.key] = next === '' ? null : draft[f.key];
  }
  return out;
}

export type ReportConflict = { by: string | null; current: OutingReportRow | null };

export function useReport(outingId: string) {
  const [row, setRow] = useState<OutingReportRow | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  // The row the draft started from (its version is what a save expects) and the draft itself
  const [base, setBase] = useState<OutingReportRow | null>(null);
  const [draft, setDraft] = useState<ReportDraft>(draftFrom(null));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<ReportConflict | null>(null);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const { requireActor, actorId } = useIdentity();
  const actorRef = useRef(actorId);
  actorRef.current = actorId;
  const toast = useToast();

  const accept = useCallback((next: OutingReportRow | null) => {
    setRow((cur) => (cur && next && cur.version > next.version ? cur : next));
    if (!dirtyRef.current) {
      setBase(next);
      setDraft(draftFrom(next));
    }
  }, []);

  useEffect(() => {
    const client = getBrowserClient();
    if (!client) {
      setLoadState('error');
      return;
    }
    let cancelled = false;
    const off = subscribeToTable<OutingReportRow>(
      'outing_reports',
      (change) => {
        if (change.new) accept(change.new);
      },
      { filter: `outing_id=eq.${outingId}` },
    );
    (async () => {
      const { data, error } = await client.from('outing_reports').select('*').eq('outing_id', outingId).maybeSingle();
      if (cancelled) return;
      if (error) {
        setLoadState('error');
        return;
      }
      accept((data as OutingReportRow | null) ?? null);
      setLoadState('ready');
    })();
    return () => {
      cancelled = true;
      off();
    };
  }, [outingId, accept]);

  const edit = useCallback((key: ReportKey, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
  }, []);

  const discard = useCallback(() => {
    setDirty(false);
    setConflict(null);
    setBase(row);
    setDraft(draftFrom(row));
  }, [row]);

  /**
   * Save the fields this user changed (against the row they started from). `over`: the row a
   * conflict returned, to apply the same edits on top of it ("keep mine"); their other fields stay.
   */
  const save = useCallback(
    async (over?: OutingReportRow | null) => {
      const from = over !== undefined ? over : base;
      const fields = changedFields(draftFrom(base), draft);
      if (Object.keys(fields).length === 0) {
        setDirty(false);
        setConflict(null);
        return;
      }
      const actor = await requireActor();
      if (!actor) return;
      setSaving(true);
      const result = await saveOutingReport({ outingId, fields, actorId: actor, expectedVersion: from?.version ?? 0 });
      setSaving(false);
      if (result.ok) {
        setConflict(null);
        setDirty(false);
        dirtyRef.current = false;
        accept(result.row);
        const changeId = result.changeId;
        toast('Report saved', {
          onUndo: async () => {
            const a = actorRef.current;
            if (!a) return;
            const u = await undoChange({ changeId, actorId: a });
            if (u.ok) {
              accept(u.row as OutingReportRow);
              toast('Report change undone');
            } else if (u.reason === 'conflict') {
              toast(u.message === 'already undone' ? 'Already undone.' : `Can't undo: ${u.updatedByName ?? 'someone'} changed the report since.`, { warn: true });
            } else toast("Couldn't undo. Try again.", { warn: true });
          },
        });
        return;
      }
      if (result.reason === 'conflict') {
        const current = (result.current as OutingReportRow | null) ?? null;
        setRow(current);
        setConflict({ by: result.updatedByName, current });
        toast(`${result.updatedByName ?? 'Someone'} saved the report first. Yours wasn't applied.`, { warn: true });
        return;
      }
      toast(result.message ? `Not saved: ${result.message}` : 'Not saved. Check your connection and try again.', { warn: true });
    },
    [base, draft, outingId, requireActor, toast, accept],
  );

  return {
    row,
    loadState,
    draft,
    dirty,
    saving,
    conflict,
    /** Someone else saved since this draft started (Realtime), before any save was tried. */
    stale: dirty && !conflict && Boolean(row && (row.version ?? 0) !== (base?.version ?? 0)),
    edit,
    discard,
    save,
  };
}
