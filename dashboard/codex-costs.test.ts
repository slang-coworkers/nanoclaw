import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

import { describe, expect, it } from 'vitest';

import {
  CODEX_MODEL_PRICING,
  codexUsageKey,
  codexUsageTokens,
  normalizeCodexModel,
  parseCodexRollout,
  priceCodexUsage,
  type CodexTokenUsage,
} from './codex-costs.js';

// ── Fixtures distilled from real prod rollout files ───────────────────────────
// A `token_count` event as codex actually writes it; a `turn_context` line as it
// actually precedes them; and the exact numbers from the prod session-day whose
// ccusage `costUSD` (3.2796745000000005) pinned the rate table.

const MODEL = 'azure/openai/gpt-5.6-sol';

function tokenCountLine(
  ts: string,
  last: CodexTokenUsage,
  total: CodexTokenUsage = last,
): string {
  return JSON.stringify({
    timestamp: ts,
    type: 'event_msg',
    payload: { type: 'token_count', info: { total_token_usage: total, last_token_usage: last, model_context_window: 258400 } },
  });
}

function turnContextLine(ts: string, model = MODEL): string {
  return JSON.stringify({ timestamp: ts, type: 'turn_context', payload: { type: 'turn_context', model, cwd: '/workspace/agent' } });
}

describe('normalizeCodexModel', () => {
  it('strips the doubled gateway prefix the fleet actually emits', () => {
    expect(normalizeCodexModel('azure/openai/gpt-5.6-sol')).toBe('gpt-5.6-sol');
    expect(normalizeCodexModel('openai/openai/gpt-5.5')).toBe('gpt-5.5');
    expect(normalizeCodexModel('gpt-5.2-codex')).toBe('gpt-5.2-codex');
    expect(normalizeCodexModel('GPT-5.1-Codex')).toBe('gpt-5.1-codex');
  });

  it('tolerates a dated snapshot and a -latest suffix', () => {
    expect(normalizeCodexModel('azure/openai/gpt-5.6-sol-20260101')).toBe('gpt-5.6-sol');
    expect(normalizeCodexModel('gpt-5.6-latest')).toBe('gpt-5.6');
  });

  it('returns empty for unknown/absent so they price as unpriced, not $0', () => {
    expect(normalizeCodexModel('claude-opus-5')).toBe('');
    expect(normalizeCodexModel('some-future-model')).toBe('');
    expect(normalizeCodexModel(undefined)).toBe('');
    expect(normalizeCodexModel('')).toBe('');
  });
});

describe('priceCodexUsage', () => {
  it('reproduces ccusage to the cent on a real prod session-day', () => {
    // slang-coworkers prod, ag-1780667166418-apezq5/sess-1785899910063-h38gq3,
    // 2026-08-05. ccusage codex daily --json --offline reported:
    //   inputTokens 173343, cacheReadTokens 3040319, outputTokens 29760,
    //   cacheCreationTokens 0, costUSD 3.2796745000000005
    // ccusage's `inputTokens` is already NET of cached, so the rollout's raw
    // `input_tokens` for the same day is 173343 + 3040319.
    const cost = priceCodexUsage(MODEL, {
      input_tokens: 173343 + 3040319,
      cached_input_tokens: 3040319,
      output_tokens: 29760,
      reasoning_output_tokens: 11864,
    });
    expect(cost).toBeCloseTo(3.2796745, 7);
  });

  it('bills input NET of the cached subset (input_tokens INCLUDES cached)', () => {
    // 1M input of which 900k were cache reads: 100k at 5e-6 + 900k at 5e-7.
    expect(priceCodexUsage(MODEL, { input_tokens: 1_000_000, cached_input_tokens: 900_000 })).toBeCloseTo(
      0.5 + 0.45,
      9,
    );
  });

  it('does NOT bill cache writes separately (ccusage reports cacheCreationTokens 0)', () => {
    const without = priceCodexUsage(MODEL, { input_tokens: 500_000, cached_input_tokens: 0 });
    const withWrites = priceCodexUsage(MODEL, {
      input_tokens: 500_000,
      cached_input_tokens: 0,
      cache_write_input_tokens: 499_000,
    });
    expect(withWrites).toBe(without);
  });

  it('does NOT add reasoning tokens on top of output (they are a subset)', () => {
    const plain = priceCodexUsage(MODEL, { output_tokens: 100_000 });
    const withReasoning = priceCodexUsage(MODEL, { output_tokens: 100_000, reasoning_output_tokens: 80_000 });
    expect(withReasoning).toBe(plain);
    expect(plain).toBeCloseTo(3.0, 9); // 100k * 3e-5
  });

  it('resolves the fleet prefix to the AZURE rates, not the cheaper bare-OpenAI ones', () => {
    // The bare LiteLLM `gpt-5.6-sol` entry is 4e-6 input / 2e-5 output; ccusage
    // resolves `azure/openai/…` to azure's 5e-6 / 3e-5. Guarding the expensive
    // one, because picking wrong understates every codex session ~20%.
    expect(CODEX_MODEL_PRICING['gpt-5.6-sol']).toEqual({ input: 5e-6, output: 3e-5, cacheRead: 5e-7 });
  });

  it('never throws and contributes 0 for an unknown model', () => {
    expect(priceCodexUsage('some-future-model', { input_tokens: 1_000_000, output_tokens: 10_000 })).toBe(0);
    expect(priceCodexUsage(undefined, { output_tokens: 5 })).toBe(0);
  });

  it('clamps a nonsensical cached > input rather than crediting negative input', () => {
    const cost = priceCodexUsage(MODEL, { input_tokens: 10, cached_input_tokens: 1000 });
    expect(cost).toBeCloseTo(1000 * 5e-7, 12);
  });
});

describe('codexUsageTokens', () => {
  it('is input + output — the rollout’s own total_tokens, not a re-sum of the parts', () => {
    // Real event: 5043251 + 22021 == total_tokens 5065272. cache writes and
    // reasoning tokens are already inside those two and must not be re-added.
    expect(
      codexUsageTokens({
        input_tokens: 5043251,
        cached_input_tokens: 4836849,
        cache_write_input_tokens: 169003,
        output_tokens: 22021,
        reasoning_output_tokens: 12811,
        total_tokens: 5065272,
      }),
    ).toBe(5065272);
  });
});

describe('parseCodexRollout', () => {
  it('extracts each call’s delta usage, dated by the event’s own timestamp', () => {
    const content = [
      JSON.stringify({ timestamp: '2026-08-05T03:28:20.000Z', type: 'session_meta', payload: { session_id: 'x' } }),
      turnContextLine('2026-08-05T03:28:21.000Z'),
      tokenCountLine('2026-08-05T03:28:26.223Z', { input_tokens: 25418, cached_input_tokens: 0, output_tokens: 311 }),
      tokenCountLine(
        '2026-08-06T03:28:31.692Z',
        { input_tokens: 25551, cached_input_tokens: 25415, output_tokens: 270 },
        { input_tokens: 50969, cached_input_tokens: 25415, output_tokens: 581 },
      ),
      '',
    ].join('\n');
    const events = parseCodexRollout(content);
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({
      dayKey: '20260805',
      model: MODEL,
      usage: { input_tokens: 25418, cached_input_tokens: 0, output_tokens: 311 },
    });
    // Second event lands on its OWN day, not the file's directory day.
    expect(events[1].dayKey).toBe('20260806');
    // The DELTA is used, never the cumulative — cross-file dedupe needs per-call rows.
    expect(events[1].usage.input_tokens).toBe(25551);
  });

  it('survives truncated/garbage lines and rows with no usage', () => {
    const content = [
      '{not json',
      turnContextLine('2026-08-05T03:28:21.000Z'),
      JSON.stringify({ timestamp: '2026-08-05T03:28:22.000Z', type: 'response_item', payload: { type: 'reasoning' } }),
      // token_count with an all-zero reading — carries no cost, must not create a row
      tokenCountLine('2026-08-05T03:28:23.000Z', { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 }),
      tokenCountLine('2026-08-05T03:28:26.000Z', { input_tokens: 100, cached_input_tokens: 0, output_tokens: 10 }),
    ].join('\n');
    expect(parseCodexRollout(content).map((e) => e.usage.input_tokens)).toEqual([100]);
  });

  it('leaves the model empty when the rollout never declares one (→ unpriced, not $0)', () => {
    const content = tokenCountLine('2026-08-05T03:28:26.000Z', { input_tokens: 100, output_tokens: 10 });
    const events = parseCodexRollout(content);
    expect(events[0].model).toBe('');
    expect(priceCodexUsage(events[0].model, events[0].usage)).toBe(0);
    // …and server.ts must RAISE the unpriced `*` for it. The rule there is
    // `cost === 0 && tokens > 0 && !normalizeCodexModel(model)` — deliberately
    // NOT gated on the model being non-empty, because a model-less reading is
    // real spend we cannot name, not a free synthetic row. This assertion pins
    // the predicate; an `&& model` guard would silently report a confident $0.
    const model = events[0].model;
    const cost = priceCodexUsage(model, events[0].usage);
    const tokens = codexUsageTokens(events[0].usage);
    expect(cost === 0 && tokens > 0 && !normalizeCodexModel(model)).toBe(true);
  });

  it('a null dayKey (timestamp missing) is reported rather than guessed', () => {
    const content = JSON.stringify({
      type: 'event_msg',
      payload: { type: 'token_count', info: { last_token_usage: { input_tokens: 100, output_tokens: 10 } } },
    });
    expect(parseCodexRollout(content)[0].dayKey).toBeNull();
  });
});

describe('codexUsageKey — the cross-file dedupe that keeps us reconciled with ccusage', () => {
  // A codex subagent thread spawn (payload.source.subagent.thread_spawn, with
  // forked_from_id) writes its OWN rollout file that replays the parent's
  // already-billed turns. Summing per-file cumulative totals overcounted a real
  // prod session-day by 13.7%. ccusage collapses the replayed calls by their
  // usage tuple; this key is that rule.
  const parent = [
    turnContextLine('2026-08-05T03:28:20.000Z'),
    tokenCountLine('2026-08-05T03:28:26.000Z', { input_tokens: 25418, cached_input_tokens: 0, output_tokens: 311 }),
    tokenCountLine('2026-08-05T03:28:31.000Z', { input_tokens: 25551, cached_input_tokens: 25415, output_tokens: 270 }),
  ].join('\n');
  // The fork replays the parent's FIRST turn verbatim, then diverges.
  const fork = [
    turnContextLine('2026-08-05T03:28:48.000Z'),
    tokenCountLine('2026-08-05T03:28:54.000Z', { input_tokens: 25418, cached_input_tokens: 0, output_tokens: 311 }),
    tokenCountLine('2026-08-05T03:29:02.000Z', { input_tokens: 30585, cached_input_tokens: 30512, output_tokens: 322 }),
  ].join('\n');

  /** What server.ts's scanSessionCodexCost does across a session's rollout files. */
  function sessionCost(files: string[]): { cost: number; kept: number } {
    const seen = new Set<string>();
    let cost = 0;
    let kept = 0;
    for (const content of files) {
      for (const ev of parseCodexRollout(content)) {
        const k = codexUsageKey(ev.model, ev.usage);
        if (seen.has(k)) continue;
        seen.add(k);
        cost += priceCodexUsage(ev.model, ev.usage);
        kept++;
      }
    }
    return { cost, kept };
  }

  it('drops the replayed prefix a forked subagent rollout carries', () => {
    expect(sessionCost([parent, fork]).kept).toBe(3); // 4 events, 1 replay
  });

  it('an un-forked session is untouched by the dedupe', () => {
    expect(sessionCost([parent]).kept).toBe(2);
  });

  it('the replayed turn is billed exactly once', () => {
    const replayed = priceCodexUsage(MODEL, { input_tokens: 25418, cached_input_tokens: 0, output_tokens: 311 });
    expect(sessionCost([parent, fork]).cost).toBeCloseTo(sessionCost([parent]).cost + sessionCost([fork]).cost - replayed, 12);
  });

  it('keys on the model too, so two models on identical counts stay distinct', () => {
    const u = { input_tokens: 100, cached_input_tokens: 0, output_tokens: 10 };
    expect(codexUsageKey('azure/openai/gpt-5.6-sol', u)).not.toBe(codexUsageKey('gpt-5.2-codex', u));
  });

  it('an unknown model still gets a stable, distinct key (never collapses into ‘’)', () => {
    const u = { input_tokens: 100, output_tokens: 10 };
    expect(codexUsageKey('future-a', u)).not.toBe(codexUsageKey('future-b', u));
  });
});

describe('CODEX_MODEL_PRICING agrees with the agent-runner’s copy (no drift)', () => {
  // The agent-runner needs the same rates for LIVE cost-cap enforcement (the
  // runner half of #1327) and CANNOT import this module: container/Dockerfile
  // copies only `agent-runner/` into /app and src/container-runner.ts bind-mounts
  // only container/agent-runner/src at /app/src, so nothing under dashboard/ (or
  // a hypothetical src/shared/) resolves inside the container. The table is
  // therefore duplicated there and guarded here — the same discipline
  // session-costs.ts uses against server.ts's FALLBACK_PRICING.
  //
  // On THIS branch (nv-dashboard) the runner copy does not exist and the test
  // no-ops. CI composes every nv-* branch into one tree, so once the runner half
  // lands the two are checked against each other on every run.
  const RUNNER_SRC = join(process.cwd(), 'container', 'agent-runner', 'src');

  function findRunnerPricingFiles(): string[] {
    const hits: string[] = [];
    const walk = (dir: string, depth: number): void => {
      if (depth > 4) return;
      let entries: ReturnType<typeof readdirSync>;
      try {
        entries = readdirSync(dir);
      } catch {
        return;
      }
      for (const name of entries) {
        const full = join(dir, name);
        let isDir = false;
        try {
          isDir = statSync(full).isDirectory();
        } catch {
          continue;
        }
        if (isDir) {
          if (name === 'node_modules') continue;
          walk(full, depth + 1);
        } else if (
          name.endsWith('.ts') &&
          !name.endsWith('.test.ts') &&
          /codex/i.test(name) &&
          /pricing|price|cost|rate/i.test(name)
        ) {
          // Filename contract with the runner half (see the describe() comment):
          // anything under container/agent-runner/src named for BOTH codex and
          // pricing/cost/rates. Kept a pattern rather than one hard-coded path so
          // the runner can organise its tree freely; the tradeoff is that a table
          // hidden in an unrelated filename is not guarded, which is why the
          // expected name is written down on both sides.
          hits.push(full);
        }
      }
    };
    if (existsSync(RUNNER_SRC)) walk(RUNNER_SRC, 0);
    return hits;
  }

  it('every model both copies know is priced identically, and the runner covers all of ours', async () => {
    const files = findRunnerPricingFiles();
    if (files.length === 0) return; // runner half not in this tree — see comment above
    const tables: { where: string; table: Record<string, unknown> }[] = [];
    for (const file of files) {
      // An import failure is NOT swallowed: a rate table that the dashboard's
      // test runner cannot load is a table nothing can check, which is the
      // failure mode this guard exists to prevent.
      const mod = (await import(file)) as Record<string, unknown>;
      for (const [exportName, value] of Object.entries(mod)) {
        if (!/CODEX.*(PRICING|RATES)/i.test(exportName) || !value || typeof value !== 'object') continue;
        tables.push({ where: `${file}#${exportName}`, table: value as Record<string, unknown> });
      }
    }
    expect(tables.length, `found ${files.join(', ')} but no CODEX_*_PRICING/RATES export in them`).toBeGreaterThan(0);

    for (const { where, table } of tables) {
      // (a) Shared keys must agree exactly.
      for (const [model, rate] of Object.entries(table)) {
        const ours = CODEX_MODEL_PRICING[model];
        if (!ours) continue; // the runner may price models we don't; that's allowed
        expect(rate, `${where}[${model}] disagrees with dashboard/codex-costs.ts`).toMatchObject(ours);
      }
      // (b) …and the runner must know every model WE price. Otherwise a model
      // the dashboard reports spend for is one the runner's cost cap can't see,
      // which is the enforcement hole #1327 is closing, reopened by omission.
      const missing = Object.keys(CODEX_MODEL_PRICING).filter((m) => !(m in table));
      expect(missing, `${where} is missing models dashboard/codex-costs.ts prices`).toEqual([]);
    }
  });
});
