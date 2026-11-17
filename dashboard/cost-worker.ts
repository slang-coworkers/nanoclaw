/**
 * Cost worker: computes the per-session cost snapshot off the dashboard's event
 * loop and posts it to the main thread.
 *
 * `computeSessionCostSnapshot` reads every session directory (each outbound.db
 * ledger, the Claude transcripts, the codex rollouts). On the main thread that
 * pass held the event loop for seconds at a time, so HTTP requests queued
 * behind it. Here it runs on its own thread, and the main thread only swaps in
 * the result (see startCostWorker in server.ts).
 *
 * Pricing and folding stay in session-cost-scan.ts, which this worker and the
 * test path in server.ts share; this file only schedules passes, writes the two
 * output files, and posts the result. The worker keeps its own per-file cache
 * (warmed from the same on-disk snapshot), so a steady-state pass re-parses only
 * transcripts whose size or mtime changed.
 *
 * Messages to the main thread:
 *   { kind: 'snapshot', computedAt, phases, byPeriod }  after each good pass
 *   { kind: 'error', message }                         after a failed pass
 * Messages from the main thread: 'refresh' (run a pass now), 'stop'.
 */
import { parentPort, workerData } from 'node:worker_threads';
import Database from 'better-sqlite3';
import {
  computeSessionCostSnapshot,
  emptySessionCostByPeriod,
  loadPerFileCostCache,
  persistPerFileCostCache,
  writeCostThresholdFile,
  type SessionCostByPeriod,
} from './session-cost-scan.js';

interface CostWorkerData {
  dataDir: string;
  centralDbPath: string;
  intervalMs: number;
  firstDelayMs: number;
  /** Test hook: busy time added to each pass, standing in for a slow scan. */
  testDelayMs: number;
}

const cfg = workerData as CostWorkerData;
const port = parentPort;
if (!port) throw new Error('cost-worker.ts must run as a worker thread');

let db: Database.Database | null = null;
let prev: SessionCostByPeriod = emptySessionCostByPeriod();
let running = false;
let timer: ReturnType<typeof setInterval> | null = null;

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

/** Run one pass and post its result. Overlapping triggers are dropped, not queued. */
function runOnce(): void {
  if (running) return;
  running = true;
  try {
    const { byPeriod, phases } = computeSessionCostSnapshot(openCentralDb(), cfg.dataDir, prev);
    if (cfg.testDelayMs > 0) {
      const until = Date.now() + cfg.testDelayMs;
      while (Date.now() < until) {
        // Busy-wait on purpose: a test stands in for a long synchronous scan.
      }
    }
    const tw = Date.now();
    writeCostThresholdFile(cfg.dataDir, byPeriod);
    persistPerFileCostCache(cfg.dataDir);
    phases.writeMs = Date.now() - tw;
    prev = byPeriod;
    port!.postMessage({ kind: 'snapshot', computedAt: new Date().toISOString(), phases, byPeriod });
  } catch (e) {
    // A bad pass reopens the DB next time (it may have been replaced) and the
    // main thread keeps serving its last snapshot.
    closeCentralDb();
    port!.postMessage({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
  } finally {
    running = false;
  }
}

port.on('message', (msg: unknown) => {
  if (msg === 'refresh') runOnce();
  else if (msg === 'stop') {
    if (timer) clearInterval(timer);
    closeCentralDb();
    port.close();
  }
});

loadPerFileCostCache(cfg.dataDir);
setTimeout(() => {
  runOnce();
  timer = setInterval(runOnce, cfg.intervalMs);
}, cfg.firstDelayMs);
