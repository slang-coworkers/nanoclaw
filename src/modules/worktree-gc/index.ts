/**
 * Worktree GC coverage: every agent group whose directory holds work the
 * supervise-issues worktree GC manages carries the GC's hourly task, and the
 * supervisor can see, for every such group, whether the GC is running.
 *
 * The GC itself runs inside each group's own container, as the pre-task gate of
 * a recurring `worktree-gc` task (`container/skills/supervise-issues/scripts/
 * worktree-gc-run.sh`). Which groups had that task used to be a hand-made list:
 * an operator ran `ncl tasks create` once per tier. A group that started cloning
 * later, or that nobody listed, never had its checkouts collected, and the
 * supervisor, which read only the reports that existed, could not tell. Consider
 * prod on 2026-11-17: `main` held 8 `wt-*` trees up to 100 days old,
 * `slang-pr-approver` 8 and `eval-slang-reviewer` 59, and none of them had the
 * task.
 *
 * Coverage is therefore derived from facts on every pass. A group needs the task
 * when its directory holds a top-level `wt-*` entry, a top-level git repository
 * (a base clone or any other checkout) or a non-empty `runs/`: the work
 * `worktree-gc-discover.py` collects. The task's definition has one home,
 * `container/skills/supervise-issues/tasks/worktree-gc.md`; the pass creates a
 * missing series and rewrites one that drifted from it, through the named-series
 * planner template restamping uses. A paused task series is the operator's
 * decision and stays paused. A paused group cannot spawn the container the gate
 * runs in, so it gets no task until it is unpaused.
 *
 * Only the host sees every group directory (the supervisor's container mounts a
 * few), so the pass also writes the fleet's coverage, one status per group, to
 * `data/shared/worktree-gc/coverage.json`, which every container reads at
 * `/workspace/shared/worktree-gc/coverage.json`. The supervisor's step 8
 * escalates the `gaps` it lists, and escalates the file itself once it is past
 * its `stale_after`: then this pass has stopped running.
 *
 * Cost: the host sweep calls this every tick and a pass runs at most once per
 * COVERAGE_INTERVAL_MS. A group whose series this process already verified
 * against the current definition, and whose GC report is fresh, costs a
 * directory listing and two small reads; only the others scan their task
 * sessions.
 */
import crypto from 'crypto';
import path from 'path';

import { AnchoredDir } from '../../anchored-dir.js';
import { DATA_DIR, GROUPS_DIR } from '../../config.js';
import { resolveGroupTimezone } from '../../container-config.js';
import { getAllAgentGroups } from '../../db/agent-groups.js';
import { isValidGroupFolder } from '../../group-folder.js';
import { log } from '../../log.js';
import { prepareTemplateTasks, readTasks, type TemplateTask } from '../../templates/tasks.js';
import type { AgentGroup } from '../../types.js';
import { createScheduledTask } from '../scheduling/create.js';
import { planTaskSeries, updateTaskSeries } from '../scheduling/series.js';

export const WORKTREE_GC_TASK_NAME = 'worktree-gc';
export const WORKTREE_GC_TASKS_DIR = path.join(process.cwd(), 'container', 'skills', 'supervise-issues', 'tasks');
/** The GC's state directory inside a group directory (the container's `/workspace/agent/.worktree-gc`). */
export const GC_STATE_DIR = '.worktree-gc';
export const GC_REPORT_FILE = 'last-run.json';
/** The fleet coverage file, under DATA_DIR (`/workspace/shared/worktree-gc/coverage.json` in a container). */
export const FLEET_COVERAGE_DIR = ['shared', 'worktree-gc'] as const;
export const FLEET_COVERAGE_FILE = 'coverage.json';

export const COVERAGE_INTERVAL_MS = 60 * 60 * 1000;
/** A GC report older than this means the hourly task stopped firing (two missed fires tolerated). */
export const REPORT_STALE_MS = 3 * 60 * 60 * 1000;
/** The fleet file is stale, and this pass has stopped running, once it is older than this. */
export const COVERAGE_STALE_MS = 3 * COVERAGE_INTERVAL_MS;

/** What the pass did to the group's series: wrote it, found it, or left it alone. */
export type CoverageAction = 'created' | 'updated' | 'unchanged' | 'rearming' | 'verified' | 'group-paused';

/**
 * One group's coverage, worst first:
 *   coverage-failed    the pass threw for this group (logged); retried next pass
 *   task-paused        the series is paused, so nothing is collected
 *   not-firing         the series is live but its report is missing or older than REPORT_STALE_MS
 *   errors             the last run listed errors (or its report is unreadable)
 *   first-run-pending  the series was created this pass and has not fired yet
 *   paused             the group is paused: no container runs, so no task until it is unpaused
 *   ok                 the series is live and its report is fresh and clean
 */
export type CoverageStatus =
  'coverage-failed' | 'task-paused' | 'not-firing' | 'errors' | 'first-run-pending' | 'paused' | 'ok';

const GAP_STATUSES: ReadonlySet<CoverageStatus> = new Set(['coverage-failed', 'task-paused', 'not-firing', 'errors']);

export interface GroupCoverage {
  folder: string;
  status: CoverageStatus;
  action: CoverageAction | null;
  series_id: string | null;
  task_status: string | null;
  report_at: string | null;
  report_age_hours: number | null;
  report_errors: number | null;
  report_skipped: number | null;
  free_gb: number | null;
}

export interface FleetCoverage {
  at: string;
  stale_after: string;
  task: string;
  groups: GroupCoverage[];
  /** Folders of `groups` whose status needs the operator. */
  gaps: string[];
  /** Group directories with GC work but no agent group (deleted-group residue, never auto-deleted). */
  residue: string[];
}

interface VerifiedSeries {
  fingerprint: string;
  seriesId: string;
  taskStatus: string;
}

let lastPassAt: number | null = null;
const verified = new Map<string, VerifiedSeries>();

/** Forget pass timing and verified series; tests start each case from a fresh process state. */
export function _resetWorktreeGcCoverageForTesting(): void {
  lastPassAt = null;
  verified.clear();
}

/**
 * The canonical `worktree-gc` task definition, or undefined on an install that
 * does not ship the supervise-issues skill (nothing to enforce there). A
 * malformed definition throws, so a broken edit is loud rather than silently
 * disabling coverage.
 */
export function loadWorktreeGcTask(tasksDir: string = WORKTREE_GC_TASKS_DIR): TemplateTask | undefined {
  return readTasks(tasksDir, 'supervise-issues/tasks').find((task) => task.name === WORKTREE_GC_TASK_NAME);
}

function fingerprintOf(task: TemplateTask): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify([task.schedule, task.script ?? null, task.prompt]))
    .digest('hex');
}

/**
 * Run one filesystem probe inside a directory the container can rewrite at any
 * moment. An entry that vanished, or was swapped for a symlink between two
 * probes, is not this group's checkout on this pass; the next pass sees the
 * settled state, so every such failure answers `fallback`.
 */
function probe<T>(fn: () => T, fallback: T): T {
  /* eslint-disable no-catch-all/no-catch-all -- see the doc comment: a racing entry is skipped this pass, never an error */
  try {
    return fn();
  } catch {
    return fallback;
  }
  /* eslint-enable no-catch-all/no-catch-all */
}

/** Run `fn` on the real directory `name` inside `dir`; `fallback` when it is gone or not a real directory. */
function inSubdir<T>(dir: AnchoredDir, name: string, fallback: T, fn: (sub: AnchoredDir) => T): T {
  const sub = probe(() => dir.openDir(name), null);
  if (!sub) return fallback;
  try {
    return probe(() => fn(sub), fallback);
  } finally {
    sub.close();
  }
}

function isDirectoryEntry(dir: AnchoredDir, name: string): boolean {
  return probe(() => dir.lstat(name).isDirectory(), false);
}

function hasEntry(dir: AnchoredDir, name: string): boolean {
  return probe(() => (dir.lstat(name), true), false);
}

/**
 * Is `name` (a real directory inside `dir`) a git repository: a checkout with a
 * `.git` entry, or a bare repository (`HEAD`, `objects`, `refs`)? The same test
 * as `git_shape` in worktree-gc-discover.py.
 */
function isGitRepository(dir: AnchoredDir, name: string): boolean {
  return inSubdir(
    dir,
    name,
    false,
    (sub) =>
      hasEntry(sub, '.git') ||
      (hasEntry(sub, 'HEAD') && isDirectoryEntry(sub, 'objects') && isDirectoryEntry(sub, 'refs')),
  );
}

/**
 * Does this group directory hold work the worktree GC manages: a top-level
 * `wt-*` directory or file, a top-level git repository (a base clone or any
 * other checkout, bare included), or a non-empty `runs/`? Hidden entries and
 * symlinks never count, as in worktree-gc-discover.py.
 */
export function groupHoldsGcWork(groupDir: string): boolean {
  const dir = probe(() => AnchoredDir.open(groupDir, []), null);
  if (!dir) return false;
  try {
    for (const name of dir.entries()) {
      if (name.startsWith('.')) continue;
      const st = probe(() => dir.lstat(name), null);
      if (!st || st.isSymbolicLink()) continue;
      if (name.startsWith('wt-') && (st.isDirectory() || st.isFile())) return true;
      if (!st.isDirectory()) continue;
      if (
        name === 'runs' ? inSubdir(dir, name, false, (sub) => sub.entries().length > 0) : isGitRepository(dir, name)
      ) {
        return true;
      }
    }
    return false;
  } finally {
    dir.close();
  }
}

interface GcReport {
  ageMs: number;
  at: string | null;
  errors: number | null;
  skipped: number | null;
  freeGb: number | null;
}

/** The group's last GC report (`.worktree-gc/last-run.json`), or null when it has none. */
function readGcReport(groupDir: string, now: number): GcReport | null {
  const state = probe(() => AnchoredDir.open(groupDir, [GC_STATE_DIR]), null);
  if (!state) return null;
  try {
    const st = probe(() => state.lstat(GC_REPORT_FILE), null);
    if (!st?.isFile()) return null;
    const body = probe(
      () => JSON.parse(state.readFile(GC_REPORT_FILE).toString('utf8')) as Record<string, unknown>,
      null,
    );
    const count = (v: unknown): number | null => (Array.isArray(v) ? v.length : null);
    return {
      ageMs: now - st.mtimeMs,
      at: typeof body?.at === 'string' ? body.at : null,
      // An unreadable report counts as one error: the GC wrote something it could not finish.
      errors: body ? count(body.errors) : 1,
      skipped: body ? count(body.skipped) : null,
      freeGb: typeof body?.free_gb_after === 'number' ? body.free_gb_after : null,
    };
  } finally {
    state.close();
  }
}

/**
 * Bring one group's `worktree-gc` series in line with `definition`: create it
 * (pending, so it fires at the next scheduled minute), rewrite it in place when
 * it drifted, or leave it when it matches or is re-arming between runs.
 */
async function ensureWorktreeGcTask(
  group: AgentGroup,
  definition: TemplateTask,
): Promise<{ action: CoverageAction; seriesId: string | null; taskStatus: string | null }> {
  const prepared = prepareTemplateTasks([definition], await resolveGroupTimezone(group.id)).get(definition.name)!;
  const plan = await planTaskSeries(group.id, definition.name, prepared);
  if (plan.action === 'create') {
    const { row } = await createScheduledTask(group.id, prepared, { status: 'pending' });
    log.info('Worktree GC task created', { group: group.folder, seriesId: row.seriesId });
    return { action: 'created', seriesId: row.seriesId ?? row.id, taskStatus: row.status };
  }
  const { match } = plan;
  if (plan.action === 'update') {
    await updateTaskSeries(group.id, match, prepared);
    log.info('Worktree GC task repaired', { group: group.folder, seriesId: match.seriesId });
  }
  return {
    action: plan.action === 'update' ? 'updated' : plan.action,
    seriesId: match.seriesId,
    taskStatus: match.status,
  };
}

function statusOf(
  action: CoverageAction,
  taskStatus: string | null,
  report: GcReport | null,
  groupPaused: boolean,
): CoverageStatus {
  if (groupPaused) return 'paused';
  if (taskStatus === 'paused') return 'task-paused';
  if (action === 'created') return 'first-run-pending';
  if (!report || report.ageMs > REPORT_STALE_MS) return 'not-firing';
  if (report.errors) return 'errors';
  return 'ok';
}

/** Cover one live group; null when its directory holds nothing the GC manages. */
async function coverGroup(
  group: AgentGroup,
  definition: TemplateTask,
  fingerprint: string,
  now: number,
): Promise<GroupCoverage | null> {
  // The directory the container runner mounts as /workspace/agent (container-runner.ts resolves it
  // the same way): a live group's folder is trusted, and `main` is a valid one that the
  // creation grammar in group-folder.ts refuses.
  const groupDir = path.resolve(GROUPS_DIR, group.folder);
  if (!groupHoldsGcWork(groupDir)) return null;
  const report = readGcReport(groupDir, now);
  const groupPaused = group.paused === 1;
  const known = verified.get(group.id);
  let result: { action: CoverageAction; seriesId: string | null; taskStatus: string | null };
  if (groupPaused) {
    result = { action: 'group-paused', seriesId: known?.seriesId ?? null, taskStatus: known?.taskStatus ?? null };
  } else if (known?.fingerprint === fingerprint && report !== null && report.ageMs <= REPORT_STALE_MS) {
    result = { action: 'verified', seriesId: known.seriesId, taskStatus: known.taskStatus };
  } else {
    result = await ensureWorktreeGcTask(group, definition);
    if (result.action === 'rearming' || result.seriesId === null) verified.delete(group.id);
    else verified.set(group.id, { fingerprint, seriesId: result.seriesId, taskStatus: result.taskStatus ?? '' });
  }
  return {
    folder: group.folder,
    status: statusOf(result.action, result.taskStatus, report, groupPaused),
    action: result.action,
    series_id: result.seriesId,
    task_status: result.taskStatus,
    report_at: report?.at ?? null,
    report_age_hours: report ? Math.round((report.ageMs / 3_600_000) * 10) / 10 : null,
    report_errors: report?.errors ?? null,
    report_skipped: report?.skipped ?? null,
    free_gb: report?.freeGb ?? null,
  };
}

/** Group directories under GROUPS_DIR with GC work and no agent group behind them. */
function residueWithGcWork(liveFolders: ReadonlySet<string>): string[] {
  const root = probe(() => AnchoredDir.open(GROUPS_DIR, []), null);
  if (!root) return [];
  let names: string[];
  try {
    names = root.entries();
  } finally {
    root.close();
  }
  return (
    names
      // A reserved name (`templates`, `shared`, `global`) is a system tree, never a group's leftovers.
      .filter((name) => !liveFolders.has(name) && isValidGroupFolder(name, { adminSetup: true }))
      .filter((name) => groupHoldsGcWork(path.join(GROUPS_DIR, name)))
      .sort()
  );
}

/**
 * Write the fleet file under `data/shared/`. The shared directory is created by
 * the install that uses it (its presence is what mounts `/workspace/shared` into
 * containers), so an install without one gets no file rather than a new mount.
 */
function writeFleetCoverage(fleet: FleetCoverage): void {
  const [sharedName, subdir] = FLEET_COVERAGE_DIR;
  const shared = AnchoredDir.open(DATA_DIR, [sharedName]);
  if (!shared) return;
  let dir: AnchoredDir | null = null;
  try {
    dir = shared.openDir(subdir, true);
    dir?.replaceFile(FLEET_COVERAGE_FILE, JSON.stringify(fleet, null, 1) + '\n');
  } finally {
    dir?.close();
    shared.close();
  }
}

/**
 * One coverage pass over every agent group, at most once per
 * COVERAGE_INTERVAL_MS unless `force` is set. Writes and returns the fleet
 * coverage, or returns null when the pass was not due or this install ships no
 * `worktree-gc` definition. A failure in one group is logged, reported as that
 * group's `coverage-failed` status, and retried by the next pass.
 */
export async function reconcileWorktreeGcCoverage(
  opts: { now?: number; force?: boolean; tasksDir?: string } = {},
): Promise<FleetCoverage | null> {
  const now = opts.now ?? Date.now();
  if (!opts.force && lastPassAt !== null && now - lastPassAt < COVERAGE_INTERVAL_MS) return null;
  lastPassAt = now;

  const definition = loadWorktreeGcTask(opts.tasksDir);
  if (!definition) return null;
  const fingerprint = fingerprintOf(definition);

  const groups: GroupCoverage[] = [];
  const all = await getAllAgentGroups();
  for (const group of all) {
    /* eslint-disable no-catch-all/no-catch-all -- one group's broken directory or mailbox must not stop coverage of the others; it is reported and retried next pass */
    try {
      const coverage = await coverGroup(group, definition, fingerprint, now);
      if (coverage) groups.push(coverage);
    } catch (err) {
      verified.delete(group.id);
      log.error('Worktree GC coverage failed for a group', { group: group.folder, err });
      groups.push({
        folder: group.folder,
        status: 'coverage-failed',
        action: null,
        series_id: null,
        task_status: null,
        report_at: null,
        report_age_hours: null,
        report_errors: null,
        report_skipped: null,
        free_gb: null,
      });
    }
    /* eslint-enable no-catch-all/no-catch-all */
  }

  const fleet: FleetCoverage = {
    at: new Date(now).toISOString(),
    stale_after: new Date(now + COVERAGE_STALE_MS).toISOString(),
    task: WORKTREE_GC_TASK_NAME,
    groups,
    gaps: groups.filter((g) => GAP_STATUSES.has(g.status)).map((g) => g.folder),
    residue: residueWithGcWork(new Set(all.map((g) => g.folder))),
  };
  writeFleetCoverage(fleet);
  if (fleet.gaps.length > 0) log.warn('Worktree GC coverage gaps', { gaps: fleet.gaps });
  return fleet;
}
