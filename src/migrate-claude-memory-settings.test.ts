/**
 * `migrateClaudeMemorySettings` reconciles an EXISTING group's Claude settings
 * with NanoClaw's memory model. New groups get the right settings at scaffold
 * (`group-init.ts`); groups created before that keep whatever they had.
 *
 * It had no caller and no test. The consequence was a split brain: the SDK child
 * receives `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` at runtime (claude.ts), so
 * behaviour is right, while the group's `settings.json` still claims auto-memory
 * is enabled. Anything reading the file to answer "is native memory off here?"
 * — an operator, a provider switch, a future migration — gets the wrong answer.
 *
 * Ordering matters and is the reason this is NOT a boot-time migration: flipping
 * the flags before `/migrate-memory` has copied the native store into OKF would
 * strand those memories. The skill's own verification step even requires that "no
 * automatic migration occurred during an ordinary restart".
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { migrateClaudeMemorySettings } from './migrate-claude-memory-settings.js';

let dir: string;
let settingsFile: string;

const PRE_COMPACT = 'bun /app/src/compact-instructions.ts';
const LEGACY_HOOK = 'bun /app/src/memory-hook.ts';

function write(settings: unknown): void {
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + '\n');
}

function read(): Record<string, never> {
  return JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mem-settings-'));
  settingsFile = path.join(dir, 'settings.json');
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('migrateClaudeMemorySettings', () => {
  it('turns off native auto-memory at BOTH switches', () => {
    write({});

    expect(migrateClaudeMemorySettings(settingsFile)).toBe(true);

    const out = read() as unknown as { autoMemoryEnabled: boolean; env: Record<string, string> };
    // Settings-level and runtime. Leaving either unset means "whatever the CLI
    // defaults to", which is not a promise that survives a CLI upgrade.
    expect(out.autoMemoryEnabled).toBe(false);
    expect(out.env.CLAUDE_CODE_DISABLE_AUTO_MEMORY).toBe('1');
  });

  it('is idempotent — a second run reports no change', () => {
    write({});
    expect(migrateClaudeMemorySettings(settingsFile)).toBe(true);
    const first = fs.readFileSync(settingsFile, 'utf-8');

    expect(migrateClaudeMemorySettings(settingsFile)).toBe(false);

    expect(fs.readFileSync(settingsFile, 'utf-8')).toBe(first);
  });

  it('preserves unrelated settings and env vars', () => {
    write({ model: 'opus', env: { SOMETHING_ELSE: 'keep-me' }, permissions: { allow: ['Bash'] } });

    migrateClaudeMemorySettings(settingsFile);

    const out = read() as unknown as {
      model: string;
      env: Record<string, string>;
      permissions: { allow: string[] };
    };
    expect(out.model).toBe('opus');
    expect(out.env.SOMETHING_ELSE).toBe('keep-me');
    expect(out.permissions.allow).toEqual(['Bash']);
  });

  it('removes the legacy memory SessionStart hook', () => {
    write({ hooks: { SessionStart: [{ hooks: [{ type: 'command', command: LEGACY_HOOK }] }] } });

    migrateClaudeMemorySettings(settingsFile);

    // The whole entry goes when the legacy command was its only hook — an empty
    // matcher entry would otherwise linger.
    expect(JSON.stringify(read())).not.toContain(LEGACY_HOOK);
    expect((read() as unknown as { hooks: Record<string, unknown> }).hooks.SessionStart).toBeUndefined();
  });

  it('keeps sibling hooks when stripping the legacy one', () => {
    write({
      hooks: {
        SessionStart: [
          {
            hooks: [
              { type: 'command', command: LEGACY_HOOK },
              { type: 'command', command: 'bun /app/src/other.ts' },
            ],
          },
        ],
      },
    });

    migrateClaudeMemorySettings(settingsFile);

    const json = JSON.stringify(read());
    expect(json).not.toContain(LEGACY_HOOK);
    expect(json).toContain('bun /app/src/other.ts');
  });

  it('adds the PreCompact instruction hook once', () => {
    write({});

    migrateClaudeMemorySettings(settingsFile);
    migrateClaudeMemorySettings(settingsFile);

    const occurrences = JSON.stringify(read()).split(PRE_COMPACT).length - 1;
    expect(occurrences).toBe(1);
  });

  // Failing closed matters more than migrating: a corrupt or unreadable settings
  // file must not be replaced with a synthesized one.
  it('leaves a non-object settings root untouched', () => {
    fs.writeFileSync(settingsFile, '[1,2,3]\n');

    expect(migrateClaudeMemorySettings(settingsFile)).toBe(false);

    expect(fs.readFileSync(settingsFile, 'utf-8')).toBe('[1,2,3]\n');
  });

  it('reports false on malformed JSON without throwing', () => {
    fs.writeFileSync(settingsFile, '{not json\n');

    expect(migrateClaudeMemorySettings(settingsFile)).toBe(false);

    expect(fs.readFileSync(settingsFile, 'utf-8')).toBe('{not json\n');
  });

  it('reports false for a missing file without creating one', () => {
    const absent = path.join(dir, 'nope.json');

    expect(migrateClaudeMemorySettings(absent)).toBe(false);

    expect(fs.existsSync(absent)).toBe(false);
  });

  it('leaves no temp file behind', () => {
    write({});

    migrateClaudeMemorySettings(settingsFile);

    expect(fs.readdirSync(dir)).toEqual(['settings.json']);
  });
});

/**
 * `.claude-shared/` is mounted writable into the container, so any name in it —
 * `settings.json` itself or the temp name the rewrite goes through — may be a
 * planted symlink. The file is reached through the directory's descriptor
 * (AnchoredDir, `O_NOFOLLOW` + exclusive create), so a planted entry is refused
 * rather than followed, and is never deleted.
 */
describe('entries planted by the container', () => {
  it('refuses a symlink planted at settings.json: nothing read or written through it', () => {
    const victim = path.join(dir, 'victim.json');
    const hostile = JSON.stringify({ autoMemoryEnabled: true }) + '\n';
    fs.writeFileSync(victim, hostile);
    fs.symlinkSync(victim, settingsFile);

    // Caught and logged, not thrown: this function's contract is "leave the
    // settings unchanged on any failure".
    expect(migrateClaudeMemorySettings(settingsFile)).toBe(false);

    expect(fs.readFileSync(victim, 'utf-8')).toBe(hostile);
    expect(fs.lstatSync(settingsFile).isSymbolicLink()).toBe(true);
  });

  // A refused temp name must not become a deletion: the colliding entry is
  // someone else's, and an unconditional cleanup would remove it.
  it('leaves a symlink planted at its temp name alone and writes nothing through it', () => {
    write({});
    const before = fs.readFileSync(settingsFile, 'utf-8');
    const victim = path.join(dir, 'victim.txt');
    fs.writeFileSync(victim, 'untouched\n');
    const now = Date.now();
    const spy = vi.spyOn(Date, 'now').mockReturnValue(now);
    const tmp = path.join(dir, `settings.json.tmp-${process.pid}-${now}`);
    fs.symlinkSync(victim, tmp);

    try {
      expect(migrateClaudeMemorySettings(settingsFile)).toBe(false);
    } finally {
      spy.mockRestore();
    }

    expect(fs.readFileSync(victim, 'utf-8')).toBe('untouched\n');
    expect(fs.lstatSync(tmp).isSymbolicLink()).toBe(true);
    expect(fs.readFileSync(settingsFile, 'utf-8')).toBe(before);
  });
});
