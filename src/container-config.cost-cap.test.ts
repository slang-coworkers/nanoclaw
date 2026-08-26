/**
 * Host resolver for the per-session cost cap (NanoClaw #1 cost cap v2).
 *
 * `resolveCostCapT2Usd(groupFolder?)` picks the cap materialized into every
 * group's container.json. Precedence: NANOCLAW_COST_T2_USD env override →
 * per-group p90 → fleet p90 → $100 default, with an absolute $10 floor on the
 * auto-sourced value (the override bypasses the floor). These pin the three
 * behaviors the ceiling review added a floor + preference order for.
 *
 * The thresholds file lives under DATA_DIR; we stub fs.readFileSync so the test
 * is hermetic (and independent of whether a real data/cost-thresholds.json
 * exists in the tree).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';

import { resolveCostCapT2Usd } from './container-config.js';

const savedEnv = process.env.NANOCLAW_COST_T2_USD;

/** Make DATA_DIR/cost-thresholds.json read as `obj`, or throw `obj` if an Error. */
function stubThresholds(obj: unknown): void {
  vi.spyOn(fs, 'readFileSync').mockImplementation(((p: fs.PathOrFileDescriptor) => {
    if (typeof p === 'string' && p.endsWith('cost-thresholds.json')) {
      if (obj instanceof Error) throw obj;
      return JSON.stringify(obj);
    }
    throw new Error(`unexpected read in test: ${String(p)}`);
  }) as typeof fs.readFileSync);
}

describe('resolveCostCapT2Usd', () => {
  beforeEach(() => {
    // The override wins outright; clear it so the threshold/default paths are testable.
    delete process.env.NANOCLAW_COST_T2_USD;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (savedEnv === undefined) delete process.env.NANOCLAW_COST_T2_USD;
    else process.env.NANOCLAW_COST_T2_USD = savedEnv;
  });

  it('floors a below-$10 per-group p90 at the $10 minimum', async () => {
    stubThresholds({ perGroupP90Usd: { fixer: 2 }, p90Usd: 3 });
    expect(await resolveCostCapT2Usd('fixer')).toBe(10);
  });

  it('floors a below-$10 fleet p90 at the $10 minimum when the group has no own p90', async () => {
    stubThresholds({ p90Usd: 4 });
    expect(await resolveCostCapT2Usd('brand-new-group')).toBe(10);
    // No group folder at all → same fleet fallback, same floor.
    expect(await resolveCostCapT2Usd()).toBe(10);
  });

  it('the $100 default is already ≥ floor — the floor never lowers a legit value', async () => {
    // Missing/corrupt thresholds file → fail-soft to the $100 default.
    stubThresholds(new Error('ENOENT: no such file'));
    expect(await resolveCostCapT2Usd('fixer')).toBe(100);
  });

  it('prefers the group’s own p90 over the fleet p90', async () => {
    stubThresholds({ perGroupP90Usd: { fixer: 91 }, p90Usd: 30 });
    expect(await resolveCostCapT2Usd('fixer')).toBe(91); // per-group wins
    expect(await resolveCostCapT2Usd('other')).toBe(30); // not in the map → fleet fallback
  });

  it('keeps an above-floor per-group p90 unchanged', async () => {
    stubThresholds({ perGroupP90Usd: { reviewer: 12 } });
    expect(await resolveCostCapT2Usd('reviewer')).toBe(12);
  });

  it('the NANOCLAW_COST_T2_USD override bypasses the floor and wins over thresholds', async () => {
    process.env.NANOCLAW_COST_T2_USD = '3'; // below the $10 floor
    stubThresholds({ perGroupP90Usd: { fixer: 91 }, p90Usd: 30 });
    expect(await resolveCostCapT2Usd('fixer')).toBe(3); // override wins outright, unfloored
  });
});
