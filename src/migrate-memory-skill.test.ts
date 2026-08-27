/**
 * `migrateClaudeMemorySettings` was dead code: correct, and never called. The
 * consequence was a split brain — the SDK child gets
 * `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` at runtime, so behaviour was right, while
 * every pre-existing group's `settings.json` still claimed auto-memory was on.
 * Anything reading the file to answer "is the native store off here?" got the
 * wrong answer.
 *
 * Wiring it is a two-part link — a script that calls it, and a `/migrate-memory`
 * step that runs the script — and either half can rot silently. A rename breaks
 * the skill's command with nothing going red; a dropped step revives the dead
 * code. These tests pin both halves and the ordering constraint that decides
 * WHERE the step goes.
 */
import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const SCRIPT_REL = 'scripts/migrate-claude-memory-settings.ts';
const SKILL = fs.readFileSync(path.join(ROOT, '.claude/skills/migrate-memory/SKILL.md'), 'utf-8');

describe('the CLI entry point', () => {
  it('exists at the path the skill invokes', () => {
    const cited = SKILL.match(/pnpm exec tsx (scripts\/[\w-]+\.ts)/);

    expect(cited).not.toBeNull();
    expect(cited![1]).toBe(SCRIPT_REL);
    expect(fs.existsSync(path.join(ROOT, cited![1]))).toBe(true);
  });

  // The whole point of the wiring: the function must actually be reached.
  it('calls migrateClaudeMemorySettings', () => {
    const script = fs.readFileSync(path.join(ROOT, SCRIPT_REL), 'utf-8');

    expect(script).toMatch(/from '\.\.\/src\/migrate-claude-memory-settings\.js'/);
    expect(script).toMatch(/migrateClaudeMemorySettings\(file\)/);
  });

  // Editing one group's settings file must not require opening the central DB.
  // A `--all` variant did, and on a fresh data dir `initDb` CREATED `data/v2.db`
  // and then threw an uncaught `no such table: agent_groups`. The skill already
  // enumerates groups with `ncl groups list`, so the DB buys nothing here.
  it('touches no central DB', () => {
    const script = fs.readFileSync(path.join(ROOT, SCRIPT_REL), 'utf-8');

    expect(script).not.toMatch(/initDb|getDb|CENTRAL_DB_PATH|agent_groups/);
  });

  // Same derivation as `claudeDir` in container-runner.ts. A drift here writes
  // the flags into a path no container ever mounts — silently a no-op.
  it('derives the settings path the container actually mounts', () => {
    const script = fs.readFileSync(path.join(ROOT, SCRIPT_REL), 'utf-8');
    const runner = fs.readFileSync(path.join(ROOT, 'src/container-runner.ts'), 'utf-8');

    const segments = /'v2-sessions', *\w+(?:\.id)?, *'\.claude-shared'/;
    expect(script).toMatch(segments);
    expect(runner).toMatch(segments);
  });
});

describe('the skill step', () => {
  it('runs the migration for the group being migrated', () => {
    expect(SKILL).toMatch(/pnpm exec tsx scripts\/migrate-claude-memory-settings\.ts --group <group-id>/);
  });

  // Ordering is the reason this is a skill step and not a startup migration:
  // flipping the switches before the native store is staged strands those
  // memories — the CLI stops loading them and there is nothing left to import.
  it('comes after the native store has been staged, not before', () => {
    const stagedAt = SKILL.indexOf('imported-claude-auto-memory');
    const migrateAt = SKILL.indexOf('scripts/migrate-claude-memory-settings.ts');

    expect(stagedAt).toBeGreaterThan(-1);
    expect(migrateAt).toBeGreaterThan(stagedAt);
  });

  it('states the ordering constraint so a reader does not move the step', () => {
    expect(SKILL.replace(/\s+/g, ' ')).toMatch(/Order matters.*not a startup migration/i);
  });

  it('is verified in the verification section', () => {
    const verify = SKILL.slice(SKILL.indexOf('## 5. Verify and rollback'));

    expect(verify).toMatch(/autoMemoryEnabled: false/);
    expect(verify).toMatch(/CLAUDE_CODE_DISABLE_AUTO_MEMORY/);
  });
});

describe('startup stays free of it', () => {
  // The skill's own verification requires "no automatic migration occurred
  // during an ordinary restart". A boot-time call would make that bullet false.
  it('is not invoked from the host entry point', () => {
    const index = fs.readFileSync(path.join(ROOT, 'src/index.ts'), 'utf-8');

    expect(index).not.toMatch(/migrateClaudeMemorySettings/);
  });

  it('keeps the no-automatic-migration guarantee it depends on', () => {
    expect(SKILL).toMatch(/no automatic migration occurred during an ordinary restart/);
  });
});
