/**
 * Contract tests for scripts/mirror-skills.mjs.
 *
 * The host's spawn-time sync (`syncSharedSkillLinks`, src/provider-contracts/
 * realize.ts) accepts one shape for a shared skill under
 * `.claude-shared/skills/`: a symlink, which it plants as `/app/skills/<skill>`.
 * Anything else is logged as "Shared skill not symlinked" on every spawn. These
 * tests pin the script to that shape, including the conversion of the real
 * directory copies an earlier revision of the script left behind, and the
 * template-owned directories it must never touch.
 *
 * Nothing is mocked: the script runs as a child process against a throwaway
 * checkout layout, exactly as the hourly cron runs it.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT = path.resolve(import.meta.dirname, 'mirror-skills.mjs');

let root: string;

function write(rel: string, content = ''): void {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function run(...args: string[]): { stdout: string; stderr: string; status: number | null } {
  const result = spawnSync(process.execPath, [SCRIPT, '--root', root, ...args], { encoding: 'utf8' });
  return { stdout: result.stdout, stderr: result.stderr, status: result.status };
}

function skillEntry(groupId: string, skill: string): string {
  return path.join(root, 'data', 'v2-sessions', groupId, '.claude-shared', 'skills', skill);
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'nanoclaw-mirror-skills-'));
  write('container/skills/alpha/SKILL.md', '# alpha');
  write('container/skills/beta/SKILL.md', '# beta');
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('scripts/mirror-skills.mjs', () => {
  it('plants the symlink the host sync expects for a group with no skills yet', () => {
    fs.mkdirSync(path.join(root, 'data', 'v2-sessions', 'g1', '.claude-shared'), { recursive: true });

    const result = run();

    expect(result.status, result.stderr).toBe(0);
    for (const skill of ['alpha', 'beta']) {
      const entry = skillEntry('g1', skill);
      expect(fs.lstatSync(entry).isSymbolicLink()).toBe(true);
      // Dangling on the host, valid inside the container — the same target the
      // host's own sync plants.
      expect(fs.readlinkSync(entry)).toBe(`/app/skills/${skill}`);
    }
    expect(result.stdout).toContain('g1: skills/alpha linked');
    expect(result.stdout).toContain('2 change(s) across 1 group(s)');
  });

  it('replaces a real-directory copy of a shared skill with the symlink', () => {
    write('data/v2-sessions/g1/.claude-shared/skills/alpha/SKILL.md', '# stale copy');
    write('data/v2-sessions/g1/.claude-shared/skills/alpha/nested/extra.md', 'leftover');

    const result = run();

    expect(result.status, result.stderr).toBe(0);
    const entry = skillEntry('g1', 'alpha');
    expect(fs.lstatSync(entry).isSymbolicLink()).toBe(true);
    expect(fs.readlinkSync(entry)).toBe('/app/skills/alpha');
    expect(result.stdout).toContain('g1: skills/alpha replaced copy with link');
  });

  it('is idempotent: an existing symlink is left alone and a second run changes nothing', () => {
    fs.mkdirSync(path.join(root, 'data', 'v2-sessions', 'g1', '.claude-shared', 'skills'), { recursive: true });
    // A link with a non-canonical target is still the accepted shape; the host
    // sync does not rewrite it and neither does the script.
    fs.symlinkSync('/elsewhere/alpha', skillEntry('g1', 'alpha'));

    expect(run().status).toBe(0);
    expect(fs.readlinkSync(skillEntry('g1', 'alpha'))).toBe('/elsewhere/alpha');

    const second = run();
    expect(second.status, second.stderr).toBe(0);
    expect(second.stdout).toContain('0 change(s) across 0 group(s)');
  });

  it('leaves a template-stamped skill directory in place', () => {
    write('container/skills/gamma/SKILL.md', '# catalog gamma');
    write('groups/some-template/plugins/p/skills/gamma/SKILL.md', '# template gamma');
    write('data/v2-sessions/g1/.claude-shared/skills/gamma/SKILL.md', '# stamped into g1');

    const result = run();

    expect(result.status, result.stderr).toBe(0);
    const entry = skillEntry('g1', 'gamma');
    expect(fs.lstatSync(entry).isDirectory()).toBe(true);
    expect(fs.readFileSync(path.join(entry, 'SKILL.md'), 'utf8')).toBe('# stamped into g1');
    expect(result.stdout).toContain('g1: skills/gamma is template-owned — left alone');
    // The other catalog skills are still linked.
    expect(fs.lstatSync(skillEntry('g1', 'alpha')).isSymbolicLink()).toBe(true);
  });

  it('refuses to write through a skills directory that is itself a symlink', () => {
    const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), 'nanoclaw-mirror-elsewhere-'));
    try {
      fs.mkdirSync(path.join(root, 'data', 'v2-sessions', 'g1', '.claude-shared'), { recursive: true });
      fs.symlinkSync(elsewhere, path.join(root, 'data', 'v2-sessions', 'g1', '.claude-shared', 'skills'));

      const result = run();

      expect(result.status, result.stderr).toBe(0);
      expect(fs.readdirSync(elsewhere)).toEqual([]);
      expect(result.stdout).toContain('g1: skills/ is a symlink — left alone');
    } finally {
      fs.rmSync(elsewhere, { recursive: true, force: true });
    }
  });

  it('reports without touching anything under --dry-run', () => {
    write('data/v2-sessions/g1/.claude-shared/skills/alpha/SKILL.md', '# stale copy');

    const result = run('--dry-run');

    expect(result.status, result.stderr).toBe(0);
    expect(fs.lstatSync(skillEntry('g1', 'alpha')).isDirectory()).toBe(true);
    expect(fs.existsSync(skillEntry('g1', 'beta'))).toBe(false);
    expect(result.stdout).toContain('g1: skills/alpha would replace copy with link');
    expect(result.stdout).toContain('g1: skills/beta would link');
    expect(result.stdout).toContain('Mirror (dry-run)');
  });

  it('still copies a skill-shipped agent.md into agents/ by mtime', () => {
    write('container/skills/alpha/agent.md', '# subagent v1');
    fs.mkdirSync(path.join(root, 'data', 'v2-sessions', 'g1', '.claude-shared'), { recursive: true });

    expect(run().status).toBe(0);
    const agentDst = path.join(root, 'data', 'v2-sessions', 'g1', '.claude-shared', 'agents', 'alpha.md');
    expect(fs.readFileSync(agentDst, 'utf8')).toBe('# subagent v1');

    // Same mtime or older upstream: no re-copy.
    const second = run();
    expect(second.stdout).toContain('0 change(s)');

    // Newer upstream: refreshed.
    const future = new Date(Date.now() + 60_000);
    write('container/skills/alpha/agent.md', '# subagent v2');
    fs.utimesSync(path.join(root, 'container', 'skills', 'alpha', 'agent.md'), future, future);
    const third = run();
    expect(third.stdout).toContain('g1: agents/alpha.md refreshed');
    expect(fs.readFileSync(agentDst, 'utf8')).toBe('# subagent v2');
  });
});
