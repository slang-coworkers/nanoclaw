import type { ContainerConfig } from '../container-config.js';
import type { AgentGroup, Session } from '../types.js';
import { listProviderContainerConfigNames } from './provider-container-registry.js';

/**
 * The tiers a provider pick can come from, highest first. Named rather than
 * positional because the tiers are all `string | null | undefined`, so the
 * compiler cannot tell them apart: a positional call that passes the container
 * config where the group belongs type-checks, silently drops the group tier,
 * and agrees with the correct answer whenever the group has no provider of its
 * own — which is how exactly that defect survived in `spawnContainer`.
 *
 * Every key is required. Pass `undefined` for a tier the caller genuinely has
 * nothing for, so that omitting one is a compile error rather than a shift of
 * the remaining values onto the wrong tiers.
 */
export interface ProviderTiers {
  /**
   * A provider named in the operation being validated, outranking anything
   * stored: the `--provider` a command carries alongside the field it is
   * checking. Not a stored tier — nothing reads it back.
   */
  override: string | null | undefined;
  /** `sessions.agent_provider` — a per-session pin. */
  session: string | null | undefined;
  /** `agent_groups.agent_provider` — the group's own runtime provider. */
  group: string | null | undefined;
  /** `container_configs.provider`. */
  config: string | null | undefined;
}

/**
 * The one rule for which provider an agent group runs on: the session's pinned
 * provider, else the group's own `agent_provider`, else the group's container
 * config, else Claude. Spawn resolves through this, and so does every host
 * command that must validate against the group's actual provider (e.g.
 * `--speed`).
 *
 * The `group` tier is a real one on this fork — upstream's rule has only two,
 * which makes a group-level provider pick silently lose to container.json.
 */
export function resolveProviderName(tiers: ProviderTiers): string {
  return resolveProviderTier(tiers).provider;
}

/** The tier a provider pick came from: a stored or command tier, or the default. */
export type ProviderTier = keyof ProviderTiers | 'default';

/**
 * `resolveProviderName`, plus the tier that supplied the answer. `ncl sessions
 * get/list` show the tier, so an operator can see that a session runs on its
 * pin rather than on the group's provider.
 */
export function resolveProviderTier(tiers: ProviderTiers): { provider: string; tier: ProviderTier } {
  for (const tier of ['override', 'session', 'group', 'config'] as const) {
    const value = tiers[tier];
    if (value) return { provider: value.toLowerCase(), tier };
  }
  return { provider: 'claude', tier: 'default' };
}

/**
 * Every provider this host can spawn a container for, sorted: the providers the
 * barrel under src/providers/ registers. A stored provider outside this list
 * has no container contribution, so a command that stores one validates it here.
 */
export function knownProviderNames(): string[] {
  return listProviderContainerConfigNames().sort();
}

/**
 * The provider a spawn runs on. Both halves of a spawn — the group-filesystem
 * scaffold and the mounts/contribution — MUST resolve through this one call, or
 * a group whose provider lives only in `agent_groups.agent_provider` gets its
 * filesystem prepared for one provider and its container built for another.
 */
export function resolveSpawnProvider(rows: {
  // Whole rows, not `Pick<_, 'agent_provider'>`: both declare
  // `agent_provider: string | null`, so the picked types are structurally
  // identical and `{ session: agentGroup, agentGroup: session }` would compile
  // and silently invert their precedence. The full types have no such overlap,
  // and the structure test pins only that this helper is *called* — not the
  // rows it is called with.
  session: Session;
  agentGroup: AgentGroup;
  containerConfig: Pick<ContainerConfig, 'provider'>;
}): string {
  return resolveProviderName({
    override: undefined,
    session: rows.session.agent_provider,
    group: rows.agentGroup.agent_provider,
    config: rows.containerConfig.provider,
  });
}
