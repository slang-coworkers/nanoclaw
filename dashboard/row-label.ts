/**
 * Row label for a session's thread_id.
 *
 * Hermes gap-matrix sessions (docs/hermes-port) all carry
 * `thread_id = "hermes-<ROW>"` (e.g. `hermes-LOOP-F35`), one thread per row
 * shared by every role on it. The dashboard shows the bare row id as a title
 * prefix so the session list / filter / lane header read by row, not by slug.
 *
 * Pure: no DB, no I/O. Returns null for anything that is not a hermes row
 * thread (other adapters' thread ids, gh-issue-* chains, null threads).
 */
export function rowLabelForThread(threadId: string | null | undefined): string | null {
  if (typeof threadId !== 'string') return null;
  const m = /^hermes-(.+)$/.exec(threadId);
  return m ? m[1] : null;
}
