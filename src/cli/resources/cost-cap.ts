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
import { registerResource } from '../crud.js';
import {
  clearCostCapPolicy,
  getCostCapPolicy,
  listCostCapPolicies,
  setCostCapPolicy,
  type CostCapPolicyRow,
} from '../../db/cost-cap-policy.js';
import { resolveCostCapT2Usd, resolveCostCeilingT2Usd } from '../../container-config.js';

/** Who is making the change, for the row's audit column. */
function actorLabel(ctx: { caller: string; agentGroupId?: string } | undefined): string {
  return ctx?.caller === 'agent' ? (ctx.agentGroupId ?? 'agent') : 'host';
}

function usd(n: number): string {
  return `$${n.toFixed(2)}`;
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
        const fleetRow = getCostCapPolicy();
        const envCeiling = Number(process.env.NANOCLAW_COST_T2_CEILING_USD);
        const envCeilingValue = Number.isFinite(envCeiling) && envCeiling > 0 ? envCeiling : null;

        const effectiveFleetCeiling = resolveCostCeilingT2Usd();
        const fleetSource =
          fleetRow && typeof fleetRow.ceiling_usd === 'number' ? 'db' : envCeilingValue !== null ? 'env' : 'none';

        const base = {
          fleet: {
            effectiveCeilingUsd: effectiveFleetCeiling,
            source: fleetSource,
            dbCeilingUsd: fleetRow?.ceiling_usd ?? null,
            envCeilingUsd: envCeilingValue,
          },
          overrides: listCostCapPolicies().map(policyView),
        };

        if (!group) return base;

        const row = getCostCapPolicy(group);
        return {
          ...base,
          group: {
            group_folder: group,
            effectiveCapUsd: resolveCostCapT2Usd(group),
            effectiveCeilingUsd: resolveCostCeilingT2Usd(group),
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

        const row = setCostCapPolicy({ groupFolder: group, ceilingUsd, capUsd, updatedBy: actorLabel(ctx) });
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
        const removed = clearCostCapPolicy(group);
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
  },
});
