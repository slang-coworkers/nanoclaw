/**
 * Container config types and materialization.
 *
 * Source of truth is the `container_configs` table in the central DB.
 * This module provides:
 *   - Type definitions for the file shape (read by the container runner)
 *   - `materializeContainerJson()` — writes `groups/<folder>/container.json`
 *     from the DB at spawn time
 *   - `configFromDb()` — builds a `ContainerConfig` from a DB row + agent group
 */
import fs from 'fs';
import path from 'path';

import { DATA_DIR, GROUPS_DIR, TIMEZONE } from './config.js';
import { getContainerConfig } from './db/container-configs.js';
import { getCostCapPolicy } from './db/cost-cap-policy.js';
import { getAgentGroup } from './db/agent-groups.js';
import { isValidTimezone } from './timezone.js';
import type { AgentGroup, ContainerConfigRow } from './types.js';

export interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  instructions?: string;
}

export interface AdditionalMountConfig {
  hostPath: string;
  containerPath: string;
  readonly?: boolean;
}

/** Shape of the materialized `container.json` file read by the container runner. */
export interface ContainerConfig {
  mcpServers: Record<string, McpServerConfig>;
  packages: { apt: string[]; npm: string[] };
  imageTag?: string;
  additionalMounts: AdditionalMountConfig[];
  skills: string[] | 'all';
  provider?: string;
  groupName?: string;
  assistantName?: string;
  agentGroupId?: string;
  maxMessagesPerPrompt?: number;
  model?: string;
  effort?: string;
  timezone?: string;
  /**
   * Immortality (NanoClaw #1 cost cap): orchestrator / admin groups escalate
   * for cost-cap visibility only and are never quiesced. Derived from an
   * authoritative host field so a renamed orchestrator keeps its exemption.
   */
  immortal?: boolean;
  /**
   * Per-session soft cost cap (USD) — Tier 1. Precedence: a per-group DB override
   * (`ncl cost-cap set --cap … --group <folder>`) → env `NANOCLAW_COST_T2_USD` →
   * the group's OWN 7-day p90 in `data/cost-thresholds.json` `perGroupP90Usd[folder]`
   * → fleet `p90Usd` → a conservative $100 default. Materialized for ALL groups.
   * See `resolveCostCapT2Usd`.
   */
  costCapT2Usd?: number;
  /**
   * Tier-2 hard ceiling (USD). A non-immortal session that reaches it hard-stops;
   * immortal groups re-escalate for visibility only (never blocked). Precedence: a
   * per-group DB override → the fleet DB ceiling (both set via `ncl cost-cap set`)
   * → env `NANOCLAW_COST_T2_CEILING_USD`; 0/absent = no ceiling. See
   * `resolveCostCeilingT2Usd`.
   */
  costCeilingT2Usd?: number;
}

/**
 * Conservative fallback per-session cost cap (USD) when neither the env
 * override nor the dashboard's computed p90 threshold is available.
 */
const DEFAULT_COST_CAP_T2_USD = 100;

/**
 * Absolute floor for the auto-sourced cap (USD). A brand-new agent group (or one
 * with no priced sessions in the window) has no per-group and possibly no fleet
 * p90 — without a floor its cap could resolve to ~$0 and escalate on the first
 * turn. The floor guarantees every group escalates somewhere sane. Not applied to
 * an explicit NANOCLAW_COST_T2_USD operator override (that wins outright).
 */
const MIN_COST_CAP_T2_USD = 10;

/**
 * Resolve the per-session cost cap (USD) materialized into every group's
 * container.json (NanoClaw #1 cost cap v2).
 *
 * Precedence:
 *   0. cost_cap_policy DB per-group `cap_usd` — the operator override set at
 *      runtime via `ncl cost-cap set --cap … --group <folder>`. Highest priority,
 *      wins outright and unfloored (same class as the env override).
 *   1. NANOCLAW_COST_T2_USD env — explicit operator override, wins outright.
 *   2. data/cost-thresholds.json `perGroupP90Usd[folder]` — the group's OWN p90.
 *      A fleet number under-serves expensive groups (fixer p90 ~$91) and
 *      over-caps cheap ones (reviewer ~$12), so per-group wins when present.
 *   3. data/cost-thresholds.json `p90Usd` — fleet p90 fallback (group too new to
 *      have its own priced sample yet).
 *   4. DEFAULT_COST_CAP_T2_USD ($100) — conservative fallback.
 *
 * The auto-sourced tail (2–4) is floored at MIN_COST_CAP_T2_USD; the two explicit
 * operator overrides (0, 1) bypass the floor.
 *
 * Fail-soft: an uninitialized DB, a missing table, or a missing/unreadable/
 * malformed/non-positive thresholds file falls through to the next source rather
 * than throwing or disabling the cap.
 */
export function resolveCostCapT2Usd(groupFolder?: string): number {
  // 0. Runtime DB per-group override — an explicit operator decision; wins
  //    outright and unfloored, exactly like the env override below.
  if (groupFolder) {
    const dbCap = getCostCapPolicy(groupFolder)?.cap_usd;
    if (typeof dbCap === 'number' && Number.isFinite(dbCap) && dbCap > 0) return dbCap;
  }

  const env = Number(process.env.NANOCLAW_COST_T2_USD);
  if (Number.isFinite(env) && env > 0) return env;

  let cap = DEFAULT_COST_CAP_T2_USD;
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'cost-thresholds.json'), 'utf8')) as {
      p90Usd?: unknown;
      perGroupP90Usd?: Record<string, unknown>;
    };
    const g =
      groupFolder && parsed.perGroupP90Usd && typeof parsed.perGroupP90Usd === 'object'
        ? Number(parsed.perGroupP90Usd[groupFolder])
        : NaN;
    if (Number.isFinite(g) && g > 0) {
      cap = g;
    } else {
      const p90 = Number(parsed.p90Usd);
      if (Number.isFinite(p90) && p90 > 0) cap = p90;
    }
  } catch {
    // Fail-soft — missing/corrupt thresholds file falls through to the default.
  }
  // Floor the auto-sourced value so a new/zero-p90 group never caps near $0.
  return Math.max(MIN_COST_CAP_T2_USD, cap);
}

/**
 * Resolve the Tier-2 hard ceiling (USD) materialized into every container.json.
 *
 * Precedence:
 *   0. cost_cap_policy DB per-group `ceiling_usd` (`ncl cost-cap set --ceiling …
 *      --group <folder>`) — a per-group override, when present.
 *   1. cost_cap_policy DB fleet `ceiling_usd` (`ncl cost-cap set --ceiling …`) —
 *      the runtime operator ceiling.
 *   2. NANOCLAW_COST_T2_CEILING_USD env — the back-compat fallback.
 *   3. 0 — no ceiling (opt-in: an install with none keeps escalate-only behavior).
 *
 * A stored DB value wins over the env var, INCLUDING 0 (an explicit "no ceiling"
 * that overrides an env-configured ceiling). NULL/absent in the DB falls through.
 * `ncl cost-cap clear` removes a DB row to restore the env fallback. DB reads are
 * fail-soft (uninitialized DB / missing table → skip).
 */
export function resolveCostCeilingT2Usd(groupFolder?: string): number {
  if (groupFolder) {
    const g = getCostCapPolicy(groupFolder)?.ceiling_usd;
    if (typeof g === 'number' && Number.isFinite(g) && g >= 0) return g;
  }
  const fleet = getCostCapPolicy()?.ceiling_usd;
  if (typeof fleet === 'number' && Number.isFinite(fleet) && fleet >= 0) return fleet;

  const env = Number(process.env.NANOCLAW_COST_T2_CEILING_USD);
  if (Number.isFinite(env) && env > 0) return env;
  return 0;
}

/**
 * Effective timezone for an agent group: per-group override → install global.
 * The ncl write path validates, but a hand-edited DB value must not silently
 * flip scheduling to UTC — an invalid override falls back to the global tz,
 * same as no override.
 */
export function resolveGroupTimezone(agentGroupId: string): string {
  const tz = getContainerConfig(agentGroupId)?.timezone;
  return tz && isValidTimezone(tz) ? tz : TIMEZONE;
}

/** Build a `ContainerConfig` from a DB row + agent group identity. */
export function configFromDb(row: ContainerConfigRow, group: AgentGroup): ContainerConfig {
  // NanoClaw #1 cost cap. Immortality is an authoritative host signal — the
  // admin group (`is_admin`) or the orchestrator coworker type ('main'). The
  // cap value (v2) auto-sources the fleet-wide p90 threshold and is emitted for
  // ALL groups so every session carries a cap.
  const immortal = group.is_admin === 1 || group.coworker_type === 'main';
  const costCapT2Usd = resolveCostCapT2Usd(group.folder);
  const costCeilingT2Usd = resolveCostCeilingT2Usd(group.folder);
  return {
    mcpServers: JSON.parse(row.mcp_servers) as Record<string, McpServerConfig>,
    packages: {
      apt: JSON.parse(row.packages_apt) as string[],
      npm: JSON.parse(row.packages_npm) as string[],
    },
    imageTag: row.image_tag ?? undefined,
    additionalMounts: JSON.parse(row.additional_mounts) as AdditionalMountConfig[],
    skills: JSON.parse(row.skills) as string[] | 'all',
    provider: row.provider ?? undefined,
    groupName: group.name,
    assistantName: row.assistant_name ?? group.name,
    agentGroupId: group.id,
    maxMessagesPerPrompt: row.max_messages_per_prompt ?? undefined,
    model: row.model ?? undefined,
    effort: row.effort ?? undefined,
    timezone: row.timezone && isValidTimezone(row.timezone) ? row.timezone : undefined,
    immortal,
    costCapT2Usd,
    costCeilingT2Usd,
  };
}

/**
 * Materialize `container.json` from the DB. Called at spawn time so the
 * container always sees fresh config. Returns the `ContainerConfig` for
 * use by the caller (buildMounts, buildContainerArgs, etc.).
 */
export function materializeContainerJson(agentGroupId: string): ContainerConfig {
  const group = getAgentGroup(agentGroupId);
  if (!group) throw new Error(`Agent group not found: ${agentGroupId}`);

  const row = getContainerConfig(agentGroupId);
  if (!row) throw new Error(`Container config not found for agent group: ${agentGroupId}`);

  const config = configFromDb(row, group);

  const p = path.join(GROUPS_DIR, group.folder, 'container.json');
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(config, null, 2) + '\n');

  return config;
}
