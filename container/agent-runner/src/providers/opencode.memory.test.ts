import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { OpenCodeProvider } from './opencode.js';
import { buildOpenCodeConfig, cloneClaudeMdPaths, withCloneClaudeMdInstructions } from './opencode-config.js';
import {
  prepareOpenCodeMemory,
  openCodeInstructionsPath,
  runHookCommand,
  runMemorySessionHook,
  type OpenCodeMemorySessionHook,
} from './opencode-memory.js';

// The same registered renderer used by other providers supplies a turn-start
// snapshot. Native OpenCode rereads its output file during that turn.

const MARKER = '<<memory-block>>';

let dir: string;
let scriptSeq = 0;

function logPath(): string {
  return path.join(dir, 'stdin.log');
}

/** Payloads the hook command received, one per invocation, in order. */
function invocations(): string[] {
  if (!fs.existsSync(logPath())) return [];
  return fs
    .readFileSync(logPath(), 'utf-8')
    .split('\n')
    .filter((line) => line.length > 0);
}

/**
 * A stand-in for `bun /app/src/memory/hook.ts`: appends its stdin to the log,
 * prints `body` on stdout, exits with `exitCode`.
 */
function fakeHook(opts: { body?: string; exitCode?: number } = {}): OpenCodeMemorySessionHook {
  const body = opts.body ?? MARKER;
  const script = path.join(dir, `hook-${scriptSeq++}.sh`);
  fs.writeFileSync(
    script,
    [
      '#!/bin/sh',
      `cat >> "${logPath()}"`,
      `echo "" >> "${logPath()}"`,
      `cat <<'EOF'`,
      body,
      'EOF',
      `exit ${opts.exitCode ?? 0}`,
    ].join('\n') + '\n',
  );
  return { command: `sh ${script}`, legacyCommands: [], sources: ['startup', 'clear', 'compact'] };
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'opencode-memory-'));
  scriptSeq = 0;
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('runMemorySessionHook', () => {
  it('feeds the hook the SessionStart lifecycle payload for the source it runs', async () => {
    const hook = fakeHook();
    expect(await runMemorySessionHook(hook, 'startup')).toBe(MARKER);
    expect(await runMemorySessionHook(hook, 'compact')).toBe(MARKER);
    expect(invocations()).toEqual([
      '{"hook_event_name":"SessionStart","source":"startup"}',
      '{"hook_event_name":"SessionStart","source":"compact"}',
    ]);
  });

  it('injects the command output verbatim — truncation belongs to the shared renderer', async () => {
    // Far past the shared renderer's 16k-per-file budget: whatever the command
    // decided to print is what gets injected, uncut, so the caps live in one
    // place instead of being re-implemented (and double-applied) here.
    const big = 'x'.repeat(40_000);
    const out = await runMemorySessionHook(fakeHook({ body: big }), 'startup');
    expect(out).toBe(big);
    expect(out).toHaveLength(40_000);
  });

  it('distinguishes renderer failure from successfully empty output', async () => {
    expect(await runMemorySessionHook(fakeHook({ exitCode: 3 }), 'startup')).toBeUndefined();
    expect(await runMemorySessionHook(fakeHook({ body: '' }), 'startup')).toBe('');
    expect(await runMemorySessionHook(undefined, 'startup')).toBeUndefined();
    expect(
      await runMemorySessionHook(
        { command: path.join(dir, 'does-not-exist.sh'), legacyCommands: [], sources: ['startup'] },
        'startup',
      ),
    ).toBeUndefined();
  });

  it('gives up at the deadline even when a background child keeps stdout open', async () => {
    // The async path must not wait for `close` behind a lingering grandchild
    // or a hook that ignores SIGTERM.
    const started = Date.now();
    const res = await runHookCommand('sleep 5 & echo partial; wait', '{}', 150);
    expect(Date.now() - started).toBeLessThan(2000);
    expect(res.error?.message).toBe('timed out after 150ms');
    expect(res.stdout).toBe('partial\n');
  });

  it('skips a source the registration does not declare', async () => {
    const hook = { ...fakeHook(), sources: ['startup'] as const };
    expect(await runMemorySessionHook(hook, 'compact')).toBeUndefined();
    expect(invocations()).toEqual([]);
  });
});

describe('rendered turn instructions', () => {
  it('writes rendered memory, core instructions and delivery wording into one private file', async () => {
    const file = path.join(dir, 'turn.md');
    await prepareOpenCodeMemory(fakeHook(), 'CORE', 'ROUTING', file);
    expect(fs.readFileSync(file, 'utf8')).toBe(`${MARKER}\n\nCORE\n\nROUTING`);
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    expect(invocations()).toEqual(['{"hook_event_name":"SessionStart","source":"startup"}']);
  });

  it('refreshes the same file on each external turn, including a resumed session', async () => {
    const file = path.join(dir, 'turn.md');
    await prepareOpenCodeMemory(fakeHook(), 'OLD', 'OLD ROUTING', file);
    await prepareOpenCodeMemory(fakeHook({ body: 'FRESH' }), 'CURRENT', 'ROUTING', file);
    expect(fs.readFileSync(file, 'utf8')).toBe('FRESH\n\nCURRENT\n\nROUTING');
    expect(invocations()).toHaveLength(2);
  });

  it('keeps current instructions when rendering fails and does not resurrect stale memory', async () => {
    const file = path.join(dir, 'turn.md');
    await prepareOpenCodeMemory(fakeHook(), 'OLD', '', file);
    await prepareOpenCodeMemory(fakeHook({ exitCode: 1 }), 'CURRENT', 'ROUTING', file);
    expect(fs.readFileSync(file, 'utf8')).toBe('CURRENT\n\nROUTING');
    await prepareOpenCodeMemory(fakeHook({ body: '' }), 'NEW', '', file);
    expect(fs.readFileSync(file, 'utf8')).toBe('NEW');
  });
});

describe('OpenCodeProvider memory registration', () => {
  it('refuses to start a query when the shared hook was never registered', () => {
    expect(() => new OpenCodeProvider().query({ prompt: 'hi', cwd: '/workspace' })).toThrow(
      /memory session hook was not registered/i,
    );
  });

  it('does not run startup before the lazy query actually creates a session', () => {
    const provider = new OpenCodeProvider();
    provider.registerMemorySessionHook(fakeHook());
    provider.query({ prompt: 'hi', cwd: '/workspace' });
    provider.query({ prompt: 'hi again', cwd: '/workspace', continuation: 'ses_existing' });
    expect(invocations()).toEqual([]);
  });
});

describe('buildOpenCodeConfig instructions', () => {
  it('loads the rendered turn file, preserving the shared renderer caps on raw memory', () => {
    const config = buildOpenCodeConfig({});
    expect(config.instructions).toContain(openCodeInstructionsPath());
    expect(config).not.toHaveProperty('plugin');
    expect(config.instructions).not.toContain('/workspace/agent/memory/index.md');
    expect(config.instructions).not.toContain('/workspace/agent/memory/system/definition.md');
  });

  it('loads the composed group instructions from the agent directory', () => {
    const config = buildOpenCodeConfig({});
    expect(config.instructions).toContain('/workspace/agent/CLAUDE.md');
    expect(config.instructions).toContain('/workspace/agent/CLAUDE.local.md');
  });
});

// A folder under the agent directory shaped like a checkout. `git` is 'clone'
// for a `.git` directory and 'worktree' for a linked worktree's `.git` file.
function checkout(
  name: string,
  opts: { git?: 'clone' | 'worktree'; origin?: string; files?: Array<'CLAUDE.md' | 'AGENTS.md'> } = {},
): string {
  const root = path.join(dir, name);
  fs.mkdirSync(root);
  if ((opts.git ?? 'clone') === 'clone') {
    fs.mkdirSync(path.join(root, '.git'));
    const remote = opts.origin === undefined ? '' : `[remote "origin"]\n\turl = ${opts.origin}\n`;
    fs.writeFileSync(path.join(root, '.git', 'config'), `[core]\n\tbare = false\n${remote}`);
  } else {
    fs.writeFileSync(path.join(root, '.git'), `gitdir: ${dir}/tool/.git/worktrees/${name}\n`);
  }
  for (const file of opts.files ?? ['CLAUDE.md', 'AGENTS.md']) {
    fs.writeFileSync(path.join(root, file), `# ${file}\n\n@AGENTS.md\n`);
  }
  return root;
}

describe('cloneClaudeMdPaths', () => {
  it('adds the CLAUDE.md of a clone that also has AGENTS.md', () => {
    checkout('tool', { origin: 'https://github.com/acme/tool.git' });
    expect(cloneClaudeMdPaths(dir)).toEqual([path.join(dir, 'tool', 'CLAUDE.md')]);
  });

  it('skips a linked worktree, whose guide is the same text as its clone', () => {
    checkout('tool', { origin: 'https://github.com/acme/tool.git' });
    checkout('wt-tool-456', { git: 'worktree' });
    expect(cloneClaudeMdPaths(dir)).toEqual([path.join(dir, 'tool', 'CLAUDE.md')]);
  });

  it('skips a clone with only CLAUDE.md, which OpenCode finds without help', () => {
    checkout('tool', { origin: 'https://github.com/acme/tool.git', files: ['CLAUDE.md'] });
    expect(cloneClaudeMdPaths(dir)).toEqual([]);
  });

  it('skips a clone whose AGENTS.md links to its CLAUDE.md', () => {
    const root = checkout('tool', { origin: 'https://github.com/acme/tool.git', files: ['CLAUDE.md'] });
    fs.symlinkSync('CLAUDE.md', path.join(root, 'AGENTS.md'));
    expect(cloneClaudeMdPaths(dir)).toEqual([]);
  });

  it('loads the guide once when per-task copies of the repository sit beside the clone', () => {
    checkout('tool', { origin: 'https://github.com/acme/tool.git' });
    checkout('tool-bisect', { origin: 'https://x-access-token:secret@github.com/acme/tool' });
    checkout('wt-122', { origin: path.join(dir, 'tool') });
    checkout('wt-123', { origin: path.join(dir, 'bare-123.git') });
    checkout('wt-124', { origin: `file://${dir}/bare-124.git` });
    checkout('scratch');
    checkout('other', { origin: 'git@github.com:acme/other.git' });
    expect(cloneClaudeMdPaths(dir)).toEqual([
      path.join(dir, 'other', 'CLAUDE.md'),
      path.join(dir, 'tool', 'CLAUDE.md'),
    ]);
  });

  it('returns nothing when the agent directory does not exist', () => {
    expect(cloneClaudeMdPaths(path.join(dir, 'missing'))).toEqual([]);
  });
});

describe('withCloneClaudeMdInstructions', () => {
  it('adds the clone guides after the group instructions, as paths OpenCode reads as is', () => {
    checkout('tool', { origin: 'https://github.com/acme/tool.git' });
    const config = buildOpenCodeConfig({});
    const spawned = withCloneClaudeMdInstructions(config, dir);
    expect(spawned.instructions).toEqual([...(config.instructions as string[]), path.join(dir, 'tool', 'CLAUDE.md')]);
    expect(config.instructions).not.toContain(path.join(dir, 'tool', 'CLAUDE.md'));
  });

  it('returns the config unchanged when no clone qualifies', () => {
    const config = buildOpenCodeConfig({});
    expect(withCloneClaudeMdInstructions(config, dir)).toBe(config);
  });
});
