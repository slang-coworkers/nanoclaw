/**
 * Effects a CLI command must not run until its own response is durable.
 *
 * `ncl groups mcp-tools set` restarts every running container in the target
 * agent group, because a direct MCP tool cannot be revoked from a live
 * container any other way. If the caller is one of those containers, killing
 * it inside the handler destroys the answer it was about to receive: the
 * response frame for a container-issued `cli_request` is written to that
 * session's `inbound.db` AFTER `dispatch()` returns (see
 * `src/cli/delivery-action.ts`), so a kill during the handler means the row is
 * written to a session whose reader is already gone. The operator sees a
 * command that hung, with no way to tell whether it applied.
 *
 * Handlers therefore enqueue the restart here instead of performing it, and
 * each transport drains once its response is on the wire / in the DB.
 *
 * Today an agent caller can never target its own group — `mcp-tools set`
 * denies self-targeting outright — so the ordering is not load-bearing for
 * that one command. It is written down as a mechanism anyway because the
 * alternative is an invariant that lives only in the interaction between two
 * files, and the failure mode when it breaks is silent.
 */
import { log } from '../log.js';

interface PendingEffect {
  label: string;
  run: () => void;
}

let queue: PendingEffect[] = [];

/**
 * Defer `run` until the current command's response is durable.
 *
 * A macrotask fallback drains the queue even if the transport never calls
 * `drainPostResponseEffects` — a forgotten drain must not turn a reported
 * restart into no restart. `insertMessage` / socket `write` are synchronous
 * within the calling macrotask, so the fallback still runs strictly after the
 * response is durable.
 */
export function enqueuePostResponseEffect(label: string, run: () => void): void {
  queue.push({ label, run });
  setTimeout(() => {
    if (queue.length > 0) {
      log.warn('Post-response effects drained by fallback timer — a transport did not drain', {
        pending: queue.map((e) => e.label),
      });
      drainPostResponseEffects();
    }
  }, 0);
}

/** Run and clear every deferred effect. Never throws; a failing effect is logged. */
export function drainPostResponseEffects(): void {
  const pending = queue;
  queue = [];
  for (const effect of pending) {
    try {
      effect.run();
    } catch (err) {
      log.error('Post-response effect failed', { effect: effect.label, err });
    }
  }
}

/** Test seam: forget anything queued without running it. */
export function resetPostResponseEffectsForTests(): void {
  queue = [];
}

/** Test seam: labels currently queued. */
export function pendingPostResponseEffectLabels(): string[] {
  return queue.map((e) => e.label);
}
