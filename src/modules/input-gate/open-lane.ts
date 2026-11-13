import { getAgentGroupByFolder } from '../../db/agent-groups.js';
import { getContainerConfig } from '../../db/container-configs.js';
import { modelPolicyViolations, resolveGroupModels } from '../../model-policy.js';
import { resolveProviderName } from '../../providers/provider-name.js';

/**
 * The open-weights lane: one coworker that takes the work of a person who
 * passes Check 1 but fails Check 2.
 *
 * Check 2 is the closed-model access policy. Its identity, entity and location
 * rules come from the terms of closed-weights models (Claude, GPT); open-weights
 * models (GLM, Kimi, DeepSeek on NVIDIA inference) carry no such terms. So the
 * work of a person who fails Check 2 may still run, provided it runs on
 * open-weights models only, and the lane is the coworker that guarantees it.
 */
export type OpenLane =
  | { status: 'unset' }
  | { status: 'ready'; folder: string; agentGroupId: string }
  | { status: 'invalid'; folder: string; problem: string };

/**
 * Resolve the lane from its agent group folder (NANOCLAW_INPUT_GATE_OPEN_LANE).
 *
 * The group's models resolve as spawn resolves them for a fresh session, which
 * has no provider pin: the group's provider tiers, then the model policy on its
 * container config. The lane is ready only when the group is `weights=open` and
 * every role resolves to an open-weights model. Spawn refuses a `weights=open`
 * group that would call a closed model, so a ready lane cannot start on one.
 * Consider an OpenCode group left at `weights=any`: its critic resolves to the
 * install's GPT default, so it is invalid, and the person stays `not_eligible`.
 */
export async function resolveOpenLane(folder: string | null): Promise<OpenLane> {
  if (!folder) return { status: 'unset' };
  const group = await getAgentGroupByFolder(folder);
  if (!group) return { status: 'invalid', folder, problem: 'no agent group has this folder' };
  const config = await getContainerConfig(group.id);
  const provider = resolveProviderName({
    override: undefined,
    session: undefined,
    group: group.agent_provider,
    config: config?.provider,
  });
  const models = resolveGroupModels(provider, config ?? {});
  if (models.weights !== 'open') return { status: 'invalid', folder, problem: 'the group is not weights=open' };
  const problems = modelPolicyViolations(models);
  if (problems.length > 0) return { status: 'invalid', folder, problem: problems.join('; ') };
  return { status: 'ready', folder, agentGroupId: group.id };
}
