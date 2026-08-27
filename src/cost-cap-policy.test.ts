/**
 * Runtime cost-cap policy (`cost_cap_policy`) — DB accessor + the resolver
 * precedence it feeds.
 *
 * These pin the new behavior added on top of the env / thresholds chain:
 *   - a DB per-group `cap_usd` is the new HIGHEST-priority cap source (wins over
 *     env and thresholds, unfloored — an explicit operator decision);
 *   - the ceiling resolves per-group DB → fleet DB → env → 0, and a stored DB
 *     value (including 0) beats the env var;
 *   - with no DB rows the existing chain (env → thresholds → $100, floored $10)
 *     is preserved exactly;
 *   - reads are fail-soft (an uninitialized DB never throws).
 *
 * The thresholds file lives under DATA_DIR; we stub fs.readFileSync so the cap
 * tests are hermetic.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';

import { resolveCostCapT2Usd, resolveCostCeilingT2Usd } from './container-config.js';
import { closeDb, initTestDb } from './db/connection.js';
import { runMigrations } from './db/migrations/index.js';
import { clearCostCapPolicy, getCostCapPolicy, listCostCapPolicies, setCostCapPolicy } from './db/cost-cap-policy.js';

const savedCap = process.env.NANOCLAW_COST_T2_USD;
const savedCeiling = process.env.NANOCLAW_COST_T2_CEILING_USD;

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

describe('runtime cost-cap policy', () => {
  beforeEach(async () => {
    await runMigrations(await initTestDb());
    delete process.env.NANOCLAW_COST_T2_USD;
    delete process.env.NANOCLAW_COST_T2_CEILING_USD;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await closeDb();
    if (savedCap === undefined) delete process.env.NANOCLAW_COST_T2_USD;
    else process.env.NANOCLAW_COST_T2_USD = savedCap;
    if (savedCeiling === undefined) delete process.env.NANOCLAW_COST_T2_CEILING_USD;
    else process.env.NANOCLAW_COST_T2_CEILING_USD = savedCeiling;
  });

  describe('resolveCostCapT2Usd — DB per-group override precedence', () => {
    it('a DB per-group cap wins over BOTH env and thresholds, unfloored', async () => {
      await setCostCapPolicy({ groupFolder: 'slang-fixer', capUsd: 3 }); // below the $10 floor
      process.env.NANOCLAW_COST_T2_USD = '50';
      stubThresholds({ perGroupP90Usd: { 'slang-fixer': 91 }, p90Usd: 30 });
      expect(await resolveCostCapT2Usd('slang-fixer')).toBe(3);
    });

    it('the DB override only applies to its own group; others fall through the chain', async () => {
      await setCostCapPolicy({ groupFolder: 'slang-fixer', capUsd: 200 });
      stubThresholds({ perGroupP90Usd: { reviewer: 12 }, p90Usd: 30 });
      expect(await resolveCostCapT2Usd('slang-fixer')).toBe(200); // DB
      expect(await resolveCostCapT2Usd('reviewer')).toBe(12); // its own p90
      expect(await resolveCostCapT2Usd('brand-new')).toBe(30); // fleet p90
    });

    it('with no DB cap the existing chain + $10 floor are preserved', async () => {
      stubThresholds({ perGroupP90Usd: { fixer: 2 }, p90Usd: 3 });
      expect(await resolveCostCapT2Usd('fixer')).toBe(10); // floored, unchanged from before
    });

    it('a DB cap set on another group does not leak to an unrelated group', async () => {
      await setCostCapPolicy({ groupFolder: 'slang-fixer', capUsd: 500 });
      stubThresholds(new Error('ENOENT')); // → $100 default
      expect(await resolveCostCapT2Usd('unrelated')).toBe(100);
    });
  });

  describe('resolveCostCeilingT2Usd — DB per-group → fleet → env → 0', () => {
    it('a fleet DB ceiling wins over the env var', async () => {
      process.env.NANOCLAW_COST_T2_CEILING_USD = '150';
      expect(await resolveCostCeilingT2Usd()).toBe(150); // env only
      await setCostCapPolicy({ ceilingUsd: 250 });
      expect(await resolveCostCeilingT2Usd()).toBe(250); // fleet DB beats env
    });

    it('a per-group DB ceiling wins over the fleet DB ceiling', async () => {
      await setCostCapPolicy({ ceilingUsd: 250 }); // fleet
      await setCostCapPolicy({ groupFolder: 'slang-fixer', ceilingUsd: 400 });
      expect(await resolveCostCeilingT2Usd('slang-fixer')).toBe(400); // per-group
      expect(await resolveCostCeilingT2Usd('other')).toBe(250); // fleet fallback
    });

    it('a stored ceiling of 0 explicitly disables the ceiling, overriding the env var', async () => {
      process.env.NANOCLAW_COST_T2_CEILING_USD = '150';
      await setCostCapPolicy({ ceilingUsd: 0 });
      expect(await resolveCostCeilingT2Usd()).toBe(0);
    });

    it('falls back to the env var, then 0, when no DB row is set', async () => {
      expect(await resolveCostCeilingT2Usd()).toBe(0); // no env, no DB
      process.env.NANOCLAW_COST_T2_CEILING_USD = '150';
      expect(await resolveCostCeilingT2Usd('any')).toBe(150);
    });
  });

  describe('accessor semantics', () => {
    it('set upserts, changing only the provided amount', async () => {
      await setCostCapPolicy({ groupFolder: 'g', ceilingUsd: 100 });
      await setCostCapPolicy({ groupFolder: 'g', capUsd: 50 }); // leaves ceiling untouched
      const row = await getCostCapPolicy('g');
      expect(row?.ceiling_usd).toBe(100);
      expect(row?.cap_usd).toBe(50);
    });

    it('clear removes an override and restores the env fallback', async () => {
      process.env.NANOCLAW_COST_T2_CEILING_USD = '150';
      await setCostCapPolicy({ ceilingUsd: 500 });
      expect(await resolveCostCeilingT2Usd()).toBe(500);
      expect(await clearCostCapPolicy()).toBe(true);
      expect(await getCostCapPolicy()).toBeUndefined();
      expect(await resolveCostCeilingT2Usd()).toBe(150); // back to env
      expect(await clearCostCapPolicy()).toBe(false); // nothing left to remove
    });

    it('lists the fleet row first, then group overrides', async () => {
      await setCostCapPolicy({ groupFolder: 'zeta', capUsd: 10 });
      await setCostCapPolicy({ ceilingUsd: 200 }); // fleet
      await setCostCapPolicy({ groupFolder: 'alpha', capUsd: 20 });
      const scopes = (await listCostCapPolicies()).map((r) => r.group_folder);
      expect(scopes[0]).toBe(''); // fleet first
      expect(scopes.slice(1)).toEqual(['alpha', 'zeta']); // then folders, sorted
    });

    it('reads are fail-soft when the DB is closed', async () => {
      await closeDb();
      expect(await getCostCapPolicy('x')).toBeUndefined();
      expect(await listCostCapPolicies()).toEqual([]);
      expect(await resolveCostCeilingT2Usd('x')).toBe(0); // resolver survives a missing DB
    });
  });
});
