/**
 * Pure aggregation + percentile math behind `ncl cost-cap sessions`. No DB, no
 * network — `fetchSessionCosts` (the one HTTP part) is covered by the verb's own
 * error paths elsewhere; here we pin the math a coworker relies on to turn the
 * distribution into a ceiling.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

import {
  aggregateSessionCosts,
  fetchSessionCosts,
  percentileNearestRank,
  rankSessionCosts,
  type SessionCostRow,
} from './cost-cap-sessions.js';

function row(
  over: Partial<SessionCostRow> & { session_id: string; group_folder: string; cost: number },
): SessionCostRow {
  return {
    agent_group_id: `ag-${over.group_folder}`,
    group_name: over.group_folder,
    status: 'active',
    container_status: 'stopped',
    ...over,
  };
}

describe('percentileNearestRank — sort asc, index floor(p*(n-1))', () => {
  it('matches the host p90 method on a 10-element ramp', () => {
    const asc = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    // floor(0.5*9)=4 -> arr[4]=5 ; floor(0.9*9)=8 -> arr[8]=9 ; floor(0.95*9)=8 -> arr[8]=9
    expect(percentileNearestRank(asc, 0.5)).toBe(5);
    expect(percentileNearestRank(asc, 0.9)).toBe(9);
    expect(percentileNearestRank(asc, 0.95)).toBe(9);
  });

  it('returns the sole element for a singleton and 0 for empty', () => {
    expect(percentileNearestRank([42], 0.95)).toBe(42);
    expect(percentileNearestRank([42], 0.5)).toBe(42);
    expect(percentileNearestRank([], 0.9)).toBe(0);
  });

  it('never interpolates — every result is an actually-observed value', () => {
    const asc = [3, 7, 19]; // floor(0.9*2)=1 -> 7, floor(0.95*2)=1 -> 7
    expect(percentileNearestRank(asc, 0.9)).toBe(7);
    expect([3, 7, 19]).toContain(percentileNearestRank(asc, 0.95));
  });
});

describe('aggregateSessionCosts', () => {
  const sessions: SessionCostRow[] = [
    row({ session_id: 'f1', group_folder: 'fixer', cost: 10 }),
    row({ session_id: 'f2', group_folder: 'fixer', cost: 20 }),
    row({ session_id: 'f3', group_folder: 'fixer', cost: 90 }),
    row({ session_id: 'f4', group_folder: 'fixer', cost: 0 }), // excluded (cost 0)
    row({ session_id: 'r1', group_folder: 'reviewer', cost: 5 }),
    row({ session_id: 'r2', group_folder: 'reviewer', cost: 7 }),
    row({ session_id: 'z1', group_folder: 'idle', cost: 0 }), // whole group excluded
    row({ session_id: 'n1', group_folder: '', cost: 99 }), // no folder — excluded
  ];

  it('aggregates per group over cost>0 sessions, sorted by total spend desc', () => {
    const groups = aggregateSessionCosts(sessions);
    expect(groups.map((g) => g.group)).toEqual(['fixer', 'reviewer']); // idle + '' omitted; fixer first
    const fixer = groups[0];
    expect(fixer.sessions).toBe(3); // the cost-0 f4 excluded
    expect(fixer.total_usd).toBe(120);
    expect(fixer.max).toBe(90);
    // sorted asc [10,20,90]: p50 floor(0.5*2)=1 ->20 ; p90/p95 floor(.9*2)=1 ->20 (not the 90 tail)
    expect(fixer.p50).toBe(20);
    expect(fixer.p90).toBe(20);
    expect(fixer.p95).toBe(20);
    const reviewer = groups[1];
    expect(reviewer.total_usd).toBe(12);
  });

  it('honors --group and omits everything else', () => {
    const groups = aggregateSessionCosts(sessions, { group: 'reviewer' });
    expect(groups).toHaveLength(1);
    expect(groups[0].group).toBe('reviewer');
    expect(groups[0].sessions).toBe(2);
  });

  it('returns [] when nothing is priced', () => {
    expect(aggregateSessionCosts([row({ session_id: 'x', group_folder: 'g', cost: 0 })])).toEqual([]);
  });

  it('rounds money to whole cents', () => {
    const groups = aggregateSessionCosts([
      row({ session_id: 'a', group_folder: 'g', cost: 1.005 }),
      row({ session_id: 'b', group_folder: 'g', cost: 2.004 }),
    ]);
    expect(groups[0].total_usd).toBe(3.01);
    expect(groups[0].max).toBe(2);
  });
});

describe('rankSessionCosts (--sessions)', () => {
  it('lists only priced sessions, ranked by cost desc, with provider split defaulted', () => {
    const list = rankSessionCosts([
      row({ session_id: 'a', group_folder: 'g', cost: 5, claudeUsd: 5 }),
      row({ session_id: 'b', group_folder: 'g', cost: 30, claudeUsd: 20, codexUsd: 10 }),
      row({ session_id: 'c', group_folder: 'g', cost: 0 }),
    ]);
    expect(list.map((s) => s.session_id)).toEqual(['b', 'a']);
    expect(list[0].codexUsd).toBe(10);
    expect(list[1].codexUsd).toBe(0); // defaulted when absent
  });
});

describe('fetchSessionCosts — transport + costUnavailable threading + error surfacing', () => {
  afterEach(() => vi.unstubAllGlobals());

  const stubFetch = (impl: () => Promise<unknown> | unknown) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => impl()),
    );
  };

  it('returns sessions and echoes the costUnavailable reason (not swallowed)', async () => {
    stubFetch(() => ({
      ok: true,
      json: async () => ({
        sessions: [{ session_id: 's1', group_folder: 'g', cost: 5 }],
        costUnavailable: 'ccusage is not installed in this checkout',
      }),
    }));
    const res = await fetchSessionCosts('30d');
    expect(res.sessions).toHaveLength(1);
    expect(res.costUnavailable).toBe('ccusage is not installed in this checkout');
  });

  it('normalizes a null/absent costUnavailable to null', async () => {
    stubFetch(() => ({ ok: true, json: async () => ({ sessions: [] }) }));
    expect((await fetchSessionCosts('7d')).costUnavailable).toBeNull();
  });

  it('throws a clear error when the dashboard is unreachable', async () => {
    stubFetch(() => {
      throw new Error('ECONNREFUSED');
    });
    await expect(fetchSessionCosts('30d')).rejects.toThrow(/could not reach the dashboard cost API/);
  });

  it('throws on a non-ok response (and names 401 specifically)', async () => {
    stubFetch(() => ({ ok: false, status: 401, statusText: 'Unauthorized' }));
    await expect(fetchSessionCosts('30d')).rejects.toThrow(/401/);
  });

  it('throws on an unexpected shape (no sessions array)', async () => {
    stubFetch(() => ({ ok: true, json: async () => ({ nope: true }) }));
    await expect(fetchSessionCosts('30d')).rejects.toThrow(/unexpected shape/);
  });
});
