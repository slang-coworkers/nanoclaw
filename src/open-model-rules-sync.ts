/**
 * Install the open-models-only rules for every open-weights group.
 *
 * The host writes these rules at spawn, but only when `NANOCLAW_SESSION_PRIVILEGE=enforce`. An install
 * that runs open-weights groups and keeps enforcement off has no rule at all, so a closed model is
 * refused by configuration only. `scripts/open-model-rules.ts` calls this module to close that gap
 * for the groups that exist now, and again after a group is added or moved to open weights.
 */
import type { MigrationGroupInput } from './open-weights-migration.js';

/** One group that must have the rules: its id is the name of its OneCLI agent. */
export interface OpenModelRuleTarget {
  id: string;
  folder: string;
}

/** What happened for one group. `unchanged` means the live rules were already right. */
export interface OpenModelRuleResult extends OpenModelRuleTarget {
  outcome: 'installed' | 'unchanged' | 'unsupported' | 'failed';
  /** The reason, for `failed` only. */
  error?: string;
}

/**
 * The groups that need the rules: `weights=open` on a provider that can run open models. A Claude
 * group cannot be open (its SDK and router call Claude), so a `weights=open` setting on one is a
 * mistake that `ncl groups config update` and the migration plan already refuse; a rule for it
 * would only cut it off from the model it must use.
 */
export function openModelRuleTargets(inputs: MigrationGroupInput[]): OpenModelRuleTarget[] {
  return inputs
    .filter((input) => input.config.weights === 'open' && input.provider !== 'claude')
    .map(({ id, folder }) => ({ id, folder }))
    .sort((a, b) => a.folder.localeCompare(b.folder));
}

/**
 * Run `ensure` for each target, one at a time, because every call publishes the whole draft and two
 * at once could publish each other's half-written one. One group's failure does not stop the others.
 */
export async function syncOpenModelRules(
  targets: OpenModelRuleTarget[],
  ensure: (identifier: string) => Promise<'installed' | 'unchanged' | 'unsupported'>,
): Promise<OpenModelRuleResult[]> {
  const results: OpenModelRuleResult[] = [];
  for (const target of targets) {
    try {
      results.push({ ...target, outcome: await ensure(target.id) });
    } catch (err) {
      results.push({ ...target, outcome: 'failed', error: (err as Error).message });
    }
  }
  return results;
}
