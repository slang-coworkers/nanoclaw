// Backfills `AGENTS.md` and `.agents` symlinks in every existing
// `groups/<folder>/` directory.
//
// `group-init.ts` already creates these for *new* groups, so codex-mode
// agents can natively discover the composed CLAUDE.md and the
// `/home/node/.claude` skills tree. Older groups created before that
// scaffolding existed never got the symlinks — codex sessions in those
// groups can't find skills via their native discovery path. This module
// closes the gap without touching pre-existing files (idempotent).
//
// Symlinks created (matches `group-init.ts:232-247`):
//   AGENTS.md  → CLAUDE.md             (sibling file; resolves on host AND in container)
//   .agents    → /home/node/.claude    (absolute container path; only resolves inside the container)

import fs from 'fs';
import path from 'path';

import { log } from './log.js';

export interface BackfillResult {
  scanned: number;
  symlinkedAgentsMd: number;
  symlinkedAgentsDir: number;
  skipped: number;
}

/**
 * Walk `<repoRoot>/groups/` and ensure each group directory with a `CLAUDE.md`
 * has the two codex-discovery symlinks. Existing files of any kind at those
 * paths are left untouched.
 */
export function backfillAgentsSymlinks(repoRoot: string): BackfillResult {
  const result: BackfillResult = {
    scanned: 0,
    symlinkedAgentsMd: 0,
    symlinkedAgentsDir: 0,
    skipped: 0,
  };

  const groupsRoot = path.join(repoRoot, 'groups');
  if (!fs.existsSync(groupsRoot)) return result;

  for (const entry of fs.readdirSync(groupsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const groupDir = path.join(groupsRoot, entry.name);
    result.scanned++;

    // Only backfill groups that look initialized (have a composed CLAUDE.md).
    if (!fs.existsSync(path.join(groupDir, 'CLAUDE.md'))) {
      result.skipped++;
      continue;
    }

    const agentsMd = path.join(groupDir, 'AGENTS.md');
    if (!fs.existsSync(agentsMd) && !isSymlink(agentsMd)) {
      try {
        fs.symlinkSync('CLAUDE.md', agentsMd);
        result.symlinkedAgentsMd++;
      } catch (err) {
        // Directory may not be writable in some test sandboxes — log and continue.
        log.warn(`agents-symlink-backfill: failed to symlink AGENTS.md in ${groupDir}`, {
          err: String(err),
        });
      }
    }

    const agentsDir = path.join(groupDir, '.agents');
    if (!fs.existsSync(agentsDir) && !isSymlink(agentsDir)) {
      try {
        fs.symlinkSync('/home/node/.claude', agentsDir);
        result.symlinkedAgentsDir++;
      } catch (err) {
        log.warn(`agents-symlink-backfill: failed to symlink .agents in ${groupDir}`, {
          err: String(err),
        });
      }
    }
  }

  if (result.symlinkedAgentsMd > 0 || result.symlinkedAgentsDir > 0) {
    log.info(
      `agents-symlink-backfill: ${result.symlinkedAgentsMd} AGENTS.md + ${result.symlinkedAgentsDir} .agents symlink(s) created across ${result.scanned} group dir(s)`,
    );
  }

  return result;
}

function isSymlink(p: string): boolean {
  try {
    return fs.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}
