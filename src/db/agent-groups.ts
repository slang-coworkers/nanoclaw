import type { AgentGroup } from '../types.js';
import { getDb } from './connection.js';

export async function createAgentGroup(
  group: Partial<AgentGroup> & Pick<AgentGroup, 'id' | 'name' | 'folder' | 'created_at'>,
): Promise<void> {
  await getDb().run(
    `INSERT INTO agent_groups (id, name, folder, is_admin, agent_provider, container_config, coworker_type, allowed_mcp_tools, overlays, routing, sidebar_group, created_at)
     VALUES (@id, @name, @folder, @is_admin, @agent_provider, @container_config, @coworker_type, @allowed_mcp_tools, @overlays, @routing, @sidebar_group, @created_at)`,
    {
      is_admin: 0,
      agent_provider: null,
      container_config: null,
      coworker_type: null,
      allowed_mcp_tools: null,
      overlays: null,
      routing: 'direct',
      sidebar_group: null,
      ...group,
    },
  );
}

export async function getAgentGroup(id: string): Promise<AgentGroup | undefined> {
  return getDb().get<AgentGroup>('SELECT * FROM agent_groups WHERE id = ?', id);
}

export async function getAgentGroupByFolder(folder: string): Promise<AgentGroup | undefined> {
  return getDb().get<AgentGroup>('SELECT * FROM agent_groups WHERE folder = ?', folder);
}

export async function getAllAgentGroups(): Promise<AgentGroup[]> {
  return getDb().all<AgentGroup>('SELECT * FROM agent_groups ORDER BY name');
}

export async function getAdminAgentGroup(): Promise<AgentGroup | undefined> {
  return getDb().get<AgentGroup>('SELECT * FROM agent_groups WHERE is_admin = 1 LIMIT 1');
}

export async function updateAgentGroup(
  id: string,
  updates: Partial<
    Pick<
      AgentGroup,
      'name' | 'agent_provider' | 'container_config' | 'coworker_type' | 'allowed_mcp_tools' | 'overlays' | 'paused'
    >
  >,
): Promise<void> {
  const fields: string[] = [];
  const values: Record<string, unknown> = { id };

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      fields.push(`${key} = @${key}`);
      values[key] = value;
    }
  }
  if (fields.length === 0) return;

  await getDb().run(`UPDATE agent_groups SET ${fields.join(', ')} WHERE id = @id`, values);
}

export async function deleteAgentGroup(id: string): Promise<void> {
  await getDb().run('DELETE FROM agent_groups WHERE id = ?', id);
}
