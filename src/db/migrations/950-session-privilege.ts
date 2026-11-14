import type { Migration } from './index.js';

/**
 * `sessions.privilege` (src/modules/session-privilege): "open" sessions run
 * open-weights models only, "closed" sessions may run closed models. A session
 * keeps its privilege for life; a message of the other privilege goes to a
 * second session on the same thread. Existing rows become open, which matches
 * what routing asks for while NANOCLAW_SESSION_PRIVILEGE is off.
 */
export const migration950: Migration = {
  version: 950,
  name: 'session-privilege',
  async up(db) {
    await db.exec(`
      ALTER TABLE sessions ADD COLUMN privilege TEXT NOT NULL DEFAULT 'open';
      CREATE INDEX IF NOT EXISTS idx_sessions_agent_thread_privilege ON sessions(agent_group_id, thread_id, privilege);
    `);
  },
};
