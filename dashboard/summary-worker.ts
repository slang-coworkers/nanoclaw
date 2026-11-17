/**
 * Summary worker: runs, off the dashboard's event loop, the scans whose results
 * request handlers serve from memory:
 *   - `threads`: per-session thread summaries for the main chat view
 *     (thread-summary-scan.ts), every 2 s;
 *   - `contextWindow`: each coworker's latest-turn context usage
 *     (context-scan.ts), every 10 s;
 *   - `contextStats`: each coworker's compaction and peak-context stats
 *     (context-scan.ts), every 60 s;
 *   - `tasks`: each coworker's pending and paused scheduled tasks
 *     (task-scan.ts), every 15 s.
 *
 * On the main thread these passes held the event loop for 0.5-3.4 s at a time,
 * and for tens of seconds after a restart (prod CPU profile and restart,
 * 2026-11-17). Here each pass runs on this thread and posts
 * its result; the main thread only swaps it in (see startSummaryWorker in
 * server.ts). The scanners keep their per-file caches across passes, so a
 * steady-state pass opens or re-reads only the files that changed. The passes
 * are synchronous, so they never overlap; a slow pass only delays the next one.
 *
 * Messages to the main thread:
 *   { kind: 'threads', computedAt, full, changed, removed, phases }
 *   { kind: 'contextWindow', computedAt, entries, phases }
 *   { kind: 'contextStats', computedAt, entries, phases }
 *   { kind: 'tasks', computedAt, entries, phases }
 *   { kind: 'error', pass, message }                    after a failed pass
 * Messages from the main thread: { kind: 'run', pass } (run that pass now, e.g.
 * after a task mutation), 'stop'.
 */
import { parentPort, workerData } from 'node:worker_threads';
import Database from 'better-sqlite3';
import { ContextScanner } from './context-scan.js';
import { TaskScanner } from './task-scan.js';
import { ThreadSummaryScanner } from './thread-summary-scan.js';

export type SummaryPass = 'threads' | 'contextWindow' | 'contextStats' | 'tasks';
const SUMMARY_PASSES: readonly SummaryPass[] = ['threads', 'contextWindow', 'contextStats', 'tasks'];

export interface SummaryWorkerData {
  dataDir: string;
  centralDbPath: string;
  threadsIntervalMs: number;
  contextWindowIntervalMs: number;
  contextStatsIntervalMs: number;
  contextStatsFirstDelayMs: number;
  tasksIntervalMs: number;
  /** Test hook: busy time added to each threads pass, standing in for a slow scan. */
  testDelayMs: number;
}

const cfg = workerData as SummaryWorkerData;
const port = parentPort;
if (!port) throw new Error('summary-worker.ts must run as a worker thread');

const threads = new ThreadSummaryScanner();
const context = new ContextScanner();
const tasks = new TaskScanner();
const timers: Array<ReturnType<typeof setTimeout>> = [];
let db: Database.Database | null = null;

function openCentralDb(): Database.Database {
  if (db) return db;
  const handle = new Database(cfg.centralDbPath, { readonly: true, fileMustExist: true });
  handle.pragma('busy_timeout = 2000');
  db = handle;
  return handle;
}

function closeCentralDb(): void {
  try {
    db?.close();
  } catch {
    // The handle is dropped either way; the next pass reopens it.
  }
  db = null;
}

function busyWait(ms: number): void {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    // Busy-wait on purpose: a test stands in for a long synchronous scan.
  }
}

/** Run one pass and post its result. A failed pass posts an error; the main thread keeps serving its last result. */
function runPass(pass: SummaryPass): void {
  try {
    const central = openCentralDb();
    const computedAt = (): string => new Date().toISOString();
    if (pass === 'threads') {
      const delta = threads.scan(central, cfg.dataDir);
      if (cfg.testDelayMs > 0) busyWait(cfg.testDelayMs);
      port!.postMessage({ kind: 'threads', computedAt: computedAt(), ...delta });
    } else if (pass === 'contextWindow') {
      const phases = context.refreshWindow(central, cfg.dataDir);
      port!.postMessage({ kind: 'contextWindow', computedAt: computedAt(), entries: [...context.window], phases });
    } else if (pass === 'contextStats') {
      const phases = context.refreshStats(central, cfg.dataDir);
      port!.postMessage({ kind: 'contextStats', computedAt: computedAt(), entries: [...context.stats], phases });
    } else {
      const phases = tasks.refresh(central, cfg.dataDir);
      port!.postMessage({ kind: 'tasks', computedAt: computedAt(), entries: [...tasks.groups], phases });
    }
  } catch (e) {
    // The central DB may have been replaced; the next pass reopens it.
    closeCentralDb();
    port!.postMessage({ kind: 'error', pass, message: e instanceof Error ? e.message : String(e) });
  }
}

/** Run `pass` after `firstDelayMs`, then every `intervalMs`. */
function schedule(pass: SummaryPass, firstDelayMs: number, intervalMs: number): void {
  timers.push(
    setTimeout(() => {
      runPass(pass);
      timers.push(setInterval(() => runPass(pass), intervalMs));
    }, firstDelayMs),
  );
}

port.on('message', (msg: unknown) => {
  const run = msg as { kind?: string; pass?: SummaryPass } | null;
  if (run && run.kind === 'run' && run.pass && SUMMARY_PASSES.includes(run.pass)) {
    runPass(run.pass);
  } else if (msg === 'stop') {
    for (const t of timers) clearTimeout(t);
    closeCentralDb();
    port.close();
  }
});

schedule('threads', 0, cfg.threadsIntervalMs);
schedule('contextWindow', 0, cfg.contextWindowIntervalMs);
schedule('contextStats', cfg.contextStatsFirstDelayMs, cfg.contextStatsIntervalMs);
schedule('tasks', 0, cfg.tasksIntervalMs);
