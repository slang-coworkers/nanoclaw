import type { Migration } from './index.js';

/**
 * Add coworker fields to agent_groups — coworker_type for manifest-driven
 * CLAUDE.md composition + role templates, and allowed_mcp_tools for
 * per-agent MCP tool filtering (JSON array of tool names).
 */
export const migration006: Migration = {
  version: 6,
  name: 'coworker-fields',
  up(db) {
    db.exec(`
      ALTER TABLE agent_groups ADD COLUMN coworker_type TEXT;
      ALTER TABLE agent_groups ADD COLUMN allowed_mcp_tools TEXT;
    `);
  },
};
