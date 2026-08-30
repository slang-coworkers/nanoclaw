import { addColumnIfMissing } from './column-guard.js';
import type { Migration } from './index.js';

/**
 * Add coworker fields to agent_groups:
 *   - is_admin (INTEGER, 0|1) — privilege flag for admin agent groups
 *   - container_config (TEXT, JSON) — per-agent container overrides
 *   - coworker_type (TEXT) — manifest-driven CLAUDE.md composition + role templates
 *   - allowed_mcp_tools (TEXT, JSON) — per-agent MCP tool filtering
 */
export const migration006: Migration = {
  version: 6,
  name: 'coworker-fields',
  async up(db) {
    // One ALTER per column rather than a single multi-statement exec: the
    // batch aborted partway on any column that already existed, leaving the
    // rest unapplied. addColumnIfMissing makes each independently idempotent.
    await addColumnIfMissing(db, 'agent_groups', 'is_admin INTEGER NOT NULL DEFAULT 0');
    await addColumnIfMissing(db, 'agent_groups', 'container_config TEXT');
    await addColumnIfMissing(db, 'agent_groups', 'coworker_type TEXT');
    await addColumnIfMissing(db, 'agent_groups', 'allowed_mcp_tools TEXT');
  },
};
