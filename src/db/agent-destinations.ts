/**
 * Per-agent destination map + ACL.
 *
 * Each row means: agent `agent_group_id` is allowed to send messages to
 * target (`target_type`, `target_id`), and refers to it locally as `local_name`.
 *
 * Names are local to each source agent — they exist only inside that agent's
 * namespace. The host uses this table both for routing (resolve name → ID)
 * and for permission checks (row exists ⇒ authorized).
 */
import type { AgentDestination } from '../types.js';
import { getDb } from './connection.js';

export function createDestination(row: AgentDestination): void {
  getDb()
    .prepare(
      `INSERT INTO agent_destinations (agent_group_id, local_name, target_type, target_id, created_at)
       VALUES (@agent_group_id, @local_name, @target_type, @target_id, @created_at)`,
    )
    .run(row);
}

export function getDestinations(agentGroupId: string): AgentDestination[] {
  return getDb()
    .prepare('SELECT * FROM agent_destinations WHERE agent_group_id = ?')
    .all(agentGroupId) as AgentDestination[];
}

export function getDestinationByName(agentGroupId: string, localName: string): AgentDestination | undefined {
  return getDb()
    .prepare('SELECT * FROM agent_destinations WHERE agent_group_id = ? AND local_name = ?')
    .get(agentGroupId, localName) as AgentDestination | undefined;
}

/** Reverse lookup: what does this agent call the given target? */
export function getDestinationByTarget(
  agentGroupId: string,
  targetType: 'channel' | 'agent',
  targetId: string,
): AgentDestination | undefined {
  return getDb()
    .prepare('SELECT * FROM agent_destinations WHERE agent_group_id = ? AND target_type = ? AND target_id = ?')
    .get(agentGroupId, targetType, targetId) as AgentDestination | undefined;
}

/** Permission check: can this agent send to this target? */
export function hasDestination(agentGroupId: string, targetType: 'channel' | 'agent', targetId: string): boolean {
  const row = getDb()
    .prepare('SELECT 1 FROM agent_destinations WHERE agent_group_id = ? AND target_type = ? AND target_id = ? LIMIT 1')
    .get(agentGroupId, targetType, targetId);
  return !!row;
}

export function deleteDestination(agentGroupId: string, localName: string): void {
  getDb()
    .prepare('DELETE FROM agent_destinations WHERE agent_group_id = ? AND local_name = ?')
    .run(agentGroupId, localName);
}

/** Normalize a human-readable name into a lowercase, dash-separated identifier. */
export function normalizeName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'unnamed'
  );
}

/**
 * Allocate a local destination name inside one agent namespace.
 * Uses the canonical v2 rule: normalize first, then suffix on collision.
 */
export function allocateDestinationName(agentGroupId: string, preferredName: string): string {
  const baseLocalName = normalizeName(preferredName);
  let localName = baseLocalName;
  let suffix = 2;
  while (getDestinationByName(agentGroupId, localName)) {
    localName = `${baseLocalName}-${suffix}`;
    suffix++;
  }
  return localName;
}
