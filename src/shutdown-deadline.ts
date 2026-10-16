/**
 * Bounded graceful shutdown.
 *
 * The systemd unit stops the host with `TimeoutStopSec=10` (setup/service.ts).
 * If the graceful path overruns that budget systemd SIGKILLs the node process,
 * the circuit-breaker "clean shutdown" marker is never written, and the next
 * start is counted as a crash — two of those within an hour escalate to delayed
 * startups. Under KillMode=process the coworker containers survive a host stop
 * and are re-adopted at the next start, so nothing the host does on the way out
 * is worth being SIGKILLed for: run the steps in order, and once the deadline
 * passes abandon whatever is still pending, log it, and let the caller finish
 * (write the clean marker, exit).
 */
import { log } from './log.js';

/** Comfortably inside the unit's TimeoutStopSec=10 — leaves ~3 s for finalize + exit. */
export const DEFAULT_SHUTDOWN_DEADLINE_MS = 7_000;

export interface ShutdownStep {
  name: string;
  run: () => void | Promise<void>;
}

export interface ShutdownResult {
  /** True when every step settled before the deadline. */
  completed: boolean;
  /** The step that was running when the deadline fired. */
  pending?: string;
  /** Steps never started because the deadline fired first. */
  skipped: string[];
  elapsedMs: number;
}

export function resolveShutdownDeadlineMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.NANOCLAW_SHUTDOWN_DEADLINE_MS;
  if (!raw) return DEFAULT_SHUTDOWN_DEADLINE_MS;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_SHUTDOWN_DEADLINE_MS;
}

/**
 * Run `steps` serially. A step that throws is logged and the next one runs
 * (one failed cleanup must not block the rest). Resolves no later than
 * `deadlineMs` after the call, even if a step never settles.
 */
export async function runShutdownSteps(steps: readonly ShutdownStep[], deadlineMs: number): Promise<ShutdownResult> {
  const startedAt = Date.now();
  let index = 0;
  let current: string | undefined;
  let timedOut = false;

  // Arm the deadline BEFORE the first step runs: an async IIFE executes its
  // body synchronously up to the first await, so arming afterwards would let
  // a step's synchronous work silently extend the budget.
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<'deadline'>((resolve) => {
    timer = setTimeout(() => resolve('deadline'), deadlineMs);
  });

  const sequence = (async () => {
    for (; index < steps.length; index++) {
      // Don't admit another step once the budget is spent, even if the timer
      // callback hasn't had its turn on the event loop yet.
      if (timedOut || Date.now() - startedAt >= deadlineMs) {
        timedOut = true;
        return;
      }
      const step = steps[index];
      current = step.name;
      const stepStart = Date.now();
      /* eslint-disable no-catch-all/no-catch-all -- graceful shutdown must continue through every cleanup step */
      try {
        await step.run();
      } catch (err) {
        log.error('Shutdown step threw', { step: step.name, err });
      }
      /* eslint-enable no-catch-all/no-catch-all */
      const tookMs = Date.now() - stepStart;
      if (tookMs >= 1_000) log.warn('Slow shutdown step', { step: step.name, tookMs });
      current = undefined;
    }
  })();

  const outcome = await Promise.race([sequence.then(() => 'done' as const), deadline]);
  if (timer) clearTimeout(timer);

  const elapsedMs = Date.now() - startedAt;
  if (outcome === 'done' && !timedOut) return { completed: true, skipped: [], elapsedMs };

  timedOut = true;
  const pending = current;
  const skipped = steps.slice(pending ? index + 1 : index).map((s) => s.name);
  log.warn('Shutdown deadline reached — abandoning remaining cleanup', { deadlineMs, pending, skipped });
  return { completed: false, pending, skipped, elapsedMs };
}
