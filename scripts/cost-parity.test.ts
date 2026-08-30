/**
 * Tests for the cost-parity harness (scripts/cost-parity.ts, issue #1375).
 *
 * HERMETIC ONLY. Nothing here shells out to ccusage or reads a real transcript:
 * CI has neither. The oracle-facing code is exercised through its PURE folders
 * (`foldClaudeDaily` / `foldCodexDaily`), fed the JSON shapes ccusage actually
 * emits — which is where every ccusage bug we have hit actually lived (a wrong
 * flag, a wrong field name, an unpriced model), never in the transport.
 *
 * Leg 1 is tested against SYNTHETIC dashboard trees rather than only the real
 * one, because on nv-main alone `dashboard/` is absent and the real check
 * SKIPs — a suite that only asserted "did not report drift" would pass just as
 * happily if the guard never ran. The synthetic cases prove it catches each
 * drift shape that has actually burned us in prod.
 */
import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { afterEach, describe, expect, it } from 'vitest';

import { CODEX_MODEL_PRICING } from '../container/agent-runner/src/codex-cost.js';
import { MODEL_PRICING } from '../container/agent-runner/src/pricing.js';
import {
  checkTableParity,
  codexDayKey,
  compareCounterToLedger,
  compareLeg,
  compareLedgerToReprice,
  DEFAULT_THRESHOLDS,
  emptyTokens,
  findDashboardPricingFiles,
  foldClaudeDaily,
  foldCodexDaily,
  isClaudeModel,
  parseArgs,
  parseCcusageJson,
  readSessionMeters,
  repriceClaudeTranscripts,
  repriceCodexHome,
  resolveClaudeConfigDir,
  totalTokens,
  withinSince,
  type OracleResult,
  type TokenTotals,
} from './cost-parity.js';

const RUNNER_PRICING = path.resolve(
  fileURLToPath(new URL('../container/agent-runner/src/pricing.ts', import.meta.url)),
);
const RUNNER_CODEX = path.resolve(
  fileURLToPath(new URL('../container/agent-runner/src/codex-cost.ts', import.meta.url)),
);

const tmpDirs: string[] = [];
function tmp(prefix: string): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpDirs.push(d);
  return d;
}
afterEach(() => {
  while (tmpDirs.length > 0) fs.rmSync(tmpDirs.pop()!, { recursive: true, force: true });
});

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

// ───────────────────────── LEG 1: synthetic dashboard trees ─────────────────

/**
 * A stand-in dashboard tree. The "agrees" case re-exports the RUNNER's own table
 * and normalizer through the declaration forms the discovery regex looks for, so
 * it can never drift for the wrong reason when a real rate changes; each drift
 * case perturbs exactly one thing on top of that.
 */
function fakeRepo(opts: { claude?: string; codex?: string } = {}): string {
  const root = tmp('cost-parity-repo-');
  const claude =
    opts.claude ??
    `import { MODEL_PRICING as R, normalizeModel as N } from ${JSON.stringify(RUNNER_PRICING)};
export const MODEL_PRICING: Record<string, Record<string, number>> = R as unknown as Record<string, Record<string, number>>;
export function normalizeModel(m: string | undefined): string { return N(m); }
`;
  const codex =
    opts.codex ??
    `import { CODEX_MODEL_PRICING as R, normalizeCodexModel as N } from ${JSON.stringify(RUNNER_CODEX)};
export const CODEX_MODEL_PRICING: Record<string, Record<string, number>> = R as unknown as Record<string, Record<string, number>>;
export function normalizeCodexModel(m: string | undefined): string { return N(m); }
`;
  write(path.join(root, 'dashboard', 'session-costs.ts'), claude);
  write(path.join(root, 'dashboard', 'codex-costs.ts'), codex);
  return root;
}

describe('leg 1 — table parity discovery', () => {
  it('skips, loudly and with a reason, when the dashboard half is not in the tree', async () => {
    const root = tmp('cost-parity-empty-');
    const r = await checkTableParity(root);
    expect(r.status).toBe('skipped');
    expect(r.reason).toMatch(/nv-dashboard/);
    expect(r.checks).toBe(0);
  });

  it('discovers by CONTENT, so renaming the dashboard module cannot disable the guard', async () => {
    const root = fakeRepo();
    fs.renameSync(
      path.join(root, 'dashboard', 'session-costs.ts'),
      path.join(root, 'dashboard', 'renamed-by-someone.ts'),
    );
    const files = findDashboardPricingFiles(root);
    expect(files.map((f) => path.basename(f)).sort()).toEqual(['codex-costs.ts', 'renamed-by-someone.ts']);
    const r = await checkTableParity(root);
    expect(r.status).toBe('ok');
  });

  it('ignores .test.ts files (they import the module, they are not the module)', () => {
    const root = fakeRepo();
    write(path.join(root, 'dashboard', 'decoy.test.ts'), 'export const MODEL_PRICING = { nope: { input: 1 } };\n');
    expect(findDashboardPricingFiles(root).some((f) => f.endsWith('decoy.test.ts'))).toBe(false);
  });

  it('passes when the two copies agree', async () => {
    const r = await checkTableParity(fakeRepo());
    expect(r.findings).toEqual([]);
    expect(r.status).toBe('ok');
    // Both sides plus the normalizer battery actually ran — a green run with
    // zero checks is the vacuous pass this guard must never produce.
    expect(r.checks).toBeGreaterThan(50);
    expect(r.modules).toHaveLength(2);
  });
});

describe('leg 1 — the drift shapes that actually burned us', () => {
  it('catches a WRONG rate (sonnet-5 carrying sonnet-4-6 prices: a silent 50% markup)', async () => {
    const root = fakeRepo({
      claude: `import { MODEL_PRICING as R, normalizeModel as N } from ${JSON.stringify(RUNNER_PRICING)};
export const MODEL_PRICING: Record<string, Record<string, number>> = {
  ...(R as unknown as Record<string, Record<string, number>>),
  'claude-sonnet-5': { input: 3e-6, output: 15e-6, cacheCreate: 3.75e-6, cacheRead: 3e-7 },
};
export function normalizeModel(m: string | undefined): string { return N(m); }
`,
    });
    const r = await checkTableParity(root);
    expect(r.status).toBe('drift');
    expect(r.findings.join('\n')).toMatch(
      /claude: rate drift on claude-sonnet-5\.(input|output|cacheCreate|cacheRead)/,
    );
  });

  it('catches a model the DASHBOARD prices and the runner cannot — the cost cap goes blind', async () => {
    const root = fakeRepo({
      codex: `import { CODEX_MODEL_PRICING as R, normalizeCodexModel as N } from ${JSON.stringify(RUNNER_CODEX)};
export const CODEX_MODEL_PRICING: Record<string, Record<string, number>> = {
  ...(R as unknown as Record<string, Record<string, number>>),
  'gpt-6-brandnew': { input: 9e-6, output: 40e-6, cacheRead: 1e-6 },
};
export function normalizeCodexModel(m: string | undefined): string { return N(m); }
`,
    });
    const r = await checkTableParity(root);
    expect(r.status).toBe('drift');
    expect(r.findings.join('\n')).toMatch(/codex: the runner cannot price gpt-6-brandnew/);
  });

  it('catches NORMALIZER drift on a dated snapshot id (the 25x luna overcharge)', async () => {
    // The tables are byte-identical here. Only the function that decides WHICH
    // row to read differs — which is exactly how the real defect presented:
    // `gpt-5.6-luna-20260101` resolved to '' on the enforcer side and fell to
    // DEFAULT_CODEX_RATE ($5/$30) against luna's real $0.2/$1.2.
    const root = fakeRepo({
      codex: `import { CODEX_MODEL_PRICING as R, normalizeCodexModel as N } from ${JSON.stringify(RUNNER_CODEX)};
export const CODEX_MODEL_PRICING: Record<string, Record<string, number>> = R as unknown as Record<string, Record<string, number>>;
export function normalizeCodexModel(m: string | undefined): string {
  if (m && /-\\d{8}$/.test(m)) return '';
  return N(m);
}
`,
    });
    const r = await checkTableParity(root);
    expect(r.status).toBe('drift');
    expect(r.findings.join('\n')).toMatch(/codex: normalizer drift on "gpt-5\.6-luna-20260101"/);
  });

  it('fails rather than passing vacuously when a discovered module exports no table', async () => {
    // The module shape moved out from under the discovery regex. A guard that
    // finds files, loads nothing, and reports green is worse than no guard.
    const root = tmp('cost-parity-shapeshift-');
    write(
      path.join(root, 'dashboard', 'session-costs.ts'),
      '// export const MODEL_PRICING moved elsewhere\nexport const NOTHING = 1;\nexport function normalizeModel(m?: string) { return m ?? ""; }\n',
    );
    const r = await checkTableParity(root);
    expect(r.status).toBe('drift');
    expect(r.findings.join('\n')).toMatch(/none exported a rate table/);
  });

  it('notes (but allows) a model only the runner prices — the enforcer may be stricter', async () => {
    const root = fakeRepo({
      claude: `import { MODEL_PRICING as R, normalizeModel as N } from ${JSON.stringify(RUNNER_PRICING)};
const { 'claude-haiku-4-5': _dropped, ...rest } = R as unknown as Record<string, Record<string, number>>;
export const MODEL_PRICING: Record<string, Record<string, number>> = rest;
export function normalizeModel(m: string | undefined): string { return N(m); }
`,
    });
    const r = await checkTableParity(root);
    expect(r.status).toBe('ok');
    expect(r.notes.join('\n')).toMatch(/claude: runner prices claude-haiku-4-5/);
  });
});

describe('leg 1 — against this actual checkout', () => {
  it('never reports drift (ok in the composed tree, skipped on nv-main alone)', async () => {
    const r = await checkTableParity();
    expect(r.findings).toEqual([]);
    expect(['ok', 'skipped']).toContain(r.status);
  });
});

// ─────────────────────── LEG 2: reprice fixtures (hermetic) ─────────────────

/** One assistant transcript row. `requestId` is deliberately absent — Bedrock. */
function assistantRow(o: {
  id?: string;
  model: string;
  ts: string;
  uuid: string;
  usage: Record<string, unknown>;
  type?: string;
}): string {
  return JSON.stringify({
    type: o.type ?? 'assistant',
    uuid: o.uuid,
    timestamp: o.ts,
    message: { ...(o.id ? { id: o.id } : {}), model: o.model, usage: o.usage },
  });
}

const OPUS_USAGE = {
  input_tokens: 1000,
  output_tokens: 500,
  cache_read_input_tokens: 20000,
  cache_creation_input_tokens: 3000,
};
// 1000*5e-6 + 500*25e-6 + 20000*5e-7 + 3000*6.25e-6
const OPUS_USD = 0.005 + 0.0125 + 0.01 + 0.01875; // 0.04625

const SONNET_USAGE = {
  input_tokens: 100,
  output_tokens: 50,
  cache_read_input_tokens: 1000,
  // Present but IGNORED: the per-TTL split below wins when it exists.
  cache_creation_input_tokens: 800,
  cache_creation: { ephemeral_5m_input_tokens: 300, ephemeral_1h_input_tokens: 500 },
};
// 100*2e-6 + 50*10e-6 + 1000*2e-7 + 300*2.5e-6 + 500*(2e-6*2)
const SONNET_USD = 0.0002 + 0.0005 + 0.0002 + 0.00075 + 0.002; // 0.00365

/**
 * Two transcript files for one session. The same opus message is logged THREE
 * times — twice in file A (one row per content block, distinct top-level uuid,
 * identical `message.id` and identical `usage`) and once more in file B (a
 * resume replay). No row carries a requestId, and the ids are Bedrock
 * `msg_bdrk_*`. This is the exact shape that makes an (id, requestId) dedup gate
 * never fire and double-count.
 */
function claudeFixture(): string {
  const root = tmp('cost-parity-claude-');
  const dir = path.join(root, 'projects', '-workspace-agent');
  write(
    path.join(dir, 'a.jsonl'),
    [
      assistantRow({
        id: 'msg_bdrk_01ABCDEF',
        model: 'aws/anthropic/bedrock-claude-opus-5',
        ts: '2026-08-01T10:00:00.000Z',
        uuid: 'u1',
        usage: OPUS_USAGE,
      }),
      assistantRow({
        id: 'msg_bdrk_01ABCDEF',
        model: 'aws/anthropic/bedrock-claude-opus-5',
        ts: '2026-08-01T10:00:00.100Z',
        uuid: 'u2',
        usage: OPUS_USAGE,
      }),
      // Usage-bearing but not an assistant turn — must not be charged.
      assistantRow({
        id: 'msg_bdrk_09USERROW',
        model: 'claude-opus-5',
        ts: '2026-08-01T10:00:01.000Z',
        uuid: 'u3',
        usage: { input_tokens: 999999 },
        type: 'user',
      }),
      // No message.id: undedupable, so counted and NOT charged (matches the runner).
      assistantRow({
        model: 'claude-opus-5',
        ts: '2026-08-01T10:00:02.000Z',
        uuid: 'u4',
        usage: { input_tokens: 777777 },
      }),
      '', // trailing newline
    ].join('\n'),
  );
  write(
    path.join(dir, 'b.jsonl'),
    [
      // Cross-FILE replay of the same message — dedup is session-wide, not per file.
      assistantRow({
        id: 'msg_bdrk_01ABCDEF',
        model: 'aws/anthropic/bedrock-claude-opus-5',
        ts: '2026-08-01T10:00:00.200Z',
        uuid: 'u5',
        usage: OPUS_USAGE,
      }),
      assistantRow({
        id: 'msg_bdrk_02GHIJKL',
        model: 'claude-sonnet-5[1m]',
        ts: '2026-08-02T11:00:00.000Z',
        uuid: 'u6',
        usage: SONNET_USAGE,
      }),
      // Bills tokens under a model no table knows: priced $0 and REPORTED.
      assistantRow({
        id: 'msg_bdrk_03MNOPQR',
        model: 'claude-fictional-9',
        ts: '2026-08-02T11:00:01.000Z',
        uuid: 'u7',
        usage: { input_tokens: 10 },
      }),
      '',
    ].join('\n'),
  );
  return root;
}

describe('leg 2 — Claude reprice', () => {
  it('collapses a double-logged message.id to ONE charge (id alone, no requestId)', () => {
    const r = repriceClaudeTranscripts(claudeFixture());
    // Three rows carry msg_bdrk_01ABCDEF; exactly one is billed.
    expect(r.duplicates).toBe(2);
    expect(r.byModel['claude-opus-5']).toBeCloseTo(OPUS_USD, 10);
  });

  it('prices with the runner’s own priceUsage, honouring the 1h cache-write premium', () => {
    const r = repriceClaudeTranscripts(claudeFixture());
    // 1h writes cost 2x input, not 1.25x. Pricing the flat cache_creation field
    // at the 5m rate understated prod by a consistent ~16% against ccusage.
    expect(r.byModel['claude-sonnet-5']).toBeCloseTo(SONNET_USD, 10);
    expect(r.totalUsd).toBeCloseTo(OPUS_USD + SONNET_USD, 10);
  });

  it('counts but does not charge undedupable and non-assistant rows', () => {
    const r = repriceClaudeTranscripts(claudeFixture());
    expect(r.missingId).toBe(1);
    expect(r.nonAssistant).toBe(1);
    // 777777 + 999999 input tokens of opus would have been ~$8.9 if charged.
    expect(r.tokens.input).toBe(OPUS_USAGE.input_tokens + SONNET_USAGE.input_tokens + 10);
    expect(r.messages).toBe(3);
    expect(r.files).toBe(2);
  });

  it('reports an unpriced model instead of silently reading it as free', () => {
    const r = repriceClaudeTranscripts(claudeFixture());
    expect(r.unpricedModels).toEqual(['claude-fictional-9']);
    expect(r.byModel['?claude-fictional-9']).toBe(0);
  });

  it('buckets by UTC day and honours --since', () => {
    const root = claudeFixture();
    const all = repriceClaudeTranscripts(root);
    expect(Object.keys(all.byDay).sort()).toEqual(['2026-08-01', '2026-08-02']);
    expect(all.byDay['2026-08-01']).toBeCloseTo(OPUS_USD, 10);
    const since = repriceClaudeTranscripts(root, '20260802');
    expect(since.totalUsd).toBeCloseTo(SONNET_USD, 10);
    expect(since.byDay['2026-08-01']).toBeUndefined();
  });
});

/**
 * Two codex rollouts under one CODEX_HOME. File B is a forked subagent thread:
 * it REPLAYS file A's first call byte-for-byte, then adds one of its own.
 * Summing files independently over-counts (13.7% and 19.2% measured on prod
 * sessions with forks), so the replayed call must be charged exactly once, to
 * the earlier-sorted file.
 */
const SOL = 'azure/openai/gpt-5.6-sol';
function tokenCountRow(ts: string, input: number, cached: number, output: number): string {
  return JSON.stringify({
    timestamp: ts,
    type: 'event_msg',
    payload: {
      type: 'token_count',
      info: { last_token_usage: { input_tokens: input, cached_input_tokens: cached, output_tokens: output } },
    },
  });
}
function turnContextRow(ts: string, model: string): string {
  return JSON.stringify({ timestamp: ts, type: 'turn_context', payload: { model } });
}

// (1000-400)*5e-6 + 400*0.5e-6 + 200*30e-6
const CALL1_USD = 0.003 + 0.0002 + 0.006; // 0.0092
// (2000-1000)*5e-6 + 1000*0.5e-6 + 500*30e-6
const CALL2_USD = 0.005 + 0.0005 + 0.015; // 0.0205
// (100-0)*5e-6 + 0 + 50*30e-6
const CALL3_USD = 0.0005 + 0.0015; // 0.002

function codexFixture(): string {
  const home = tmp('cost-parity-codex-');
  const day = path.join(home, 'sessions', '2026', '08', '01');
  write(
    path.join(day, 'rollout-2026-08-01T00-00-00-aaaaaaaa.jsonl'),
    [
      turnContextRow('2026-08-01T00:00:00.000Z', SOL),
      tokenCountRow('2026-08-01T00:00:01.000Z', 1000, 400, 200),
      tokenCountRow('2026-08-02T00:00:01.000Z', 2000, 1000, 500),
      // All-zero bookkeeping tick: codex saying "no call happened". Charging it
      // would also poison the dedup set with a degenerate key.
      tokenCountRow('2026-08-02T00:00:02.000Z', 0, 0, 0),
      '',
    ].join('\n'),
  );
  write(
    path.join(day, 'rollout-2026-08-02T00-00-00-bbbbbbbb.jsonl'),
    [
      turnContextRow('2026-08-02T00:00:00.000Z', SOL),
      tokenCountRow('2026-08-01T00:00:01.000Z', 1000, 400, 200), // replayed — already billed to A
      tokenCountRow('2026-08-02T00:00:03.000Z', 100, 0, 50),
      '',
    ].join('\n'),
  );
  return home;
}

describe('leg 2 — Codex reprice', () => {
  it('charges a forked rollout’s replayed call exactly once', () => {
    const r = repriceCodexHome(codexFixture());
    expect(r.calls).toBe(3); // not 4 — the replay is deduped across files
    expect(r.totalUsd).toBeCloseTo(CALL1_USD + CALL2_USD + CALL3_USD, 10);
  });

  it('reports net-of-cache input tokens, matching ccusage’s columns', () => {
    const r = repriceCodexHome(codexFixture());
    expect(r.tokens).toEqual({
      input: 600 + 1000 + 100,
      cacheRead: 400 + 1000 + 0,
      output: 200 + 500 + 50,
      cacheCreate: 0,
    });
    expect(r.errors).toBe(0);
    expect(r.unpricedModels).toEqual([]);
    expect(r.byModel['gpt-5.6-sol']).toBeCloseTo(CALL1_USD + CALL2_USD + CALL3_USD, 10);
  });

  it('buckets by UTC day from the row timestamp (not the path) and honours --since', () => {
    const home = codexFixture();
    const all = repriceCodexHome(home);
    expect(all.byDay['2026-08-01']).toBeCloseTo(CALL1_USD, 10);
    expect(all.byDay['2026-08-02']).toBeCloseTo(CALL2_USD + CALL3_USD, 10);
    const since = repriceCodexHome(home, '20260802');
    expect(since.totalUsd).toBeCloseTo(CALL2_USD + CALL3_USD, 10);
    expect(since.calls).toBe(2);
  });

  it('flags a model the rate table does not know (it falls to the $5/$30 default)', () => {
    const home = tmp('cost-parity-codex-unknown-');
    write(
      path.join(home, 'sessions', 'rollout-2026-08-01T00-00-00-cccccccc.jsonl'),
      [
        turnContextRow('2026-08-01T00:00:00.000Z', 'azure/openai/gpt-9-imaginary'),
        tokenCountRow('2026-08-01T00:00:01.000Z', 100, 0, 10),
        '',
      ].join('\n'),
    );
    const r = repriceCodexHome(home);
    expect(r.unpricedModels).toEqual(['azure/openai/gpt-9-imaginary']);
    expect(r.byModel['?azure/openai/gpt-9-imaginary']).toBeGreaterThan(0);
  });
});

// ───────────────────── the oracle: pure folders over real shapes ────────────

describe('foldClaudeDaily', () => {
  const parsed = {
    daily: [
      {
        date: '2026-08-01',
        modelBreakdowns: [
          {
            modelName: 'claude-opus-5',
            inputTokens: 1000,
            outputTokens: 500,
            cacheCreationTokens: 3000,
            cacheReadTokens: 20000,
            cost: OPUS_USD,
          },
          // ccusage 19+ auto-aggregates every detected agent regardless of
          // CLAUDE_CONFIG_DIR. Without the filter this host-wide codex spend
          // lands on a Claude coworker that never ran codex.
          {
            modelName: 'gpt-5.6-sol',
            inputTokens: 600,
            outputTokens: 200,
            cacheCreationTokens: 0,
            cacheReadTokens: 400,
            cost: CALL1_USD,
          },
          // Tokens present, cost 0 — the 52x-understatement signature.
          {
            modelName: 'claude-sonnet-5',
            inputTokens: 10,
            outputTokens: 5,
            cacheCreationTokens: 0,
            cacheReadTokens: 0,
            cost: 0,
          },
        ],
      },
    ],
  };

  it('keeps only Claude models, so co-detected codex spend cannot contaminate the leg', () => {
    const r = foldClaudeDaily(parsed);
    expect(r.totalUsd).toBeCloseTo(OPUS_USD, 10);
    expect(Object.keys(r.byModel).sort()).toEqual(['claude-opus-5', 'claude-sonnet-5']);
    expect(r.byDay['2026-08-01']).toBeCloseTo(OPUS_USD, 10);
    expect(r.days).toBe(1);
  });

  it('surfaces models ccusage priced at $0 with tokens present', () => {
    expect(foldClaudeDaily(parsed).zeroPriced).toEqual(['claude-sonnet-5']);
  });

  it('accumulates tokens for EVERY Claude model, including the $0-priced one', () => {
    // The tokens of an unpriced model are the only evidence it was used at all.
    // Dropping them alongside its (zero) cost is what makes a 52x understatement
    // look like a small, plausible bill.
    const r = foldClaudeDaily(parsed);
    expect(r.tokens).toEqual({ input: 1010, output: 505, cacheRead: 20000, cacheCreate: 3000 });
    // ...and codex's tokens stay out, exactly as its dollars do.
    expect(totalTokens(r.tokens)).toBe(1010 + 505 + 20000 + 3000);
  });

  it('accepts ccusage 19+ rows keyed `period` instead of `date`', () => {
    const r = foldClaudeDaily({
      daily: [{ period: '2026-08-03', modelBreakdowns: [{ modelName: 'claude-opus-5', cost: 1 }] }],
    });
    expect(r.byDay['2026-08-03']).toBe(1);
  });

  it('refuses a row with no modelBreakdowns rather than comparing a contaminated total', () => {
    // Without a per-model split there is no way to separate Claude from codex.
    // Returning the raw total would silently inflate the leg.
    expect(() => foldClaudeDaily({ daily: [{ date: '2026-08-01', totalCost: 5 }] })).toThrow(/modelBreakdowns/);
  });

  it('isClaudeModel spans every prefix prod emits', () => {
    for (const m of ['claude-opus-5', 'aws/anthropic/bedrock-claude-opus-5', 'anthropic/claude-sonnet-5']) {
      expect(isClaudeModel(m), m).toBe(true);
    }
    for (const m of ['gpt-5.6-sol', 'azure/openai/gpt-5.6-sol', 'gemini-3-pro']) {
      expect(isClaudeModel(m), m).toBe(false);
    }
  });
});

describe('foldCodexDaily', () => {
  const parsed = {
    daily: [
      {
        // The codex subcommand emits human dates, not ISO.
        date: 'Aug 01, 2026',
        costUSD: CALL1_USD,
        totalTokens: 1600,
        models: {
          'gpt-5.6-sol': { totalTokens: 1600, inputTokens: 1000, cachedInputTokens: 400, outputTokens: 200 },
        },
        // Present on the Claude feed, meaningless here. Reading it instead of
        // `models` yields undefined and silently drops the whole breakdown.
        modelsUsed: ['THIS-FIELD-IS-A-TRAP'],
      },
      { date: 'Aug 02, 2026', costUSD: 0, totalTokens: 100, models: { 'gpt-9-imaginary': { totalTokens: 100 } } },
    ],
  };

  it('reads the per-model split from `models`, never `modelsUsed`', () => {
    const r = foldCodexDaily(parsed);
    expect(Object.keys(r.byModel).sort()).toEqual(['gpt-5.6-sol', 'gpt-9-imaginary']);
    expect(r.byModel['THIS-FIELD-IS-A-TRAP']).toBeUndefined();
    expect(r.byModel['gpt-5.6-sol']).toBeCloseTo(CALL1_USD, 10);
  });

  it('normalises "Aug 01, 2026" to an ISO day so it compares against our buckets', () => {
    const r = foldCodexDaily(parsed);
    expect(r.byDay['2026-08-01']).toBeCloseTo(CALL1_USD, 10);
    expect(r.totalUsd).toBeCloseTo(CALL1_USD, 10);
    expect(r.days).toBe(2);
  });

  it('surfaces a day ccusage priced at $0 with tokens present', () => {
    expect(foldCodexDaily(parsed).zeroPriced).toEqual(['gpt-9-imaginary']);
  });

  it('reads ccusage 20.x tokens, where inputTokens is ALREADY net and cache lives in cacheReadTokens', () => {
    // Verified against a real `ccusage@20.0.19 codex daily --json --offline`
    // run: for a wire call of input 1000 / cached 400 / output 200 it emits
    // inputTokens 600, cacheReadTokens 400, totalTokens 1200.
    const r = foldCodexDaily({
      daily: [
        {
          date: '2026-08-01',
          costUSD: 1,
          totalTokens: 1200,
          inputTokens: 600,
          cacheReadTokens: 400,
          cacheCreationTokens: 0,
          outputTokens: 200,
          reasoningOutputTokens: 0,
          models: { 'azure/openai/gpt-5.6-sol': { totalTokens: 1200 } },
        },
      ],
    });
    expect(r.tokens).toEqual({ input: 600, cacheRead: 400, output: 200, cacheCreate: 0 });
  });

  it('still nets the LEGACY shape, where inputTokens is inclusive of cachedInputTokens', () => {
    // Applying the legacy rule to the 20.x shape is not a rounding error: it
    // zeroes the cache column and subtracts net-from-net. On a fixture whose
    // DOLLARS matched to the cent it produced 2,300 tokens against a true 3,700
    // — which is exactly why tokens are compared at all.
    const r = foldCodexDaily({
      daily: [
        {
          date: 'Aug 01, 2026',
          costUSD: 1,
          totalTokens: 1600,
          inputTokens: 1000,
          cachedInputTokens: 400,
          outputTokens: 200,
          models: { 'gpt-5.6-sol': { totalTokens: 1600 } },
        },
      ],
    });
    expect(r.tokens).toEqual({ input: 600, cacheRead: 400, output: 200, cacheCreate: 0 });
  });

  it('never adds reasoningOutputTokens — ccusage counts them inside outputTokens', () => {
    const r = foldCodexDaily({
      daily: [
        {
          date: '2026-08-01',
          costUSD: 1,
          totalTokens: 200,
          inputTokens: 0,
          cacheReadTokens: 0,
          outputTokens: 200,
          reasoningOutputTokens: 150,
          models: {},
        },
      ],
    });
    expect(totalTokens(r.tokens)).toBe(200);
  });
});

describe('codexDayKey', () => {
  it('anchors a bare calendar date at UTC, so the host timezone cannot shift the day', () => {
    // `new Date('Aug 01, 2026').toISOString()` — what dashboard/server.ts's
    // normalizeCodexEntry does — reads that as LOCAL midnight and shifts it, so
    // in any zone east of UTC (this box runs Asia/Calcutta) the key slides back
    // to 2026-07-31. At a --since boundary that moves a whole day of spend
    // across the window and manufactures drift out of nothing.
    expect(codexDayKey('Aug 01, 2026')).toBe('2026-08-01');
    expect(codexDayKey('Jan 1, 2026')).toBe('2026-01-01');
    expect(codexDayKey('Dec 31, 2026')).toBe('2026-12-31');
  });

  it('passes an already-ISO date through untouched, and refuses junk', () => {
    expect(codexDayKey('2026-08-01')).toBe('2026-08-01');
    expect(codexDayKey('2026-08-01T04:00:00Z')).toBe('2026-08-01');
    expect(codexDayKey('not a date')).toBe('');
    expect(codexDayKey(undefined)).toBe('');
    expect(codexDayKey('')).toBe('');
  });
});

describe('parseCcusageJson', () => {
  it('strips resolver noise printed before the JSON', () => {
    expect(parseCcusageJson('Resolving dependencies\n{"daily":[]}\n')).toEqual({ daily: [] });
  });
  it('throws rather than returning an empty result that would render as $0', () => {
    expect(() => parseCcusageJson('use npx ccusage instead\n')).toThrow(/no JSON object/);
  });
});

// ─────────────────────────────── comparison ─────────────────────────────────

/** Token totals both sides agree on, so a case can isolate the DOLLAR axis. */
const TOK = { input: 1000, output: 200, cacheRead: 5000, cacheCreate: 300 };

function oracle(totalUsd: number, zeroPriced: string[] = [], tokens: TokenTotals = { ...TOK }): OracleResult {
  return { totalUsd, byDay: {}, byModel: {}, tokens, zeroPriced, days: 1 };
}
function mine(usd: number, tokens: TokenTotals = { ...TOK }): { usd: number; tokens: TokenTotals } {
  return { usd, tokens };
}

describe('compareLeg — dollars', () => {
  it('passes Claude inside its 5% band', () => {
    const c = compareLeg('claude', mine(102), oracle(100), DEFAULT_THRESHOLDS.claude);
    expect(c.verdict).toBe('ok');
    expect(c.deltaPct).toBeCloseTo(2, 10);
  });

  it('fails Claude outside it — Claude reconciles to the cent, so 6% is a real defect', () => {
    expect(compareLeg('claude', mine(106), oracle(100), DEFAULT_THRESHOLDS.claude).verdict).toBe('DRIFT');
  });

  it('tolerates the codex date-effective residual and says WHY', () => {
    // ccusage prices e.g. gpt-5.6-sol output at ~$45/Mtok on some dates and $30
    // on others; a flat CODEX_MODEL_PRICING cannot express that. ~2% aggregate,
    // ~12% worst single session. Flagging it every run would train us to ignore
    // this harness.
    const c = compareLeg('codex', mine(94), oracle(100), DEFAULT_THRESHOLDS.codex);
    expect(c.verdict).toBe('ok');
    expect(c.notes.join('\n')).toMatch(/DATE-EFFECTIVE/);
  });

  it('fails codex beyond its wider band', () => {
    expect(compareLeg('codex', mine(112), oracle(100), DEFAULT_THRESHOLDS.codex).verdict).toBe('DRIFT');
  });

  it('warns that a leg is not evidence for models the oracle priced at $0', () => {
    const c = compareLeg('claude', mine(100), oracle(100, ['claude-opus-5']), DEFAULT_THRESHOLDS.claude);
    expect(c.verdict).toBe('ok');
    expect(c.notes.join('\n')).toMatch(/NOT evidence/);
    expect(c.oracleBlind).toEqual(['claude-opus-5']);
  });
});

describe('compareLeg — tokens first, so a red run points somewhere', () => {
  it('diagnoses RATES when tokens agree but dollars do not', () => {
    // The 52x understatement's shape: every token accounted for, the dollars
    // collapsed. Sending someone to audit the scanner here wastes a day.
    const c = compareLeg('claude', mine(50), oracle(100), DEFAULT_THRESHOLDS.claude);
    expect(c.verdict).toBe('DRIFT');
    expect(c.diagnosis).toBe('rates');
    expect(c.tokens.match).toBe(true);
    expect(c.notes.join('\n')).toMatch(/TOKENS AGREE, DOLLARS DO NOT/);
  });

  it('diagnoses COUNTING when the tokens themselves disagree, naming the column', () => {
    // The 1.7–2.8x counter inflation's shape: a dedup failure, so both tokens
    // and dollars are inflated by the same factor.
    const c = compareLeg(
      'claude',
      mine(200, { ...TOK, output: TOK.output * 2 }),
      oracle(100),
      DEFAULT_THRESHOLDS.claude,
    );
    expect(c.verdict).toBe('DRIFT');
    expect(c.diagnosis).toBe('counting');
    expect(c.notes.join('\n')).toMatch(/TOKENS DISAGREE.*output \+100\.000%/s);
  });

  it('fails on a token gap even when the dollars happen to land inside the band', () => {
    // Offsetting errors, or a mispriced model with a small dollar share. The
    // dollar band alone would call this parity.
    const c = compareLeg('codex', mine(100, { ...TOK, input: TOK.input * 2 }), oracle(100), DEFAULT_THRESHOLDS.codex);
    expect(c.verdict).toBe('DRIFT');
    expect(c.diagnosis).toBe('counting');
  });

  it('absorbs a sub-0.5% token wobble (one line written mid-read)', () => {
    const c = compareLeg(
      'claude',
      mine(100, { ...TOK, output: TOK.output + 1 }),
      oracle(100),
      DEFAULT_THRESHOLDS.claude,
    );
    expect(c.tokens.match).toBe(true);
    expect(c.verdict).toBe('ok');
  });
});

describe('compareLeg — the suspicious-zero guard, both directions', () => {
  it('flags oracle-$0 while we billed real money', () => {
    const c = compareLeg('claude', mine(12.34), oracle(0), DEFAULT_THRESHOLDS.claude);
    expect(c.verdict).toBe('DRIFT');
    expect(c.diagnosis).toBe('blind');
    expect(c.deltaPct).toBeNull();
    expect(c.notes.join('\n')).toMatch(/cannot see this spend/);
  });

  it('flags the REVERSE — we priced $0 while the oracle billed', () => {
    // This is the direction that actually cost us $31k of invisible spend, and
    // the direction the first cut of this harness missed entirely.
    const c = compareLeg('claude', mine(0), oracle(100), DEFAULT_THRESHOLDS.claude);
    expect(c.verdict).toBe('DRIFT');
    expect(c.diagnosis).toBe('blind');
    expect(c.notes.join('\n')).toMatch(/WE priced \$0 .*52x understatement/s);
  });

  it('flags had-signal-but-$0 — both meters zero with tokens billed', () => {
    // Agreement on $0 is parity only when nothing was used. With tokens on the
    // wire it means NOBODY could price them, which reads identically to idle.
    const c = compareLeg('codex', mine(0), oracle(0), DEFAULT_THRESHOLDS.codex);
    expect(c.verdict).toBe('DRIFT');
    expect(c.diagnosis).toBe('blind');
    expect(c.notes.join('\n')).toMatch(/both meters read \$0 but .* tokens were billed/);
  });

  it('accepts a genuinely idle window — $0 AND no tokens', () => {
    const c = compareLeg('codex', mine(0, emptyTokens()), oracle(0, [], emptyTokens()), DEFAULT_THRESHOLDS.codex);
    expect(c.verdict).toBe('ok');
    expect(c.diagnosis).toBe('ok');
  });

  it('fails a Claude leg whose own table could not price a model, however well the totals agree', () => {
    // priceUsage returns $0 for an unknown model, so "agreement" here is luck:
    // the unpriced tokens simply were not in either total.
    const c = compareLeg('claude', mine(100), oracle(100), DEFAULT_THRESHOLDS.claude, {
      unpricedModels: ['claude-opus-6'],
    });
    expect(c.verdict).toBe('DRIFT');
    expect(c.notes.join('\n')).toMatch(/OUR table cannot price claude-opus-6/);
  });

  it('only warns for codex, which falls back to DEFAULT_CODEX_RATE rather than $0', () => {
    const c = compareLeg('codex', mine(100), oracle(100), DEFAULT_THRESHOLDS.codex, {
      unpricedModels: ['gpt-9-imaginary'],
    });
    expect(c.verdict).toBe('ok');
    expect(c.notes.join('\n')).toMatch(/DEFAULT_CODEX_RATE/);
  });
});

// ───────────── LEG 3: the runner's recorded meters (outbound.db) ────────────

/**
 * A stand-in outbound.db. The `cost_events` DDL is copied from the runner's
 * `createCostEventsTable` — it cannot be imported, because that function takes a
 * `bun:sqlite` handle. If the runner's schema changes, `readSessionMeters`'s
 * column reads break against a REAL prod DB while this fixture keeps passing, so
 * the assertions below stay on the columns' MEANING (net input, mutually
 * exclusive cache-write fields) rather than merely on round-tripping.
 */
interface LedgerRow {
  id: string;
  ts: string;
  provider?: string;
  model?: string;
  input?: number;
  cacheRead?: number;
  cacheWrite?: number;
  cw5?: number;
  cw1?: number;
  output?: number;
  priced?: number;
  rateVersion?: number;
  adjustment?: number;
  windowGen?: number;
}

function outboundFixture(opts: {
  costCap?: Record<string, unknown>;
  events?: LedgerRow[];
  noLedger?: boolean;
}): string {
  const dir = tmp('cost-parity-outbound-');
  const dbPath = path.join(dir, 'outbound.db');
  const db = new Database(dbPath);
  db.exec('CREATE TABLE session_state (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  if (opts.costCap) {
    db.prepare("INSERT INTO session_state (key, value) VALUES ('cost_cap', ?)").run(JSON.stringify(opts.costCap));
  }
  if (!opts.noLedger) {
    db.exec(`
      CREATE TABLE cost_events (
        id TEXT PRIMARY KEY, ts TEXT NOT NULL, provider TEXT NOT NULL, model TEXT NOT NULL,
        input_tokens INTEGER NOT NULL DEFAULT 0, cache_read_tokens INTEGER NOT NULL DEFAULT 0,
        cache_write_tokens INTEGER NOT NULL DEFAULT 0, cache_write_5m_tokens INTEGER NOT NULL DEFAULT 0,
        cache_write_1h_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0,
        reasoning_tokens INTEGER NOT NULL DEFAULT 0, priced_usd REAL NOT NULL, rate_version INTEGER NOT NULL,
        adjustment_usd REAL NOT NULL DEFAULT 0, window_gen INTEGER NOT NULL DEFAULT 0,
        thread_id TEXT, gh_ref TEXT, created_at TEXT NOT NULL)`);
    const ins = db.prepare(
      `INSERT INTO cost_events (id, ts, provider, model, input_tokens, cache_read_tokens, cache_write_tokens,
       cache_write_5m_tokens, cache_write_1h_tokens, output_tokens, reasoning_tokens, priced_usd, rate_version,
       adjustment_usd, window_gen, created_at)
       VALUES (@id, @ts, @provider, @model, @input, @cacheRead, @cacheWrite, @cw5, @cw1, @output, 0, @priced,
       @rateVersion, @adjustment, @windowGen, @ts)`,
    );
    for (const e of opts.events ?? []) {
      ins.run({
        id: e.id,
        ts: e.ts,
        provider: e.provider ?? 'claude',
        model: e.model ?? 'claude-opus-5',
        input: e.input ?? 0,
        cacheRead: e.cacheRead ?? 0,
        cacheWrite: e.cacheWrite ?? 0,
        cw5: e.cw5 ?? 0,
        cw1: e.cw1 ?? 0,
        output: e.output ?? 0,
        priced: e.priced ?? 0,
        rateVersion: e.rateVersion ?? 1,
        adjustment: e.adjustment ?? 0,
        windowGen: e.windowGen ?? 0,
      });
    }
  }
  db.close();
  return dbPath;
}

const LIFETIME_CAP = { capUsd: 100, spentUsd: 10, status: 'ok', immortal: true, window: 'lifetime', ledgerGen: 0 };

describe('leg 3 — reading what the runner actually recorded', () => {
  it('lifts the enforcement counter — the number the cap actually compared against', () => {
    const p = outboundFixture({ costCap: { ...LIFETIME_CAP, ceilingUsd: 250, budgetGen: 3 } });
    const m = readSessionMeters(p);
    expect(m.present).toBe(true);
    expect(m.counter).toMatchObject({ spentUsd: 10, capUsd: 100, ceilingUsd: 250, status: 'ok', budgetGen: 3 });
  });

  it('sums the ledger by provider and does NOT double-count cache writes', () => {
    // cost-events-integration.ts writes `hasSplit ? 0 : flat`, so the flat field
    // and the 5m/1h split are mutually exclusive per row. Summing all three is
    // the total; treating flat as an additional column would inflate it.
    const p = outboundFixture({
      costCap: LIFETIME_CAP,
      events: [
        {
          id: 'claude:a',
          ts: '2026-08-01T00:00:00.000Z',
          input: 100,
          cacheRead: 50,
          cacheWrite: 30,
          output: 10,
          priced: 4,
        },
        { id: 'claude:b', ts: '2026-08-01T01:00:00.000Z', input: 200, cw5: 20, cw1: 40, output: 20, priced: 5 },
        {
          id: 'codex:c',
          ts: '2026-08-02T00:00:00.000Z',
          provider: 'codex',
          model: 'gpt-5.6-sol',
          input: 300,
          output: 30,
          priced: 1,
        },
      ],
    });
    const m = readSessionMeters(p);
    expect(m.ledger?.rows).toBe(3);
    expect(m.ledger?.usd).toBeCloseTo(10, 10);
    expect(m.ledger?.tokens).toEqual({ input: 600, cacheRead: 50, cacheCreate: 30 + 20 + 40, output: 60 });
    expect(m.ledger?.byProvider.claude).toMatchObject({ rows: 2, usd: 9 });
    expect(m.ledger?.byProvider.codex).toMatchObject({ rows: 1, usd: 1 });
  });

  it('filters the ledger by --since on the raw ts prefix', () => {
    const p = outboundFixture({
      costCap: LIFETIME_CAP,
      events: [
        { id: 'a', ts: '2026-08-01T23:59:59.999Z', priced: 7, input: 1 },
        { id: 'b', ts: '2026-08-02T00:00:00.000Z', priced: 3, input: 1 },
      ],
    });
    expect(readSessionMeters(p).ledger?.usd).toBeCloseTo(10, 10);
    expect(readSessionMeters(p, '20260802').ledger?.usd).toBeCloseTo(3, 10);
  });

  it('reports a mixed rate_version instead of quietly summing incompatible dollars', () => {
    const p = outboundFixture({
      costCap: LIFETIME_CAP,
      events: [
        { id: 'a', ts: '2026-08-01T00:00:00.000Z', priced: 1, rateVersion: 1, input: 1 },
        { id: 'b', ts: '2026-08-01T01:00:00.000Z', priced: 1, rateVersion: 2, input: 1 },
      ],
    });
    const m = readSessionMeters(p);
    expect(m.ledger?.rateVersions).toEqual([1, 2]);
    expect(m.notes.join('\n')).toMatch(/spans rate_version 1, 2/);
  });

  it('flags a TOKEN row stamped $0 but not a legitimate adjustment row', () => {
    // An adjustment row carries dollars and no tokens by design. A token row
    // stamped $0 is a model the ledger could not price — the same failure as an
    // unpriced model anywhere else, and just as invisible in a total.
    const p = outboundFixture({
      costCap: LIFETIME_CAP,
      events: [
        { id: 'adj', ts: '2026-08-01T00:00:00.000Z', model: 'n/a', priced: 5, adjustment: 5 },
        { id: 'bad', ts: '2026-08-01T01:00:00.000Z', model: 'claude-opus-6', input: 900, priced: 0 },
      ],
    });
    const m = readSessionMeters(p);
    expect(m.ledger?.unpricedModels).toEqual(['claude-opus-6']);
    expect(m.ledger?.adjustmentUsd).toBeCloseTo(5, 10);
  });

  it('degrades with a REASON, never to a confident $0', () => {
    const missing = readSessionMeters(path.join(tmp('cost-parity-absent-'), 'outbound.db'));
    expect(missing.present).toBe(false);
    expect(missing.counter).toBeUndefined();
    expect(missing.notes.join('\n')).toMatch(/no outbound\.db/);

    const preLedger = readSessionMeters(outboundFixture({ costCap: LIFETIME_CAP, noLedger: true }));
    expect(preLedger.ledger).toBeUndefined();
    expect(preLedger.notes.join('\n')).toMatch(/predates the #65 durable ledger/);

    const preCap = readSessionMeters(outboundFixture({ events: [] }));
    expect(preCap.counter).toBeUndefined();
    expect(preCap.notes.join('\n')).toMatch(/cost tracking never ran/);
  });

  it('accepts the session DIRECTORY as well as the db path', () => {
    const p = outboundFixture({ costCap: LIFETIME_CAP });
    expect(readSessionMeters(path.dirname(p)).counter?.spentUsd).toBe(10);
  });
});

describe('leg 3 — counter vs ledger', () => {
  const events = [{ id: 'a', ts: '2026-08-01T00:00:00.000Z', priced: 10, input: 100 }];

  it('passes when enforcement and the durable record agree', () => {
    const m = readSessionMeters(outboundFixture({ costCap: LIFETIME_CAP, events }));
    expect(compareCounterToLedger(m, DEFAULT_THRESHOLDS.meter).verdict).toBe('ok');
  });

  it('flags charges that reached the ledger but never reached enforcement', () => {
    const m = readSessionMeters(outboundFixture({ costCap: { ...LIFETIME_CAP, spentUsd: 4 }, events }));
    const c = compareCounterToLedger(m, DEFAULT_THRESHOLDS.meter);
    expect(c.verdict).toBe('DRIFT');
    expect(c.notes.join('\n')).toMatch(/ledger > counter/);
  });

  it('flags enforcement charging more than the record can account for', () => {
    const m = readSessionMeters(outboundFixture({ costCap: { ...LIFETIME_CAP, spentUsd: 40 }, events }));
    const c = compareCounterToLedger(m, DEFAULT_THRESHOLDS.meter);
    expect(c.verdict).toBe('DRIFT');
    expect(c.notes.join('\n')).toMatch(/counter > ledger/);
  });

  it('flags a $0 counter sitting on a ledger full of real charges', () => {
    const m = readSessionMeters(outboundFixture({ costCap: { ...LIFETIME_CAP, spentUsd: 0 }, events }));
    const c = compareCounterToLedger(m, DEFAULT_THRESHOLDS.meter);
    expect(c.verdict).toBe('DRIFT');
    expect(c.notes.join('\n')).toMatch(/enforcement was blind/);
  });

  it('SKIPS a daily counter rather than comparing two different windows', () => {
    // A daily counter covers only its dayKey; the ledger sum here does not.
    // Reporting that difference as a delta would fire on every non-immortal
    // session forever, which is how a check gets ignored.
    const m = readSessionMeters(
      outboundFixture({ costCap: { ...LIFETIME_CAP, window: 'daily', dayKey: '2026-08-01' }, events }),
    );
    const c = compareCounterToLedger(m, DEFAULT_THRESHOLDS.meter);
    expect(c.verdict).toBe('skipped');
    expect(c.notes.join('\n')).toMatch(/rerun with --since 20260801/);
  });

  it('SKIPS when --since scopes the ledger but not the lifetime counter', () => {
    const m = readSessionMeters(outboundFixture({ costCap: LIFETIME_CAP, events }), '20260801');
    const c = compareCounterToLedger(m, DEFAULT_THRESHOLDS.meter, '20260801');
    expect(c.verdict).toBe('skipped');
    expect(c.notes.join('\n')).toMatch(/different windows/);
  });

  it('notes a rotated window generation rather than reading it as a shortfall', () => {
    const m = readSessionMeters(
      outboundFixture({
        costCap: { ...LIFETIME_CAP, ledgerGen: 1 },
        events: [
          { id: 'old', ts: '2026-08-01T00:00:00.000Z', priced: 6, input: 1, windowGen: 0 },
          { id: 'new', ts: '2026-08-02T00:00:00.000Z', priced: 4, input: 1, windowGen: 1 },
        ],
      }),
    );
    expect(compareCounterToLedger(m, DEFAULT_THRESHOLDS.meter).notes.join('\n')).toMatch(/a \/clear rotated/);
  });

  it('skips cleanly when either meter is absent', () => {
    const m = readSessionMeters(outboundFixture({ costCap: LIFETIME_CAP, noLedger: true }));
    expect(compareCounterToLedger(m, DEFAULT_THRESHOLDS.meter).verdict).toBe('skipped');
  });
});

describe('leg 3 — ledger vs reprice', () => {
  it('passes when the recorded past and a fresh re-read agree', () => {
    expect(compareLedgerToReprice(10, 10.05, DEFAULT_THRESHOLDS.meter).verdict).toBe('ok');
  });

  it('flags a write-path gap — spend the transcripts show that no row captured', () => {
    // Unreachable by a reprice-vs-ccusage comparison alone: both of those would
    // agree with each other while the system recorded nothing.
    const c = compareLedgerToReprice(0, 12.5, DEFAULT_THRESHOLDS.meter);
    expect(c.verdict).toBe('DRIFT');
    expect(c.notes.join('\n')).toMatch(/rows never got written/);
  });

  it('fails a 5% gap — both sides are ours, so the band is 1%', () => {
    expect(compareLedgerToReprice(100, 105, DEFAULT_THRESHOLDS.meter).verdict).toBe('DRIFT');
  });

  it('carries a scope note when only one provider was repriced', () => {
    const c = compareLedgerToReprice(100, 60, DEFAULT_THRESHOLDS.meter, 'only claude was repriced');
    expect(c.notes[0]).toMatch(/only claude was repriced/);
  });
});

// ──────────────────────────────── CLI plumbing ──────────────────────────────

describe('CLI plumbing', () => {
  it('resolves CLAUDE_CONFIG_DIR from either .claude-shared or its projects/ dir', () => {
    // ccusage wants the PARENT of projects/. Handing it projects/ yields a
    // silent $0 — the failure this normalisation exists to prevent.
    expect(resolveClaudeConfigDir('/d/.claude-shared/projects')).toBe('/d/.claude-shared');
    expect(resolveClaudeConfigDir('/d/.claude-shared')).toBe('/d/.claude-shared');
  });

  it('parses flags and strips dashes from --since', () => {
    const a = parseArgs([
      'session',
      '--claude-dir',
      '/c',
      '--codex-home',
      '/x',
      '--outbound-db',
      '/o/outbound.db',
      '--since',
      '2026-08-01',
      '--json',
    ]);
    expect(a).toMatchObject({
      cmd: 'session',
      claudeDir: '/c',
      codexHome: '/x',
      outboundDb: '/o/outbound.db',
      since: '20260801',
      json: true,
    });
    expect(a.claudeThreshold).toBe(DEFAULT_THRESHOLDS.claude);
    expect(a.codexThreshold).toBe(DEFAULT_THRESHOLDS.codex);
    expect(a.meterThreshold).toBe(DEFAULT_THRESHOLDS.meter);
  });

  it('rejects an unknown flag instead of ignoring it', () => {
    expect(() => parseArgs(['session', '--clade-dir', '/c'])).toThrow(/unknown argument/);
  });

  it('withinSince excludes undatable rows once a window is given', () => {
    expect(withinSince('2026-08-02', '20260801')).toBe(true);
    expect(withinSince('2026-07-31', '20260801')).toBe(false);
    // ccusage will not have counted an undatable row inside the window either,
    // so including it would manufacture drift.
    expect(withinSince('unknown-day', '20260801')).toBe(false);
    expect(withinSince('unknown-day')).toBe(true);
  });
});

describe('the tables this harness guards are not empty', () => {
  // Cheap tripwire: every assertion above is only as good as the tables being
  // real. An accidental `export const MODEL_PRICING = {}` would make most of
  // leg 1 vacuously true.
  it('carries the models prod actually runs', () => {
    for (const m of ['claude-opus-5', 'claude-sonnet-5']) expect(MODEL_PRICING[m], m).toBeDefined();
    for (const m of ['gpt-5.6-sol', 'gpt-5.6-luna']) expect(CODEX_MODEL_PRICING[m], m).toBeDefined();
  });
});
