/**
 * Overview cost summary — the at-a-glance figures on the Admin Overview.
 *
 * The point of extracting overviewCostSummary is that the Overview total must
 * agree with the Token Usage table and /api/cost-history (all read the same
 * ccusageCache), and must distinguish "no spend" ($0) from "cost is ABSENT"
 * (ccusage CLI unresolved → the UI shows n/a, never a confident $0). These
 * tests pin both.
 */
import { describe, expect, it } from 'vitest';

import { overviewCostSummary } from './server.js';

function day(date: string, totalCost: number) {
  return {
    date,
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    totalTokens: 0,
    totalCost,
    modelsUsed: [],
    modelBreakdowns: [],
  };
}

const emptyPeriod = { combined: [], byGroup: [] };

describe('overviewCostSummary', () => {
  it('sums combined totalCost per period and passes lastRefresh through', () => {
    const cache = {
      '1d': { combined: [day('2026-08-14', 12.5)], byGroup: [] },
      '7d': { combined: [day('2026-08-08', 100), day('2026-08-14', 12.5)], byGroup: [] },
      '30d': { combined: [day('2026-07-20', 400), day('2026-08-14', 12.5)], byGroup: [] },
      lastRefresh: 1786700000000,
    };
    const s = overviewCostSummary(cache, null);
    expect(s.today).toBeCloseTo(12.5);
    expect(s.last7d).toBeCloseTo(112.5);
    expect(s.last30d).toBeCloseTo(412.5);
    expect(s.lastRefresh).toBe(1786700000000);
    expect(s.unavailable).toBeNull();
  });

  it('picks the single highest-cost coworker over the 7d window', () => {
    const cache = {
      '1d': emptyPeriod,
      '7d': {
        combined: [],
        byGroup: [
          { groupId: 'ag-a', groupName: 'slang-fixer', daily: [day('2026-08-10', 30), day('2026-08-12', 20)] },
          { groupId: 'ag-b', groupName: 'slang-triager', daily: [day('2026-08-11', 40)] },
        ],
      },
      '30d': emptyPeriod,
      lastRefresh: 0,
    };
    const s = overviewCostSummary(cache, null);
    // slang-fixer totals 50 vs slang-triager 40 → fixer is top.
    expect(s.topCoworker7d).toEqual({ name: 'slang-fixer', cost: 50 });
  });

  it('reports null topCoworker7d when there is no spend', () => {
    const cache = { '1d': emptyPeriod, '7d': emptyPeriod, '30d': emptyPeriod, lastRefresh: 0 };
    const s = overviewCostSummary(cache, null);
    expect(s.topCoworker7d).toBeNull();
    expect(s.today).toBe(0);
  });

  it('passes an unavailable reason through verbatim so the UI shows n/a, not $0', () => {
    const cache = { '1d': emptyPeriod, '7d': emptyPeriod, '30d': emptyPeriod, lastRefresh: 0 };
    const reason = 'ccusage is not installed in this checkout';
    const s = overviewCostSummary(cache, reason);
    // The numbers are still 0 here, but `unavailable` being non-null is the
    // signal the client keys on to render n/a instead of a confident $0.
    expect(s.unavailable).toBe(reason);
  });

  it('tolerates missing/partial periods without throwing', () => {
    // A cold cache can have undefined period slots before the first refresh.
    const cache = { lastRefresh: 0 } as unknown as Parameters<typeof overviewCostSummary>[0];
    const s = overviewCostSummary(cache, null);
    expect(s.today).toBe(0);
    expect(s.last7d).toBe(0);
    expect(s.topCoworker7d).toBeNull();
  });
});
