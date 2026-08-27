import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { backfillAgentsSymlinks } from './agents-symlink-backfill.js';

let tmpRoot: string;
let groupsDir: string;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-backfill-'));
  groupsDir = path.join(tmpRoot, 'groups');
  fs.mkdirSync(groupsDir);
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function makeGroup(name: string, opts: { withClaude?: boolean } = {}): string {
  const dir = path.join(groupsDir, name);
  fs.mkdirSync(dir);
  if (opts.withClaude !== false) {
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '# placeholder\n');
  }
  return dir;
}

describe('backfillAgentsSymlinks', () => {
  it('creates AGENTS.md → CLAUDE.md and .agents → /home/node/.claude for groups missing them', () => {
    const dir = makeGroup('main');

    const result = backfillAgentsSymlinks(tmpRoot);

    expect(result.scanned).toBe(1);
    expect(result.symlinkedAgentsMd).toBe(1);
    expect(result.symlinkedAgentsDir).toBe(1);
    expect(fs.readlinkSync(path.join(dir, 'AGENTS.md'))).toBe('CLAUDE.md');
    expect(fs.readlinkSync(path.join(dir, '.agents'))).toBe('/home/node/.claude');
  });

  it('is idempotent — second run creates nothing new and does not error', () => {
    makeGroup('main');
    backfillAgentsSymlinks(tmpRoot);
    const second = backfillAgentsSymlinks(tmpRoot);

    expect(second.scanned).toBe(1);
    expect(second.symlinkedAgentsMd).toBe(0);
    expect(second.symlinkedAgentsDir).toBe(0);
  });

  it('skips a group dir without CLAUDE.md (uninitialized scratch dir)', () => {
    const dir = makeGroup('halfbaked', { withClaude: false });

    const result = backfillAgentsSymlinks(tmpRoot);

    expect(result.scanned).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.symlinkedAgentsMd).toBe(0);
    expect(fs.existsSync(path.join(dir, 'AGENTS.md'))).toBe(false);
  });

  it('does not overwrite a pre-existing real AGENTS.md file', () => {
    const dir = makeGroup('upstream-style');
    // Some upstream repos (e.g. slang) ship their own AGENTS.md as a real file.
    // Backfill must leave it alone.
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# upstream-owned content\n');

    const result = backfillAgentsSymlinks(tmpRoot);

    expect(result.symlinkedAgentsMd).toBe(0);
    expect(fs.lstatSync(path.join(dir, 'AGENTS.md')).isSymbolicLink()).toBe(false);
    expect(fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf-8')).toContain('upstream-owned');
  });

  it('does not touch a pre-existing .agents directory or symlink', () => {
    const dir = makeGroup('preset');
    // Pretend a previous run already linked it elsewhere — leave it.
    fs.symlinkSync('/some/other/target', path.join(dir, '.agents'));

    const result = backfillAgentsSymlinks(tmpRoot);

    expect(result.symlinkedAgentsDir).toBe(0);
    expect(fs.readlinkSync(path.join(dir, '.agents'))).toBe('/some/other/target');
  });

  it('returns zero counts when groups/ does not exist', () => {
    fs.rmSync(groupsDir, { recursive: true });
    const result = backfillAgentsSymlinks(tmpRoot);
    expect(result.scanned).toBe(0);
    expect(result.symlinkedAgentsMd).toBe(0);
    expect(result.symlinkedAgentsDir).toBe(0);
  });

  it('handles many groups in one pass', () => {
    for (const n of ['a', 'b', 'c', 'd']) makeGroup(n);

    const result = backfillAgentsSymlinks(tmpRoot);

    expect(result.scanned).toBe(4);
    expect(result.symlinkedAgentsMd).toBe(4);
    expect(result.symlinkedAgentsDir).toBe(4);
  });
});
