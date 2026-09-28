/**
 * The fork's merge assist and upstream's failure diagnosis share one Claude
 * spawn. Upstream #3920 made that spawn read-only, which is right for the
 * diagnosis and fatal for the merge assist: it has to merge, edit, build and
 * commit, so under Read/Grep/Glob every composition fails and rolls back.
 * This pins each caller to its own permission set.
 */
import { EventEmitter } from 'events';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ca = vi.hoisted(() => ({ spawn: vi.fn() }));

// Clean tree, Claude installed and signed in, every git/build call succeeds.
vi.mock('child_process', () => ({
  execSync: vi.fn(() => 'nv-main'),
  spawn: ca.spawn,
  spawnSync: vi.fn(() => ({ status: 0, stdout: '', stderr: '' })),
}));

vi.mock('@clack/prompts', async (importActual) => {
  const actual = await importActual<typeof import('@clack/prompts')>();
  return {
    ...actual,
    log: { ...actual.log, warn: vi.fn(), error: vi.fn(), success: vi.fn(), message: vi.fn(), info: vi.fn() },
  };
});

vi.mock('./runner.js', () => ({ ensureAnswer: (v: unknown) => v }));
vi.mock('./theme.js', async (importActual) => ({
  ...(await importActual<typeof import('./theme.js')>()),
  note: vi.fn(),
}));

import { composeMergeViaClaude } from './claude-assist.js';

beforeEach(() => {
  ca.spawn.mockReset();
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  ca.spawn.mockImplementation(() => {
    const child = Object.assign(new EventEmitter(), {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      stdin: { end: () => {} },
    });
    queueMicrotask(() => child.emit('close', 0));
    return child;
  });
});

describe('composeMergeViaClaude', () => {
  it('spawns Claude with write permissions, not the diagnosis read-only set', async () => {
    await composeMergeViaClaude('nv-dashboard', '/tmp/nanoclaw');

    const [binary, args] = ca.spawn.mock.calls[0] as [string, string[]];
    expect(binary).toBe('claude');
    expect(args).toEqual([
      '-p',
      '--output-format',
      'stream-json',
      '--verbose',
      '--permission-mode',
      'bypassPermissions',
    ]);
  });
});
