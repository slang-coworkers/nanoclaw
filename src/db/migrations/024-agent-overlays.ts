import type { Migration } from './index.js';

export const migration024: Migration = {
  version: 24,
  name: 'agent-overlays',
  dependsOn: ['disable-overlays'],
  up(db) {
    const hasCol = (
      db
        .prepare("SELECT count(*) as c FROM pragma_table_info('agent_groups') WHERE name = 'overlays'")
        .get() as { c: number }
    ).c;
    if (!hasCol) {
      db.exec(`ALTER TABLE agent_groups ADD COLUMN overlays TEXT`);
    }

    // Backfill: variant types that existed solely to add overlays are being
    // removed from coworker-types.yaml. Migrate any agents using them to
    // their parent type and persist the overlay in the new column.
    const variantMigrations: { from: string; to: string; overlays: string[] }[] = [
      { from: 'slang-triage-buddy', to: 'slang-triage', overlays: ['critique-overlay', 'buddy-monitor'] },
      { from: 'slang-fixer-buddy', to: 'slang-fixer', overlays: ['critique-overlay', 'buddy-monitor'] },
      { from: 'slang-discord-critiqued', to: 'slang-discord', overlays: ['critique-overlay', 'discord-answer-critique'] },
      { from: 'slang-discord-buddy', to: 'slang-discord', overlays: ['critique-overlay', 'buddy-monitor'] },
    ];

    for (const { from, to, overlays } of variantMigrations) {
      db.prepare(
        'UPDATE agent_groups SET coworker_type = ?, overlays = ? WHERE coworker_type = ?',
      ).run(to, JSON.stringify(overlays), from);
    }

    // Backfill types that inherited overlays from *-common parents.
    // Any agent whose type inherited critique-overlay (all slang-*, slangpy-*,
    // nanoclaw-* types) and doesn't already have overlays set gets it backfilled.
    const rows = db.prepare(
      "SELECT folder, coworker_type FROM agent_groups WHERE overlays IS NULL AND coworker_type IS NOT NULL AND coworker_type != 'main' AND coworker_type != 'default'",
    ).all() as { folder: string; coworker_type: string }[];

    for (const row of rows) {
      const type = row.coworker_type;
      if (type.startsWith('slang') || type.startsWith('nanoclaw') || type.startsWith('slangpy')) {
        db.prepare('UPDATE agent_groups SET overlays = ? WHERE folder = ?').run(
          JSON.stringify(['critique-overlay']),
          row.folder,
        );
      }
    }
  },
};
