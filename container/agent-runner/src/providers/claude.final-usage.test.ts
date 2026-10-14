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
 * Between processes the harness appends the `cost-state` entry Claude Code
 * writes into the session transcript when a process ends (its `modelUsage` is
 * the last result's), exactly as the real CLI did.
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
let subagentDir = '';
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
          const hook = lastOptions?.hooks?.SubagentStop?.[0]?.hooks?.[0];
          if (hook) {
            await hook(
              {
                ...input,
                agent_transcript_path: input.agent_transcript_path?.replace('__FIXTURE__', subagentDir),
                // The session transcript the subagents directory sits next to, and
                // its session (the fixture's sanitized inputs dropped both).
                transcript_path: `${path.dirname(subagentDir)}.jsonl`,
                session_id: path.basename(path.dirname(subagentDir)),
              },
              undefined,
              { signal: new AbortController().signal },
            );
          }
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
const {
  __resetSubagentReadCursors,
  createSubagentUsageHook,
  finalUsageFromStreamEvent,
  finalUsageFromTranscript,
  resultAccounting,
  validateSubagentTranscriptPath,
} = await import('./claude.js');
const { readRestoredModelUsage } = await import('./claude-history.js');
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

const MAIN_SID = (load('main-two-turns.jsonl').find((m) => m.type === 'result') as { session_id: string }).session_id;
const SUB_SID = (load('background-subagents.jsonl').find((m) => m.type === 'result') as { session_id: string })
  .session_id;

let tmp: string;
let prevHome: string | undefined;
let projectDir: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-finalusage-'));
  prevHome = process.env.HOME;
  process.env.HOME = tmp;
  projectDir = path.join(tmp, '.claude', 'projects', '-ws');
  subagentDir = path.join(projectDir, SUB_SID, 'subagents');
  fs.mkdirSync(subagentDir, { recursive: true });
  for (const f of fs.readdirSync(FX).filter((x) => x.startsWith('agent-'))) {
    fs.copyFileSync(path.join(FX, f), path.join(subagentDir, f));
  }
  __resetSubagentReadCursors();
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
    ledgerBaselineVersion: 1,
    seenMessageIds: [],
    claudeBackstop: newBackstopState(),
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

/** The `cost-state` Claude Code appends to the session transcript when a process ends. */
function endProcess(sid: string, fixture: string): void {
  const last = load(fixture)
    .filter((m) => m.type === 'result')
    .pop() as { modelUsage: Record<string, unknown> };
  fs.appendFileSync(
    path.join(projectDir, `${sid}.jsonl`),
    `${JSON.stringify({ type: 'user', sessionId: sid })}\n${JSON.stringify({ type: 'cost-state', sessionId: sid, modelUsage: last.modelUsage })}\n`,
  );
}

/** Run one fixture as one query — open its segment first, exactly as runPollLoop does. */
async function replay(name: string, continuation?: string, usageTracking = true): Promise<Ev[]> {
  script = load(name);
  const p = provider();
  if (usageTracking)
    H.beginClaudeSegment(continuation, continuation ? (p.readRestoredUsage?.(continuation) ?? null) : null);
  const q = p.query({ prompt: 'x', cwd: tmp, continuation, usageTracking });
  const out: Ev[] = [];
  let settled = false;
  for await (const e of q.events) {
    const ev = e as unknown as Ev;
    out.push(ev);
    if (ev.type === 'init') H.noteClaudeContinuation(ev.continuation as string, !continuation);
    if (ev.type === 'message_usage') H.recordMessageCost(e as never);
    if (ev.type === 'result' && ev.accounting) {
      H.recordTurnCost({ type: 'usage', ...(ev.accounting as object) } as never);
      settled = true;
    }
    if (ev.type === 'usage') {
      if (!settled) H.recordTurnCost(e as never);
      settled = false;
    }
  }
  return out;
}

/** Ledger tokens per model family (residual rows included). */
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

  it('a subagent final read inside the turn is emitted BEFORE that turn result', async () => {
    const evs = await replay('background-subagents.jsonl');
    const heapFinal = evs.findIndex(
      (e) => e.type === 'message_usage' && e.final && e.isSubagent && e.outputTokens === 117,
    );
    const firstResult = evs.findIndex((e) => e.type === 'result');
    expect(heapFinal).toBeGreaterThan(-1);
    expect(heapFinal).toBeLessThan(firstResult);
  });

  it('the result carries the accounting (helper calls included); a usage event follows', async () => {
    const evs = await replay('main-two-turns.jsonl');
    const r = evs.find((e) => e.type === 'result') as { accounting?: { modelUsage?: Record<string, unknown> } };
    expect(Object.keys(r.accounting?.modelUsage ?? {}).sort()).toEqual([
      'claude-haiku-4-5-20251001',
      'claude-sonnet-5-5[1m]',
    ]);
    expect(evs.filter((e) => e.type === 'usage')).toHaveLength(2);
  });

  it('an error result with ONLY modelUsage still produces accounting (item 6)', () => {
    const acc = resultAccounting({ modelUsage: { 'claude-sonnet-5-5': { inputTokens: 5, outputTokens: 7 } } }, true);
    expect(acc).toMatchObject({
      isError: true,
      inputTokens: 0,
      modelUsage: { 'claude-sonnet-5-5': { inputTokens: 5, outputTokens: 7 } },
    });
    expect(resultAccounting({}, false)).toBeNull();
  });
});

describe('SubagentStop transcript read — defensive (items 6, 7)', () => {
  const SINK = () => {
    const got: Array<Record<string, unknown>> = [];
    return { got, sink: (e: unknown) => got.push(e as Record<string, unknown>) };
  };
  const signal = { signal: new AbortController().signal };
  const projectsRoot = () => path.join(tmp, '.claude', 'projects');
  const transcript = () => path.join(projectDir, `${SUB_SID}.jsonl`);
  const realFile = () => path.join(subagentDir, 'agent-a2d3a5720f1e5a422.jsonl');
  const fire = async (
    p: string,
    opts: {
      transcriptPath?: string;
      sessionId?: string;
      querySession?: string;
      beforeInit?: boolean;
      budgetBytes?: number;
    } = {},
  ) => {
    const { got, sink } = SINK();
    await createSubagentUsageHook(sink, {
      projectsRoot: projectsRoot(),
      sessionId: () => (opts.beforeInit ? undefined : (opts.querySession ?? SUB_SID)),
      ...(opts.budgetBytes ? { budgetBytes: opts.budgetBytes } : {}),
    })(
      {
        agent_transcript_path: p,
        transcript_path: opts.transcriptPath ?? transcript(),
        session_id: opts.sessionId ?? SUB_SID,
      } as never,
      undefined,
      signal,
    );
    return got;
  };

  it("reads a regular agent-*.jsonl in THIS session's subagents directory", async () => {
    const got = await fire(realFile());
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({ outputTokens: 124, ephemeral5mInputTokens: 15_691, isSubagent: true, final: true });
  });

  it("rejects another session's transcript, a symlink out, a wrong name or depth, and a missing file", async () => {
    const other = path.join(projectDir, 'sess-other', 'subagents');
    fs.mkdirSync(other, { recursive: true });
    fs.copyFileSync(realFile(), path.join(other, 'agent-a2d3a5720f1e5a422.jsonl'));
    const outside = path.join(tmp, 'outside.jsonl');
    fs.copyFileSync(realFile(), outside);
    const link = path.join(subagentDir, 'agent-evil.jsonl');
    fs.symlinkSync(outside, link);
    const wrongName = path.join(subagentDir, 'notes.jsonl');
    fs.copyFileSync(realFile(), wrongName);
    const wrongDepth = path.join(projectDir, 'agent-x.jsonl');
    fs.copyFileSync(realFile(), wrongDepth);
    for (const p of [
      path.join(other, 'agent-a2d3a5720f1e5a422.jsonl'),
      link,
      wrongName,
      wrongDepth,
      path.join(subagentDir, 'agent-missing.jsonl'),
    ]) {
      expect(validateSubagentTranscriptPath(p, projectsRoot(), transcript())).toBeNull();
      expect(await fire(p)).toHaveLength(0);
    }
  });

  it("is bound to the RUNNING query: the hook's session, its transcript and the query's init must agree (R3-5)", async () => {
    expect(await fire(realFile(), { querySession: SUB_SID })).toHaveLength(1);
    __resetSubagentReadCursors();
    // A hook naming another session than its own transcript, or than this query.
    expect(await fire(realFile(), { sessionId: 'sess-forged' })).toHaveLength(0);
    expect(await fire(realFile(), { querySession: 'sess-other-query' })).toHaveLength(0);
    // The query's own session id cannot vouch for another session's transcript.
    const otherDir = path.join(projectDir, 'sess-other2', 'subagents');
    fs.mkdirSync(otherDir, { recursive: true });
    fs.copyFileSync(realFile(), path.join(otherDir, 'agent-a2d3a5720f1e5a422.jsonl'));
    expect(
      await fire(path.join(otherDir, 'agent-a2d3a5720f1e5a422.jsonl'), {
        transcriptPath: path.join(projectDir, 'sess-other2.jsonl'),
      }),
    ).toHaveLength(0);
    // Before the query's init has named its session, nothing is trusted.
    expect(await fire(realFile(), { beforeInit: true })).toHaveLength(0);
    // Both paths of another session agreeing with each other are still not this query's.
    const otherSub = path.join(projectDir, 'sess-other', 'subagents');
    fs.mkdirSync(otherSub, { recursive: true });
    fs.copyFileSync(realFile(), path.join(otherSub, 'agent-a2d3a5720f1e5a422.jsonl'));
    expect(
      await fire(path.join(otherSub, 'agent-a2d3a5720f1e5a422.jsonl'), {
        transcriptPath: path.join(projectDir, 'sess-other.jsonl'),
        sessionId: 'sess-other',
        querySession: SUB_SID,
      }),
    ).toHaveLength(0);
  });

  it('a read budget yields the hook; a re-fire continues from the cursor (R3-6)', async () => {
    const big = path.join(subagentDir, 'agent-budget.jsonl');
    const pad = `${JSON.stringify({ type: 'user', pad: 'x'.repeat(1_000_000) })}\n`;
    fs.writeFileSync(big, pad.repeat(6) + fs.readFileSync(realFile(), 'utf8').trimEnd());
    // 4 MiB budget: the first invocation stops before the record (and never
    // mistakes its partial carry for the final record).
    expect(await fire(big, { budgetBytes: 4 * 1024 * 1024 })).toHaveLength(0);
    expect((await fire(big)).map((e) => e.outputTokens)).toEqual([124]);
  });

  it('reads a transcript of any size completely, in bounded chunks (no size skip)', async () => {
    const big = path.join(subagentDir, 'agent-big.jsonl');
    const pad = `${JSON.stringify({ type: 'user', pad: 'x'.repeat(1_000_000) })}\n`;
    fs.writeFileSync(big, pad.repeat(6) + fs.readFileSync(realFile(), 'utf8'));
    expect(fs.statSync(big).size).toBeGreaterThan(4 * 1024 * 1024);
    expect((await fire(big)).map((e) => e.outputTokens)).toEqual([124]);
  });

  it('a final record without a trailing newline is read — the transcript is complete at SubagentStop', async () => {
    const noNl = path.join(subagentDir, 'agent-nonl.jsonl');
    fs.writeFileSync(noNl, fs.readFileSync(realFile(), 'utf8').trimEnd());
    expect((await fire(noNl)).map((e) => e.outputTokens)).toEqual([124]);
  });

  it('a re-fired hook reads only what was appended', async () => {
    await fire(realFile());
    const line = JSON.parse(fs.readFileSync(realFile(), 'utf8').trim()) as { message: { id: string } };
    line.message.id = 'msg_appended';
    fs.appendFileSync(realFile(), `${JSON.stringify(line)}\n`);
    expect((await fire(realFile())).map((e) => e.messageId)).toEqual(['msg_appended']);
  });

  it('drops invalid numbers and malformed lines; canonicalizes timestamps', () => {
    const evs = finalUsageFromTranscript(
      [
        'not json',
        JSON.stringify({
          type: 'assistant',
          message: { id: 'm1', usage: { input_tokens: -5, output_tokens: 'x', cache_read_input_tokens: 1e400 } },
        }),
        JSON.stringify({
          type: 'assistant',
          message: { id: 'm2', usage: { output_tokens: 7 } },
          timestamp: 'not a date',
        }),
        JSON.stringify({
          type: 'assistant',
          message: { id: 'm3', usage: { output_tokens: 1 } },
          timestamp: '2026-10-14T11:59:59+02:00',
        }),
      ].join('\n'),
    );
    expect(evs.map((e) => [e.messageId, e.inputTokens, e.outputTokens, e.cacheReadInputTokens, e.callTs])).toEqual([
      ['m1', 0, 0, 0, undefined],
      ['m2', 0, 7, 0, undefined],
      ['m3', 0, 1, 0, '2026-10-14T09:59:59.000Z'],
    ]);
  });

  it('is not registered when the consumer does not meter usage', async () => {
    await replay('background-subagents.jsonl', undefined, false);
    expect(lastOptions?.hooks?.SubagentStop).toBeUndefined();
  });
});

describe('restore baseline from the transcript', () => {
  it('reads the LAST cost-state, scanning backwards across chunks', () => {
    const file = path.join(projectDir, 'sess-r.jsonl');
    const filler = `${JSON.stringify({ type: 'user', pad: 'x'.repeat(300_000) })}\n`;
    fs.writeFileSync(
      file,
      `${JSON.stringify({ type: 'cost-state', modelUsage: { a: { outputTokens: 1 } } })}\n` +
        filler +
        `${JSON.stringify({ type: 'cost-state', modelUsage: { a: { outputTokens: 2 } } })}\n` +
        filler,
    );
    expect(readRestoredModelUsage('sess-r')).toEqual({ a: { outputTokens: 2 } });
    expect(readRestoredModelUsage('sess-none')).toBeNull();
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
    endProcess(MAIN_SID, 'main-two-turns.jsonl');
    await replay('resume-compact.jsonl', MAIN_SID);
    endProcess(MAIN_SID, 'resume-compact.jsonl');
    await replay('resume-after-compact.jsonl', MAIN_SID);
    expect(ledgerTokens()).toEqual(lastModelUsage('resume-after-compact.jsonl'));
    const exact =
      price(SONNET, { input: 2_044, output: 1_783, cacheRead: 87_746, cw1h: 41_240 }) +
      price(HAIKU, { input: 922, output: 12 });
    expect(spent()).toBeCloseTo(exact, 12);
    expect(ledgerUsd()).toBeCloseTo(exact, 12);
  });

  it('first run after deploy: the transcript cost-state baselines even the first turn — its compaction is charged', async () => {
    // No runner state at all for this session, but the transcript has the saved totals.
    endProcess(MAIN_SID, 'main-two-turns.jsonl');
    await replay('resume-compact.jsonl', MAIN_SID);
    const compaction = price(SONNET, { input: 2_036, output: 1_190, cacheRead: 26_368, cw5: 289 });
    expect(spent()).toBeCloseTo(compaction, 12); // 5m: no main-thread TTL observed yet
    expect(ledgerUsd()).toBeCloseTo(spent(), 12);
  });

  it('only with neither a transcript cost-state nor a checkpoint is the first result absorbed', async () => {
    await replay('resume-compact.jsonl', MAIN_SID); // no transcript written for this session
    expect(spent()).toBe(0);
    await replay('resume-after-compact.jsonl', MAIN_SID); // checkpoint from the absorbed result now exists
    expect(spent()).toBeCloseTo(price(SONNET, { input: 2, output: 4, cacheRead: 11_062, cw1h: 14_253 }), 12);
  });
});
