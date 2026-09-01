/**
 * `cost-cap` — runtime configuration of the Tier-2 cost cap (NanoClaw #1 cost cap).
 *
 * The Tier-2 hard ceiling and per-group per-session caps used to be settable only
 * via `NANOCLAW_COST_T2_CEILING_USD` (a static `.env` value) and
 * `data/cost-thresholds.json` (auto-sourced p90). This resource lets an elevated
 * operator change them at runtime, DB-backed (`cost_cap_policy`), read fresh at
 * every container spawn. The env var stays a back-compat fallback.
 *
 * ELEVATED-ONLY. `cost-cap` is deliberately NOT in `GROUP_SCOPE_RESOURCES`
 * (src/cli/registry.ts), so the shared CLI guard (src/cli/guard.ts) denies it for
 * any container under `cli_scope: 'group'` or `'disabled'`. It is reachable only
 * from the trusted host socket (operator) and from a `cli_scope: 'global'`
 * container (the orchestrator / admin group). A fleet-wide cost knob is not
 * something an ordinary coworker gets to turn.
 *
 * Effect timing: `set` / `clear` write the DB immediately. The host materializes
 * the values into a group's container.json at its NEXT spawn, so a change reaches
 * a running session on its next restart. To apply immediately, restart the group
 * (`ncl groups restart --id <group-id>`).
 */
import { randomUUID } from 'crypto';

import { registerResource } from '../crud.js';
import {
  clearCostCapPolicy,
  getCostCapPolicy,
  listCostCapPolicies,
  setCostCapPolicy,
  type CostCapPolicyRow,
} from '../../db/cost-cap-policy.js';
import { resolveCostCapT2Usd, resolveCostCeilingT2Usd } from '../../container-config.js';
import { readSessionCostCapStatus, type SessionCostCapView } from '../session-cost-cap.js';
import {
  listEscalationEpisodes,
  type CostDecisionState,
  type EscalationListRow,
} from '../../db/cost-escalation-episodes.js';
import {
  aggregateSessionCosts,
  fetchSessionCosts,
  rankSessionCosts,
  COST_PERIODS,
  type CostPeriod,
  type GroupCostAggregate,
  type SessionCostListEntry,
} from '../cost-cap-sessions.js';
import { readCostPerCoworker, type CostPerCoworkerResult } from '../cost-per-coworker.js';

/** Who is making the change, for the row's audit column. */
function actorLabel(ctx: { caller: string; agentGroupId?: string } | undefined): string {
  return ctx?.caller === 'agent' ? (ctx.agentGroupId ?? 'agent') : 'host';
}

function usd(n: number): string {
  return `$${n.toFixed(2)}`;
}

/** Observed-cost formatter — keeps enough precision that sub-cent spend doesn't render as $0.00. */
function money(n: number): string {
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
}

/** A DB override row rendered for JSON output (nulls kept explicit). */
function policyView(row: CostCapPolicyRow) {
  return {
    scope: row.group_folder === '' ? 'fleet' : row.group_folder,
    group_folder: row.group_folder,
    ceiling_usd: row.ceiling_usd,
    cap_usd: row.cap_usd,
    updated_at: row.updated_at,
    updated_by: row.updated_by,
  };
}

/** An escalation episode rendered for JSON/human output (the `escalations` verb). */
function escalationView(r: EscalationListRow) {
  return {
    session_id: r.session_id,
    short_id: r.short_id,
    coworker: r.group_folder,
    reason: r.reason,
    window: r.window,
    spent_usd: r.spent_usd,
    cap_usd: r.cap_usd,
    ceiling_usd: r.ceiling_usd,
    immortal: r.immortal === 1,
    decision_state: r.decision_state,
    gh_author: r.gh_author,
    gh: r.gh_repo && r.gh_number != null ? `${r.gh_repo}#${r.gh_number}` : null,
    created_at: r.created_at,
    resolved_at: r.resolved_at,
    resolved_by: r.resolved_by,
  };
}

registerResource({
  name: 'cost-cap',
  plural: 'cost-cap',
  // No generic CRUD — cost_cap_policy is a small policy table, not a row-per-id
  // resource. `table`/`idColumn`/`columns` are declared for help introspection.
  table: 'cost_cap_policy',
  description:
    'Runtime Tier-2 cost-cap policy. Fleet-wide hard ceiling + optional per-group cap/ceiling overrides, ' +
    'DB-backed and read at each container spawn (env NANOCLAW_COST_T2_CEILING_USD / cost-thresholds.json ' +
    'stay as fallbacks). Elevated-only: reachable from the host operator or a cli_scope=global orchestrator.',
  idColumn: 'group_folder',
  columns: [
    {
      name: 'group_folder',
      type: 'string',
      description: "'' = fleet-wide row; otherwise the group's workspace folder.",
    },
    { name: 'ceiling_usd', type: 'number', description: 'Tier-2 hard ceiling (USD). 0 = explicitly no ceiling.' },
    { name: 'cap_usd', type: 'number', description: 'Per-session soft cap (USD). Per-group only.' },
    { name: 'updated_at', type: 'string', description: 'When the row was last written (ISO-8601 UTC).' },
    { name: 'updated_by', type: 'string', description: 'host, or the agent group id that set it.' },
  ],
  operations: {},
  customOperations: {
    get: {
      access: 'open',
      description:
        'Show the effective cost-cap policy. Without --group: the fleet ceiling (effective + sources) and every ' +
        "DB override. With --group <folder>: that group's effective per-session cap and ceiling.",
      args: [
        { name: 'group', type: 'string', description: 'Group workspace folder to report the effective values for.' },
      ],
      examples: ['ncl cost-cap get', 'ncl cost-cap get --group slang-fixer'],
      handler: async (args) => {
        const group = typeof args.group === 'string' && args.group.trim() ? args.group.trim() : undefined;
        const fleetRow = await getCostCapPolicy();
        const envCeiling = Number(process.env.NANOCLAW_COST_T2_CEILING_USD);
        const envCeilingValue = Number.isFinite(envCeiling) && envCeiling > 0 ? envCeiling : null;

        const effectiveFleetCeiling = await resolveCostCeilingT2Usd();
        const fleetSource =
          fleetRow && typeof fleetRow.ceiling_usd === 'number' ? 'db' : envCeilingValue !== null ? 'env' : 'none';

        const base = {
          fleet: {
            effectiveCeilingUsd: effectiveFleetCeiling,
            source: fleetSource,
            dbCeilingUsd: fleetRow?.ceiling_usd ?? null,
            envCeilingUsd: envCeilingValue,
          },
          overrides: (await listCostCapPolicies()).map(policyView),
        };

        if (!group) return base;

        const row = await getCostCapPolicy(group);
        return {
          ...base,
          group: {
            group_folder: group,
            effectiveCapUsd: await resolveCostCapT2Usd(group),
            effectiveCeilingUsd: await resolveCostCeilingT2Usd(group),
            dbCapUsd: row?.cap_usd ?? null,
            dbCeilingUsd: row?.ceiling_usd ?? null,
          },
        };
      },
      formatHuman: (data) => {
        const d = data as {
          fleet: {
            effectiveCeilingUsd: number;
            source: string;
            dbCeilingUsd: number | null;
            envCeilingUsd: number | null;
          };
          overrides: ReturnType<typeof policyView>[];
          group?: {
            group_folder: string;
            effectiveCapUsd: number;
            effectiveCeilingUsd: number;
            dbCapUsd: number | null;
            dbCeilingUsd: number | null;
          };
        };
        const lines: string[] = [];
        const fc = d.fleet.effectiveCeilingUsd;
        lines.push(`Fleet ceiling: ${fc > 0 ? usd(fc) : 'none'} (source: ${d.fleet.source})`);
        if (d.overrides.length === 0) {
          lines.push('Overrides: none');
        } else {
          lines.push('Overrides:');
          for (const o of d.overrides) {
            const parts: string[] = [];
            if (o.ceiling_usd !== null) parts.push(`ceiling=${usd(o.ceiling_usd)}`);
            if (o.cap_usd !== null) parts.push(`cap=${usd(o.cap_usd)}`);
            lines.push(
              `  ${o.scope}: ${parts.join(' ') || '(none set)'} — by ${o.updated_by ?? '?'} at ${o.updated_at}`,
            );
          }
        }
        if (d.group) {
          lines.push(
            `Group ${d.group.group_folder}: effective cap ${usd(d.group.effectiveCapUsd)}, ` +
              `effective ceiling ${d.group.effectiveCeilingUsd > 0 ? usd(d.group.effectiveCeilingUsd) : 'none'}`,
          );
        }
        return lines.join('\n');
      },
    },
    set: {
      access: 'open',
      description:
        'Set the fleet ceiling and/or a per-group override. Provide at least one of --ceiling / --cap. Without ' +
        '--group the ceiling is fleet-wide; with --group <folder> the values override just that group. --cap is ' +
        'per-group only (fleet caps come from p90) so it requires --group. Effect: next container spawn.',
      args: [
        { name: 'ceiling', type: 'number', description: 'Tier-2 hard ceiling (USD), >= 0. 0 = disable the ceiling.' },
        { name: 'cap', type: 'number', description: 'Per-session soft cap (USD), > 0. Requires --group.' },
        { name: 'group', type: 'string', description: 'Group workspace folder. Omit for the fleet-wide ceiling.' },
      ],
      examples: [
        'ncl cost-cap set --ceiling 150',
        'ncl cost-cap set --ceiling 300 --group slang-fixer',
        'ncl cost-cap set --cap 60 --group slang-fixer',
        'ncl cost-cap set --ceiling 0   # disable the fleet ceiling (overrides the env var)',
      ],
      handler: async (args, ctx) => {
        const group = typeof args.group === 'string' && args.group.trim() ? args.group.trim() : undefined;
        const hasCeiling = args.ceiling !== undefined;
        const hasCap = args.cap !== undefined;
        if (!hasCeiling && !hasCap) throw new Error('provide at least one of --ceiling or --cap');

        let ceilingUsd: number | undefined;
        if (hasCeiling) {
          ceilingUsd = Number(args.ceiling);
          if (!Number.isFinite(ceilingUsd) || ceilingUsd < 0) throw new Error('--ceiling must be a number >= 0');
        }

        let capUsd: number | undefined;
        if (hasCap) {
          capUsd = Number(args.cap);
          if (!Number.isFinite(capUsd) || capUsd <= 0) throw new Error('--cap must be a number > 0');
          if (!group) {
            throw new Error(
              '--cap is a per-group override and requires --group <folder>. A fleet-wide cap is auto-sourced ' +
                'from cost-thresholds.json (p90); use --ceiling for a fleet-wide limit.',
            );
          }
        }

        const row = await setCostCapPolicy({ groupFolder: group, ceilingUsd, capUsd, updatedBy: actorLabel(ctx) });
        return {
          updated: policyView(row),
          note:
            'Written to the DB. It materializes into container.json at the next container spawn; ' +
            'run `ncl groups restart --id <group-id>` to apply it to a running session immediately.',
        };
      },
      formatHuman: (data) => {
        const d = data as { updated: ReturnType<typeof policyView>; note: string };
        const o = d.updated;
        const parts: string[] = [];
        if (o.ceiling_usd !== null) parts.push(`ceiling=${usd(o.ceiling_usd)}`);
        if (o.cap_usd !== null) parts.push(`cap=${usd(o.cap_usd)}`);
        return `Set ${o.scope}: ${parts.join(' ') || '(nothing)'}\n${d.note}`;
      },
    },
    clear: {
      access: 'open',
      description:
        'Remove a DB cost-cap override, restoring the env / thresholds fallback. Without --group clears the ' +
        'fleet ceiling row; with --group <folder> clears that group override. Effect: next container spawn.',
      args: [{ name: 'group', type: 'string', description: 'Group workspace folder. Omit to clear the fleet row.' }],
      examples: ['ncl cost-cap clear', 'ncl cost-cap clear --group slang-fixer'],
      handler: async (args) => {
        const group = typeof args.group === 'string' && args.group.trim() ? args.group.trim() : undefined;
        const removed = await clearCostCapPolicy(group);
        const scope = group ?? 'fleet';
        return {
          cleared: removed,
          scope,
          note: removed
            ? `Removed the ${scope} override. The env / thresholds fallback applies at the next spawn.`
            : `No ${scope} override was set.`,
        };
      },
      formatHuman: (data) => {
        const d = data as { cleared: boolean; scope: string; note: string };
        return d.note;
      },
    },
    status: {
      access: 'open',
      description:
        "Report a session's LIVE cost-cap runtime status — read directly from that session's outbound.db " +
        '(`session_state` table, key `cost_cap`), the row the runner writes as spend accrues. Distinct from ' +
        '`get` (the CONFIGURED policy ceiling/cap): this is the OBSERVED state for one specific session — ' +
        "'ok' | 'warn' | 'escalated' | 'stopped' (hard-blocked pending a human Continue/Stop decision on the " +
        "dashboard), or 'unknown' when no cost-cap row exists yet (pre-cost-cap runner, or the session has " +
        'not spawned / spent anything). Intended for scriptable callers (e.g. /supervise-issues) that need to ' +
        "tell a session that's merely idle apart from one that's deliberately stopped.",
      args: [{ name: 'session', type: 'string', description: 'Session ID.', required: true }],
      examples: ['ncl cost-cap status --session <session-id>'],
      handler: async (args) => readSessionCostCapStatus(String(args.session ?? '')),
      formatHuman: (data) => {
        const d = data as SessionCostCapView;
        if (d.status === 'unknown') {
          return `Session ${d.session_id}: cost-cap status unknown (no cost_cap row yet).`;
        }
        const parts: string[] = [`status=${d.status}`];
        if (typeof d.spent_usd === 'number') parts.push(`spent=${usd(d.spent_usd)}`);
        if (typeof d.cap_usd === 'number') parts.push(`cap=${usd(d.cap_usd)}`);
        if (typeof d.ceiling_usd === 'number' && d.ceiling_usd > 0) parts.push(`ceiling=${usd(d.ceiling_usd)}`);
        if (d.decision) parts.push(`decision=${d.decision}${d.decided_at ? ` at ${d.decided_at}` : ''}`);
        return `Session ${d.session_id} (${d.agent_group_id}): ${parts.join(' ')}`;
      },
    },
    escalations: {
      access: 'open',
      description:
        'List cost-escalation episodes — per session: spent/cap/ceiling, decision_state ' +
        "('pending' | 'continued' | 'stopped' | 'expired' | 'superseded' | 'observed'), reason (cap|ceiling), " +
        'immortal, the coworker, and — when the session sits on a GitHub thread — the issue/PR author. This is ' +
        'the LIST behind "which sessions were cost-stopped and how much did they cost"; pair it with ' +
        '`cost-cap status --session` (one session, LIVE) and the dashboard Continue/Stop. Filters: --state, ' +
        '--session, --group (coworker folder), --author (GitHub login), --limit.',
      args: [
        { name: 'state', type: 'string', description: 'pending|continued|stopped|expired|superseded|observed' },
        { name: 'session', type: 'string', description: 'filter to one session id' },
        { name: 'group', type: 'string', description: 'filter by coworker workspace folder' },
        { name: 'author', type: 'string', description: 'filter by GitHub author (via gh_thread_origin)' },
        { name: 'limit', type: 'number', description: 'max rows (default 50, max 500)' },
      ],
      examples: [
        'ncl cost-cap escalations --state stopped',
        'ncl cost-cap escalations --group slang-fixer',
        'ncl cost-cap escalations --author tangent-vector --json',
      ],
      handler: async (args) => {
        const STATES: CostDecisionState[] = ['pending', 'continued', 'stopped', 'expired', 'superseded', 'observed'];
        const trim = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
        const stateRaw = trim(args.state);
        if (stateRaw && !STATES.includes(stateRaw as CostDecisionState)) {
          throw new Error(`--state must be one of: ${STATES.join(', ')}`);
        }
        const rows = await listEscalationEpisodes({
          state: stateRaw as CostDecisionState | undefined,
          sessionId: trim(args.session),
          groupFolder: trim(args.group),
          ghAuthor: trim(args.author),
          limit: args.limit !== undefined ? Number(args.limit) : undefined,
        });
        return { count: rows.length, escalations: rows.map(escalationView) };
      },
      formatHuman: (data) => {
        const d = data as { count: number; escalations: ReturnType<typeof escalationView>[] };
        if (d.count === 0) return 'No cost escalations match.';
        const lines = [`${d.count} escalation${d.count === 1 ? '' : 's'}:`];
        for (const e of d.escalations) {
          const parts: string[] = [`spent=${e.spent_usd != null ? usd(e.spent_usd) : '?'}`];
          if (e.cap_usd != null) parts.push(`cap=${usd(e.cap_usd)}`);
          if (e.ceiling_usd != null && e.ceiling_usd > 0) parts.push(`ceiling=${usd(e.ceiling_usd)}`);
          if (e.immortal) parts.push('immortal');
          const who = e.gh_author ? ` by ${e.gh_author}${e.gh ? ` (${e.gh})` : ''}` : '';
          lines.push(
            `  [${e.decision_state}] ${e.session_id} · ${e.coworker ?? '?'} · ${e.reason}/${e.window} · ${parts.join(' ')}${who}`,
          );
        }
        return lines.join('\n');
      },
    },
    sessions: {
      access: 'open',
      description:
        'Per-session cost DISTRIBUTION + percentiles — the surface a coworker needs to compute a per-group ' +
        'p95 and set a sane ceiling (escalations only shows the tripped tail). Reads the authoritative ' +
        'transcript-priced per-session cost from the local dashboard `GET /api/sessions` (the same source ' +
        'ops/metrics collect_cost() reads; requires /add-dashboard installed + running). Default output: ' +
        "per-group aggregates {group, sessions, total_usd, p50, p90, p95, max} over each group's cost>0 " +
        'sessions, sorted by total spend. Percentiles use the NEAREST-RANK method (sort asc, index ' +
        'floor(p*(n-1))) — the same method the host uses for cost-thresholds.json p90, so every value is a ' +
        'real observed session cost. Filters: --group <folder>, --period (1d|7d|30d|all, default 30d); ' +
        '--sessions emits the raw per-session list instead of aggregates.',
      args: [
        { name: 'group', type: 'string', description: 'Filter to one group workspace folder.' },
        { name: 'period', type: 'string', description: 'Day-window: 1d|7d|30d|all (default 30d).', default: '30d' },
        {
          name: 'sessions',
          type: 'boolean',
          description: 'Emit the raw per-session cost list (ranked desc) instead of per-group aggregates.',
        },
      ],
      examples: [
        'ncl cost-cap sessions',
        'ncl cost-cap sessions --group slang-fixer --period 7d',
        'ncl cost-cap sessions --group slang-fixer --sessions --json',
      ],
      handler: async (args) => {
        const period = String(args.period ?? '30d').trim() as CostPeriod;
        if (!COST_PERIODS.includes(period)) {
          throw new Error(`--period must be one of: ${COST_PERIODS.join(', ')}`);
        }
        const group = typeof args.group === 'string' && args.group.trim() ? args.group.trim() : undefined;
        const { sessions, costUnavailable } = await fetchSessionCosts(period);
        if (args.sessions === true) {
          const list = rankSessionCosts(sessions, { group });
          return { period, group: group ?? null, costUnavailable, count: list.length, sessions: list };
        }
        const groups = aggregateSessionCosts(sessions, { group });
        return {
          period,
          group: group ?? null,
          costUnavailable,
          method: 'nearest-rank (sort asc, index floor(p*(n-1)))',
          groups,
        };
      },
      formatHuman: (data) => {
        const d = data as {
          period: string;
          group: string | null;
          costUnavailable?: string | null;
          method?: string;
          groups?: GroupCostAggregate[];
          count?: number;
          sessions?: SessionCostListEntry[];
        };
        // Surface the dashboard's "pricing absent" reason so a $0/empty result is
        // never mistaken for "no spend" when it actually means "no cost data".
        const warn = d.costUnavailable ? `⚠ cost data may be unavailable: ${d.costUnavailable}\n` : '';
        if (d.sessions) {
          if (d.sessions.length === 0) return `${warn}No priced sessions in the last ${d.period}.`;
          const lines = [`${warn}${d.count} priced session${d.count === 1 ? '' : 's'} (${d.period}):`];
          for (const s of d.sessions) {
            lines.push(`  ${usd(s.cost)}  ${s.session_id} · ${s.group}${s.status ? ` · ${s.status}` : ''}`);
          }
          return lines.join('\n');
        }
        const groups = d.groups ?? [];
        if (groups.length === 0) return `${warn}No priced sessions in the last ${d.period}.`;
        const lines = [`${warn}Per-group cost over ${d.period} (percentiles: nearest-rank):`];
        for (const g of groups) {
          lines.push(
            `  ${g.group}: ${g.sessions} sessions, total ${usd(g.total_usd)} — ` +
              `p50 ${usd(g.p50)} · p90 ${usd(g.p90)} · p95 ${usd(g.p95)} · max ${usd(g.max)}`,
          );
        }
        return lines.join('\n');
      },
    },
    continue: {
      access: 'open',
      description:
        "Resolve a cost escalation by CONTINUING a session — the elevated ncl equivalent of the dashboard's " +
        'Continue. Routes through the SAME money-safe decision path as the pill (`applyCostOverrideDecision`): ' +
        'a live pending episode resolves via its at-most-once CAS + epoch fence; otherwise the override is ' +
        "fenced by the session's latest episode epoch so a duplicate/stale press can never double-grant. On a " +
        'session that is actually stopped at its ceiling this resumes it (the runner raises the cap by one ' +
        'allotment); to set an EXACT ceiling instead, use `set-ceiling`.',
      args: [{ name: 'session', type: 'string', description: 'Session ID.', required: true }],
      examples: ['ncl cost-cap continue --session <session-id>'],
      handler: async (args, ctx) => {
        const sessionId = String(args.session ?? '').trim();
        if (!sessionId) throw new Error('--session is required');
        const { applyCostOverrideDecision } = await import('../../modules/cost-approval/index.js');
        await applyCostOverrideDecision(sessionId, 'continue', `ncl:${actorLabel(ctx)}`);
        return { session_id: sessionId, decision: 'continue', ok: true };
      },
      formatHuman: (data) => {
        const d = data as { session_id: string };
        return `Continue routed to session ${d.session_id}.`;
      },
    },
    stop: {
      access: 'open',
      description:
        "Resolve a cost escalation by STOPPING a session — the elevated ncl equivalent of the dashboard's Stop. " +
        'Routes through the SAME money-safe decision path as the pill (see `continue`): a genuine manual kill ' +
        'switch that quiesces a running, non-immortal session (recorded-only for immortal sessions, which never ' +
        'quiesce). Money-safe under duplicate/stale presses via the same episode epoch fence.',
      args: [{ name: 'session', type: 'string', description: 'Session ID.', required: true }],
      examples: ['ncl cost-cap stop --session <session-id>'],
      handler: async (args, ctx) => {
        const sessionId = String(args.session ?? '').trim();
        if (!sessionId) throw new Error('--session is required');
        const { applyCostOverrideDecision } = await import('../../modules/cost-approval/index.js');
        await applyCostOverrideDecision(sessionId, 'stop', `ncl:${actorLabel(ctx)}`);
        return { session_id: sessionId, decision: 'stop', ok: true };
      },
      formatHuman: (data) => {
        const d = data as { session_id: string };
        return `Stop routed to session ${d.session_id}.`;
      },
    },
    'set-ceiling': {
      access: 'open',
      description:
        "Set a session's LIVE Tier-2 hard ceiling to an EXACT USD value (NanoClaw #1, set-ceiling v2) — the " +
        'elevated ncl equivalent of the dashboard +/- control. Reads the live epoch + current ceiling itself, ' +
        'then submits through the existing `submitCostCeilingAdjustment` flow, whose ' +
        'UNIQUE(session_id, expected_epoch_key) ledger CAS is the concurrency control: MONEY-SAFE, never a ' +
        'double-grant. If the session moved since the read (stale epoch), or a card/another request already ' +
        'claimed the epoch, or the runner is too old / not ready, this FAILS LOUDLY (non-2xx) rather than ' +
        'over-raising. Works on a stopped session (raise + resume) or a healthy one (proactive raise/lower). ' +
        'Max $1000.00; immortal (admin/main) sessions are refused.',
      args: [
        { name: 'session', type: 'string', description: 'Session ID.', required: true },
        {
          name: 'ceiling',
          type: 'number',
          description: 'Exact target Tier-2 ceiling in USD (> 0, <= 1000). Converted to integer cents.',
          required: true,
        },
      ],
      examples: [
        'ncl cost-cap set-ceiling --session <session-id> --ceiling 300',
        'ncl cost-cap set-ceiling --session <session-id> --ceiling 42.50 --json',
      ],
      handler: async (args, ctx) => {
        const sessionId = String(args.session ?? '').trim();
        if (!sessionId) throw new Error('--session is required');
        const ceilingUsd = Number(args.ceiling);
        if (!Number.isFinite(ceilingUsd) || ceilingUsd <= 0) throw new Error('--ceiling must be a number > 0');
        const targetCeilingCents = Math.round(ceilingUsd * 100);
        if (targetCeilingCents < 1 || targetCeilingCents > 100_000) {
          throw new Error('--ceiling must be between $0.01 and $1000.00');
        }

        // Read LIVE epoch + ceiling to build the optimistic CAS precondition —
        // the same values the dashboard browser reads from /api/sessions.
        // submitCostCeilingAdjustment RE-READS and RE-VALIDATES these
        // authoritatively (409 'stale' if they moved between now and the ledger
        // insert), so this is the precondition, not a trusted bypass of it.
        const live = await readSessionCostCapStatus(sessionId);
        if (live.status === 'unknown') {
          throw new Error(
            `session ${sessionId} has no live cost-cap state (not spawned, non-Claude provider, or pre-cost-cap runner)`,
          );
        }
        if (live.immortal === true) {
          throw new Error('immortal (admin/main) sessions cannot be quiesced/adjusted by this control');
        }
        if (typeof live.ceiling_usd !== 'number' || live.ceiling_usd <= 0) {
          throw new Error('this session has no live Tier-2 ceiling configured');
        }
        if (typeof live.budget_gen !== 'number') {
          throw new Error('no live budget generation reported for this session');
        }
        const expectedEpochKey = String(live.budget_gen);
        const expectedCeilingCents = Math.round(live.ceiling_usd * 100);
        if (targetCeilingCents === expectedCeilingCents) {
          throw new Error(`--ceiling ${usd(ceilingUsd)} equals the current live ceiling — nothing to change`);
        }

        const requestId = `cca-${randomUUID()}`;
        const { submitCostCeilingAdjustment } = await import('../../modules/cost-ceiling-adjustment/index.js');
        const result = await submitCostCeilingAdjustment(
          { protocolVersion: 2, requestId, sessionId, targetCeilingCents, expectedEpochKey, expectedCeilingCents },
          `ncl:${actorLabel(ctx)}`,
        );

        // MONEY-SAFE: surface any non-accept status as a thrown error instead of
        // pretending success. 200 = idempotent-terminal, 202 = accepted/enqueued.
        if (result.status !== 200 && result.status !== 202) {
          const err = typeof result.body.error === 'string' ? result.body.error : `http_${result.status}`;
          const msg = typeof result.body.message === 'string' ? result.body.message : '';
          throw new Error(`set-ceiling refused (${result.status} ${err})${msg ? `: ${msg}` : ''}`);
        }
        return {
          session_id: sessionId,
          requestId,
          targetCeilingUsd: ceilingUsd,
          targetCeilingCents,
          status: result.status,
          result: result.body,
        };
      },
      formatHuman: (data) => {
        const d = data as { session_id: string; targetCeilingUsd: number; status: number };
        const verb = d.status === 200 ? 'already recorded' : 'submitted';
        return `Set-ceiling ${verb}: session ${d.session_id} → ${usd(d.targetCeilingUsd)} ceiling.`;
      },
    },
    coworkers: {
      access: 'open',
      description:
        "Cost per coworker (agent group), from the inference gateway's EXACT per-request cost — the litellm " +
        'number the OneCLI gateway captures into request_logs (header x-litellm-response-cost-original), rolled ' +
        "up by agent group. Not a token estimate: it is the billing system's own figure, date-correct, covering " +
        'both Claude and Codex (both route through the gateway). Read HOST-SIDE only — a cli_scope=global caller ' +
        'gets back just the numbers, never OneCLI DB access. Needs the gateway capture flag ' +
        '(ONECLI_CAPTURE_RESPONSE_HEADERS) + ONECLI_PG_CONTAINER; reports configured:false when unset. ' +
        'Filters: --group (coworker folder), --period (e.g. 30d, 24h; default all-time).',
      args: [
        { name: 'group', type: 'string', description: 'filter to one coworker workspace folder' },
        {
          name: 'period',
          type: 'string',
          description: 'lookback window: <n>d or <n>h (e.g. 30d, 24h). Default: all-time.',
        },
      ],
      examples: [
        'ncl cost-cap coworkers',
        'ncl cost-cap coworkers --period 7d',
        'ncl cost-cap coworkers --group slang-fixer --json',
      ],
      handler: async (args) => {
        const trim = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
        return readCostPerCoworker({ period: trim(args.period), groupFolder: trim(args.group) });
      },
      formatHuman: (data) => {
        const d = data as CostPerCoworkerResult;
        if (!d.configured) return d.note ?? 'Cost source not configured.';
        if (d.coworkers.length === 0) return d.note ?? 'No captured cost rows.';
        const lines = [`Cost per coworker (${d.period}, source: ${d.source}) — total ${money(d.totalUsd)}:`];
        for (const c of d.coworkers) {
          const who = c.folder ?? (c.name || c.groupId);
          lines.push(`  ${who}: ${money(c.costUsd)} · ${c.calls} call${c.calls === 1 ? '' : 's'}`);
        }
        return lines.join('\n');
      },
    },
  },
});
