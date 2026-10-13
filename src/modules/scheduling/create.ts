import { randomUUID } from 'crypto';
import { CronExpressionParser } from 'cron-parser';

import { TIMEZONE } from '../../config.js';
import type { TaskRecord } from '../../mailbox/index.js';
import { resolveTaskSession, withMailboxSession } from '../../session-manager.js';
import { parseZonedToUtc } from '../../timezone.js';

export const MAX_DAILY_FIRES = 4;

const RECURRENCE_LIMIT_WARNING =
  'Warning: this task has not been scheduled. Frequent running tasks consume the ' +
  "user's subscription quota or unnecessarily use tokens and can cause the user's " +
  'account to be banned. Instead, use a pre-task run script that you write that can ' +
  'check some kind of external condition, usually via one or more API calls. The ' +
  'script returns a decision programmatically whether the task needs to be run now ' +
  'or not. For example, an API call to GitHub to check if there are open PRs, and ' +
  'only run when there are new open PRs.\n' +
  'Run `ncl tasks create --help` to get full directions on how to write a script and test it.\n\n' +
  'Note: if and only if you explicitly need to schedule a task more frequently and ' +
  "you've verified with the user that they understand and that this is what they " +
  'want and based on your judgment you agree that this is the right thing to do in ' +
  'this situation, you can override this with --dangerously-override-recurrence-limit';

export interface PreparedScheduledTask {
  name?: string;
  prompt: string;
  recurrence: string | null;
  script: string | null;
  processAfter: string;
}

export type ScheduledTaskRow = TaskRecord;

/**
 * The deterministic slug half of a task id. Exposed so template restamping can
 * find the live series a named task produced (`<slug>-<4hex>`).
 */
export function taskNameSlug(name: unknown): string {
  if (typeof name !== 'string') return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
    .replace(/-+$/g, '');
}

/**
 * Short, readable, filesystem/thread-safe task id. With a name → `<slug>-<4hex>`;
 * without one → `t-<6hex>`. Always matches /^[a-z0-9-]+$/ so it is safe as a
 * thread suffix, filename, and copy-pasteable CLI argument.
 */
export function makeTaskId(name: unknown): string {
  const hex = (n: number): string => randomUUID().replace(/-/g, '').slice(0, n);
  const slug = taskNameSlug(name);
  return slug ? `${slug}-${hex(4)}` : `t-${hex(6)}`;
}

export function parseProcessAfter(value: unknown, tz: string = TIMEZONE): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error('--process-after is required');
  const date = parseZonedToUtc(value, tz);
  if (Number.isNaN(date.getTime())) throw new Error(`invalid --process-after: ${value}`);
  return date.toISOString();
}

export function validateRecurrence(value: string | null | undefined, tz: string = TIMEZONE): void {
  if (!value) return;
  try {
    CronExpressionParser.parse(value, { tz });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`invalid --recurrence: ${msg}`, { cause: err });
  }
}

export function enforceRecurrenceLimit(
  recurrence: string | null,
  override: boolean,
  hasScript: boolean,
  tz: string = TIMEZONE,
): void {
  // A gate script is the sanctioned mitigation: a skipped fire costs no agent
  // tokens, so scripted tasks may poll faster without the explicit override.
  if (!recurrence || override || hasScript) return;
  const horizon = Date.now() + 24 * 60 * 60 * 1000;
  const interval = CronExpressionParser.parse(recurrence, { tz });
  let fires = 0;
  while (fires <= MAX_DAILY_FIRES) {
    const next = interval.next();
    if (next.getTime() > horizon) break;
    fires++;
  }
  if (fires > MAX_DAILY_FIRES) throw new Error(RECURRENCE_LIMIT_WARNING);
}

/**
 * A recurring task that watches ONE issue or PR. Recognized by a name that is an
 * issue handle (`i13435-maintainer-gate`, `pr12200-verdict-guard`, `watch-13261-dep`,
 * `dispatch-13472-after-131`) or by a prompt whose opening mentions exactly one
 * `#NNNN` and no other issue number.
 */
const PER_ISSUE_NAME = /^(i|issue|pr|gh|recheck|watch|dispatch)[-_]?\d{3,6}/i;
const ISSUE_REF = /#(\d{3,6})\b/g;
const PROMPT_SCAN_CHARS = 200;

/**
 * The name half of a series id: `makeTaskId` appends `-<4hex>` to the slug, and
 * four hex digits can all be decimal (`watch-1234`), which would read as an issue
 * handle. Stripping the suffix recovers the slug for the per-issue check on update.
 */
export function taskNameFromSeriesId(seriesId: string): string {
  return seriesId.replace(/-[0-9a-f]{4}$/, '');
}

export function targetsSingleIssue(name: string | undefined, prompt: string): boolean {
  if (name && PER_ISSUE_NAME.test(name)) return true;
  const refs = new Set<string>();
  for (const m of prompt.slice(0, PROMPT_SCAN_CHARS).matchAll(ISSUE_REF)) refs.add(m[1]);
  return refs.size === 1;
}

/**
 * Refuse an agent-created recurrence that targets a single issue/PR. GitHub
 * webhooks already deliver `issues` / `issue_comment` / `pull_request` events to
 * the install, and a per-issue cron never self-cancels: it wakes a fresh container
 * on every fire until someone deletes it. The host CLI (an operator) is not
 * restricted — the check is only applied to agent callers.
 */
export function rejectPerIssueRecurrence(name: string | undefined, prompt: string, recurrence: string | null): void {
  if (!recurrence || !targetsSingleIssue(name, prompt)) return;
  throw new Error(
    'Refusing a recurring task that targets a single issue/PR (the name or prompt names exactly one #NNNN). ' +
      "A per-issue cron never self-cancels; webhooks already deliver that issue's events. " +
      'For a one-time future check use --process-after <ISO timestamp> (no --recurrence); ' +
      'for a chain parked on a human, record a parked-chain entry that the daily re-chase tick reads.',
  );
}

/**
 * Upper bound on an agent-supplied `--script`. The script text is copied into every
 * occurrence row of the series, so a large program stored inline is duplicated on
 * each fire; a program belongs in a file under the group workspace that the script
 * execs. Host callers are not bound by this limit.
 */
export const MAX_AGENT_SCRIPT_BYTES = 8 * 1024;

export function rejectOversizeAgentScript(script: string | null): void {
  if (script === null) return;
  const bytes = Buffer.byteLength(script, 'utf8');
  if (bytes <= MAX_AGENT_SCRIPT_BYTES) return;
  throw new Error(
    `--script is ${bytes} bytes; an agent-created script may be at most ${MAX_AGENT_SCRIPT_BYTES} bytes. ` +
      'Save the program under /workspace/agent/ and make the script exec it, e.g. ' +
      "--script 'exec bash /workspace/agent/gates/<name>.sh'.",
  );
}

/**
 * Validate task semantics and derive its first run without writing anything.
 * `timezone` grounds wall-clock interpretation (cron grid, naive
 * --process-after) — pass the owning group's effective timezone
 * (`resolveGroupTimezone`); it defaults to the install-global one.
 */
export function prepareScheduledTask(input: {
  name?: string;
  prompt: string;
  recurrence?: string | null;
  processAfter?: string;
  script?: string | null;
  dangerouslyOverrideRecurrenceLimit?: boolean;
  timezone?: string;
}): PreparedScheduledTask {
  if (!input.prompt) throw new Error('--prompt is required');
  const recurrence = input.recurrence ?? null;
  const script = input.script ?? null;
  const tz = input.timezone ?? TIMEZONE;
  validateRecurrence(recurrence, tz);
  enforceRecurrenceLimit(recurrence, input.dangerouslyOverrideRecurrenceLimit === true, script !== null, tz);

  let processAfter: string;
  if (input.processAfter === undefined && recurrence) {
    const next = CronExpressionParser.parse(recurrence, { tz }).next().toISOString();
    if (!next) throw new Error(`--recurrence has no upcoming run: ${recurrence}`);
    processAfter = next;
  } else {
    processAfter = parseProcessAfter(input.processAfter, tz);
  }

  return { name: input.name, prompt: input.prompt, recurrence, script, processAfter };
}

/** Persist a prepared task through NanoClaw's single task/session representation. */
export async function createScheduledTask(
  agentGroupId: string,
  task: PreparedScheduledTask,
  options?: { status?: 'pending' | 'paused'; originSessionId?: string | null },
): Promise<{ session: { id: string; agent_group_id: string }; row: ScheduledTaskRow }> {
  const id = makeTaskId(task.name);
  const { session } = await resolveTaskSession(agentGroupId, id);

  const row = await withMailboxSession(agentGroupId, session.id, async (db) => {
    await db.insertTask({
      id,
      seriesId: id,
      processAfter: task.processAfter,
      recurrence: task.recurrence,
      content: JSON.stringify({
        prompt: task.prompt,
        script: task.script,
        originSessionId: options?.originSessionId ?? null,
      }),
      status: options?.status ?? 'pending',
    });
    const stored = db.getTask(id);
    if (!stored) throw new Error(`task row not found after insert: ${id}`);
    return stored;
  });

  return { session: { id: session.id, agent_group_id: session.agent_group_id }, row };
}
