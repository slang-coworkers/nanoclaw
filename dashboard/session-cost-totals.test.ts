import { describe, expect, it } from 'vitest';

import { SESSIONS_CCUSAGE_STALE_MS, ccusageIsStale, computeSessionsCostTotals } from './session-cost-totals.js';

const period = {
  combined: [{ totalCost: 10.5 }, { totalCost: 2.25 }, { totalCost: Number.NaN }],
  byGroup: [
    { groupId: 'ag-orch', groupName: 'Orchestrator', daily: [{ totalCost: 8 }, { totalCost: 0.5 }] },
    { groupId: 'ag-fixer', groupName: 'slang-fixer', daily: [{ totalCost: 4.25 }] },
    { groupId: 'ag-nofolder', groupName: 'legacy', daily: [] },
  ],
};
const folderById = new Map([
  ['ag-orch', 'orchestrator'],
  ['ag-fixer', 'slang-fixer'],
]);

describe('computeSessionsCostTotals', () => {
  it('sums the ccusage period per coworker and fleet-wide, keyed by id and by folder', () => {
    const t = computeSessionsCostTotals(period, 1_700_000_000_000, folderById);
    expect(t.available).toBe(true);
    expect(t.lastRefresh).toBe(1_700_000_000_000);
    expect(t.ccusageTotalUsd).toBe(12.75); // NaN day ignored
    expect(t.byGroupId).toEqual({ 'ag-orch': 8.5, 'ag-fixer': 4.25, 'ag-nofolder': 0 });
    expect(t.byGroupFolder).toEqual({ orchestrator: 8.5, 'slang-fixer': 4.25 });
  });
  it('reports available:false with zero totals before the cache was ever refreshed', () => {
    const t = computeSessionsCostTotals(undefined, 0, folderById);
    expect(t).toEqual({ available: false, lastRefresh: 0, ccusageTotalUsd: 0, byGroupId: {}, byGroupFolder: {} });
  });
});

describe('ccusageIsStale', () => {
  it('is stale when never refreshed or older than the gate, fresh otherwise', () => {
    const now = 10_000_000;
    expect(ccusageIsStale(0, now)).toBe(true);
    expect(ccusageIsStale(now - SESSIONS_CCUSAGE_STALE_MS - 1, now)).toBe(true);
    expect(ccusageIsStale(now - 1000, now)).toBe(false);
  });
});
