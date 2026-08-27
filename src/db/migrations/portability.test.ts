import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

import { migrations } from './index.js';

const FROZEN_SQLITE_ONLY = new Set([
  'initial-v2-schema',
  'chat-sdk-state',
  'pending-approvals',
  'agent-destinations',
  'agent-message-policies',
  'pending-approvals-title-options',
  'approvals-approver-user-id',
  'dropped-messages',
  'drop-pending-credentials',
  'engage-modes',
  'pending-sender-approvals',
  'channel-registration',
  'approval-render-metadata',
  'container-configs',
  'cli-scope',
  'messaging-group-instance',
  'wiring-threads-override',
  'container-config-timezone',
  'approval-question-render-metadata',
]);

const BANNED_PORTABLE_SQL = [
  /\bPRAGMA\b/i,
  /\bsqlite_master\b/i,
  /\bINSERT\s+OR\b/i,
  /\browid\b/i,
  /\bdatetime\s*\(/i,
  /\bstrftime\s*\(/i,
  /\bIS\s+\?/i,
];

/**
 * Comments are stripped before the banned-SQL scan. The policy governs SQL the
 * migration EXECUTES; a comment that names a SQLite-only construct in order to
 * explain why it is NOT used ("the portable form of the old sqlite_master
 * probe") documents compliance and must not be read as a violation.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

describe('central migration portability policy', () => {
  it('freezes SQLite-only status to the pre-boundary migration set', () => {
    const actual = migrations.filter((migration) => migration.sqliteOnly).map((migration) => migration.name);
    expect(new Set(actual)).toEqual(FROZEN_SQLITE_ONLY);
  });

  it('requires every post-boundary migration to be async and portable', () => {
    for (const migration of migrations.filter((candidate) => !candidate.sqliteOnly)) {
      expect(migration.up.constructor.name, migration.name).toBe('AsyncFunction');
      const source = stripComments(String(migration.up));
      for (const banned of BANNED_PORTABLE_SQL) expect(source, `${migration.name}: ${banned}`).not.toMatch(banned);
    }
  });

  /**
   * Upstream's anchor asserted two byte-exact lines in a STATIC registry
   * (`import { migration019 } … ` + its array entry). This fork resolves that
   * file to the dynamic `fs.readdirSync` loader on purpose — `create-nv-branch`
   * Pattern D: "Lego's dynamic loader is the better design — it auto-discovers
   * upstream's new migrations without registry edits. Take lego's version
   * entirely. Remove all static imports and the static array." So there is no
   * static import left to anchor on, and re-adding one to satisfy the old
   * assertion would reintroduce the merge conflict the loader exists to avoid.
   *
   * What the anchor was actually protecting is that a migration file dropped
   * into this directory is REACHED. Under auto-discovery that is a stronger
   * property and it is checkable directly: every `<version>-<slug>.ts` on disk
   * must appear in the loaded set.
   */
  it('discovers every migration file on disk', () => {
    // Matched on COUNT, not on name: a migration's `name` is its permanent
    // applied identity and deliberately need not match its filename
    // (`001-initial.ts` → 'initial-v2-schema'). One loaded migration per
    // migration file is what proves the loader skipped none.
    const onDisk = fs
      .readdirSync(new URL('.', import.meta.url))
      .filter((f) => /^(\d+|module)-.*\.ts$/.test(f) && !f.endsWith('.test.ts'));
    expect(migrations).toHaveLength(onDisk.length);
    expect(new Set(migrations.map((m) => m.name)).size, 'migration names must be unique').toBe(migrations.length);
  });
});
