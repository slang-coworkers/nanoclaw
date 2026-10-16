/**
 * Move a task series out of a shared session into its own `system:tasks:<series>`
 * lane.
 *
 * Every task created through `createScheduledTask` already gets its own session.
 * Series armed before that (legacy rows in a group's chat session, or in the old
 * shared `system:tasks` thread) keep re-arming in place forever, because
 * `handleRecurrence` clones the next occurrence into the mailbox it came from.
 * Such a series shares a lane with chat and with every other task there: a long
 * run delays everything queued behind it, and a task that comes due during an
 * open turn is folded into it as a follow-up.
 *
 * The move spans two mailboxes, so it is ordered to fail safe and to be re-runnable:
 *   1. hold   — pause the series' live rows in the source (one transaction; refused
 *               while an occurrence is running or awaiting re-arm, see holdTaskSeries).
 *   2. copy   — insert the rows, with their pre-hold status, into the target lane.
 *               Skipped when the target already holds the series (a re-run after a
 *               crash between steps 2 and 3).
 *   3. retire — cancel the held rows in the source (cancel clears recurrence, so the
 *               source can never re-arm the series again).
 * A crash after 1 leaves the series paused in the source (no double fire); re-running
 * the move copies it as paused, and `ncl tasks resume` revives it. If step 2 throws,
 * the hold is released and the series keeps running where it was.
 *
 * Series id, prompt, script, schedule and the run log (`tasks/<series>.md`, keyed by
 * series) carry over; completed-run history stays in the source mailbox.
 */
import { getSession, taskThreadId } from '../../db/sessions.js';
import type { HeldTaskRow } from '../../mailbox/index.js';
import { log } from '../../log.js';
import { resolveTaskSession, withExistingMailboxSession, withMailboxSession } from '../../session-manager.js';

export interface IsolateResult {
  series_id: string;
  from_session_id: string;
  to_session_id: string;
  /** Rows copied into the target lane (0 when a previous run already copied them). */
  moved: number;
  /** Status of each moved row in its new lane. */
  statuses: Array<'pending' | 'paused'>;
}

/** Same charset the run log and thread suffix accept. */
const SERIES_ID = /^[a-z0-9-]+$/;

export async function isolateTaskSeries(
  agentGroupId: string,
  sourceSessionId: string,
  seriesId: string,
): Promise<IsolateResult> {
  if (!SERIES_ID.test(seriesId)) throw new Error(`invalid task id: ${seriesId}`);
  const source = await getSession(sourceSessionId);
  if (!source || source.agent_group_id !== agentGroupId) throw new Error(`session not found: ${sourceSessionId}`);
  if (source.thread_id === taskThreadId(seriesId)) {
    throw new Error(`task ${seriesId} already runs in its own session (${sourceSessionId})`);
  }

  const held = await withExistingMailboxSession(agentGroupId, sourceSessionId, (db) => db.holdTaskSeries(seriesId));
  if (!held) throw new Error(`session has no mailbox: ${sourceSessionId}`);
  if (held.inFlight) {
    throw new Error(
      `task ${seriesId} is running or awaiting its next re-arm in ${sourceSessionId}; retry after the current run finishes`,
    );
  }
  if (held.rows.length === 0) throw new Error(`no live task matched: ${seriesId}`);
  const rows: HeldTaskRow[] = held.rows;

  let target: { id: string };
  let moved = 0;
  try {
    ({ session: target } = await resolveTaskSession(agentGroupId, seriesId));
    moved = await withMailboxSession(agentGroupId, target.id, async (db) => {
      if (db.getTask(seriesId)) return 0;
      for (const row of rows) {
        await db.insertTask({
          id: row.id,
          seriesId: row.seriesId,
          processAfter: row.processAfter,
          recurrence: row.recurrence,
          content: row.content,
          status: row.status,
        });
      }
      return rows.length;
    });
  } catch (err) {
    const pendingIds = rows.filter((r) => r.status === 'pending').map((r) => r.id);
    await withExistingMailboxSession(agentGroupId, sourceSessionId, (db) => db.releaseHeldTaskRows(pendingIds));
    throw err;
  }

  await withExistingMailboxSession(agentGroupId, sourceSessionId, (db) => db.cancelTask(seriesId));
  log.info('Task series isolated into its own session', {
    agentGroupId,
    seriesId,
    from: sourceSessionId,
    to: target.id,
    moved,
  });
  return {
    series_id: seriesId,
    from_session_id: sourceSessionId,
    to_session_id: target.id,
    moved,
    statuses: rows.map((r) => r.status),
  };
}
