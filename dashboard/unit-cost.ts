/**
 * Unit cost: what one opened PR costs in agent spend.
 *
 * cost per PR opened, by ISO week = (triager + fixer + reviewer spend) / (PRs opened)
 *
 * The cost side is NOT recomputed here. `refreshCcusageCache` already resolves
 * ccusage (pinned 20.0.19, never npx) and produces per-group daily totals; this
 * module only selects, buckets and divides. Adding a second cost path would be
 * a second thing to keep correct.
 *
 * TWO THINGS THIS DELIBERATELY REFUSES TO DO
 *
 * 1. It never divides by a zero denominator. A week with spend but no PR opened
 *    is a real and interesting state — it is not "$0 per PR" and it is not
 *    infinity. It reports `costPerPr: null` and the caller must render that as
 *    words, never as a number.
 *
 * 2. It never treats "no data" as "no spend". A week outside the retention
 *    window, or before a group existed, has `hasCost: false` — distinct from a
 *    week that genuinely cost nothing. Collapsing those two is how a chart
 *    invents a saving that never happened.
 */

/** The three coworker roles whose spend is attributed to opening a PR. */
export const UNIT_COST_ROLES = ['triager', 'fixer', 'reviewer'] as const;

/**
 * Exactly the six groups that count, by name.
 *
 * An explicit set rather than a suffix match, because prod carries several
 * decoys that a `endsWith('-fixer')` rule would silently sweep in:
 * `dashboard_slang-fixer`, `generic-fixer`, `slang-playground-fixer`,
 * `legacy_slang-reviewer`, `dashboard_slang-triage`. Those are dashboards,
 * templates and retired groups; counting their spend would inflate the
 * numerator against a denominator they never contributed a PR to.
 */
export const UNIT_COST_GROUPS: readonly string[] = [
  'slang-triager',
  'slangpy-triager',
  'slang-fixer',
  'slangpy-fixer',
  'slang-reviewer',
  'slangpy-reviewer',
];

export function isUnitCostGroup(groupName: string): boolean {
  return UNIT_COST_GROUPS.includes(groupName);
}

/**
 * Monday-start ISO week key (UTC) for a `YYYY-MM-DD` or `YYYYMMDD` date.
 *
 * UTC throughout: ccusage day boundaries are UTC, and session ids embed UTC
 * epoch-ms. Bucketing one side in local time would shift PRs across a week
 * boundary relative to the spend that produced them.
 */
export function isoWeekStart(date: string): string {
  const s = date.includes('-') ? date : `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`unit-cost: unparseable date ${date}`);
  // getUTCDay(): 0=Sun..6=Sat. Shift so Monday is the start of the week.
  const back = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}

/** Week key for an epoch-ms instant, e.g. decoded from a `sess-<ms>-<rand>` id. */
export function isoWeekStartFromMs(ms: number): string {
  return isoWeekStart(new Date(ms).toISOString().slice(0, 10));
}

/**
 * Epoch-ms embedded in a `sess-<ms>-<rand>` session id, or null.
 *
 * Returns null rather than NaN or 0 so an unrecognised id shape is skipped and
 * counted, instead of silently landing every malformed row in the same wrong
 * week (1970) and dragging a bucket's denominator up.
 */
export function sessionIdMs(sessionId: string): number | null {
  const m = /^sess-(\d{10,})-/.exec(sessionId);
  if (!m) return null;
  const ms = Number(m[1]);
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

export interface UnitCostWeek {
  /** Monday of the ISO week, `YYYY-MM-DD` UTC. */
  week: string;
  /** Summed spend across the six groups. Only meaningful when `hasCost`. */
  cost: number;
  /** PRs opened by fixer groups in this week. */
  prs: number;
  /** cost / prs, or null when prs === 0. NEVER 0 and never Infinity. */
  costPerPr: number | null;
  /** False when no transcript data covers this week at all. */
  hasCost: boolean;
}

export interface UnitCostResult {
  weeks: UnitCostWeek[];
  /** Groups actually found in the cost data, of the six expected. */
  groupsMatched: string[];
  /** Expected groups with no cost data at all — a real coverage gap. */
  groupsMissing: string[];
  /** Set when the whole metric cannot be computed; callers must render words. */
  unavailable: string | null;
}

export interface CostGroupInput {
  groupName: string;
  daily: { date: string; totalCost: number }[];
}

/**
 * Build the weekly series.
 *
 * @param byGroup      per-group daily cost, from `ccusageCache.all.byGroup`
 * @param prWeeks      week key -> count of PRs opened in that week
 * @param weeksWanted  how many trailing weeks to return (default 4)
 * @param nowMs        clock injected so tests are not time-dependent
 */
export function unitCostByWeek(
  byGroup: CostGroupInput[],
  prWeeks: Map<string, number>,
  weeksWanted = 4,
  nowMs: number = Date.now(),
): UnitCostResult {
  const matched = byGroup.filter((g) => isUnitCostGroup(g.groupName));
  const groupsMatched = matched.map((g) => g.groupName).sort();
  const groupsMissing = UNIT_COST_GROUPS.filter((n) => !groupsMatched.includes(n));

  if (matched.length === 0) {
    return {
      weeks: [],
      groupsMatched,
      groupsMissing,
      unavailable: 'no cost data for any of the triager/fixer/reviewer groups',
    };
  }

  const costByWeek = new Map<string, number>();
  for (const g of matched) {
    for (const d of g.daily) {
      const w = isoWeekStart(d.date);
      costByWeek.set(w, (costByWeek.get(w) ?? 0) + (Number(d.totalCost) || 0));
    }
  }

  // The trailing N complete-or-current weeks ending with the week containing now.
  const thisWeek = isoWeekStartFromMs(nowMs);
  const keys: string[] = [];
  const cursor = new Date(`${thisWeek}T00:00:00Z`);
  for (let i = 0; i < weeksWanted; i++) {
    keys.unshift(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() - 7);
  }

  const weeks: UnitCostWeek[] = keys.map((week) => {
    const hasCost = costByWeek.has(week);
    const cost = costByWeek.get(week) ?? 0;
    const prs = prWeeks.get(week) ?? 0;
    return {
      week,
      cost,
      prs,
      // Both guards matter. prs===0 would divide to Infinity; !hasCost would
      // report a confident 0 for a week we simply have no transcripts for.
      costPerPr: hasCost && prs > 0 ? cost / prs : null,
      hasCost,
    };
  });

  return { weeks, groupsMatched, groupsMissing, unavailable: null };
}
