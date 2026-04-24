import { execFile } from 'child_process';
import path from 'path';

import { logger } from './logger.js';

const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const SCRIPT_PATH = path.resolve(process.cwd(), 'scripts/cleanup-sessions.sh');

function resolveShell(): string {
  if (process.platform === 'win32') {
    // Prefer Git Bash on Windows; fall back to sh from PATH
    const gitBash = path.join(
      process.env.PROGRAMFILES || 'C:\\Program Files',
      'Git',
      'bin',
      'bash.exe',
    );
    try {
      const fs = require('fs');
      if (fs.existsSync(gitBash)) return gitBash;
    } catch {
      /* ignore */
    }
    return 'bash'; // hope it's on PATH
  }
  return '/bin/bash';
}

function runCleanup(): void {
  const shell = resolveShell();
  execFile(shell, [SCRIPT_PATH], { timeout: 60_000 }, (err, stdout) => {
    if (err) {
      logger.error({ err }, 'Session cleanup failed');
      return;
    }
    const summary = stdout.trim().split('\n').pop();
    if (summary) logger.info(summary);
  });
}

export function startSessionCleanup(): void {
  // Run once at startup (delayed 30s to not compete with init)
  setTimeout(runCleanup, 30_000);
  // Then every 24 hours
  setInterval(runCleanup, CLEANUP_INTERVAL);
}
