/**
 * Worktree runtime for NanoClaw.
 * Agents run as direct Node processes in git worktrees instead of Docker containers.
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

import { DATA_DIR } from './config.js';
import { logger } from './logger.js';

export const WORKTREES_DIR = path.join(DATA_DIR, 'worktrees');

/**
 * Address the MCP proxy binds to on the host.
 * Agents run as local processes, so loopback is always correct.
 */
export const PROXY_BIND_HOST = process.env.CREDENTIAL_PROXY_HOST || '127.0.0.1';

/**
 * Hostname agents use to reach the host (MCP proxy, dashboard).
 * Same process space, so just localhost.
 */
export const AGENT_HOST_GATEWAY = 'localhost';

/**
 * Ensure the project root is a git repository.
 * Creates one with an empty initial commit if needed so `git worktree` works.
 */
export function ensureGitRepo(projectRoot: string): void {
  const gitDir = path.join(projectRoot, '.git');
  if (fs.existsSync(gitDir)) {
    logger.debug('Git repo already exists — worktree support ready');
    return;
  }

  try {
    execSync('git init', { cwd: projectRoot, stdio: 'pipe' });
    execSync('git commit --allow-empty -m "nanoclaw: init worktree base"', {
      cwd: projectRoot,
      stdio: 'pipe',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'nanoclaw',
        GIT_AUTHOR_EMAIL: 'nanoclaw@localhost',
        GIT_COMMITTER_NAME: 'nanoclaw',
        GIT_COMMITTER_EMAIL: 'nanoclaw@localhost',
      },
    });
    logger.info({ projectRoot }, 'Initialized git repo for worktree support');
  } catch (err) {
    logger.warn(
      { err: String(err) },
      'Failed to initialize git repo — agents will run without worktree isolation',
    );
  }
}

/**
 * Get or create a persistent git worktree for the given group.
 * The worktree lives at data/worktrees/{groupFolder}.
 *
 * @param groupFolder  Group identifier used as the worktree directory name.
 * @param sourceRepo   The git repo to create the worktree from.
 *                     When a group has a workDir pointing at an external repo,
 *                     pass that path so each agent gets its own isolated copy
 *                     of the target repo rather than of the nanoclaw project.
 * Returns the worktree path (may be a plain directory if git failed).
 */
export function getOrCreateWorktree(
  groupFolder: string,
  sourceRepo: string,
): string {
  const worktreePath = path.join(WORKTREES_DIR, groupFolder);

  // Already set up
  if (fs.existsSync(path.join(worktreePath, '.git'))) {
    return worktreePath;
  }

  fs.mkdirSync(WORKTREES_DIR, { recursive: true });

  const branchName = `nanoclaw/agent-${groupFolder.replace(/[^a-zA-Z0-9-]/g, '-')}`;

  try {
    // Create a worktree on a new branch based on HEAD — this gives the agent
    // a full copy of the source code (unlike --orphan which creates empty branches).
    execSync(`git worktree add -b "${branchName}" "${worktreePath}" HEAD`, {
      cwd: sourceRepo,
      stdio: 'pipe',
    });
    logger.info(
      { groupFolder, worktreePath, sourceRepo },
      'Created git worktree for agent',
    );
  } catch {
    // Branch may already exist — try attaching to it directly
    try {
      execSync(`git worktree add "${worktreePath}" "${branchName}"`, {
        cwd: sourceRepo,
        stdio: 'pipe',
      });
      logger.info(
        { groupFolder, worktreePath },
        'Reattached existing git worktree',
      );
    } catch (err2) {
      logger.warn(
        { err: String(err2), groupFolder },
        'Failed to create git worktree — using plain directory',
      );
      fs.mkdirSync(worktreePath, { recursive: true });
    }
  }

  return worktreePath;
}

/**
 * Remove a group's worktree (e.g., when a group is deleted).
 */
export function removeWorktree(
  worktreePath: string,
  projectRoot: string,
): void {
  try {
    execSync(`git worktree remove --force "${worktreePath}"`, {
      cwd: projectRoot,
      stdio: 'pipe',
    });
  } catch {
    // Fall back to plain directory removal
    try {
      fs.rmSync(worktreePath, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

/**
 * Prune stale worktree references from git's index.
 * Safe to call at startup even if no worktrees exist.
 */
export function pruneWorktrees(projectRoot: string): void {
  try {
    execSync('git worktree prune', { cwd: projectRoot, stdio: 'pipe' });
    logger.debug('Pruned stale worktree references');
  } catch {
    logger.debug('git worktree prune skipped (not a git repo or no worktrees)');
  }
}

/**
 * Clean up stale agent PID files and prune orphaned worktrees.
 */
export function cleanupOrphans(projectRoot: string): void {
  const pidDir = path.join(DATA_DIR, 'agent-pids');
  let cleaned = 0;

  if (fs.existsSync(pidDir)) {
    for (const file of fs.readdirSync(pidDir)) {
      const pidFile = path.join(pidDir, file);
      try {
        const pid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim(), 10);
        if (!isNaN(pid)) {
          try {
            process.kill(pid, 0); // Check if process still alive
          } catch {
            // Process gone — clean up
            fs.unlinkSync(pidFile);
            cleaned++;
          }
        }
      } catch {
        /* ignore */
      }
    }
  }

  if (cleaned > 0) {
    logger.info({ count: cleaned }, 'Cleaned up stale agent PID files');
  }

  pruneWorktrees(projectRoot);
}
