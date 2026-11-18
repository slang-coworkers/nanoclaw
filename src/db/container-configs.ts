import { creationWeights, type ModelWeights } from '../model-policy.js';
import type { ContainerConfigRow } from '../types.js';
import { getDb } from './connection.js';

const SCALAR_COLUMNS = new Set([
  'provider',
  'model',
  'effort',
  'image_tag',
  'assistant_name',
  'max_messages_per_prompt',
  'cli_scope',
  'timezone',
  'speed',
  'small_model',
  'router_model',
  'critic_model',
  'weights',
]);
const JSON_COLUMNS = new Set(['skills', 'mcp_servers', 'packages_apt', 'packages_npm', 'additional_mounts']);

export async function getContainerConfig(agentGroupId: string): Promise<ContainerConfigRow | undefined> {
  return getDb().get<ContainerConfigRow>('SELECT * FROM container_configs WHERE agent_group_id = ?', agentGroupId);
}

export async function getAllContainerConfigs(): Promise<ContainerConfigRow[]> {
  return getDb().all<ContainerConfigRow>('SELECT * FROM container_configs');
}

/** Insert a new config row. Caller must supply all JSON fields (use defaults for empty). */
export async function createContainerConfig(config: ContainerConfigRow): Promise<void> {
  await getDb().run(
    `INSERT INTO container_configs (
        agent_group_id, provider, model, effort, image_tag, assistant_name,
        max_messages_per_prompt, skills, mcp_servers, packages_apt, packages_npm,
        additional_mounts, cli_scope, timezone, speed, weights, updated_at
      ) VALUES (
        @agent_group_id, @provider, @model, @effort, @image_tag, @assistant_name,
        @max_messages_per_prompt, @skills, @mcp_servers, @packages_apt, @packages_npm,
        @additional_mounts, @cli_scope, @timezone, @speed, @weights, @updated_at
      )`,
    { weights: null, ...config },
  );
}

/**
 * Create a config row if one doesn't exist. Idempotent: an existing row is
 * never touched, so this never changes the provider or weights of a group that
 * already has a row.
 *
 * `provider` is the creator's explicit pick (a subagent's parent provider, the
 * operator's pick at setup), stored as given, Claude included. Without a pick
 * the column stays empty and the group follows the install default
 * (installDefaultProvider) at every spawn. `weights` works the same way. When
 * the creator names no weights, a group whose named provider is Claude records
 * `any` (creationWeights), because Claude runs Claude models only and would
 * fail an open install default at its first spawn. The named provider is the
 * one the group will run on: its own `agent_groups.agent_provider`, which
 * outranks this row, else the pick.
 *
 * Consider `ncl groups create --agent-provider claude` on an install with the
 * open default: the group row says claude, so this row gets weights `any`, and
 * the group starts on Claude. A group created with no provider gets an empty
 * row and starts on OpenCode with open-weights models.
 */
export async function ensureContainerConfig(
  agentGroupId: string,
  provider?: string | null,
  weights?: ModelWeights | null,
): Promise<void> {
  const pick = provider ? provider.toLowerCase() : null;
  const group = await getDb().get<{ agent_provider: string | null }>(
    'SELECT agent_provider FROM agent_groups WHERE id = ?',
    agentGroupId,
  );
  await getDb().run(
    `INSERT INTO container_configs (agent_group_id, provider, weights, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (agent_group_id) DO NOTHING`,
    agentGroupId,
    pick,
    weights ?? creationWeights(group?.agent_provider || pick),
    new Date().toISOString(),
  );
}

/** Update scalar fields on a config row. Only touches fields present in `updates`. */
export async function updateContainerConfigScalars(
  agentGroupId: string,
  updates: Partial<
    Pick<
      ContainerConfigRow,
      | 'provider'
      | 'model'
      | 'effort'
      | 'image_tag'
      | 'assistant_name'
      | 'max_messages_per_prompt'
      | 'cli_scope'
      | 'timezone'
      | 'speed'
      | 'small_model'
      | 'router_model'
      | 'critic_model'
      | 'weights'
    >
  >,
): Promise<void> {
  const fields: string[] = [];
  const values: Record<string, unknown> = { agent_group_id: agentGroupId };

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      if (!SCALAR_COLUMNS.has(key)) throw new Error(`Invalid scalar column: ${key}`);
      fields.push(`${key} = @${key}`);
      values[key] = value;
    }
  }
  if (fields.length === 0) return;

  fields.push('updated_at = @updated_at');
  values.updated_at = new Date().toISOString();

  await getDb().run(`UPDATE container_configs SET ${fields.join(', ')} WHERE agent_group_id = @agent_group_id`, values);
}

/** Overwrite a JSON column wholesale. Used for skills, mcp_servers, packages_*, additional_mounts. */
export async function updateContainerConfigJson(
  agentGroupId: string,
  column: 'skills' | 'mcp_servers' | 'packages_apt' | 'packages_npm' | 'additional_mounts',
  value: unknown,
): Promise<void> {
  if (!JSON_COLUMNS.has(column)) throw new Error(`Invalid JSON column: ${column}`);
  const now = new Date().toISOString();
  await getDb().run(
    `UPDATE container_configs SET ${column} = ?, updated_at = ? WHERE agent_group_id = ?`,
    JSON.stringify(value),
    now,
    agentGroupId,
  );
}

export async function deleteContainerConfig(agentGroupId: string): Promise<void> {
  await getDb().run('DELETE FROM container_configs WHERE agent_group_id = ?', agentGroupId);
}
