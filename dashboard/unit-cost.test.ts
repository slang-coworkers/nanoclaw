import { describe, expect, it } from 'vitest';

import {
  isUnitCostGroup,
  isoWeekStart,
  isoWeekStartFromMs,
  sessionIdMs,
  unitCostByWeek,
  UNIT_COST_GROUPS,
  type CostGroupInput,
} from './unit-cost.js';

const MON_JUL_6 = '2026-07-06';
const MON_JUL_13 = '2026-07-13';
const MON_JUL_20 = '2026-07-20';
const MON_JUL_27 = '2026-07-27';
// Wed of the Jul 27 week — "now" for the trailing-4-week window.
const NOW = Date.parse('2026-07-29T12:00:00Z');

function g(groupName: string, daily: Array<[string, number]>): CostGroupInput {
  return { groupName, daily: daily.map(([date, totalCost]) => ({ date, totalCost })) };
}

describe('isUnitCostGroup', () => {
  it('accepts exactly the six coworker groups', () => {
    expect(UNIT_COST_GROUPS).toHaveLength(6);
    for (const n of UNIT_COST_GROUPS) expect(isUnitCostGroup(n)).toBe(true);
  });

  it('rejects the prod decoys a suffix match would have swept in', () => {
    // These all exist on prod. A rule like endsWith('-fixer') counts their
    // spend against a denominator they never contributed a PR to.
    for (const decoy of [
      'dashboard_slang-fixer',
      'generic-fixer',
      'slang-playground-fixer',
      'legacy_slang-reviewer',
      'dashboard_slang-triage',
      'generic-triage',
      'main',
      'slang-pr-approver',
    ]) {
      expect(isUnitCostGroup(decoy), decoy).toBe(false);
    }
  });
});

describe('isoWeekStart', () => {
  it('maps every day of a week to that week Monday', () => {
    // Mon 6th through Sun 12th July 2026 all belong to the Jul 6 week.
    for (const d of ['2026-07-06', '2026-07-07', '2026-07-09', '2026-07-11', '2026-07-12']) {
      expect(isoWeekStart(d), d).toBe(MON_JUL_6);
    }
    // Monday the 13th starts the NEXT week, not the same one.
    expect(isoWeekStart('2026-07-13')).toBe(MON_JUL_13);
  });

  it('treats Sunday as the END of its week, not the start', () => {
    // The classic off-by-one: JS getUTCDay() calls Sunday 0.
    expect(isoWeekStart('2026-07-12')).toBe(MON_JUL_6);
  });

  it('accepts the compact YYYYMMDD form ccusage also emits', () => {
    expect(isoWeekStart('20260709')).toBe(MON_JUL_6);
  });

  it('throws on an unparseable date rather than silently bucketing it', () => {
    expect(() => isoWeekStart('not-a-date')).toThrow();
  });

  it('is UTC, so a late-UTC-Sunday does not slide into the next week', () => {
    expect(isoWeekStartFromMs(Date.parse('2026-07-12T23:59:59Z'))).toBe(MON_JUL_6);
  });
});

describe('sessionIdMs', () => {
  it('extracts the epoch-ms', () => {
    expect(sessionIdMs('sess-1785934553192-8lcrie')).toBe(1785934553192);
  });

  it('returns null for a shape it does not recognise', () => {
    // Must NOT return 0/NaN — that would land every malformed row in the 1970
    // bucket and inflate one week's denominator.
    for (const bad of ['a2a-1785934553192-x', 'sess-abc-x', 'sess--x', '', 'sess-12-x']) {
      expect(sessionIdMs(bad), bad).toBeNull();
    }
  });
});

describe('unitCostByWeek', () => {
  const cost: CostGroupInput[] = [
    g('slang-fixer', [
      ['2026-07-08', 100],
      ['2026-07-15', 80],
      ['2026-07-22', 60],
      ['2026-07-29', 50],
    ]),
    g('slang-triager', [
      ['2026-07-08', 20],
      ['2026-07-15', 15],
      ['2026-07-22', 10],
      ['2026-07-29', 10],
    ]),
    // Not one of the six — must be excluded entirely.
    g('main', [['2026-07-08', 9999]]),
  ];
  const prs = new Map([
    [MON_JUL_6, 2],
    [MON_JUL_13, 5],
    [MON_JUL_20, 7],
    [MON_JUL_27, 4],
  ]);

  it('returns the trailing four weeks ending with the current one', () => {
    const r = unitCostByWeek(cost, prs, 4, NOW);
    expect(r.weeks.map((w) => w.week)).toEqual([MON_JUL_6, MON_JUL_13, MON_JUL_20, MON_JUL_27]);
    expect(r.unavailable).toBeNull();
  });

  it('sums only the six groups, excluding everything else', () => {
    const r = unitCostByWeek(cost, prs, 4, NOW);
    // 100 + 20 = 120, NOT 120 + 9999 from `main`.
    expect(r.weeks[0].cost).toBe(120);
    expect(r.weeks[0].costPerPr).toBe(60); // 120 / 2
  });

  it('reports groups that contributed no cost data at all', () => {
    const r = unitCostByWeek(cost, prs, 4, NOW);
    expect(r.groupsMatched).toEqual(['slang-fixer', 'slang-triager']);
    // Declaration order, not alphabetical — it groups slang/slangpy pairs by
    // role, which is how an operator reads a coverage gap.
    expect(r.groupsMissing).toEqual(['slangpy-triager', 'slangpy-fixer', 'slang-reviewer', 'slangpy-reviewer']);
  });

  it('returns null — not 0, not Infinity — when no PR was opened that week', () => {
    // The whole point. Spend with no PR is a real state; it is neither free
    // nor infinitely expensive, and it must never render as a number.
    const r = unitCostByWeek(cost, new Map([[MON_JUL_6, 0]]), 4, NOW);
    const w = r.weeks.find((x) => x.week === MON_JUL_6)!;
    expect(w.cost).toBe(120);
    expect(w.prs).toBe(0);
    expect(w.costPerPr).toBeNull();
    expect(Number.isFinite(w.costPerPr as number)).toBe(false);
  });

  it('marks a week with no transcript coverage as hasCost:false, not cost 0', () => {
    // A week before the data starts must not read as "we spent nothing".
    const sparse = [g('slang-fixer', [['2026-07-29', 50]])];
    const r = unitCostByWeek(sparse, prs, 4, NOW);
    const early = r.weeks.find((w) => w.week === MON_JUL_6)!;
    expect(early.hasCost).toBe(false);
    expect(early.costPerPr).toBeNull();
    const current = r.weeks.find((w) => w.week === MON_JUL_27)!;
    expect(current.hasCost).toBe(true);
  });

  it('is unavailable — with a reason — when none of the six have data', () => {
    const r = unitCostByWeek([g('main', [['2026-07-08', 10]])], prs, 4, NOW);
    expect(r.weeks).toEqual([]);
    expect(r.unavailable).toMatch(/no cost data/i);
    expect(r.groupsMissing).toHaveLength(6);
  });

  it('buckets by week, so several days collapse into one bar', () => {
    const spread = [
      g('slang-fixer', [
        ['2026-07-06', 10],
        ['2026-07-07', 10],
        ['2026-07-12', 10],
      ]),
    ];
    const r = unitCostByWeek(spread, new Map([[MON_JUL_6, 3]]), 4, NOW);
    expect(r.weeks.find((w) => w.week === MON_JUL_6)!.cost).toBe(30);
  });
});
