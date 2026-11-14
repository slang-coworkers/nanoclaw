/**
 * Plan for moving every coworker to open-weights models (fork-owned).
 *
 * The operator's direction (2026-11-13) is open weights by default: every
 * coworker runs open-weights models, and closed models become an exception for
 * approved people. This module computes, for each agent group, what that move
 * changes, and the `ncl` commands that make the change. It reads; it never
 * writes. `scripts/open-weights-plan.ts` prints the plan for one install.
 *
 * Consider a Claude coworker whose `model` column holds a Claude id. Claude
 * groups cannot be `weights=open` (the SDK and the router call Claude), so the
 * plan switches it to OpenCode, which runs both open models and Claude models
 * through the gateway. The Claude id in `model` is closed, so the plan clears
 * it and the open default (GLM) applies. Codex, OpenCode and Pi groups keep
 * their provider; a column that already names an open model stays.
 *
 * The move changes only what must change. `weights=open` gives an unset role
 * the open default ahead of the install's own setting, so a Codex group that
 * runs Kimi through `CODEX_MODEL` would switch to GLM. When a role already
 * resolves to an open model, the plan writes that model into the role's
 * column, and the group keeps it.
 *
 * A session can pin its own provider, and the pin outranks the group's. A
 * session pinned to another provider would not start once its group is
 * `weights=open` on the target provider, so the plan reports it as a blocker.
 *
 * A group that pins its own container image (`container_configs.image_tag`)
 * does not run the install's current base image, so the runtime of its new
 * provider may be missing from it. Consider a Claude group whose pinned image
 * was built before OpenCode existed: after the move its container fails at
 * start with "Executable not found: opencode". An image this install derived
 * for the group (`<image base>:<group id>`) is rebuilt from the current base,
 * so the restart of such a group carries `--rebuild`. Any other pin is an image
 * this install does not build, so a provider change on it is a blocker.
 */
import { getAllAgentGroups } from './db/agent-groups.js';
import { CONTAINER_IMAGE_BASE } from './config.js';
import { getDb } from './db/connection.js';
import { getAllContainerConfigs } from './db/container-configs.js';
import { derivedImageTag } from './derived-image-repair.js';
import {
  MODEL_ROLE_COLUMNS,
  MODEL_ROLES,
  isOpenWeightsRole,
  modelPolicyViolations,
  resolveGroupModels,
  type ModelPolicyRow,
  type ModelRole,
  type ResolvedModels,
} from './model-policy.js';
import { resolveProviderName } from './providers/provider-name.js';

type Env = Readonly<Record<string, string | undefined>>;

/** The provider a Claude group moves to: it runs open models, and Claude models through the gateway. */
export const OPEN_TARGET_FOR_CLAUDE = 'opencode';

const ROLE_FLAGS: Record<ModelRole, string> = {
  main: '--model',
  small: '--small-model',
  router: '--router-model',
  critic: '--critic-model',
};

export interface MigrationGroupInput {
  id: string;
  folder: string;
  /** The group's provider, resolved without a session pin. */
  provider: string;
  config: ModelPolicyRow;
  /** Active sessions that pin their own provider. */
  pinnedSessions: { id: string; provider: string }[];
  /** `container_configs.image_tag`: the image the group pins, or null when it runs the base image. */
  imageTag: string | null;
  /** The install's image base, which names the derived image of every group. */
  imageBase: string;
}

export interface GroupMigrationPlan {
  id: string;
  folder: string;
  status: 'already-open' | 'migrate' | 'blocked';
  before: ResolvedModels;
  after: ResolvedModels;
  /** Roles that resolve to a closed model today. */
  closedRolesBefore: ModelRole[];
  /** The new provider, or null when the provider stays. */
  providerChange: string | null;
  /** Roles whose own column names a closed model and is cleared to the open default. */
  clearedRoles: ModelRole[];
  /** Roles already on an open model that `weights=open` would change; the plan sets them to that model. */
  keptRoles: ModelRole[];
  /** True when the restart rebuilds the group's derived image from the current base. */
  rebuildsImage: boolean;
  /** Why the group cannot move as planned: policy problems, pinned sessions and a foreign image pin. */
  blockers: string[];
  commands: string[];
}

/** Return the plan that moves one group to open-weights models. */
export function planGroupMigration(input: MigrationGroupInput, env: Env = process.env): GroupMigrationPlan {
  const before = resolveGroupModels(input.provider, input.config, env);
  const closedRolesBefore = MODEL_ROLES.filter((role) => isOpenWeightsRole(before, role, env) === false);
  const target = input.provider === 'claude' ? OPEN_TARGET_FOR_CLAUDE : input.provider;

  // A role's own model survives only when it is open on the target provider.
  const clearedRoles = MODEL_ROLES.filter((role) => {
    const own = input.config[MODEL_ROLE_COLUMNS[role]];
    if (!own) return false;
    const probe = resolveGroupModels(target, { [MODEL_ROLE_COLUMNS[role]]: own, weights: 'open' }, env);
    return isOpenWeightsRole(probe, role, env) === false;
  });
  const afterRow: ModelPolicyRow = { ...input.config, weights: 'open' };
  for (const role of clearedRoles) afterRow[MODEL_ROLE_COLUMNS[role]] = null;
  const defaults = resolveGroupModels(target, afterRow, env);
  const keptRoles =
    target === input.provider ? MODEL_ROLES.filter((role) => keepsOpenModel(before, defaults, role, env)) : [];
  for (const role of keptRoles) afterRow[MODEL_ROLE_COLUMNS[role]] = before[role];
  const after = resolveGroupModels(target, afterRow, env);

  const blockers = [
    ...modelPolicyViolations(after, env),
    ...input.pinnedSessions
      .filter((s) => s.provider !== target)
      .map((s) => `session ${s.id} pins provider ${s.provider}: close it or clear its pin before the restart`),
  ];
  const providerChange = target !== input.provider ? target : null;
  const derivedImage = input.imageTag !== null && input.imageTag === derivedImageTag(input.imageBase, input.id);
  const rebuildsImage = providerChange !== null && derivedImage;
  if (providerChange !== null && input.imageTag && !derivedImage) {
    blockers.push(
      `image ${input.imageTag} is pinned and this install does not build it, so it may lack the ${providerChange} runtime: ` +
        `use an image that has it, or clear the pin with ncl groups update --id ${input.id} --image-tag ""`,
    );
  }
  const unchanged = before.weights === 'open' && !providerChange && clearedRoles.length === 0 && keptRoles.length === 0;

  const commands: string[] = [];
  if (!unchanged && blockers.length === 0) {
    if (providerChange) commands.push(`ncl groups update --id ${input.id} --agent-provider ${providerChange}`);
    const clears = clearedRoles.map((role) => ` ${ROLE_FLAGS[role]} ""`).join('');
    const keeps = keptRoles.map((role) => ` ${ROLE_FLAGS[role]} ${before[role]}`).join('');
    commands.push(`ncl groups config update --id ${input.id} --weights open${clears}${keeps}`);
    commands.push(`ncl groups restart --id ${input.id}${rebuildsImage ? ' --rebuild' : ''}`);
  }
  return {
    id: input.id,
    folder: input.folder,
    status: blockers.length > 0 ? 'blocked' : unchanged ? 'already-open' : 'migrate',
    before,
    after,
    closedRolesBefore,
    providerChange,
    clearedRoles,
    keptRoles,
    rebuildsImage,
    blockers,
    commands,
  };
}

/**
 * True when `role` resolves to an open model today, and `weights=open` alone
 * would replace it with another one. The role has no column of its own (a
 * column value would survive), so its model comes from the install setting.
 */
function keepsOpenModel(before: ResolvedModels, defaults: ResolvedModels, role: ModelRole, env: Env): boolean {
  return isOpenWeightsRole(before, role, env) === true && before[role] !== defaults[role];
}

/** Read every agent group, its container config and its pinned active sessions from the central DB. */
export async function loadMigrationInputs(): Promise<MigrationGroupInput[]> {
  const configs = new Map((await getAllContainerConfigs()).map((c) => [c.agent_group_id, c]));
  const pins = await getDb().all<{ id: string; agent_group_id: string; agent_provider: string }>(
    "SELECT id, agent_group_id, agent_provider FROM sessions WHERE status = 'active' AND agent_provider IS NOT NULL AND agent_provider != ''",
  );
  return (await getAllAgentGroups()).map((group) => {
    const config = configs.get(group.id);
    return {
      id: group.id,
      folder: group.folder,
      provider: resolveProviderName({
        override: undefined,
        session: undefined,
        group: group.agent_provider,
        config: config?.provider,
      }),
      config: config ?? {},
      imageTag: config?.image_tag || null,
      imageBase: CONTAINER_IMAGE_BASE,
      pinnedSessions: pins
        .filter((p) => p.agent_group_id === group.id)
        .map((p) => ({ id: p.id, provider: p.agent_provider.toLowerCase() })),
    };
  });
}
