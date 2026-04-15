/**
 * Step: local — Set up the local worktree-based agent runtime.
 * Replaces the Docker container step for local development.
 *
 * Checks:
 *  1. Node.js is available and recent enough
 *  2. Git is available
 *  3. Claude Code CLI is installed and authenticated
 *  4. Agent-runner compiles successfully
 *  5. Seed repos (from groups/seed.json) exist on disk
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

import { logger } from '../src/logger.js';
import { emitStatus } from './status.js';

function checkNode(): { ok: boolean; version: string } {
  try {
    const version = execSync('node --version', { encoding: 'utf-8' }).trim();
    const major = parseInt(version.replace('v', ''), 10);
    return { ok: major >= 20, version };
  } catch {
    return { ok: false, version: 'not found' };
  }
}

function checkGit(): { ok: boolean; version: string } {
  try {
    const version = execSync('git --version', { encoding: 'utf-8' }).trim();
    return { ok: true, version };
  } catch {
    return { ok: false, version: 'not found' };
  }
}

function checkClaudeCode(): { ok: boolean; version: string; path: string } {
  // Check CLAUDE_CODE_EXECPATH first
  const execPath = process.env.CLAUDE_CODE_EXECPATH;
  if (execPath && fs.existsSync(execPath)) {
    try {
      const version = execSync(`"${execPath}" --version`, {
        encoding: 'utf-8',
      }).trim();
      return { ok: true, version, path: execPath };
    } catch {
      return { ok: false, version: 'error', path: execPath };
    }
  }

  // Try claude on PATH
  try {
    const version = execSync('claude --version', { encoding: 'utf-8' }).trim();
    return { ok: true, version, path: 'claude' };
  } catch {
    return { ok: false, version: 'not found', path: '' };
  }
}

function buildAgentRunner(projectRoot: string): {
  ok: boolean;
  error?: string;
} {
  const agentRunnerDir = path.join(projectRoot, 'container', 'agent-runner');

  // Install deps
  if (!fs.existsSync(path.join(agentRunnerDir, 'node_modules'))) {
    try {
      execSync('npm install', {
        cwd: agentRunnerDir,
        stdio: 'pipe',
        timeout: 120_000,
      });
    } catch (err) {
      return {
        ok: false,
        error: `npm install failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // Build
  try {
    execSync('npm run build', {
      cwd: agentRunnerDir,
      stdio: 'pipe',
      timeout: 60_000,
    });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: `build failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function checkSeedRepos(projectRoot: string): {
  repos: Record<string, { path: string; exists: boolean }>;
  allOk: boolean;
} {
  const seedPath = path.join(projectRoot, 'groups', 'seed.json');
  if (!fs.existsSync(seedPath)) {
    return { repos: {}, allOk: true };
  }

  try {
    const seed = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
    const repoMap: Record<string, string> = seed.repos || {};
    const result: Record<string, { path: string; exists: boolean }> = {};
    let allOk = true;

    for (const [name, repoPath] of Object.entries(repoMap)) {
      const exists = fs.existsSync(repoPath);
      result[name] = { path: repoPath, exists };
      if (!exists) allOk = false;
    }

    return { repos: result, allOk };
  } catch {
    return { repos: {}, allOk: true };
  }
}

export async function run(_args: string[]): Promise<void> {
  const projectRoot = process.cwd();

  logger.info('Starting local setup');

  // 1. Node.js
  const node = checkNode();
  logger.info({ ...node }, node.ok ? 'Node.js OK' : 'Node.js too old or missing');

  // 2. Git
  const git = checkGit();
  logger.info({ ...git }, git.ok ? 'Git OK' : 'Git not found');

  // 3. Claude Code
  const claude = checkClaudeCode();
  logger.info(
    { ...claude },
    claude.ok ? 'Claude Code OK' : 'Claude Code not found',
  );

  // 4. Agent runner
  logger.info('Compiling agent-runner...');
  const build = buildAgentRunner(projectRoot);
  logger.info(
    { ok: build.ok },
    build.ok ? 'Agent-runner compiled' : `Agent-runner failed: ${build.error}`,
  );

  // 5. Seed repos
  const seed = checkSeedRepos(projectRoot);
  for (const [name, info] of Object.entries(seed.repos)) {
    if (info.exists) {
      logger.info({ name, path: info.path }, 'Repo found');
    } else {
      logger.warn({ name, path: info.path }, 'Repo NOT found — clone it or update groups/seed.json');
    }
  }

  const status =
    node.ok && git.ok && claude.ok && build.ok && seed.allOk
      ? 'success'
      : 'failed';

  emitStatus('SETUP_LOCAL', {
    NODE: node.ok ? node.version : `MISSING (${node.version})`,
    GIT: git.ok ? git.version : 'MISSING',
    CLAUDE_CODE: claude.ok ? claude.version : 'MISSING',
    CLAUDE_CODE_PATH: claude.path,
    AGENT_RUNNER: build.ok ? 'compiled' : `FAILED: ${build.error || ''}`,
    SEED_REPOS: Object.entries(seed.repos)
      .map(([n, i]) => `${n}=${i.exists ? 'OK' : 'MISSING'}(${i.path})`)
      .join(', ') || '(none)',
    STATUS: status,
  });

  if (status === 'failed') process.exit(1);
}
