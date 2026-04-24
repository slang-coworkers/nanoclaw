import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';

// Mock logger
vi.mock('./logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock config
vi.mock('./config.js', () => ({
  DATA_DIR: '/tmp/nanoclaw-test-data',
}));

// Mock fs
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn(() => false),
      mkdirSync: vi.fn(),
      readdirSync: vi.fn(() => []),
      readFileSync: vi.fn(() => ''),
      writeFileSync: vi.fn(),
      unlinkSync: vi.fn(),
      rmSync: vi.fn(),
    },
  };
});

// Mock child_process
const mockExecSync = vi.fn();
vi.mock('child_process', () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

import {
  PROXY_BIND_HOST,
  AGENT_HOST_GATEWAY,
  ensureGitRepo,
  pruneWorktrees,
} from './worktree-runtime.js';
import { logger } from './logger.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PROXY_BIND_HOST', () => {
  it('defaults to 127.0.0.1', () => {
    expect(PROXY_BIND_HOST).toBe('127.0.0.1');
  });
});

describe('AGENT_HOST_GATEWAY', () => {
  it('is localhost', () => {
    expect(AGENT_HOST_GATEWAY).toBe('localhost');
  });
});

describe('ensureGitRepo', () => {
  it('skips init when .git already exists', async () => {
    const fs = await import('fs');
    vi.mocked(fs.default.existsSync).mockReturnValue(true);

    ensureGitRepo('/some/project');

    expect(mockExecSync).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      'Git repo already exists — worktree support ready',
    );
  });

  it('runs git init when no .git directory', async () => {
    const fs = await import('fs');
    vi.mocked(fs.default.existsSync).mockReturnValue(false);
    mockExecSync.mockReturnValue('');

    ensureGitRepo('/some/project');

    expect(mockExecSync).toHaveBeenCalledWith(
      'git init',
      expect.objectContaining({ cwd: '/some/project' }),
    );
  });

  it('warns and continues if git init fails', async () => {
    const fs = await import('fs');
    vi.mocked(fs.default.existsSync).mockReturnValue(false);
    mockExecSync.mockImplementationOnce(() => {
      throw new Error('not a git repo');
    });

    // Should not throw
    ensureGitRepo('/some/project');

    expect(logger.warn).toHaveBeenCalled();
  });
});

describe('pruneWorktrees', () => {
  it('calls git worktree prune', () => {
    mockExecSync.mockReturnValue('');

    pruneWorktrees('/some/project');

    expect(mockExecSync).toHaveBeenCalledWith(
      'git worktree prune',
      expect.objectContaining({ cwd: '/some/project' }),
    );
  });

  it('logs debug and continues if prune fails', () => {
    mockExecSync.mockImplementationOnce(() => {
      throw new Error('not a git repo');
    });

    pruneWorktrees('/some/project'); // should not throw

    expect(logger.debug).toHaveBeenCalled();
  });
});
