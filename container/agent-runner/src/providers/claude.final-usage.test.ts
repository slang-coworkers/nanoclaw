/**
 * Final per-call usage, end to end, on REAL SDK captures.
 *
 * The fixtures in __fixtures__/claude-usage/ are sanitized recordings of Agent
 * SDK 0.3.289 / Claude Code 2.1.296 runs (stream events, assistant blocks,
 * results and the SubagentStop hook calls, in their real order):
 *   main-two-turns         fresh session, 2 streaming turns: text+tool_use,
 *                          thinking+text, a Haiku helper call only in modelUsage
 *   background-subagents   two parallel Task subagents; one finishes after the
 *                          parent's result (late SubagentStop)
 *   resume-compact         resume of main-two-turns + /compact (the compaction
 *                          call is visible ONLY in modelUsage)
 *   resume-after-compact   resume again, one call
 *
 * The REGRESSION GUARD: replaying a session through the provider and the
 * poll-loop must leave a ledger whose tokens equal the SDK's own `modelUsage`
 * EXACTLY, and a counter equal to that ledger and to the exact price of every
 * call's final usage. Before the fix the same replay kept 8 of 235 output
 * tokens on the first call.
 */
import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

const FX = path.join(import.meta.dir, '__fixtures__', 'claude-usage');

let script: Array<Record<string, unknown>> = [];
let lastOptions:
  | { hooks?: Record<string, Array<{ hooks: Array<(i: unknown, t: unknown, o: unknown) => Promise<unknown>> }>> }
  | undefined;

mock.module('@anthropic-ai/claude-agent-sdk', () => ({
  query: (args: { options?: typeof lastOptions }) => {
    lastOptions = args?.options;
    return (async function* () {
      for (const m of script) {
        if (m.__hook === 'SubagentStop') {
          // Fire the hook where the CLI fired it, as the SDK does (between messages).
          const input = m.input as { agent_transcript_path?: string };
          const hook = lastOptions!.hooks!.SubagentStop[0].hooks[0];
          await hook(
            { ...input, agent_transcript_path: input.agent_transcript_path?.replace('__FIXTURE__', FX) },
            undefined,
            { signal: new AbortController().signal },
          );
          continue;
        }
        if (m.__hook) continue;
        yield m;
      }
    })();
  },
}));

await import('./index.js');
await import('../provider-contracts/index.js');
const { createProvider } = await import('./factory.js');
const { MEMORY_SESSION_HOOK } = await import('../memory/session-hook.js');
const { finalUsageFromStreamEvent, finalUsageFromTranscript, createSubagentUsageHook } = await import('./claude.js');
const { closeSessionDb, getOutboundDb, initTestSessionDb } = await import('../mailbox/sqlite/connection.js');
const { __setConfigForTest } = await import('../config.js');
const { __costCapTestHooks: H } = await import('../poll-loop.js');
const { createCostEventsTable, sumWindow } = await import('../cost-events.js');
const { RATE_TABLE } = await import('../cost-rate-table.js');
const { newBackstopState, priceVec, zeroVec } = await import('../claude-usage.js');

type Ev = Record<string, unknown> & { type: string };

function load(name: string): Array<Record<string, unknown>> {
  return fs
    .readFileSync(path.join(FX, name), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Record<string, unknown>);
}

let tmp: string;
let prevHome: string | undefined;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-finalusage-'));
  prevHome = process.env.HOME;
  process.env.HOME = tmp;
  initTestSessionDb();
  createCostEventsTable(getOutboundDb());
  __setConfigForTest({
    provider: 'claude',
    assistantName: 'test',
    groupName: 'test',
    agentGroupId: 'ag-test',
    maxMessagesPerPrompt: 10,
    mcpServers: {},
    model: 'claude-sonnet-5-5',
    costCapT2Usd: 10_000,
  });
  H.setState({
    costEnabled: true,
    costImmortal: false,
    costWindow: 'lifetime',
    costAllotmentUsd: 10_000,
    costCapUsd: 10_000,
    costSpentUsd: 0,
    costEscalatedAt: undefined,
    costStopRequested: false,
    costCeilingUsd: 0,
    costCeilingHardStop: false,
    codexLedger: {},
    codexUsdCharged: 0,
    codexLedgerBaselinePending: false,
    ledgerGen: 1,
    seenMessageIds: [],
    claudeBackstop: newBackstopState(0, null, true),
  });
});

afterEach(() => {
  if (prevHome === undefined) delete process.env.HOME;
  else process.env.HOME = prevHome;
  fs.rmSync(tmp, { recursive: true, force: true });
  __setConfigForTest(null);
  closeSessionDb();
});

function provider() {
  const p = createProvider('claude', {});
  p.registerMemorySessionHook(MEMORY_SESSION_HOOK);
  return p;
}

/** Run one fixture through the provider; drive the poll-loop's cost path exactly as processQuery does. */
async function replay(name: string, continuation?: string): Promise<Ev[]> {
  script = load(name);
  const q = provider().query({ prompt: 'x', cwd: tmp, continuation });
  const out: Ev[] = [];
  for await (const e of q.events) {
    const ev = e as unknown as Ev;
    out.push(ev);
    if (ev.type === 'init') H.noteClaudeContinuation(ev.continuation as string, !continuation);
    if (ev.type === 'message_usage') H.recordMessageCost(e as never);
    if (ev.type === 'usage') H.recordTurnCost(e as never);
  }
  return out;
}

/** Ledger tokens per pricing key (residual rows included). */
function ledgerTokens(): Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> {
  const rows = getOutboundDb().prepare('SELECT * FROM cost_events WHERE window_gen = 1').all() as Array<
    Record<string, number | string>
  >;
  const out: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {};
  for (const r of rows) {
    const key = String(r.model).includes('haiku') ? 'haiku' : 'sonnet';
    const t = (out[key] ??= { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
    t.input += Number(r.input_tokens);
    t.output += Number(r.output_tokens);
    t.cacheRead += Number(r.cache_read_tokens);
    t.cacheWrite += Number(r.cache_write_tokens) + Number(r.cache_write_5m_tokens) + Number(r.cache_write_1h_tokens);
  }
  return out;
}

function lastModelUsage(
  name: string,
): Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> {
  const res = load(name)
    .filter((m) => m.type === 'result')
    .pop() as { modelUsage: Record<string, Record<string, number>> };
  const out: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {};
  for (const [k, u] of Object.entries(res.modelUsage)) {
    out[k.includes('haiku') ? 'haiku' : 'sonnet'] = {
      input: u.inputTokens,
      output: u.outputTokens,
      cacheRead: u.cacheReadInputTokens,
      cacheWrite: u.cacheCreationInputTokens,
    };
  }
  return out;
}

const spent = () => H.getState().costSpentUsd;
const ledgerUsd = () => sumWindow(getOutboundDb(), RATE_TABLE, '0000-00-00', '9999-99-99', 1).usd;
const SONNET = 'claude-sonnet-5-5';
const HAIKU = 'claude-haiku-4-5';
const price = (m: string, p: Partial<ReturnType<typeof zeroVec>>) => priceVec(m, { ...zeroVec(), ...p });

describe('provider: final usage from the stream', () => {
  it('turns message_start + message_delta into one final report per call (real capture)', async () => {
    const evs = await replay('main-two-turns.jsonl');
    const finals = evs.filter((e) => e.type === 'message_usage' && e.final);
    expect(finals.map((f) => [f.outputTokens, f.ephemeral1hInputTokens])).toEqual([
      [235, 23_948],
      [289, 2_420],
      [65, 330],
    ]);
    const snaps = evs.filter((e) => e.type === 'message_usage' && !e.final);
    expect(snaps.map((s) => s.outputTokens)).toEqual([8, 8, 6, 6, 4]); // the snapshot the blocks carry
  });

  it('classic message_delta shape (output only): input and cache come from message_start', () => {
    const heads = new Map();
    finalUsageFromStreamEvent(
      {
        event: {
          type: 'message_start',
          message: {
            id: 'm1',
            model: SONNET,
            usage: {
              input_tokens: 3,
              cache_read_input_tokens: 100,
              cache_creation_input_tokens: 50,
              cache_creation: { ephemeral_5m_input_tokens: 50, ephemeral_1h_input_tokens: 0 },
              output_tokens: 1,
            },
          },
        },
      },
      heads,
    );
    const fin = finalUsageFromStreamEvent({ event: { type: 'message_delta', usage: { output_tokens: 400 } } }, heads);
    expect(fin).toMatchObject({
      messageId: 'm1',
      inputTokens: 3,
      outputTokens: 400,
      cacheReadInputTokens: 100,
      ephemeral5mInputTokens: 50,
      final: true,
      isSubagent: false,
    });
  });

  it('ignores a delta with no start, and keeps interleaved streams apart by parent_tool_use_id', () => {
    const heads = new Map();
    expect(
      finalUsageFromStreamEvent({ event: { type: 'message_delta', usage: { output_tokens: 9 } } }, heads),
    ).toBeNull();
    finalUsageFromStreamEvent(
      { parent_tool_use_id: 'toolA', event: { type: 'message_start', message: { id: 'a', usage: {} } } },
      heads,
    );
    finalUsageFromStreamEvent(
      { parent_tool_use_id: 'toolB', event: { type: 'message_start', message: { id: 'b', usage: {} } } },
      heads,
    );
    const fa = finalUsageFromStreamEvent(
      { parent_tool_use_id: 'toolA', event: { type: 'message_delta', usage: { output_tokens: 1 } } },
      heads,
    );
    const fb = finalUsageFromStreamEvent(
      { parent_tool_use_id: 'toolB', event: { type: 'message_delta', usage: { output_tokens: 2 } } },
      heads,
    );
    expect([fa?.messageId, fa?.isSubagent, fb?.messageId]).toEqual(['a', true, 'b']);
  });

  it('reads a subagent transcript: one final per id, with its timestamp; bad lines skipped', () => {
    const text = fs.readFileSync(path.join(FX, 'agent-a2d3a5720f1e5a422.jsonl'), 'utf8') + '\nnot json\n';
    const evs = finalUsageFromTranscript(text + text);
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({ outputTokens: 124, ephemeral5mInputTokens: 15_691, isSubagent: true, final: true });
    expect(typeof evs[0].callTs).toBe('string');
  });

  it('the SubagentStop hook fails soft on a missing transcript (the compaction sidechain)', async () => {
    const got: unknown[] = [];
    const hook = createSubagentUsageHook((e) => got.push(e));
    await expect(
      hook({ agent_transcript_path: path.join(FX, 'missing.jsonl') } as never, undefined, {
        signal: new AbortController().signal,
      }),
    ).resolves.toEqual({});
    expect(got).toHaveLength(0);
  });

  it('a subagent final read inside the turn is emitted BEFORE that turn result', async () => {
    const evs = await replay('background-subagents.jsonl');
    const heapFinal = evs.findIndex(
      (e) => e.type === 'message_usage' && e.final && e.isSubagent && e.outputTokens === 117,
    );
    const firstResult = evs.findIndex((e) => e.type === 'result');
    expect(heapFinal).toBeGreaterThan(-1);
    expect(heapFinal).toBeLessThan(firstResult);
  });

  it('the usage event carries modelUsage (helper calls included) and the error flag', async () => {
    const evs = await replay('main-two-turns.jsonl');
    const u = evs.find((e) => e.type === 'usage') as { modelUsage?: Record<string, unknown>; isError?: boolean };
    expect(Object.keys(u.modelUsage ?? {}).sort()).toEqual(['claude-haiku-4-5-20251001', 'claude-sonnet-5-5[1m]']);
    expect(u.isError).toBeUndefined();
  });
});

describe('REGRESSION GUARD — replayed sessions are accounted exactly', () => {
  it('main-thread session: ledger tokens == SDK modelUsage; counter == ledger == exact price', async () => {
    await replay('main-two-turns.jsonl');
    expect(ledgerTokens()).toEqual(lastModelUsage('main-two-turns.jsonl'));
    // Every sonnet cache write in this session was 1h; the helper call is Haiku.
    const exact =
      price(SONNET, { input: 6, output: 589, cacheRead: 50_316, cw1h: 26_698 }) +
      price(HAIKU, { input: 922, output: 12 });
    expect(spent()).toBeCloseTo(exact, 12);
    expect(ledgerUsd()).toBeCloseTo(exact, 12);
  });

  it('background subagents (one finishing after the result): exact, nothing double-counted', async () => {
    await replay('background-subagents.jsonl');
    expect(ledgerTokens()).toEqual(lastModelUsage('background-subagents.jsonl'));
    // Main calls wrote 1h cache, the two subagents 5m (22,070 + 15,691).
    const exact =
      price(SONNET, { input: 16, output: 631, cacheRead: 105_162, cw1h: 59_634 - 37_761, cw5: 37_761 }) +
      price(HAIKU, { input: 978, output: 17 });
    expect(spent()).toBeCloseTo(exact, 12);
    expect(ledgerUsd()).toBeCloseTo(exact, 12);
  });

  it('resume + /compact + resume: the compaction call is charged, the restored history is not', async () => {
    await replay('main-two-turns.jsonl');
    const sid = (load('main-two-turns.jsonl').find((m) => m.type === 'result') as { session_id: string }).session_id;
    await replay('resume-compact.jsonl', sid);
    await replay('resume-after-compact.jsonl', sid);
    expect(ledgerTokens()).toEqual(lastModelUsage('resume-after-compact.jsonl'));
    const exact =
      price(SONNET, { input: 2_044, output: 1_783, cacheRead: 87_746, cw1h: 41_240 }) +
      price(HAIKU, { input: 922, output: 12 });
    expect(spent()).toBeCloseTo(exact, 12);
    expect(ledgerUsd()).toBeCloseTo(exact, 12);
  });

  it('first run after deploy on a resumed session: history absorbed, only new calls charged', async () => {
    const sid = (load('main-two-turns.jsonl').find((m) => m.type === 'result') as { session_id: string }).session_id;
    await replay('resume-compact.jsonl', sid); // untracked → absorbed (incl. this compaction)
    expect(spent()).toBe(0);
    await replay('resume-after-compact.jsonl', sid);
    expect(spent()).toBeCloseTo(price(SONNET, { input: 2, output: 4, cacheRead: 11_062, cw1h: 14_253 }), 12);
    expect(ledgerUsd()).toBeCloseTo(spent(), 12);
  });
});
