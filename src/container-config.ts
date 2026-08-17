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
   * Per-session soft cost cap (USD). v2 auto-sources the fleet-wide p90 of
   * recent per-session spend: precedence is env `NANOCLAW_COST_T2_USD` →
   * `data/cost-thresholds.json` `p90Usd` (the dashboard's computed p90) →
   * a conservative $100 default. Materialized for ALL groups so every session
   * carries a cap. See `resolveCostCapT2Usd`.
   */
  costCapT2Usd?: number;
}

/**
 * Conservative fallback per-session cost cap (USD) when neither the env
 * override nor the dashboard's computed p90 threshold is available.
 */
const DEFAULT_COST_CAP_T2_USD = 100;

/**
 * Resolve the per-session cost cap (USD) materialized into every group's
 * container.json (NanoClaw #1 cost cap v2).
 *
 * Precedence:
 *   1. NANOCLAW_COST_T2_USD env — explicit operator override, wins outright.
 *   2. data/cost-thresholds.json `p90Usd` — the dashboard's auto-computed p90 of
 *      recent per-session spend (the empirical cap). Read fresh each spawn.
 *   3. DEFAULT_COST_CAP_T2_USD ($100) — conservative fallback.
 *
 * Fail-soft: a missing, unreadable, malformed, or non-positive thresholds file
 * falls through to the next source rather than throwing or disabling the cap.
 */
export function resolveCostCapT2Usd(): number {
  const env = Number(process.env.NANOCLAW_COST_T2_USD);
  if (Number.isFinite(env) && env > 0) return env;

  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, 'cost-thresholds.json'), 'utf8');
    const p90 = Number((JSON.parse(raw) as { p90Usd?: unknown }).p90Usd);
    if (Number.isFinite(p90) && p90 > 0) return p90;
  } catch {
    // Fail-soft — missing/corrupt thresholds file falls through to the default.
  }
  return DEFAULT_COST_CAP_T2_USD;
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
  const costCapT2Usd = resolveCostCapT2Usd();
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
