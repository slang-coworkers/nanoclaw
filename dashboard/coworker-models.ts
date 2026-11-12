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
} from '../src/model-policy.js';
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
 * Resolve the model card of one group from its rows. The provider follows the
 * spawn rule without a session pin: the group's provider, else its container
 * config's, else Claude.
 */
export function coworkerModels(
  group: CoworkerGroupRow,
  config: CoworkerConfigRow | undefined,
  env: NodeJS.ProcessEnv = process.env,
): CoworkerModels {
  const row = config ?? {};
  const provider = resolveProviderName({
    override: undefined,
    session: undefined,
    group: group.agent_provider,
    config: row.provider,
  });
  const models = resolveGroupModels(provider, row, env);
  return {
    folder: group.folder,
    provider,
    weights: models.weights,
    roles: MODEL_ROLES.map((role) => ({
      role,
      model: models[role] ?? null,
      openWeights: isOpenWeightsRole(models, role, env),
    })),
    problems: modelPolicyViolations(models, env),
  };
}
