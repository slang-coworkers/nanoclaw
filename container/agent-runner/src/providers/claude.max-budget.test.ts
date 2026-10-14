/**
 * The Claude provider must surface the SDK's own max-budget stop as a structured
 * flag (`maxBudgetExceeded`), taken from the result subtype `error_max_budget_usd`.
 * The poll-loop stops pushing into a query on that flag (a spent query fails every
 * later message at once). It must never be inferred from result or error prose:
 * an ordinary failure whose text quotes the phrase must not retire a usable query.
 */
import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

const sdkMessages: unknown[] = [];

mock.module('@anthropic-ai/claude-agent-sdk', () => ({
  query: () =>
    (async function* () {
      for (const m of sdkMessages) yield m;
    })(),
}));

await import('./index.js');
await import('../provider-contracts/index.js');
const { createProvider } = await import('./factory.js');
const { MEMORY_SESSION_HOOK } = await import('../memory/session-hook.js');

let tmp: string;
let prevHome: string | undefined;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-maxbudget-'));
  prevHome = process.env.HOME;
  process.env.HOME = tmp;
  sdkMessages.length = 0;
});

afterEach(() => {
  if (prevHome === undefined) delete process.env.HOME;
  else process.env.HOME = prevHome;
  fs.rmSync(tmp, { recursive: true, force: true });
});

async function results(): Promise<Array<Record<string, unknown>>> {
  const p = createProvider('claude', {});
  p.registerMemorySessionHook(MEMORY_SESSION_HOOK);
  const q = p.query({ prompt: 'hi', cwd: tmp });
  const out: Array<Record<string, unknown>> = [];
  for await (const e of q.events) {
    if ((e as { type: string }).type === 'result') out.push(e as unknown as Record<string, unknown>);
  }
  return out;
}

describe('max-budget result translation', () => {
  it('flags the SDK error_max_budget_usd result', async () => {
    sdkMessages.push({
      type: 'result',
      subtype: 'error_max_budget_usd',
      is_error: true,
      errors: ['Reached maximum budget ($12.31)'],
    });
    const [r] = await results();
    expect(r.isError).toBe(true);
    expect(r.maxBudgetExceeded).toBe(true);
  });

  it('does not flag another error whose text mentions the phrase', async () => {
    sdkMessages.push({
      type: 'result',
      subtype: 'error_during_execution',
      is_error: true,
      errors: ['tool output: Reached maximum budget ($1.00)'],
    });
    const [r] = await results();
    expect(r.isError).toBe(true);
    expect('maxBudgetExceeded' in r).toBe(false);
  });

  it('does not flag a successful result', async () => {
    sdkMessages.push({ type: 'result', subtype: 'success', is_error: false, result: 'done' });
    const [r] = await results();
    expect('maxBudgetExceeded' in r).toBe(false);
  });
});
