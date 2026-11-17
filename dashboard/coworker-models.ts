/**
 * The models one coworker uses, for the dashboard's model card (fork-owned).
 *
 * A coworker uses up to four models: the doer (main), a small model, the
 * intent router and the critic. src/model-policy.ts resolves them for one
 * group, and spawn writes that result into the container's env. The card runs
 * the same resolution on the group's rows. systemd loads the dashboard's env
 * from the same .env as the host, so the card shows what the group's next
 * container runs, and whether each model is open-weights.
 */
import {
  MODEL_ROLES,
  isOpenWeightsRole,
  modelPolicyViolations,
  resolveGroupModels,
  type ModelPolicyRow,
  type ModelRole,
  type ModelWeights,
  type ResolvedModels,
} from '../src/model-policy.js';
import {
  rowForPrivilege,
  sessionPrivilegeOf,
  type PrivilegeSettings,
  type SessionPrivilege,
} from '../src/modules/session-privilege/index.js';
import { resolveProviderName } from '../src/providers/provider-name.js';

export interface CoworkerModelRole {
  role: ModelRole;
  model: string | null;
  /** null when the role has no model (for example no small model on Codex). */
  openWeights: boolean | null;
}

export interface CoworkerModels {
  folder: string;
  provider: string;
  weights: ModelWeights;
  roles: CoworkerModelRole[];
  /** Why a `weights=open` group may not start; empty when it may. */
  problems: string[];
}

/** The `agent_groups` columns the card reads. */
export interface CoworkerGroupRow {
  folder: string;
  agent_provider: string | null;
}

/** The `container_configs` columns the card reads; absent when the group has no row. */
export type CoworkerConfigRow = ModelPolicyRow & { provider?: string | null };

/**
 * Resolve the provider and the four role models of one group (or one of its
 * sessions) with spawn's own rules: the session pin, else the group's
 * provider, else its container config's, else the install default. The model
 * card and the weights badge both go through here, so they cannot disagree.
 */
function resolveCoworker(
  group: CoworkerGroupRow,
  config: CoworkerConfigRow | undefined,
  sessionPin: string | null | undefined,
  env: NodeJS.ProcessEnv,
): ResolvedModels {
  const row = config ?? {};
  const provider = resolveProviderName({
    override: undefined,
    session: sessionPin,
    group: group.agent_provider,
    config: row.provider,
  });
  return resolveGroupModels(provider, row, env);
}

/**
 * Resolve the model card of one group from its rows, without a session pin.
 */
export function coworkerModels(
  group: CoworkerGroupRow,
  config: CoworkerConfigRow | undefined,
  env: NodeJS.ProcessEnv = process.env,
): CoworkerModels {
  const models = resolveCoworker(group, config, undefined, env);
  return {
    folder: group.folder,
    provider: models.provider,
    weights: models.weights,
    roles: MODEL_ROLES.map((role) => ({
      role,
      model: models[role] ?? null,
      openWeights: isOpenWeightsRole(models, role, env),
    })),
    problems: modelPolicyViolations(models, env),
  };
}

/**
 * Which kind of models a coworker or session may call, for the dashboard's
 * colour badge. It is `open` when the resolved policy is `weights=open`,
 * because spawn then starts only open-weights models and refuses the rest
 * (the model card names why). Under `weights=any` it is `open` when every role
 * that has a model is open-weights, and `closed` otherwise: one closed critic
 * makes the whole coworker `closed`, because the gateway sees that call too.
 */
export type WeightsClass = 'open' | 'closed';

export interface WeightsBadge {
  /** The provider the next container of this group or session runs on. */
  effectiveProvider: string;
  weights: WeightsClass;
}

/** The `sessions` columns that change what one session runs. */
export interface BadgeSessionRow {
  /** The session's provider pin, which outranks the group's provider. */
  agent_provider: string | null;
  /** Absent on a DB from before the column existed, which sessionPrivilegeOf reads as `open`. */
  privilege?: SessionPrivilege | null;
}

/**
 * Resolve the weights badge of a group, or of one of its sessions when
 * `session` is given, with spawn's own steps: the session's provider pin
 * (resolveProviderName), then its privilege applied to the group's row
 * (rowForPrivilege), then the role models (resolveGroupModels).
 *
 * Consider an OpenCode group with `weights=open` and two sessions. One has
 * `agent_provider = 'claude'`: its badge names `claude`, and stays `open`,
 * because spawn refuses the Claude provider under `weights=open`. The other is
 * a `closed` privilege session while privilege enforcement is on: spawn drops
 * the open rule for it, so it is `closed` once any of its models is closed.
 */
export function weightsBadge(
  group: CoworkerGroupRow,
  config: CoworkerConfigRow | undefined,
  session: BadgeSessionRow | null,
  env: NodeJS.ProcessEnv = process.env,
  privilegeSettings?: PrivilegeSettings,
): WeightsBadge {
  const row = config ?? {};
  // rowForPrivilege changes only the policy columns, so the row keeps its
  // provider; without `privilegeSettings` it reads the install's own.
  const sessionRow = session
    ? { ...row, ...rowForPrivilege(row, sessionPrivilegeOf(session), privilegeSettings) }
    : row;
  const models = resolveCoworker(group, sessionRow, session?.agent_provider, env);
  const open = MODEL_ROLES.map((role) => isOpenWeightsRole(models, role, env)).filter((o) => o !== null);
  const allOpen = open.length > 0 && open.every(Boolean);
  return {
    effectiveProvider: models.provider,
    weights: models.weights === 'open' || allOpen ? 'open' : 'closed',
  };
}
