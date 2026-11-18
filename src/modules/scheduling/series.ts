/**
 * Named task series: find the live series a named task produced, and decide how
 * to bring it in line with a desired definition.
 *
 * Two callers keep a named task in a group matching a definition they own:
 * template restamping (`src/templates/restamp.ts`) and the worktree GC coverage
 * reconciler (`src/modules/worktree-gc/index.ts`). Both match a series by the
 * slug its id embeds, treat a dead series as history, refuse to write through a
 * series that is between a run and its re-arm, and update a live one in place so
 * its status (an operator's pause) and run history carry over. This module holds
 * that rule once.
 */
import { findTaskSessions } from '../../db/sessions.js';
import { withExistingMailboxSession } from '../../session-manager.js';
import { taskNameSlug, type PreparedScheduledTask } from './create.js';
import { parseTaskContent } from './task-content.js';

export interface TaskSeriesMatch {
  sessionId: string;
  seriesId: string;
  /** A pending/paused row exists — the series can be updated in place. */
  live: boolean;
  status: string;
  recurrence: string | null;
  prompt: string;
  script: string | null;
}

/**
 * Find the task series a named task produced. Task rows don't store the name —
 * the id embeds its slug as `<slug>-<4hex>`, so match that shape across the
 * group's task sessions. Oldest session first: the first series predates any
 * same-named task created later, so a user's own task never shadows it. Rows
 * match in ANY state — a recurring series between a run completing and the
 * sweep re-arming it (≤60s) has only completed rows but is still alive.
 */
export async function findTaskSeriesBySlug(agentGroupId: string, slug: string): Promise<TaskSeriesMatch | undefined> {
  if (!slug) return undefined;
  for (const session of [...(await findTaskSessions(agentGroupId))].reverse()) {
    const row = await withExistingMailboxSession(agentGroupId, session.id, (mailbox) =>
      mailbox.findTaskBySeriesSlug(slug),
    );
    if (!row?.seriesId) continue;
    const content = parseTaskContent(row.content);
    return {
      sessionId: session.id,
      seriesId: row.seriesId,
      live: row.status === 'pending' || row.status === 'paused',
      status: row.status,
      recurrence: row.recurrence,
      prompt: content.prompt,
      script: content.script,
    };
  }
  return undefined;
}

/**
 * What it takes to make a group's named task match `prepared`:
 *
 *   create     no series, or only a dead one (no live row and no recurrence to
 *              re-arm), which is history rather than a task;
 *   rearming   a recurring series whose last occurrence completed and whose next
 *              one the sweep has not armed yet. Writing then would rewrite the
 *              history rows of what actually ran, so the caller retries later;
 *   unchanged  a live series whose prompt, script and recurrence already match;
 *   update     a live series that differs; `updateTaskSeries` rewrites it in place.
 */
export type TaskSeriesPlan =
  { action: 'create' } | { action: 'rearming' | 'unchanged' | 'update'; match: TaskSeriesMatch };

export async function planTaskSeries(
  agentGroupId: string,
  name: string,
  prepared: PreparedScheduledTask,
): Promise<TaskSeriesPlan> {
  const match = await findTaskSeriesBySlug(agentGroupId, taskNameSlug(name));
  if (match === undefined || (!match.live && match.recurrence === null)) return { action: 'create' };
  if (!match.live) return { action: 'rearming', match };
  const changed =
    match.prompt !== prepared.prompt || match.script !== prepared.script || match.recurrence !== prepared.recurrence;
  return { action: changed ? 'update' : 'unchanged', match };
}

/**
 * Rewrite a live series' prompt, script and (when it changed) recurrence in
 * place. The status is left alone: a pause is the operator's decision.
 */
export async function updateTaskSeries(
  agentGroupId: string,
  match: TaskSeriesMatch,
  prepared: PreparedScheduledTask,
): Promise<void> {
  await withExistingMailboxSession(agentGroupId, match.sessionId, (mailbox) =>
    mailbox.updateTask(match.seriesId, {
      prompt: prepared.prompt,
      script: prepared.script,
      ...(match.recurrence !== prepared.recurrence
        ? { recurrence: prepared.recurrence, processAfter: prepared.processAfter }
        : {}),
    }),
  );
}
