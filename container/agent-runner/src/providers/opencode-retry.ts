/**
 * Retry of an OpenCode turn that failed on a retryable model error, such as a
 * 429 from a rate limit.
 *
 * OpenCode already retries a failed model call itself: up to 5 times, starting
 * at 2 s and doubling, honoring `retry-after`, about 70 s in all (opencode
 * 1.18.25, `session/retry.ts`). That covers a blip. It does not cover an
 * outage: on prod on 2026-11-16 the endpoint's per-IP rate limit refused calls
 * for ten minutes, OpenCode gave up after its fifth retry, and the turn failed
 * with the 429 as the assistant message's error.
 *
 * We take over only after OpenCode has given up, so the two layers never
 * retry at the same time. We wait much longer than OpenCode does (30 s, then
 * doubling to 4 min, each with jitter so hundreds of containers do not retry
 * in step), honor `retry-after` when the server sends one, and stop when the
 * next wait would end more than `budgetMs` (10 min) after the first failure.
 * Past that the turn fails as before.
 *
 * The retry does not resend the prompt. OpenCode keeps the prompt and every
 * completed step in the session history, and leaves the failed call out of
 * the model's context, so we send a short note that asks the model to finish
 * the request. Resending the prompt would ask the model to start over, and a
 * turn that had already posted a comment would post it again.
 */

/** When to retry and how long to wait. */
export interface ModelRetryPolicy {
  /** Longest time from the first failure to the start of the last retry, in ms. 0 = never retry. */
  budgetMs: number;
  /** The first wait without `retry-after`, in ms. Later waits double up to 8 times this. */
  baseDelayMs: number;
}

export const DEFAULT_MODEL_RETRY_POLICY: ModelRetryPolicy = { budgetMs: 600_000, baseDelayMs: 30_000 };

/**
 * Return the retry policy from `OPENCODE_MODEL_RETRY_BUDGET_MS` and
 * `OPENCODE_MODEL_RETRY_BASE_MS` (or the variables `names` gives, for another
 * caller of the same backoff such as the codex bridge), each a whole number of
 * ms (the budget may be 0 to turn retries off). A missing or invalid value
 * keeps the default.
 */
export function modelRetryPolicyFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  names: { budget: string; base: string } = {
    budget: 'OPENCODE_MODEL_RETRY_BUDGET_MS',
    base: 'OPENCODE_MODEL_RETRY_BASE_MS',
  },
): ModelRetryPolicy {
  const read = (name: string, fallback: number, min: number): number => {
    const raw = env[name]?.trim();
    if (!raw || !/^\d+$/.test(raw)) return fallback;
    const value = Number(raw);
    return Number.isSafeInteger(value) && value >= min ? value : fallback;
  };
  return {
    budgetMs: read(names.budget, DEFAULT_MODEL_RETRY_POLICY.budgetMs, 0),
    baseDelayMs: read(names.base, DEFAULT_MODEL_RETRY_POLICY.baseDelayMs, 1),
  };
}

/** What a retryable model error tells us. */
export interface RetryableModelError {
  statusCode?: number;
  /** The server's requested wait, from `retry-after-ms` or `retry-after`. */
  retryAfterMs?: number;
}

/**
 * Return the retry facts of an OpenCode assistant-message error when it is
 * retryable, or undefined when it is not.
 *
 * Retryable means OpenCode's `APIError` with status 429 or `isRetryable: true`
 * (which OpenCode sets for rate limits, overload and 5xx). Every other error —
 * a context overflow, an abort, a 400, a 401 — fails the turn as before.
 *
 * Consider the error prod recorded at 06:48:29:
 * `{"name":"APIError","data":{"message":"Too Many Requests","statusCode":429,
 * "isRetryable":true,"responseHeaders":{"x-amzn-waf-rule":"CPE_RateLimit_IP",…}}}`.
 * It is retryable with no `retryAfterMs`, so the backoff decides the wait.
 */
export function retryableModelError(error: unknown): RetryableModelError | undefined {
  if (!isRecord(error) || error.name !== 'APIError' || !isRecord(error.data)) return undefined;
  const statusCode = typeof error.data.statusCode === 'number' ? error.data.statusCode : undefined;
  if (statusCode !== 429 && error.data.isRetryable !== true) return undefined;
  const retryAfterMs = isRecord(error.data.responseHeaders) ? retryAfter(error.data.responseHeaders) : undefined;
  return { statusCode, retryAfterMs };
}

/**
 * Read the server's requested wait from response headers, in ms: `retry-after-ms`,
 * else `retry-after` as seconds or as an HTTP date. Header names match in any case.
 */
function retryAfter(headers: Record<string, unknown>, nowMs = Date.now()): number | undefined {
  const header = (name: string): string | undefined => {
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === name && typeof value === 'string' && value.trim()) return value.trim();
    }
    return undefined;
  };
  const ms = Number(header('retry-after-ms'));
  if (Number.isFinite(ms) && ms >= 0) return ms;
  const raw = header('retry-after');
  if (raw === undefined) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
  const date = Date.parse(raw);
  return Number.isNaN(date) ? undefined : Math.max(0, date - nowMs);
}

/**
 * The backoff for one turn: each call to `next` returns the wait before the
 * next attempt, or undefined to give up.
 *
 * Without `retry-after`, attempt n waits a random time between half and all of
 * `min(8 × base, base × 2^(n-1))`: 15–30 s, 30–60 s, 60–120 s, then 120–240 s.
 * With `retry-after`, it waits that long plus up to 10% more, so containers
 * told the same time do not return in the same instant. Either way it gives up
 * when the wait would end more than `budgetMs` after the first failure.
 */
export class ModelRetryBackoff {
  private attempts = 0;
  private firstFailureAtMs?: number;

  constructor(
    private readonly policy: ModelRetryPolicy = DEFAULT_MODEL_RETRY_POLICY,
    private readonly now: () => number = Date.now,
    private readonly random: () => number = Math.random,
  ) {}

  /** Number of retries granted so far. */
  get retries(): number {
    return this.attempts;
  }

  /** Return the wait in ms before retrying after `error`, or undefined to give up. */
  next(error: RetryableModelError): number | undefined {
    const nowMs = this.now();
    this.firstFailureAtMs ??= nowMs;
    const waitMs =
      error.retryAfterMs !== undefined
        ? Math.ceil(error.retryAfterMs + 0.1 * error.retryAfterMs * this.random())
        : this.backoffMs(this.attempts + 1);
    if (nowMs - this.firstFailureAtMs + waitMs > this.policy.budgetMs) return undefined;
    this.attempts += 1;
    return waitMs;
  }

  private backoffMs(attempt: number): number {
    const ceiling = Math.min(8 * this.policy.baseDelayMs, this.policy.baseDelayMs * 2 ** (attempt - 1));
    return Math.ceil(ceiling / 2 + (ceiling / 2) * this.random());
  }
}

/**
 * The note sent instead of the prompt when a turn is retried. The prompt and
 * the steps that completed are already in the session history.
 */
export function modelRetryPrompt(error: RetryableModelError): string {
  const status = error.statusCode === 429 ? 'HTTP 429, too many requests' : 'a temporary error';
  return (
    `[System: the model provider returned ${status} and your work on the request above stopped early. ` +
    `This is an automatic retry. Continue that request from where you stopped. Do not repeat a step ` +
    `that already completed above: do not send a message, post a comment or push a commit a second time.]`
  );
}

/**
 * Wait `ms` and yield an `activity` event every `everyMs` meanwhile, ending
 * early when `signal` aborts. The events keep the turn visibly alive while it
 * waits: they touch the heartbeat, so the host neither treats the claimed
 * message as stuck nor counts the container as idle, and the poll loop's
 * idle-end timer does not close the query.
 */
export async function* waitWithActivity(
  ms: number,
  signal: AbortSignal,
  everyMs = 15_000,
): AsyncGenerator<{ type: 'activity' }> {
  const endAtMs = Date.now() + ms;
  while (!signal.aborted) {
    const leftMs = endAtMs - Date.now();
    if (leftMs <= 0) return;
    await sleep(Math.min(leftMs, everyMs), signal);
    if (!signal.aborted) yield { type: 'activity' };
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', done, { once: true });
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
