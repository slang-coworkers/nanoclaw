/**
 * The startup check of the install default: the provider and weights of every
 * group that names none of its own (installDefaultProvider /
 * installDefaultWeights in src/model-policy.ts).
 *
 * The host refuses to start when NANOCLAW_DEFAULT_WEIGHTS holds a value other
 * than "any" or "open", because every spawn of a group that follows the default
 * would throw on it. It logs an error when the default itself breaks the model
 * policy (for example DEFAULT_AGENT_PROVIDER=claude with
 * NANOCLAW_DEFAULT_WEIGHTS=open), because each group that follows the default
 * would then fail at its next spawn. It logs the default and the groups that
 * follow it, so an operator sees which groups move when the default changes.
 */
import { getAllAgentGroups } from './db/agent-groups.js';
import { getAllContainerConfigs } from './db/container-configs.js';
import { log } from './log.js';
import {
  installDefaultProvider,
  installDefaultWeights,
  modelPolicyViolations,
  resolveGroupModels,
} from './model-policy.js';

type Env = Readonly<Record<string, string | undefined>>;

export interface InstallDefaultReport {
  provider: string;
  weights: 'any' | 'open';
  /** Policy problems of a group that follows the default; empty when it may run. */
  problems: string[];
  /** Folders of groups whose provider comes from the default (no group or config provider). */
  providerFollowers: string[];
  /** Folders of groups whose weights come from the default (empty `weights`). */
  weightsFollowers: string[];
}

/** Resolve the install default and find the groups that follow it. Throws on an invalid setting. */
export async function inspectInstallDefault(env: Env = process.env): Promise<InstallDefaultReport> {
  const weights = installDefaultWeights(env);
  const provider = installDefaultProvider(env);
  const problems = modelPolicyViolations(resolveGroupModels(provider, {}, env), env);
  const configs = new Map((await getAllContainerConfigs()).map((c) => [c.agent_group_id, c]));
  const providerFollowers: string[] = [];
  const weightsFollowers: string[] = [];
  for (const group of await getAllAgentGroups()) {
    const config = configs.get(group.id);
    if (!group.agent_provider && !config?.provider) providerFollowers.push(group.folder);
    if (!config?.weights) weightsFollowers.push(group.folder);
  }
  return { provider, weights, problems, providerFollowers, weightsFollowers };
}

/** Run the check at host start: throw on an invalid setting, log the rest. */
export async function checkInstallDefault(env: Env = process.env): Promise<void> {
  const report = await inspectInstallDefault(env);
  const fields = {
    provider: report.provider,
    weights: report.weights,
    providerFollowers: report.providerFollowers,
    weightsFollowers: report.weightsFollowers,
  };
  if (report.problems.length > 0) {
    log.error(
      'The install default breaks the model policy: every group that follows it will fail at spawn. ' +
        'Set NANOCLAW_DEFAULT_WEIGHTS or DEFAULT_AGENT_PROVIDER in .env so they agree.',
      { ...fields, problems: report.problems },
    );
    return;
  }
  log.info('Install default provider and weights', fields);
}
