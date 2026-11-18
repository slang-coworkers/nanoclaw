import { describe, expect, it } from 'bun:test';

import {
  DEFAULT_MODEL_RETRY_POLICY,
  ModelRetryBackoff,
  modelRetryPolicyFromEnv,
  modelRetryPrompt,
  retryableModelError,
  waitWithActivity,
} from './opencode-retry.js';

/** The error prod recorded on 2026-11-16 at 06:48:29, after OpenCode's five retries. */
const PROD_429 = {
  name: 'APIError',
  data: {
    message: 'Too Many Requests',
    statusCode: 429,
    isRetryable: true,
    responseHeaders: {
      date: 'Mon, 16 Nov 2026 06:48:29 GMT',
      server: 'awselb/2.0',
      'x-amzn-waf-action': 'BLOCK',
      'x-amzn-waf-rule': 'CPE_RateLimit_IP',
    },
    responseBody: '',
  },
};

function apiError(data: Record<string, unknown>) {
  return { name: 'APIError', data: { message: 'x', ...data } };
}

describe('retryableModelError', () => {
  it('retries the prod 429, which carries no retry-after', () => {
    expect(retryableModelError(PROD_429)).toEqual({ statusCode: 429, retryAfterMs: undefined });
  });

  it('retries any APIError OpenCode marks retryable, and a 429 it does not', () => {
    expect(retryableModelError(apiError({ statusCode: 503, isRetryable: true }))).toEqual({
      statusCode: 503,
      retryAfterMs: undefined,
    });
    expect(retryableModelError(apiError({ statusCode: 429, isRetryable: false }))).toBeDefined();
  });

  it('does not retry other errors', () => {
    expect(retryableModelError(apiError({ statusCode: 400, isRetryable: false }))).toBeUndefined();
    expect(retryableModelError(apiError({ message: 'backend rejected request' }))).toBeUndefined();
    expect(retryableModelError({ name: 'ContextOverflowError', data: { message: 'too long' } })).toBeUndefined();
    expect(retryableModelError({ name: 'MessageAbortedError', data: { message: 'aborted' } })).toBeUndefined();
    expect(retryableModelError(undefined)).toBeUndefined();
    expect(retryableModelError('Too Many Requests')).toBeUndefined();
  });

  it('reads retry-after-ms, retry-after seconds and a retry-after date, in any header case', () => {
    const withHeaders = (responseHeaders: Record<string, string>) =>
      retryableModelError(apiError({ statusCode: 429, responseHeaders }))?.retryAfterMs;
    expect(withHeaders({ 'retry-after-ms': '1500' })).toBe(1500);
    expect(withHeaders({ 'Retry-After': '20' })).toBe(20_000);
    expect(withHeaders({ 'retry-after': '0.5' })).toBe(500);
    const date = withHeaders({ 'retry-after': new Date(Date.now() + 30_000).toUTCString() });
    expect(date).toBeGreaterThan(28_000);
    expect(date).toBeLessThanOrEqual(30_000);
    expect(withHeaders({ 'retry-after': 'soon' })).toBeUndefined();
  });
});

describe('ModelRetryBackoff', () => {
  const clock = () => {
    let now = 0;
    return { now: () => now, advance: (ms: number) => (now += ms) };
  };

  it('waits half to all of a doubling step, capped at 8 x base', () => {
    const lowest = new ModelRetryBackoff(
      { budgetMs: 10_000_000, baseDelayMs: 30_000 },
      () => 0,
      () => 0,
    );
    const highest = new ModelRetryBackoff(
      { budgetMs: 10_000_000, baseDelayMs: 30_000 },
      () => 0,
      () => 1,
    );
    const steps = (backoff: ModelRetryBackoff) => Array.from({ length: 6 }, () => backoff.next({ statusCode: 429 }));
    expect(steps(lowest)).toEqual([15_000, 30_000, 60_000, 120_000, 120_000, 120_000]);
    expect(steps(highest)).toEqual([30_000, 60_000, 120_000, 240_000, 240_000, 240_000]);
  });

  it('gives up when the next wait would end past the budget from the first failure', () => {
    const c = clock();
    const backoff = new ModelRetryBackoff(DEFAULT_MODEL_RETRY_POLICY, c.now, () => 1);
    // Each attempt also spends ~70 s inside OpenCode's own retries before it fails again.
    const waits: Array<number | undefined> = [];
    for (let i = 0; i < 6; i++) {
      const wait = backoff.next({ statusCode: 429 });
      waits.push(wait);
      if (wait === undefined) break;
      c.advance(wait + 70_000);
    }
    // 0+30 s, 100+60 s, 230+120 s fit in 600 s; 420+240 s does not.
    expect(waits).toEqual([30_000, 60_000, 120_000, undefined]);
    expect(backoff.retries).toBe(3);
  });

  it('honors retry-after, adding up to 10% so containers do not return in step', () => {
    const low = new ModelRetryBackoff(
      DEFAULT_MODEL_RETRY_POLICY,
      () => 0,
      () => 0,
    );
    const high = new ModelRetryBackoff(
      DEFAULT_MODEL_RETRY_POLICY,
      () => 0,
      () => 1,
    );
    expect(low.next({ statusCode: 429, retryAfterMs: 45_000 })).toBe(45_000);
    expect(high.next({ statusCode: 429, retryAfterMs: 45_000 })).toBe(49_500);
  });

  it('fails at once when retry-after asks for longer than the budget', () => {
    const backoff = new ModelRetryBackoff(
      DEFAULT_MODEL_RETRY_POLICY,
      () => 0,
      () => 0,
    );
    expect(backoff.next({ statusCode: 429, retryAfterMs: 3_600_000 })).toBeUndefined();
    expect(backoff.retries).toBe(0);
  });

  it('a budget of 0 never retries', () => {
    const backoff = new ModelRetryBackoff(
      { budgetMs: 0, baseDelayMs: 30_000 },
      () => 0,
      () => 0,
    );
    expect(backoff.next({ statusCode: 429 })).toBeUndefined();
  });
});

describe('modelRetryPolicyFromEnv', () => {
  it('reads whole ms values and keeps the default for anything else', () => {
    expect(modelRetryPolicyFromEnv({})).toEqual(DEFAULT_MODEL_RETRY_POLICY);
    expect(
      modelRetryPolicyFromEnv({ OPENCODE_MODEL_RETRY_BUDGET_MS: '0', OPENCODE_MODEL_RETRY_BASE_MS: '5000' }),
    ).toEqual({ budgetMs: 0, baseDelayMs: 5000 });
    expect(
      modelRetryPolicyFromEnv({ OPENCODE_MODEL_RETRY_BUDGET_MS: '-1', OPENCODE_MODEL_RETRY_BASE_MS: '0' }),
    ).toEqual(DEFAULT_MODEL_RETRY_POLICY);
    expect(modelRetryPolicyFromEnv({ OPENCODE_MODEL_RETRY_BUDGET_MS: '10m' })).toEqual(DEFAULT_MODEL_RETRY_POLICY);
  });
});

describe('modelRetryPrompt', () => {
  it('asks to continue and not to repeat completed steps', () => {
    const prompt = modelRetryPrompt({ statusCode: 429 });
    expect(prompt).toContain('HTTP 429');
    expect(prompt).toContain('Continue that request');
    expect(prompt).toContain('Do not repeat');
  });
});

describe('waitWithActivity', () => {
  it('yields activity while it waits', async () => {
    const started = Date.now();
    const events: string[] = [];
    for await (const event of waitWithActivity(60, new AbortController().signal, 20)) events.push(event.type);
    expect(Date.now() - started).toBeGreaterThanOrEqual(55);
    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(new Set(events)).toEqual(new Set(['activity']));
  });

  it('ends at once on abort', async () => {
    const controller = new AbortController();
    const started = Date.now();
    setTimeout(() => controller.abort(), 10);
    const events: string[] = [];
    for await (const event of waitWithActivity(10_000, controller.signal, 5_000)) events.push(event.type);
    expect(Date.now() - started).toBeLessThan(1_000);
    expect(events).toEqual([]);
  });
});
