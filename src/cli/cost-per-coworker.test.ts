import { afterEach, describe, expect, it } from 'vitest';

import { buildCoworkerCostSql, parseCoworkerRows, periodToInterval, readCostPerCoworker } from './cost-per-coworker.js';

describe('periodToInterval', () => {
  it('maps day/hour shorthands to a Postgres interval literal', () => {
    expect(periodToInterval('30d')).toBe('30 days');
    expect(periodToInterval('24h')).toBe('24 hours');
    expect(periodToInterval('7 d')).toBe('7 days');
  });
  it('returns null when absent', () => {
    expect(periodToInterval(undefined)).toBeNull();
    expect(periodToInterval('')).toBeNull();
  });
  it('rejects malformed periods rather than ignoring them', () => {
    expect(() => periodToInterval('30 days')).toThrow(/--period/);
    expect(() => periodToInterval('abc')).toThrow(/--period/);
    expect(() => periodToInterval('30m')).toThrow(/--period/);
    // no unit-less / injection-y inputs slip through
    expect(() => periodToInterval('1; drop table request_logs')).toThrow(/--period/);
  });
});

describe('buildCoworkerCostSql', () => {
  it('filters on the captured cost key and ag- identifiers, grouped by coworker', () => {
    const sql = buildCoworkerCostSql({ intervalSql: null, groupId: null });
    expect(sql).toContain("r.extra_data ? 'x-litellm-response-cost-original'");
    expect(sql).toContain("a.identifier LIKE 'ag-%'");
    expect(sql).toContain('JOIN agents a ON a.id = r.agent_id');
    expect(sql).toContain('GROUP BY a.identifier, a.name');
    expect(sql).not.toContain('interval');
    expect(sql).not.toContain('a.identifier =');
  });
  it('adds a time window from a validated interval', () => {
    const sql = buildCoworkerCostSql({ intervalSql: '7 days', groupId: null });
    expect(sql).toContain("r.created_at > now() - interval '7 days'");
  });
  it('adds an equality filter only for an ag- id', () => {
    const sql = buildCoworkerCostSql({ intervalSql: null, groupId: 'ag-1778288632732-akb54b' });
    expect(sql).toContain("a.identifier = 'ag-1778288632732-akb54b'");
  });
});

describe('parseCoworkerRows', () => {
  it('parses psql -tAc pipe output, coercing numbers', () => {
    const raw = ['ag-1|Orchestrator|42|1.234567', 'ag-2|slang-fixer|3|0.000079', '', '  '].join('\n');
    expect(parseCoworkerRows(raw)).toEqual([
      { groupId: 'ag-1', name: 'Orchestrator', calls: 42, costUsd: 1.234567 },
      { groupId: 'ag-2', name: 'slang-fixer', calls: 3, costUsd: 0.000079 },
    ]);
  });
  it('skips malformed lines and tolerates an empty cost', () => {
    const raw = ['garbage', 'ag-3||5|', 'ag-4|n|notanumber|1.0'].join('\n');
    expect(parseCoworkerRows(raw)).toEqual([{ groupId: 'ag-3', name: '', calls: 5, costUsd: 0 }]);
  });
});

const ORIG = process.env.ONECLI_PG_CONTAINER;
afterEach(() => {
  if (ORIG === undefined) delete process.env.ONECLI_PG_CONTAINER;
  else process.env.ONECLI_PG_CONTAINER = ORIG;
});

describe('readCostPerCoworker', () => {
  const folderById = new Map([
    ['ag-1', 'orchestrator'],
    ['ag-2', 'slang-fixer'],
  ]);

  it('reports configured:false (a no-op) when ONECLI_PG_CONTAINER is unset', async () => {
    delete process.env.ONECLI_PG_CONTAINER;
    const out = await readCostPerCoworker({}, { folderById, runPsql: async () => 'should-not-run' });
    expect(out.configured).toBe(false);
    expect(out.captured).toBe(false);
    expect(out.coworkers).toEqual([]);
    expect(out.note).toMatch(/ONECLI_PG_CONTAINER/);
  });

  it('aggregates, joins folders, totals, and echoes the period', async () => {
    process.env.ONECLI_PG_CONTAINER = 'onecli-test-postgres-1';
    let seenSql = '';
    const out = await readCostPerCoworker(
      { period: '30d' },
      {
        folderById,
        runPsql: async (sql) => {
          seenSql = sql;
          return 'ag-1|Orchestrator|42|1.234567\nag-2|slang-fixer|3|0.000079\n';
        },
      },
    );
    expect(seenSql).toContain("interval '30 days'");
    expect(out.configured).toBe(true);
    expect(out.captured).toBe(true);
    expect(out.period).toBe('30d');
    expect(out.coworkers).toEqual([
      { groupId: 'ag-1', folder: 'orchestrator', name: 'Orchestrator', calls: 42, costUsd: 1.234567 },
      { groupId: 'ag-2', folder: 'slang-fixer', name: 'slang-fixer', calls: 3, costUsd: 0.000079 },
    ]);
    expect(out.totalUsd).toBeCloseTo(1.234646, 6);
  });

  it('captured:false with a hint when the gateway has logged no cost rows', async () => {
    process.env.ONECLI_PG_CONTAINER = 'onecli-test-postgres-1';
    const out = await readCostPerCoworker({}, { folderById, runPsql: async () => '\n' });
    expect(out.configured).toBe(true);
    expect(out.captured).toBe(false);
    expect(out.note).toMatch(/ONECLI_CAPTURE_RESPONSE_HEADERS/);
  });

  it('surfaces a malformed --period as an error', async () => {
    process.env.ONECLI_PG_CONTAINER = 'onecli-test-postgres-1';
    await expect(readCostPerCoworker({ period: 'nonsense' }, { folderById, runPsql: async () => '' })).rejects.toThrow(
      /--period/,
    );
  });
});
