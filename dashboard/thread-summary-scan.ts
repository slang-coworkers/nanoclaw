/**
 * Thread-summary scan: for every active per-thread session, how many messages
 * its inbound.db and outbound.db hold for its thread, and the newest of their
 * timestamps. /api/messages folds these into the main view's `threadSummaries`
 * (the "↳ N replies" stubs under parent messages).
 *
 * The request handler used to open both DBs of every per-thread session of the
 * group on each main-view call. For a coworker with 2,200 threads that was about
 * 4,400 opens with the event loop held for 2-3.4 s (prod CPU profile,
 * 2026-11-17). The scan now runs in summary-worker.ts, and the handler reads the
 * published result from memory.
 *
 * A pass is incremental. Session DBs use journal_mode=DELETE, so every commit
 * moves the main file's mtime (the same fact msgTsFileCache in server.ts relies
 * on). We cache each file's result under its (mtime, size, thread id) and open a
 * file again only when one of those changed. A steady-state pass is one stat per
 * file and opens only the DBs that were written since the last pass.
 */
import { statSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { isMissingSchemaError } from './session-db-errors.js';

/** One session's thread messages, as the main view counts them. */
export interface SessionThreadSummary {
  count: number;
  lastTs: string | null;
}

/** One published change: [sessionId, count, lastTs]. */
export type ThreadSummaryChange = [string, number, string | null];

/** Work done by one pass, published to /api/debug. */
export interface ThreadSummaryPhases {
  sessions: number;
  stats: number;
  opens: number;
  readErrors: number;
  totalMs: number;
}

/**
 * The result of one pass, relative to the previous pass of the same scanner.
 * `full` is true on a scanner's first pass: the receiver then replaces its map
 * instead of patching it, so a restarted worker never leaves entries behind for
 * sessions that ended while it was down.
 */
export interface ThreadSummaryDelta {
  full: boolean;
  changed: ThreadSummaryChange[];
  removed: string[];
  phases: ThreadSummaryPhases;
}

interface FileSummary {
  count: number;
  ts: string | null;
}

interface CachedFileSummary extends FileSummary {
  mtimeMs: number;
  size: number;
  threadId: string;
}

const SESSION_FILES = [
  ['inbound.db', 'messages_in'],
  ['outbound.db', 'messages_out'],
] as const;

const NO_MESSAGES: FileSummary = { count: 0, ts: null };

/**
 * Count the rows of `table` in the session DB at `path` that belong to
 * `threadId`, and return the newest timestamp among them.
 *
 * Rows with a NULL thread_id count too, because the thread view of
 * /api/messages shows them, and the badge must match what opening the thread
 * shows. A legacy DB without the thread_id column counts every row, and a DB
 * without the table counts none. Any other failure (a locked or corrupt file)
 * throws, so the caller keeps its last good value and retries.
 */
export function readThreadFileSummary(path: string, table: string, threadId: string): FileSummary {
  const sdb = new Database(path, { readonly: true, fileMustExist: true });
  try {
    try {
      const row = sdb
        .prepare(`SELECT COUNT(*) AS n, MAX(timestamp) AS ts FROM ${table} WHERE thread_id = ? OR thread_id IS NULL`)
        .get(threadId) as { n: number; ts: string | null };
      return { count: row.n || 0, ts: row.ts ?? null };
    } catch (e) {
      if (!isMissingSchemaError(e)) throw e;
    }
    try {
      const row = sdb.prepare(`SELECT COUNT(*) AS n, MAX(timestamp) AS ts FROM ${table}`).get() as {
        n: number;
        ts: string | null;
      };
      return { count: row.n || 0, ts: row.ts ?? null };
    } catch (e) {
      if (!isMissingSchemaError(e)) throw e;
      return NO_MESSAGES;
    }
  } finally {
    sdb.close();
  }
}

/**
 * Keeps the per-file cache between passes and computes what changed. One
 * instance lives in the summary worker; tests run a fresh one in-process.
 */
export class ThreadSummaryScanner {
  private files = new Map<string, CachedFileSummary>();
  private published = new Map<string, SessionThreadSummary>();
  private passes = 0;

  /**
   * Summarize every active per-thread session and return the changes since the
   * previous pass. The receiver filters by group and messaging group itself, so
   * the scan covers the superset: every active session that has a thread id.
   */
  scan(central: Database.Database, dataDir: string): ThreadSummaryDelta {
    const startedAt = Date.now();
    const sessions = central
      .prepare("SELECT id, agent_group_id, thread_id FROM sessions WHERE status = 'active' AND thread_id IS NOT NULL")
      .all() as Array<{ id: string; agent_group_id: string; thread_id: string }>;
    const phases: ThreadSummaryPhases = { sessions: sessions.length, stats: 0, opens: 0, readErrors: 0, totalMs: 0 };
    const livePaths = new Set<string>();
    const current = new Map<string, SessionThreadSummary>();
    for (const s of sessions) {
      let count = 0;
      let lastTs: string | null = null;
      for (const [file, table] of SESSION_FILES) {
        const path = join(dataDir, 'v2-sessions', s.agent_group_id, s.id, file);
        livePaths.add(path);
        const r = this.fileSummary(path, table, s.thread_id, phases);
        count += r.count;
        // The inbound and outbound files store different timestamp formats; the
        // plain string comparison is the one the main view has always used.
        if (r.ts && (!lastTs || r.ts > lastTs)) lastTs = r.ts;
      }
      current.set(s.id, { count, lastTs });
    }
    for (const path of this.files.keys()) if (!livePaths.has(path)) this.files.delete(path);

    const full = this.passes === 0;
    const changed: ThreadSummaryChange[] = [];
    for (const [id, v] of current) {
      const prev = this.published.get(id);
      if (full || !prev || prev.count !== v.count || prev.lastTs !== v.lastTs) changed.push([id, v.count, v.lastTs]);
    }
    const removed = full ? [] : [...this.published.keys()].filter((id) => !current.has(id));
    this.published = current;
    this.passes += 1;
    phases.totalMs = Date.now() - startedAt;
    return { full, changed, removed, phases };
  }

  /**
   * Return one file's summary, from the cache when the file has not changed. A
   * missing file has no messages. A file we cannot stat or read keeps its last
   * good summary, and the cache entry is not updated, so the next pass retries.
   */
  private fileSummary(path: string, table: string, threadId: string, phases: ThreadSummaryPhases): FileSummary {
    const prev = this.files.get(path);
    let mtimeMs: number;
    let size: number;
    try {
      phases.stats += 1;
      ({ mtimeMs, size } = statSync(path));
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code === 'ENOENT' || code === 'ENOTDIR') {
        this.files.delete(path);
        return NO_MESSAGES;
      }
      phases.readErrors += 1;
      return prev ?? NO_MESSAGES;
    }
    if (prev && prev.mtimeMs === mtimeMs && prev.size === size && prev.threadId === threadId) return prev;
    try {
      phases.opens += 1;
      const r = readThreadFileSummary(path, table, threadId);
      this.files.set(path, { ...r, mtimeMs, size, threadId });
      return r;
    } catch {
      phases.readErrors += 1;
      return prev ?? NO_MESSAGES;
    }
  }
}
