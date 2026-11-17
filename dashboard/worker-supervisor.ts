/**
 * Supervision for the dashboard's snapshot workers (cost-worker.ts and
 * summary-worker.ts).
 *
 * Each of these workers runs a scan that used to hold the dashboard's event
 * loop, and posts its results; the main thread serves the last result it
 * received. When a worker cannot start, crashes or exits, the supervisor records
 * the error, marks the worker as not running (so the served result reads as
 * stale) and restarts it with exponential backoff. It never runs the scan on
 * the main thread instead: that scan is the stall the worker exists to remove.
 */
import { Worker } from 'node:worker_threads';

/** The lifecycle fields that a worker's snapshot state carries for /api/debug. */
export interface WorkerLifecycleState {
  workerRunning: boolean;
  restarts: number;
  lastError: string | null;
  /** When lastError happened (epoch ms). */
  lastErrorAt: number | null;
}

export interface WorkerRestartPolicy {
  /** Restart a dead worker (off in tests that kill it on purpose). */
  restartOnFailure: boolean;
  /** First restart delay; it doubles per restart up to restartMaxMs. */
  restartMinMs: number;
  restartMaxMs: number;
}

export interface WorkerSupervisor {
  /** Start a worker now, replacing a running one. Returns null when it could not be created; a restart is then scheduled. */
  start(): Worker | null;
  /** Stop the worker and any pending restart. The served result stays, marked stale. */
  stop(): Promise<void>;
  /** Post a message to the running worker. Returns false when no worker is running. */
  post(message: unknown): boolean;
}

export function recordWorkerError(state: WorkerLifecycleState, message: string): void {
  state.lastError = message;
  state.lastErrorAt = Date.now();
}

/**
 * The `execArgv` for a TypeScript worker. Under tsx, which is how the dashboard
 * runs, the loader is already in `process.execArgv` and the worker inherits it;
 * anywhere else (vitest) we load tsx explicitly.
 */
export function tsWorkerExecArgv(): string[] | undefined {
  const hasTsxLoader = process.execArgv.some((a) => /[\\/]tsx[\\/]dist[\\/](loader|preflight)/.test(a));
  return hasTsxLoader ? undefined : ['--import', 'tsx'];
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Supervise the worker that `spawn` creates. Messages from a worker that has
 * been replaced or stopped are dropped, so a dying worker can never overwrite
 * what its successor published. `policy` is read at each restart, so a caller
 * can change it between starts. `onDeath` runs when the current worker could not
 * start, crashed or exited, after the error is recorded.
 */
export function superviseWorker<M>(opts: {
  label: string;
  spawn: () => Worker;
  state: WorkerLifecycleState;
  policy: () => WorkerRestartPolicy;
  onMessage: (msg: M) => void;
  onDeath?: (reason: string) => void;
}): WorkerSupervisor {
  let current: Worker | null = null;
  let restartTimer: ReturnType<typeof setTimeout> | null = null;

  const scheduleRestart = (): void => {
    const policy = opts.policy();
    if (!policy.restartOnFailure || restartTimer) return;
    const delay = Math.min(policy.restartMaxMs, policy.restartMinMs * 2 ** opts.state.restarts);
    restartTimer = setTimeout(() => {
      restartTimer = null;
      opts.state.restarts += 1;
      start();
    }, delay);
    restartTimer.unref?.();
  };

  const start = (): Worker | null => {
    if (restartTimer) clearTimeout(restartTimer);
    restartTimer = null;
    const previous = current;
    current = null;
    if (previous) void previous.terminate();
    let worker: Worker;
    try {
      worker = opts.spawn();
    } catch (e) {
      const reason = `${opts.label} could not start: ${errorText(e)}`;
      opts.state.workerRunning = false;
      recordWorkerError(opts.state, reason);
      opts.onDeath?.(reason);
      scheduleRestart();
      return null;
    }
    current = worker;
    opts.state.workerRunning = true;
    const onDeath = (reason: string): void => {
      if (current !== worker) return; // already replaced or stopped
      current = null;
      opts.state.workerRunning = false;
      recordWorkerError(opts.state, reason);
      opts.onDeath?.(reason);
      scheduleRestart();
    };
    worker.on('message', (msg: M) => {
      if (current === worker) opts.onMessage(msg);
    });
    worker.on('error', (e) => onDeath(`${opts.label} crashed: ${errorText(e)}`));
    worker.on('exit', (code) => onDeath(`${opts.label} exited with code ${code}`));
    return worker;
  };

  const stop = async (): Promise<void> => {
    if (restartTimer) clearTimeout(restartTimer);
    restartTimer = null;
    const worker = current;
    current = null;
    opts.state.workerRunning = false;
    if (worker) await worker.terminate();
  };

  const post = (message: unknown): boolean => {
    if (!current) return false;
    try {
      current.postMessage(message);
      return true;
    } catch {
      return false;
    }
  };

  return { start, stop, post };
}
