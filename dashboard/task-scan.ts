/**
 * Scheduled-task scan: the pending and paused tasks in each session's
 * inbound.db (`messages_in` rows with kind 'task'), summarized per agent group.
 *
 * The per-group summary feeds the coworker state (task count, every 5 s) and the
 * /api/overview landing panel. Building it walks every session directory of every
 * group and opens each changed inbound.db. On the main thread that held the
 * event loop for seconds after each restart, because one group with thousands of
 * sessions was a single synchronous chunk. The periodic refresh runs in
 * summary-worker.ts; the routes that list or export tasks on request still read
 * through a TaskScanner on the main thread.
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { isMissingSchemaError } from './session-db-errors.js';

/** One pending/paused scheduled task row, as surfaced to the dashboard. */
export interface ScheduledTaskRow {
  origId: string;
  sessionId: string;
  recurrence: string | null;
  processAfter: string | null;
  content: string;
  status: string;
}

export interface GroupTaskSummary {
  tasks: ScheduledTaskRow[];
  active: number;
  paused: number;
  completed: number;
  // When this group's summary was last (re)published.
  refreshedAt: number;
}

/** Work done by one refresh, published to /api/debug. */
export interface TaskPassPhases {
  groups: number;
  sessions: number;
  opens: number;
  readErrors: number;
  totalMs: number;
}

export function summarizeGroupTasks(tasks: ScheduledTaskRow[]): GroupTaskSummary {
  let active = 0;
  let paused = 0;
  let completed = 0;
  for (const t of tasks) {
    const st = t.status === 'pending' ? 'active' : t.status;
    if (st === 'active') active++;
    else if (st === 'paused') paused++;
    else if (st === 'completed') completed++;
  }
  return { tasks, active, paused, completed, refreshedAt: Date.now() };
}

/** The session ids (`sess-*` directories) under one group's session directory. */
export function listSessionIds(dataDir: string, agentGroupId: string): string[] {
  const agDir = join(dataDir, 'v2-sessions', agentGroupId);
  let entries: string[];
  try {
    entries = readdirSync(agDir);
  } catch {
    return [];
  }
  const ids: string[] = [];
  for (const entry of entries) {
    if (!entry.startsWith('sess-')) continue;
    try {
      if (statSync(join(agDir, entry)).isDirectory()) ids.push(entry);
    } catch {
      /* removed between readdir and stat */
    }
  }
  return ids;
}

/**
 * Reads tasks with a per-file cache, and keeps the per-group summaries of the
 * periodic refresh.
 */
export class TaskScanner {
  /** The summary per agent group id, from the last clean read of each group. */
  readonly groups = new Map<string, GroupTaskSummary>();
  // mtime-keyed cache of the pending/paused task rows in each session's inbound.db.
  // A scheduled task only changes when the host writes messages_in (create / pause
  // / resume / delete), which bumps the file's mtime; an idle session's inbound.db
  // is therefore a cheap stat rather than a sqlite open on every scan. Correctness
  // is mtime-exact: a task mutation changes the file, so the very next scan
  // re-reads it (no stale window past the mutating write).
  private perFile = new Map<string, { mtimeMs: number; tasks: ScheduledTaskRow[] }>();
  private opens = 0;
  private readErrors = 0;

  /** Read the pending/paused tasks from one session's inbound.db, mtime-gated:
   *  reuse the cached rows when the file is unchanged since the last scan, so only
   *  sessions whose task set actually moved pay a sqlite open. Tri-state: `ok:false`
   *  means the DB open/query failed (transient lock / I/O). Callers building a
   *  cached aggregate must NOT publish a `!ok` result, else a momentary lock gets
   *  memoized as a group-wide undercount. A genuinely absent file, or one whose
   *  schema has no task columns yet, is `ok:true` with no tasks. Only clean reads
   *  are cached; a failed read is retried next scan. */
  sessionTasks(dbPath: string, sessionId: string): { ok: boolean; tasks: ScheduledTaskRow[] } {
    let mtimeMs: number;
    try {
      mtimeMs = statSync(dbPath).mtimeMs; // throws if the file doesn't exist
    } catch {
      this.perFile.delete(dbPath);
      return { ok: true, tasks: [] }; // no inbound.db → genuinely no tasks
    }
    const cached = this.perFile.get(dbPath);
    if (cached && cached.mtimeMs === mtimeMs) return { ok: true, tasks: cached.tasks };
    let sdb: Database.Database | null = null;
    try {
      this.opens += 1;
      sdb = new Database(dbPath, { readonly: true });
      sdb.pragma('busy_timeout = 3000');
      const rows = sdb
        .prepare(
          "SELECT id, recurrence, process_after, content, status FROM messages_in WHERE kind = 'task' AND status IN ('pending', 'paused')",
        )
        .all() as any[];
      const tasks: ScheduledTaskRow[] = rows.map((r) => ({
        origId: r.id,
        sessionId,
        recurrence: r.recurrence || null,
        processAfter: r.process_after || null,
        content: r.content,
        status: r.status,
      }));
      this.perFile.set(dbPath, { mtimeMs, tasks }); // cache only on a clean read
      return { ok: true, tasks };
    } catch (e) {
      if (isMissingSchemaError(e)) {
        this.perFile.set(dbPath, { mtimeMs, tasks: [] });
        return { ok: true, tasks: [] };
      }
      this.readErrors += 1;
      return { ok: false, tasks: [] }; // corrupt/locked — don't cache; next scan retries
    } finally {
      try {
        sdb?.close();
      } catch {
        /* */
      }
    }
  }

  /** Scan a group's sessions for scheduled tasks. Tri-state: `ok:false` if ANY
   *  constituent session read failed, so the caller can decline to publish a
   *  possibly-undercounted aggregate (a transient lock must not poison it). */
  groupTasks(dataDir: string, agentGroupId: string, sessionIds: string[]): { ok: boolean; tasks: ScheduledTaskRow[] } {
    const tasks: ScheduledTaskRow[] = [];
    let ok = true;
    for (const sessId of sessionIds) {
      const dbPath = join(dataDir, 'v2-sessions', agentGroupId, sessId, 'inbound.db');
      const r = this.sessionTasks(dbPath, sessId);
      if (!r.ok) ok = false;
      for (const t of r.tasks) tasks.push(t);
    }
    return { ok, tasks };
  }

  /**
   * Refresh `groups` for every agent group. A group whose scan hit a transient
   * read error keeps its previous summary and is retried next refresh; deleted
   * groups are dropped.
   */
  refresh(central: Database.Database, dataDir: string): TaskPassPhases {
    const startedAt = Date.now();
    this.opens = 0;
    this.readErrors = 0;
    const groups = central.prepare('SELECT id FROM agent_groups').all() as { id: string }[];
    const liveGroupIds = new Set<string>();
    const livePaths = new Set<string>();
    let sessions = 0;
    for (const g of groups) {
      liveGroupIds.add(g.id);
      const sessionIds = listSessionIds(dataDir, g.id);
      sessions += sessionIds.length;
      for (const sid of sessionIds) livePaths.add(join(dataDir, 'v2-sessions', g.id, sid, 'inbound.db'));
      const scan = this.groupTasks(dataDir, g.id, sessionIds);
      // Publish a clean read only; a partial retains the previous summary.
      if (scan.ok) this.groups.set(g.id, summarizeGroupTasks(scan.tasks));
    }
    for (const id of this.groups.keys()) if (!liveGroupIds.has(id)) this.groups.delete(id);
    // Drop per-file cache entries for sessions that no longer exist.
    if (this.perFile.size > livePaths.size * 2 + 1000) {
      for (const k of this.perFile.keys()) if (!livePaths.has(k)) this.perFile.delete(k);
    }
    return {
      groups: groups.length,
      sessions,
      opens: this.opens,
      readErrors: this.readErrors,
      totalMs: Date.now() - startedAt,
    };
  }
}
