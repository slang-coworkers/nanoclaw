/**
 * The Claude provider must surface the SDK's own max-budget stop as a structured
 * flag (`maxBudgetExceeded`), taken from the result subtype `error_max_budget_usd`.
 * The poll-loop stops pushing into a query on that flag (a spent query fails every
 * later message at once). It must never be inferred from result or error prose:
 * an ordinary failure whose text quotes the phrase must not retire a usable query.
 * It also reports how many pushed inputs are still unanswered, exact from the
 * SDK's uuid echo, so a stale query is not held open by folded sends.
 */
import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

// An entry may be a function, evaluated when reached (after the prompt stream exists).
const sdkMessages: unknown[] = [];
let promptStream: AsyncIterable<{ uuid: string }> | undefined;

mock.module('@anthropic-ai/claude-agent-sdk', () => ({
  query: (args: { prompt: AsyncIterable<{ uuid: string }> }) => {
    promptStream = args.prompt;
    return (async function* () {
      for (const m of sdkMessages) yield typeof m === 'function' ? await (m as () => Promise<unknown>)() : m;
    })();
  },
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

  it("settles the SDK's uuid echo: folded sends count together; no echo or a foreign one gives no count", async () => {
    const p = createProvider('claude', {});
    p.registerMemorySessionHook(MEMORY_SESSION_HOOK);
    const q = p.query({ prompt: 'a', cwd: tmp });
    q.push('b');
    q.push('c');
    q.push('d');
    let ids: string[] | undefined;
    const sent = async (): Promise<string[]> => {
      if (!ids) {
        const it = promptStream![Symbol.asyncIterator]();
        ids = [];
        for (let i = 0; i < 4; i++) ids.push((await it.next()).value.uuid);
      }
      return ids;
    };
    const ok = { type: 'result', subtype: 'success', is_error: false };
    // One turn folded a, b and c (real SDK 0.3.289 shape: the list in consumption order).
    sdkMessages.push(async () => {
      const [a, b, c] = await sent();
      return { ...ok, result: 'abc', user_message_uuid: a, user_message_uuids: [a, b, c] };
    });
    sdkMessages.push({ ...ok, result: 'no echo' });
    sdkMessages.push({ ...ok, result: 'foreign', user_message_uuid: 'cli-minted', user_message_uuids: ['cli-minted'] });
    // An older producer echoes only the last send.
    sdkMessages.push(async () => ({ ...ok, result: 'd', user_message_uuid: (await sent())[3] }));
    const out: Array<Record<string, unknown>> = [];
    for await (const e of q.events) {
      if ((e as { type: string }).type === 'result') out.push(e as unknown as Record<string, unknown>);
    }
    expect(new Set(ids).size).toBe(4); // every push carries its own uuid
    expect(out.map((r) => r.unansweredInputs)).toEqual([1, undefined, undefined, 0]);
    expect('unansweredInputs' in out[1]).toBe(false);
  });

  it('does not flag a successful result', async () => {
    sdkMessages.push({ type: 'result', subtype: 'success', is_error: false, result: 'done' });
    const [r] = await results();
    expect('maxBudgetExceeded' in r).toBe(false);
  });
});
