import { addColumnIfMissing } from './column-guard.js';
import type { Migration } from './index.js';

/**
 * Sidebar grouping dimension for the dashboard coworker list.
 *
 * `sidebar_group`:
 *   NULL or 'prod' — the shared "prod" group (default for all existing
 *                    coworkers; no behavior change on upgrade).
 *   any other value — a user id (e.g. "dashboard:user1"). The coworker is
 *                     grouped under that user in the dashboard sidebar.
 *
 * Additive and non-destructive — display-only; does not affect routing or
 * access control. Idempotent so it is safe under the merged deployment
 * schema where other branches may already have added the column.
 */
export const migration928: Migration = {
  version: 928,
  name: 'sidebar-group',
  async up(db) {
    await addColumnIfMissing(db, 'agent_groups', 'sidebar_group TEXT');
  },
};
