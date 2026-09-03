/**
 * Sessions-tab cost totals (dash-6).
 *
 * The Sessions tab sums per-session costs from `sessionCostCache`, which covers
 * only `projects/` transcripts joined to a session. The Overview's "Total Cost"
 * comes from the ccusage cache over the WHOLE per-coworker transcript tree —
 * including skill-run transcripts that never map to a session — so the two
 * headline numbers disagree (Overview $53 vs Sessions $14 on 2026-09-03; ~74% of
 * the gap was skill runs). This module turns the ccusage cache into per-period,
 * per-coworker totals so the Sessions header can show
 * `total · attributed to sessions · skills / unattributed` from the SAME source
 * the Overview reads. Pure; `server.ts` feeds it `ccusageCache`.
 *
 * Never ADD the total to the per-row sum — it CONTAINS it. The client shows the
 * total as the headline and (total − attributed) as the unattributed remainder.
 */

export interface CcusageDayLike {
  totalCost: number;
}
export interface CcusageGroupLike {
  /** Agent-group id (`ag-…`) — the per-coworker transcript dir name. */
  groupId: string;
  groupName?: string;
  daily: CcusageDayLike[];
}
export interface CcusagePeriodLike {
  combined: CcusageDayLike[];
  byGroup: CcusageGroupLike[];
}

export interface SessionsCostTotals {
  /** false until the ccusage cache has been populated at least once. */
  available: boolean;
  /** Epoch ms of the cache refresh these totals come from (0 = never). */
  lastRefresh: number;
  /** Fleet total for the period (Σ combined daily `totalCost`), USD. */
  ccusageTotalUsd: number;
  /** Per coworker, by agent-group id. */
  byGroupId: Record<string, number>;
  /** Same numbers by workspace folder (what the Sessions group filter uses), when the id→folder map knows the group. */
  byGroupFolder: Record<string, number>;
}

/** Kick a background ccusage refresh from the Sessions tab at most this often. */
export const SESSIONS_CCUSAGE_STALE_MS = 5 * 60_000;

const round6 = (n: number): number => Number(n.toFixed(6));
const sumDays = (days: CcusageDayLike[] | undefined): number =>
  (days ?? []).reduce((s, d) => s + (Number.isFinite(d.totalCost) ? d.totalCost : 0), 0);

export function computeSessionsCostTotals(
  period: CcusagePeriodLike | undefined,
  lastRefresh: number,
  folderById: ReadonlyMap<string, string>,
): SessionsCostTotals {
  const byGroupId: Record<string, number> = {};
  const byGroupFolder: Record<string, number> = {};
  for (const g of period?.byGroup ?? []) {
    if (!g?.groupId) continue;
    const usd = round6(sumDays(g.daily));
    byGroupId[g.groupId] = usd;
    const folder = folderById.get(g.groupId);
    if (folder) byGroupFolder[folder] = usd;
  }
  return {
    available: lastRefresh > 0,
    lastRefresh,
    ccusageTotalUsd: round6(sumDays(period?.combined)),
    byGroupId,
    byGroupFolder,
  };
}

export function ccusageIsStale(lastRefresh: number, now: number = Date.now()): boolean {
  return now - lastRefresh > SESSIONS_CCUSAGE_STALE_MS;
}
