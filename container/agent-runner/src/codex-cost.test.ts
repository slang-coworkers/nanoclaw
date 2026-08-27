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
  ledgerKey,
  normalizeCodexModel,
  parseCodexRollout,
  scanCodexRollouts,
} from './codex-cost.js';

/** One `event_msg`/`token_count` row carrying a CUMULATIVE total, prod shape. */
function tokenCount(
  ts: string,
  totals: { input: number; cached?: number; cacheWrite?: number; output?: number },
): string {
  return JSON.stringify({
    timestamp: ts,
    type: 'event_msg',
    payload: {
      type: 'token_count',
      info: {
        total_token_usage: {
          input_tokens: totals.input,
          cached_input_tokens: totals.cached ?? 0,
          cache_write_input_tokens: totals.cacheWrite ?? 0,
          output_tokens: totals.output ?? 0,
          reasoning_output_tokens: 0,
          total_tokens: totals.input + (totals.output ?? 0),
        },
        last_token_usage: {
          input_tokens: 0,
          cached_input_tokens: 0,
          cache_write_input_tokens: 0,
          output_tokens: 0,
          reasoning_output_tokens: 0,
          total_tokens: 0,
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

const D1 = '2026-08-18';
const D2 = '2026-08-19';

describe('codex rate table (anti-drift vs the ccusage-derived rates)', () => {
  it('pins $5 / $0.50 / $30 per Mtok for every known model id', () => {
    for (const key of Object.keys(CODEX_MODEL_PRICING)) {
      expect(CODEX_MODEL_PRICING[key]).toEqual({ input: 5e-6, cachedInput: 0.5e-6, output: 30e-6 });
    }
    expect(Object.keys(CODEX_MODEL_PRICING)).toContain('gpt-5.6-sol');
    expect(Object.keys(CODEX_MODEL_PRICING)).toContain('gpt-5.5');
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
});

describe('parseCodexRollout', () => {
  it('reproduces a REAL measured prod day to the cent', () => {
    // 2026-08-18 of session sess-1787093778289-z2m79j, as reported by
    // `ccusage codex daily --json --offline`: $9.004048.
    const content = [
      sessionMeta(`${D1}T01:00:00.000Z`),
      turnContext(`${D1}T01:00:01.000Z`, 'azure/openai/gpt-5.6-sol'),
      tokenCount(`${D1}T02:00:00.000Z`, { input: 9912023, cached: 9517666, cacheWrite: 388466, output: 75781 }),
    ].join('\n');
    const { file } = parseCodexRollout(content, 'r1.jsonl');
    expect(file.byDay[D1]).toBeCloseTo(9.004048, 6);
    expect(file.totalUsd).toBeCloseTo(9.004048, 6);
  });

  it('treats total_token_usage as cumulative — sums deltas, not readings', () => {
    const content = [
      turnContext(`${D1}T01:00:00.000Z`, 'gpt-5.6-sol'),
      tokenCount(`${D1}T01:00:01.000Z`, { input: 1_000_000, output: 0 }),
      tokenCount(`${D1}T01:00:02.000Z`, { input: 2_000_000, output: 0 }),
      tokenCount(`${D1}T01:00:03.000Z`, { input: 3_000_000, output: 100_000 }),
    ].join('\n');
    const { file } = parseCodexRollout(content, 'r1.jsonl');
    // 3M non-cached input @ $5/M + 100k output @ $30/M = 15 + 3
    expect(file.totalUsd).toBeCloseTo(18, 6);
  });

  it('partitions by UTC day so a file straddling midnight is attributed correctly', () => {
    const content = [
      turnContext(`${D1}T23:00:00.000Z`, 'gpt-5.6-sol'),
      tokenCount(`${D1}T23:59:00.000Z`, { input: 1_000_000 }),
      tokenCount(`${D2}T00:01:00.000Z`, { input: 3_000_000 }),
    ].join('\n');
    const { file } = parseCodexRollout(content, 'r1.jsonl');
    expect(file.byDay[D1]).toBeCloseTo(5, 6);
    expect(file.byDay[D2]).toBeCloseTo(10, 6);
    expect(file.totalUsd).toBeCloseTo(15, 6);
  });

  it('prices each delta under the model in effect when a rollout switches model', () => {
    const content = [
      turnContext(`${D1}T01:00:00.000Z`, 'gpt-5.6-sol'),
      tokenCount(`${D1}T01:00:01.000Z`, { input: 1_000_000 }),
      turnContext(`${D1}T01:00:02.000Z`, 'model-with-no-rate'),
      tokenCount(`${D1}T01:00:03.000Z`, { input: 2_000_000 }),
    ].join('\n');
    const { file, unpriced } = parseCodexRollout(content, 'r1.jsonl');
    // both legs happen to price at the same rate (default == known), but the
    // UNKNOWN model must be reported so the table can be updated.
    expect([...unpriced]).toEqual(['model-with-no-rate']);
    expect(file.totalUsd).toBeCloseTo(10, 6);
  });

  it('charges an unknown model at the default rate rather than $0', () => {
    const content = [
      turnContext(`${D1}T01:00:00.000Z`, 'gpt-9-unreleased'),
      tokenCount(`${D1}T01:00:01.000Z`, { input: 1_000_000 }),
    ].join('\n');
    const { file, unpriced } = parseCodexRollout(content, 'r1.jsonl');
    expect(file.totalUsd).toBeCloseTo(1_000_000 * DEFAULT_CODEX_RATE.input, 6);
    expect(unpriced.has('gpt-9-unreleased')).toBe(true);
  });

  it('never refunds when the cumulative counter goes backwards', () => {
    const content = [
      turnContext(`${D1}T01:00:00.000Z`, 'gpt-5.6-sol'),
      tokenCount(`${D1}T01:00:01.000Z`, { input: 2_000_000 }),
      tokenCount(`${D1}T01:00:02.000Z`, { input: 1_000_000 }), // reset / corrupt
      tokenCount(`${D1}T01:00:03.000Z`, { input: 3_000_000 }),
    ].join('\n');
    const { file } = parseCodexRollout(content, 'r1.jsonl');
    // 2M charged, backwards step ignored, then +1M over the high-water mark.
    expect(file.totalUsd).toBeCloseTo(15, 6);
  });

  it('clamps cached above input and rejects negative / non-finite token values', () => {
    const weird = JSON.stringify({
      timestamp: `${D1}T01:00:01.000Z`,
      type: 'event_msg',
      payload: {
        type: 'token_count',
        info: {
          total_token_usage: {
            input_tokens: 1_000_000,
            cached_input_tokens: 5_000_000, // > input
            output_tokens: -42,
            cache_write_input_tokens: null,
          },
        },
      },
    });
    const { file } = parseCodexRollout(
      [turnContext(`${D1}T01:00:00.000Z`, 'gpt-5.6-sol'), weird].join('\n'),
      'r.jsonl',
    );
    // non-cached clamps to 0; cached 5M @ $0.50/M = $2.50; negative output → 0
    expect(file.totalUsd).toBeCloseTo(2.5, 6);
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
    const { file } = parseCodexRollout(content, 'r1.jsonl');
    expect(file.totalUsd).toBeCloseTo(5, 6);
  });

  it('buckets a row with no usable timestamp under the missing-day key', () => {
    const noTs = JSON.stringify({
      type: 'event_msg',
      payload: { type: 'token_count', info: { total_token_usage: { input_tokens: 1_000_000 } } },
    });
    const { file } = parseCodexRollout([turnContext(`${D1}T01:00:00.000Z`, 'gpt-5.6-sol'), noTs].join('\n'), 'r.jsonl');
    expect(file.byDay[MISSING_DAY_KEY]).toBeCloseTo(5, 6);
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

  it('returns nothing for a home with no sessions dir', () => {
    expect(scanCodexRollouts(path.join(home, 'nope')).files).toEqual([]);
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
    fs.appendFileSync(p, '\n' + tokenCount(`${D1}T01:00:02Z`, { input: 3_000_000 }));
    expect(scanCodexRollouts(home).files[0].totalUsd).toBeCloseTo(15, 6);
  });
});

describe('ledgerKey', () => {
  it('joins file and day into a stable composite', () => {
    expect(ledgerKey('2026/08/18/rollout-a.jsonl', D1)).toBe(`2026/08/18/rollout-a.jsonl ${D1}`);
  });
});
