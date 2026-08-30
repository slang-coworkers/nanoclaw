/**
 * Codex rollout pricing + scanning (issue #1327).
 *
 * The rate table here is the enforcement side of a figure the dashboard already
 * reports via `ccusage codex daily --json --offline`. It was DERIVED from that
 * oracle, not guessed: 8 per-day token/cost rows from 8 real prod session codex
 * directories across 2 model ids solve exactly (zero residual) to
 * $5.00 / $0.50 / $30.00 per Mtok for input / cached-read / output, with
 * cache-write at $0. The `real prod day` case below re-checks that against one
 * of those measured rows, so a rate edit on either side goes red — the same
 * anti-drift discipline `pricing.test.ts` applies to the Claude table.
 *
 * The cross-file de-duplication is the other measured invariant. A codex
 * subagent thread spawn writes its own rollout that REPLAYS the parent's
 * already-billed turns; charging both over-counted 13.7% and 19.2% on the two of
 * thirty sampled prod sessions that had forked rollouts, while de-duplicating by
 * the usage tuple reproduced ccusage EXACTLY on all thirty.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  CODEX_MODEL_PRICING,
  DEFAULT_CODEX_RATE,
  MISSING_DAY_KEY,
  __resetCodexCostMemo,
  codexEventKey,
  ledgerKey,
  normalizeCodexModel,
  parseCodexRollout,
  priceCodexEvent,
  priceCodexFiles,
  scanCodexRollouts,
} from './codex-cost.js';

/** One `event_msg`/`token_count` row, prod shape: cumulative + this-call. */
function tokenCount(
  ts: string,
  call: { input: number; cached?: number; cacheWrite?: number; output?: number },
  cumulative?: { input: number; cached?: number; output?: number },
): string {
  const cum = cumulative ?? { input: call.input, cached: call.cached, output: call.output };
  return JSON.stringify({
    timestamp: ts,
    type: 'event_msg',
    payload: {
      type: 'token_count',
      info: {
        total_token_usage: {
          input_tokens: cum.input,
          cached_input_tokens: cum.cached ?? 0,
          cache_write_input_tokens: call.cacheWrite ?? 0,
          output_tokens: cum.output ?? 0,
          reasoning_output_tokens: 0,
          total_tokens: cum.input + (cum.output ?? 0),
        },
        last_token_usage: {
          input_tokens: call.input,
          cached_input_tokens: call.cached ?? 0,
          cache_write_input_tokens: call.cacheWrite ?? 0,
          output_tokens: call.output ?? 0,
          reasoning_output_tokens: 0,
          total_tokens: call.input + (call.output ?? 0),
        },
        model_context_window: 400000,
      },
    },
  });
}

function turnContext(ts: string, model: string): string {
  return JSON.stringify({
    timestamp: ts,
    type: 'turn_context',
    payload: { cwd: '/workspace/agent', model, approval_policy: 'never', sandbox_policy: { type: 'read-only' } },
  });
}

function sessionMeta(ts: string): string {
  return JSON.stringify({
    timestamp: ts,
    type: 'session_meta',
    payload: { id: 'ffffffff-0000-0000-0000-000000000000', timestamp: ts, cwd: '/workspace/agent' },
  });
}

/** Parse + price one file in isolation. */
function costOf(content: string): { byDay: Record<string, number>; totalUsd: number; unpriced: string[] } {
  const { files, unpricedModels } = priceCodexFiles([parseCodexRollout(content, 'r1.jsonl')]);
  return { byDay: files[0].byDay, totalUsd: files[0].totalUsd, unpriced: unpricedModels };
}

const D1 = '2026-08-18';
const D2 = '2026-08-19';

describe('codex rate table (anti-drift vs the ccusage-derived rates)', () => {
  // Per-model, not one blanket tier. The blanket form asserted every id was
  // $5/$30/$0.50, so it PINNED the bug it was meant to guard: the codex-tuned
  // variants price like their base models (cheaper), and blanket-rating them
  // overstated codex spend ~2.9x while disagreeing with dashboard/codex-costs.ts.
  const EXPECTED: Record<string, { input: number; output: number; cacheRead: number }> = {
    // ccusage-fitted (prod-observed).
    'gpt-5.6-sol': { input: 5e-6, output: 30e-6, cacheRead: 0.5e-6 },
    'gpt-5.5': { input: 5e-6, output: 30e-6, cacheRead: 0.5e-6 },
    // Published per-model rates.
    'gpt-5.6': { input: 5e-6, output: 30e-6, cacheRead: 0.5e-6 },
    'gpt-5.6-terra': { input: 2e-6, output: 12e-6, cacheRead: 0.2e-6 },
    'gpt-5.6-luna': { input: 0.2e-6, output: 1.2e-6, cacheRead: 0.02e-6 },
    'gpt-5.5-codex': { input: 5e-6, output: 30e-6, cacheRead: 0.5e-6 },
    'gpt-5.3-codex': { input: 1.75e-6, output: 14e-6, cacheRead: 0.175e-6 },
    'gpt-5.2-codex': { input: 1.75e-6, output: 14e-6, cacheRead: 0.175e-6 },
    'gpt-5.1-codex': { input: 1.25e-6, output: 10e-6, cacheRead: 0.125e-6 },
    'gpt-5-codex': { input: 1.25e-6, output: 10e-6, cacheRead: 0.125e-6 },
  };

  it('pins the published rate for every known model id', () => {
    // Both directions: an added model with no expectation here fails too, so a
    // new row cannot arrive unpriced-by-contract.
    expect(Object.keys(CODEX_MODEL_PRICING).sort()).toEqual(Object.keys(EXPECTED).sort());
    for (const [key, rate] of Object.entries(EXPECTED)) {
      expect(CODEX_MODEL_PRICING[key], `${key} rate drifted from its published price`).toEqual(rate);
    }
  });

  it('prices codex-tuned variants below the $5/$30 tier', () => {
    // The specific regression: `gpt-5.2-codex` at the gpt-5.5 rate. Stated as a
    // relation so it survives a future repricing of either side.
    for (const id of ['gpt-5.2-codex', 'gpt-5.1-codex', 'gpt-5-codex'] as const) {
      expect(CODEX_MODEL_PRICING[id].input).toBeLessThan(CODEX_MODEL_PRICING['gpt-5.5'].input);
      expect(CODEX_MODEL_PRICING[id].output).toBeLessThan(CODEX_MODEL_PRICING['gpt-5.5'].output);
    }
  });

  it('never prices an unknown model at zero — that would buy unaccounted spend', () => {
    expect(DEFAULT_CODEX_RATE.input).toBeGreaterThan(0);
    expect(DEFAULT_CODEX_RATE.output).toBeGreaterThan(0);
  });
});

describe('normalizeCodexModel', () => {
  it('accepts bare and provider-prefixed ids', () => {
    expect(normalizeCodexModel('gpt-5.6-sol')).toBe('gpt-5.6-sol');
    expect(normalizeCodexModel('azure/openai/gpt-5.6-sol')).toBe('gpt-5.6-sol');
    expect(normalizeCodexModel('openai/openai/gpt-5.5')).toBe('gpt-5.5');
    expect(normalizeCodexModel('  AZURE/OpenAI/GPT-5.6-SOL ')).toBe('gpt-5.6-sol');
  });

  it('returns "" for unknown/missing ids so the caller can flag them', () => {
    expect(normalizeCodexModel(undefined)).toBe('');
    expect(normalizeCodexModel('')).toBe('');
    expect(normalizeCodexModel('claude-opus-4-8')).toBe('');
  });

  // ANTI-REGRESSION GUARD for the runner↔dashboard normalizer.
  // `normalizeCodexModel` is duplicated (Bun container vs Node host in
  // dashboard/codex-costs.ts) and both feed cost. When they drifted, a dated
  // snapshot id fell through to DEFAULT_CODEX_RATE on the RUNNER side (the
  // enforcer) — up to a 25x overcharge that hard-stops a session at ~4% of its
  // ceiling. The two tests below are DATA-DRIVEN over the whole pricing table,
  // so a model added to CODEX_MODEL_PRICING automatically inherits both the
  // naming and the money-path guarantee — a new entry can't ship without them.
  // If you change one normalizer copy, change both and keep these green on both.
  it('resolves EVERY known model across bare / prefix / dated / -latest / mixed-case forms', () => {
    for (const base of Object.keys(CODEX_MODEL_PRICING)) {
      expect(normalizeCodexModel(base)).toBe(base);                              // bare
      expect(normalizeCodexModel(`azure/openai/${base}`)).toBe(base);           // provider prefix
      expect(normalizeCodexModel(`openai/openai/${base}`)).toBe(base);          // doubled prefix
      expect(normalizeCodexModel(`${base}-20260101`)).toBe(base);               // dated snapshot
      expect(normalizeCodexModel(`azure/openai/${base}-20260101`)).toBe(base);  // prefix + dated
      expect(normalizeCodexModel(`${base}-latest`)).toBe(base);                 // -latest alias
      expect(normalizeCodexModel(`  ${base.toUpperCase()} `)).toBe(base);       // case + whitespace
    }
  });

  it('the money-path guard: EVERY known model prices its dated/-latest form identically to bare (never DEFAULT)', () => {
    const shape = { day: '2026-08-28', input: 1_000_000, cached: 250_000, output: 40_000 };
    for (const base of Object.keys(CODEX_MODEL_PRICING)) {
      const bare = priceCodexEvent({ ...shape, rawModel: base });
      for (const variant of [`${base}-20260101`, `${base}-latest`, `azure/openai/${base}-20260101`]) {
        expect(priceCodexEvent({ ...shape, rawModel: variant })).toBeCloseTo(bare, 12);
      }
    }
    // The headline fingerprint: gpt-5.6-luna is exactly 25x cheaper than DEFAULT,
    // so a dated luna call that fell to DEFAULT (the pre-fix bug) would be 25x more.
    const luna = priceCodexEvent({ ...shape, cached: 0, output: 0, rawModel: 'gpt-5.6-luna-20260101' });
    expect((shape.input * DEFAULT_CODEX_RATE.input) / luna).toBeCloseTo(25, 6);
  });

  it('a snapshot/-latest suffix on an UNKNOWN base still returns "" (never invents a match)', () => {
    expect(normalizeCodexModel('gpt-9-imaginary-20260101')).toBe('');
    expect(normalizeCodexModel('totally-unknown-latest')).toBe('');
    expect(normalizeCodexModel('azure/openai/not-a-model-20260101')).toBe('');
  });

  it('does not resolve inherited Object.prototype keys (would price as NaN, silently $0)', () => {
    // CODEX_MODEL_PRICING is a plain object; a truthy index would treat
    // `constructor`/`toString`/`__proto__` as rates. Membership must be hasOwn.
    expect(normalizeCodexModel('constructor')).toBe('');
    expect(normalizeCodexModel('constructor-20260101')).toBe('');
    expect(normalizeCodexModel('__proto__-latest')).toBe('');
    expect(normalizeCodexModel('toString')).toBe('');
    // …and pricing such an id falls to DEFAULT, never NaN.
    expect(Number.isFinite(priceCodexEvent({ day: '2026-08-28', rawModel: 'constructor-20260101', input: 1_000, cached: 0, output: 0 }))).toBe(true);
  });
});

describe('parseCodexRollout + priceCodexFiles', () => {
  it('reproduces a REAL measured prod day to the cent', () => {
    // 2026-08-18 of session sess-1787093778289-z2m79j, as reported by
    // `ccusage codex daily --json --offline`: $9.004048.
    const content = [
      sessionMeta(`${D1}T01:00:00.000Z`),
      turnContext(`${D1}T01:00:01.000Z`, 'azure/openai/gpt-5.6-sol'),
      tokenCount(`${D1}T02:00:00.000Z`, { input: 9912023, cached: 9517666, cacheWrite: 388466, output: 75781 }),
    ].join('\n');
    const c = costOf(content);
    expect(c.byDay[D1]).toBeCloseTo(9.004048, 6);
    expect(c.totalUsd).toBeCloseTo(9.004048, 6);
  });

  it('sums PER-CALL usage, not the cumulative reading', () => {
    // Cumulative climbs 1M → 2M → 3M while each call bills 1M.
    const content = [
      turnContext(`${D1}T01:00:00.000Z`, 'gpt-5.6-sol'),
      tokenCount(`${D1}T01:00:01.000Z`, { input: 1_000_000 }, { input: 1_000_000 }),
      tokenCount(`${D1}T01:00:02.000Z`, { input: 1_000_001 }, { input: 2_000_001 }),
      tokenCount(`${D1}T01:00:03.000Z`, { input: 1_000_002, output: 100_000 }, { input: 3_000_003, output: 100_000 }),
    ].join('\n');
    // 3,000,003 input @ $5/M + 100k output @ $30/M
    expect(costOf(content).totalUsd).toBeCloseTo(3.000003 * 5 + 3, 6);
  });

  it('does NOT charge a forked replay of the parent thread twice', () => {
    // The measured over-count: a subagent spawn's rollout replays the parent's
    // already-billed calls. The earlier-sorted file keeps them.
    const call = { input: 1_000_000, output: 10_000 };
    const parent = parseCodexRollout(
      [turnContext(`${D1}T01:00:00Z`, 'gpt-5.6-sol'), tokenCount(`${D1}T01:00:01Z`, call)].join('\n'),
      'a-parent.jsonl',
    );
    const fork = parseCodexRollout(
      [
        turnContext(`${D1}T02:00:00Z`, 'gpt-5.6-sol'),
        tokenCount(`${D1}T02:00:01Z`, call), // replayed
        tokenCount(`${D1}T02:00:02Z`, { input: 2_000_000 }), // genuinely new
      ].join('\n'),
      'b-fork.jsonl',
    );
    const { files } = priceCodexFiles([parent, fork]);
    const oneCall = 1_000_000 * 5e-6 + 10_000 * 30e-6;
    expect(files[0].totalUsd).toBeCloseTo(oneCall, 6); // parent keeps its call
    expect(files[1].totalUsd).toBeCloseTo(10, 6); // fork charged only the new one
    expect(files[0].totalUsd + files[1].totalUsd).toBeCloseTo(oneCall + 10, 6);
  });

  it('partitions by UTC day so a file straddling midnight is attributed correctly', () => {
    const content = [
      turnContext(`${D1}T23:00:00.000Z`, 'gpt-5.6-sol'),
      tokenCount(`${D1}T23:59:00.000Z`, { input: 1_000_000 }),
      tokenCount(`${D2}T00:01:00.000Z`, { input: 2_000_000 }),
    ].join('\n');
    const c = costOf(content);
    expect(c.byDay[D1]).toBeCloseTo(5, 6);
    expect(c.byDay[D2]).toBeCloseTo(10, 6);
    expect(c.totalUsd).toBeCloseTo(15, 6);
  });

  it('prices each call under the model in effect when a rollout switches model', () => {
    const content = [
      turnContext(`${D1}T01:00:00.000Z`, 'gpt-5.6-sol'),
      tokenCount(`${D1}T01:00:01.000Z`, { input: 1_000_000 }),
      turnContext(`${D1}T01:00:02.000Z`, 'model-with-no-rate'),
      tokenCount(`${D1}T01:00:03.000Z`, { input: 2_000_000 }),
    ].join('\n');
    const c = costOf(content);
    // both legs happen to price at the same rate (default == known), but the
    // UNKNOWN model must be reported so the table can be updated.
    expect(c.unpriced).toEqual(['model-with-no-rate']);
    expect(c.totalUsd).toBeCloseTo(15, 6);
  });

  it('charges an unknown model at the default rate rather than $0', () => {
    const content = [
      turnContext(`${D1}T01:00:00.000Z`, 'gpt-9-unreleased'),
      tokenCount(`${D1}T01:00:01.000Z`, { input: 1_000_000 }),
    ].join('\n');
    const c = costOf(content);
    expect(c.totalUsd).toBeCloseTo(1_000_000 * DEFAULT_CODEX_RATE.input, 6);
    expect(c.unpriced).toEqual(['gpt-9-unreleased']);
  });

  it('prices cached input at the cache-read rate and ignores cache writes', () => {
    // ccusage reports cacheCreationTokens: 0 for codex — writes are not billed.
    const content = [
      turnContext(`${D1}T01:00:00.000Z`, 'gpt-5.6-sol'),
      tokenCount(`${D1}T01:00:01.000Z`, { input: 1_000_000, cached: 1_000_000, cacheWrite: 900_000 }),
    ].join('\n');
    expect(costOf(content).totalUsd).toBeCloseTo(0.5, 6);
  });

  it('skips all-zero rows so they cannot poison the dedup set', () => {
    const content = [
      turnContext(`${D1}T01:00:00.000Z`, 'gpt-5.6-sol'),
      tokenCount(`${D1}T01:00:01.000Z`, { input: 0, output: 0 }),
      tokenCount(`${D1}T01:00:02.000Z`, { input: 0, output: 0 }),
      tokenCount(`${D1}T01:00:03.000Z`, { input: 1_000_000 }),
    ].join('\n');
    expect(costOf(content).totalUsd).toBeCloseTo(5, 6);
  });

  it('clamps cached above input and rejects negative / non-finite token values', () => {
    const weird = JSON.stringify({
      timestamp: `${D1}T01:00:01.000Z`,
      type: 'event_msg',
      payload: {
        type: 'token_count',
        info: {
          last_token_usage: {
            input_tokens: 1_000_000,
            cached_input_tokens: 5_000_000, // > input
            output_tokens: -42,
            cache_write_input_tokens: null,
          },
        },
      },
    });
    const c = costOf([turnContext(`${D1}T01:00:00.000Z`, 'gpt-5.6-sol'), weird].join('\n'));
    // non-cached clamps to 0; cached 5M @ $0.50/M = $2.50; negative output → 0
    expect(c.totalUsd).toBeCloseTo(2.5, 6);
  });

  it('skips malformed and irrelevant lines without throwing', () => {
    const content = [
      '',
      'not json at all',
      '{"type":"response_item","payload":{"type":"message"}}',
      '{"type":"event_msg","payload":{"type":"token_count"',
      turnContext(`${D1}T01:00:00.000Z`, 'gpt-5.6-sol'),
      tokenCount(`${D1}T01:00:01.000Z`, { input: 1_000_000 }),
    ].join('\n');
    expect(costOf(content).totalUsd).toBeCloseTo(5, 6);
  });

  it('buckets a row with no usable timestamp under the missing-day key', () => {
    const noTs = JSON.stringify({
      type: 'event_msg',
      payload: { type: 'token_count', info: { last_token_usage: { input_tokens: 1_000_000 } } },
    });
    const c = costOf([turnContext(`${D1}T01:00:00.000Z`, 'gpt-5.6-sol'), noTs].join('\n'));
    expect(c.byDay[MISSING_DAY_KEY]).toBeCloseTo(5, 6);
  });
});

describe('codexEventKey / priceCodexEvent', () => {
  it('keys on the NORMALIZED model plus the token tuple', () => {
    const base = { day: D1, input: 1, cached: 2, output: 3 };
    expect(codexEventKey({ ...base, rawModel: 'azure/openai/gpt-5.6-sol' })).toBe(
      codexEventKey({ ...base, rawModel: 'gpt-5.6-sol' }),
    );
    expect(codexEventKey({ ...base, rawModel: 'gpt-5.5' })).not.toBe(
      codexEventKey({ ...base, rawModel: 'gpt-5.6-sol' }),
    );
    expect(codexEventKey({ ...base, output: 4, rawModel: 'gpt-5.5' })).not.toBe(
      codexEventKey({ ...base, rawModel: 'gpt-5.5' }),
    );
  });

  it('prices one call as (input - cached)*in + cached*cacheRead + output*out', () => {
    expect(
      priceCodexEvent({ day: D1, rawModel: 'gpt-5.6-sol', input: 1_000_000, cached: 400_000, output: 100_000 }),
    ).toBeCloseTo(600_000 * 5e-6 + 400_000 * 0.5e-6 + 100_000 * 30e-6, 9);
  });
});

describe('scanCodexRollouts', () => {
  let home: string;

  beforeEach(() => {
    __resetCodexCostMemo();
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-home-'));
  });

  afterEach(() => {
    fs.rmSync(home, { recursive: true, force: true });
    __resetCodexCostMemo();
  });

  function writeRollout(day: string, name: string, lines: string[]): string {
    const [y, m, d] = day.split('-');
    const dir = path.join(home, 'sessions', y, m, d);
    fs.mkdirSync(dir, { recursive: true });
    const p = path.join(dir, `rollout-${day}T10-00-00-${name}.jsonl`);
    fs.writeFileSync(p, lines.join('\n'));
    return p;
  }

  it('returns nothing for a home with no sessions dir, and reports no error for it', () => {
    const scan = scanCodexRollouts(path.join(home, 'nope'));
    expect(scan.files).toEqual([]);
    expect(scan.errors).toBe(0); // a session that never called codex is not a failure
  });

  it('walks sessions/YYYY/MM/DD and sums across files, keyed relative to sessions/', () => {
    writeRollout(D1, 'aaa', [
      turnContext(`${D1}T01:00:00Z`, 'gpt-5.6-sol'),
      tokenCount(`${D1}T01:00:01Z`, { input: 1_000_000 }),
    ]);
    writeRollout(D2, 'bbb', [
      turnContext(`${D2}T01:00:00Z`, 'gpt-5.6-sol'),
      tokenCount(`${D2}T01:00:01Z`, { input: 2_000_000 }),
    ]);
    const scan = scanCodexRollouts(home);
    expect(scan.files).toHaveLength(2);
    expect(scan.files.map((f) => f.totalUsd).reduce((a, b) => a + b, 0)).toBeCloseTo(15, 6);
    for (const f of scan.files) expect(f.key.startsWith('2026' + path.sep)).toBe(true);
  });

  it('de-duplicates across files, keeping the chronologically earlier one', () => {
    const call = { input: 1_000_000 };
    writeRollout(D1, 'zzz-later', [turnContext(`${D1}T02:00:00Z`, 'gpt-5.6-sol'), tokenCount(`${D1}T02:00:01Z`, call)]);
    writeRollout(D1, 'aaa-earlier', [
      turnContext(`${D1}T01:00:00Z`, 'gpt-5.6-sol'),
      tokenCount(`${D1}T01:00:01Z`, call),
    ]);
    const scan = scanCodexRollouts(home);
    expect(scan.files.map((f) => f.totalUsd).reduce((a, b) => a + b, 0)).toBeCloseTo(5, 6);
    const earlier = scan.files.find((f) => f.key.includes('aaa-earlier'))!;
    const later = scan.files.find((f) => f.key.includes('zzz-later'))!;
    expect(earlier.totalUsd).toBeCloseTo(5, 6);
    expect(later.totalUsd).toBe(0);
  });

  it('ignores files that are not rollout-*.jsonl', () => {
    const dir = path.join(home, 'sessions', '2026', '08', '18');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'notes.txt'), 'hello');
    fs.writeFileSync(path.join(dir, 'rollout-x.json'), '{}');
    expect(scanCodexRollouts(home).files).toEqual([]);
  });

  it('surfaces unknown model ids across the whole scan', () => {
    writeRollout(D1, 'aaa', [
      turnContext(`${D1}T01:00:00Z`, 'brand-new-model'),
      tokenCount(`${D1}T01:00:01Z`, { input: 10 }),
    ]);
    expect(scanCodexRollouts(home).unpricedModels).toEqual(['brand-new-model']);
  });

  it('re-reads a file whose size changed and keeps the growth', () => {
    const p = writeRollout(D1, 'aaa', [
      turnContext(`${D1}T01:00:00Z`, 'gpt-5.6-sol'),
      tokenCount(`${D1}T01:00:01Z`, { input: 1_000_000 }),
    ]);
    expect(scanCodexRollouts(home).files[0].totalUsd).toBeCloseTo(5, 6);
    fs.appendFileSync(p, '\n' + tokenCount(`${D1}T01:00:02Z`, { input: 2_000_000 }));
    expect(scanCodexRollouts(home).files[0].totalUsd).toBeCloseTo(15, 6);
  });

  it('counts an unreadable file as an error rather than silently dropping it', () => {
    const p = writeRollout(D1, 'aaa', [
      turnContext(`${D1}T01:00:00Z`, 'gpt-5.6-sol'),
      tokenCount(`${D1}T01:00:01Z`, { input: 1_000_000 }),
    ]);
    fs.chmodSync(p, 0o000);
    const scan = scanCodexRollouts(home);
    fs.chmodSync(p, 0o644);
    expect(scan.errors).toBe(1);
    expect(scan.files).toEqual([]);
  });
});

describe('ledgerKey', () => {
  it('joins file and day into a stable composite', () => {
    expect(ledgerKey('2026/08/18/rollout-a.jsonl', D1)).toBe(`2026/08/18/rollout-a.jsonl ${D1}`);
  });
});
