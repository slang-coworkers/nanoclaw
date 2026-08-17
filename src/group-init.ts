import fs from 'fs';
import path from 'path';

import { DATA_DIR, DEFAULT_AGENT_PROVIDER, GROUPS_DIR } from './config.js';
import { ensureContainerConfig } from './db/container-configs.js';
import { log } from './log.js';
import { providerProvidesAgentSurfaces } from './providers/provider-container-registry.js';
import type { AgentGroup } from './types.js';

const DEFAULT_SETTINGS_JSON =
  JSON.stringify(
    {
      sandbox: {
        enabled: false,
      },
      preferences: {
        reasoningEffort: 'max',
      },
      env: {
        CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD: '1',
        CLAUDE_CODE_DISABLE_AUTO_MEMORY: '0',
      },
      // Strip Claude Code's native Workflow tool — the single largest tool
      // schema on every turn (~26KB) — because NanoClaw orchestrates its own
      // sessions (a2a messaging + host-side orchestration), so it is dead
      // weight. Matches merged upstream #3031 ("lean harness defaults"), whose
      // group-init.ts delta our fork's diverged copy dropped on the Aug-5 sync.
      // NEW groups only; existing groups keep their settings.json (never
      // regenerated) — re-enable per group by editing that group's
      // .claude-shared/settings.json and restarting.
      disableWorkflows: true,
      hooks: {
        PreCompact: [
          {
            hooks: [
              {
                type: 'command',
                command: 'bun /app/src/compact-instructions.ts',
              },
            ],
          },
        ],
      },
    },
    null,
    2,
  ) + '\n';

/**
 * Deepest mtime under `p` (file or directory, recursive). Returns 0 on
 * missing path. Used to decide whether a source tree is newer than its
 * mirrored destination.
 */
function latestMtimeMs(p: string): number {
  let st: fs.Stats;
  try {
    st = fs.statSync(p);
  } catch {
    return 0;
  }
  if (!st.isDirectory()) return st.mtimeMs;
  let max = st.mtimeMs;
  let entries: string[];
  try {
    entries = fs.readdirSync(p);
  } catch {
    return max;
  }
  for (const entry of entries) {
    const child = latestMtimeMs(path.join(p, entry));
    if (child > max) max = child;
  }
  return max;
}

/**
 * Refresh a source→destination mirror when the source is newer than the
 * mirror (or the mirror does not exist). Removes the destination first so
 * files deleted upstream are not left behind. Returns true if a copy ran.
 */
export function refreshMirror(src: string, dst: string): boolean {
  const srcMtime = latestMtimeMs(src);
  const dstMtime = latestMtimeMs(dst);
  if (dstMtime >= srcMtime) return false;
  if (fs.existsSync(dst)) fs.rmSync(dst, { recursive: true, force: true });
  fs.cpSync(src, dst, { recursive: true });
  return true;
}

/**
 * Initialize the on-disk filesystem state for an agent group. Idempotent —
 * re-running on an already-initialized group only refreshes mirrored
 * source trees (skills, subagent definitions) when their sources are newer.
 *
 * Called on every wake via `buildMounts()`. Agent-owned paths (groupDir,
 * .instructions.md, settings.json) are created once and then left alone;
 * host-owned mirrors of `container/skills/` and `container/overlays/`
 * agent.md siblings are kept current automatically so upstream skill
 * changes propagate without a manual refresh tool.
 */
export function initGroupFilesystem(
  group: AgentGroup,
  opts?: { instructions?: string; provider?: string | null },
): void {
  const projectRoot = process.cwd();
  const initialized: string[] = [];

  // `opts.provider` absent means "caller has no provider opinion" — for a
  // brand-new group that resolves to the instance default, so the scaffold and
  // the stamped config row both match it. A caller that knows the provider
  // (subagent → parent's, spawn → resolved, setup → operator's pick) passes it
  // explicitly — including `claude` — which pins the group and skips the
  // default. ensureContainerConfig is INSERT OR IGNORE, so this only stamps a
  // genuinely new group; existing rows are never touched.
  const providerHint = (opts?.provider ?? DEFAULT_AGENT_PROVIDER).toLowerCase();

  // Default agent surfaces apply unless the provider declares (at registration)
  // that it provides its own.
  const defaultSurfaces = !providerProvidesAgentSurfaces(providerHint);

  // 1. groups/<folder>/ — group memory + working dir
  const groupDir = path.resolve(GROUPS_DIR, group.folder);
  if (!fs.existsSync(groupDir)) {
    fs.mkdirSync(groupDir, { recursive: true });
    initialized.push('groupDir');
  }

  // groups/<folder>/memory/ — agent-writable per-group notes (triage memos,
  // fix reports, learnings). Workflows write to /workspace/agent/memory/<file>
  // assuming the dir exists; without scaffolding the first turn fails with
  // `ls: cannot access /workspace/agent/memory/: No such file or directory`.
  const memoryDir = path.join(groupDir, 'memory');
  if (!fs.existsSync(memoryDir)) {
    fs.mkdirSync(memoryDir, { recursive: true });
    initialized.push('memory');
  }

  // groups/<folder>/CLAUDE.md is composed by composeCoworkerClaudeMd in
  // container-runner.ts on every wake — for both 'main' (flat body +
  // additive fragments) and typed coworkers (full spine). The host never
  // hand-writes the file here.

  // Seed/instructions. The fork composes CLAUDE.md from templates +
  // .instructions.md on every wake, so user instructions live in
  // .instructions.md (the fork's surface). A creator may instead drop a
  // provider-agnostic neutral `.seed.md`; consume it here (placement deferred
  // to first spawn, where the DB-resolved provider is known). `opts.instructions`
  // wins if passed inline. For a surfaces-owning (non-default, e.g. codex)
  // provider, ALSO land the seed in the memory scaffold's conventional file so
  // that agent reads it on its first turn (it doesn't compose .instructions.md).
  const neutralSeedFile = path.join(groupDir, '.seed.md');
  const seed =
    opts?.instructions ??
    (fs.existsSync(neutralSeedFile) ? fs.readFileSync(neutralSeedFile, 'utf-8').trimEnd() : undefined);

  const instructionsFile = path.join(groupDir, '.instructions.md');
  if (!fs.existsSync(instructionsFile) && seed) {
    fs.writeFileSync(instructionsFile, seed + '\n');
    initialized.push('.instructions.md');
  }

  if (!defaultSurfaces && seed) {
    const seedFile = path.join(groupDir, 'memory', 'memories', 'imported-agent-memory.md');
    if (!fs.existsSync(seedFile)) {
      fs.mkdirSync(path.dirname(seedFile), { recursive: true });
      fs.writeFileSync(seedFile, seed + '\n');
      initialized.push('memory/memories/imported-agent-memory.md');
    }
  }

  // The neutral seed is single-use — drop it once placed.
  if (fs.existsSync(neutralSeedFile)) {
    fs.rmSync(neutralSeedFile);
    initialized.push('.seed.md consumed');
  }

  // Ensure container_configs row exists in the DB. Idempotent — no-op if
  // the row already exists (e.g. created by backfill or group creation). On a
  // fresh row, stamp the resolved provider hint so a new group is created on
  // the instance default (or the caller's explicit pick).
  ensureContainerConfig(group.id, providerHint);
  initialized.push('container_configs');

  // 2. data/v2-sessions/<id>/.claude-shared/ — Claude state + per-group skills
  if (defaultSurfaces) {
    const claudeDir = path.join(DATA_DIR, 'v2-sessions', group.id, '.claude-shared');
    if (!fs.existsSync(claudeDir)) {
      fs.mkdirSync(claudeDir, { recursive: true });
      initialized.push('.claude-shared');
    }

    const settingsFile = path.join(claudeDir, 'settings.json');
    if (!fs.existsSync(settingsFile)) {
      fs.writeFileSync(settingsFile, DEFAULT_SETTINGS_JSON);
      initialized.push('settings.json');
    } else {
      ensurePreCompactHook(settingsFile, initialized);
    }

    // mtime-based mirror: re-copy any skill whose source tree is newer than
    // the destination. This fixes silent skill-mirror staleness — prior
    // copy-once-at-init left existing groups stuck on old skill versions
    // indefinitely after upstream changes.
    const skillsDst = path.join(claudeDir, 'skills');
    const skillsSrc = path.join(projectRoot, 'container', 'skills');
    if (fs.existsSync(skillsSrc)) {
      fs.mkdirSync(skillsDst, { recursive: true });
      for (const skill of fs.readdirSync(skillsSrc)) {
        const src = path.join(skillsSrc, skill);
        const dst = path.join(skillsDst, skill);
        const existed = fs.existsSync(dst);
        if (refreshMirror(src, dst)) {
          initialized.push(existed ? `skills/${skill} (refreshed)` : `skills/${skill}`);
        }
      }
    }

    // 2b. data/v2-sessions/<id>/.claude-shared/agents/ — subagent definitions.
    // A sibling `agent.md` inside any skill or overlay dir is copied as a
    // subagent definition. Overlays like `codex-critique` ship both an
    // OVERLAY.md (compose-time body) and an agent.md (runtime subagent).
    // mtime-refreshed on each wake for the same reason as skills/.
    const agentsDst = path.join(claudeDir, 'agents');
    fs.mkdirSync(agentsDst, { recursive: true });
    for (const subdir of ['skills', 'overlays']) {
      const srcRoot = path.join(projectRoot, 'container', subdir);
      if (!fs.existsSync(srcRoot)) continue;
      for (const entry of fs.readdirSync(srcRoot)) {
        const agentFile = path.join(srcRoot, entry, 'agent.md');
        if (fs.existsSync(agentFile)) {
          const dst = path.join(agentsDst, `${entry}.md`);
          const existed = fs.existsSync(dst);
          const srcMtime = latestMtimeMs(agentFile);
          const dstMtime = latestMtimeMs(dst);
          if (dstMtime < srcMtime) {
            fs.copyFileSync(agentFile, dst);
            initialized.push(existed ? `agents/${entry}.md (refreshed)` : `agents/${entry}.md`);
          }
        }
      }
    }

    // Prune mirrors for agent.md files removed upstream so stale definitions
    // (e.g. sandbox:'read-only' from an old codex-critique) can't persist.
    for (const existing of fs.readdirSync(agentsDst)) {
      const name = existing.replace(/\.md$/, '');
      const stillExists = ['skills', 'overlays'].some((sub) =>
        fs.existsSync(path.join(projectRoot, 'container', sub, name, 'agent.md')),
      );
      if (!stillExists) {
        fs.rmSync(path.join(agentsDst, existing));
        initialized.push(`agents/${existing} (pruned orphan)`);
      }
    }
  } // end if (defaultSurfaces) — claude-shared skill/agent mirrors

  // 3. data/v2-sessions/<id>/agent-runner-src/ — per-group source copy (provider-agnostic — all surfaces)
  const groupRunnerDir = path.join(DATA_DIR, 'v2-sessions', group.id, 'agent-runner-src');
  if (!fs.existsSync(groupRunnerDir)) {
    const agentRunnerSrc = path.join(projectRoot, 'container', 'agent-runner', 'src');
    if (fs.existsSync(agentRunnerSrc)) {
      fs.cpSync(agentRunnerSrc, groupRunnerDir, { recursive: true });
      initialized.push('agent-runner-src/');
    }
  }

  // 4. Codex provider: symlinks + disable overlays (hooks not supported)
  // Codex CLI doesn't execute settings.json hooks, so overlay enforcement
  // (plan-gate, critique-gate, edit-counter) is completely inoperative.
  // Set disable_overlays=1 so the composer doesn't render gate markers that
  // the agent can't enforce, and create symlinks for native discovery.
  if (group.agent_provider === 'codex') {
    if (group.disable_overlays !== 1) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Database = require('better-sqlite3');
        const dbPath = path.join(DATA_DIR, 'v2.db');
        const db = new Database(dbPath);
        db.prepare('UPDATE agent_groups SET disable_overlays = 1 WHERE id = ?').run(group.id);
        db.close();
        initialized.push('disable_overlays=1 (codex: hooks unsupported)');
      } catch {
        /* non-critical — overlays just render uselessly */
      }
    }
    const agentsMdLink = path.join(groupDir, 'AGENTS.md');
    if (!fs.existsSync(agentsMdLink)) {
      try {
        fs.symlinkSync('CLAUDE.md', agentsMdLink);
        initialized.push('AGENTS.md → CLAUDE.md');
      } catch {
        /* ignore if already exists */
      }
    }
    // .agents → the .claude-shared dir (mounted as /home/node/.claude/ in container)
    // In the container, CWD is /workspace/agent/ and .claude is at /home/node/.claude/
    // The symlink target must be relative to CWD inside the container
    const agentsLink = path.join(groupDir, '.agents');
    if (!fs.existsSync(agentsLink)) {
      try {
        fs.symlinkSync('/home/node/.claude', agentsLink);
        initialized.push('.agents → /home/node/.claude');
      } catch {
        /* ignore */
      }
    }
  }

  if (initialized.length > 0) {
    log.info('Initialized group filesystem', {
      group: group.name,
      folder: group.folder,
      id: group.id,
      steps: initialized,
    });
  }
}

const PRE_COMPACT_COMMAND = 'bun /app/src/compact-instructions.ts';

/**
 * Patch an existing settings.json to add the PreCompact hook if missing.
 * Runs on every group init so pre-existing groups pick up the hook.
 */
function ensurePreCompactHook(settingsFile: string, initialized: string[]): void {
  try {
    const raw = fs.readFileSync(settingsFile, 'utf-8');
    const settings = JSON.parse(raw);

    // Check if there's already a PreCompact hook with our command.
    const existing = settings.hooks?.PreCompact as unknown[] | undefined;
    if (existing && JSON.stringify(existing).includes(PRE_COMPACT_COMMAND)) return;

    // Add the hook, preserving existing hooks.
    if (!settings.hooks) settings.hooks = {};
    if (!settings.hooks.PreCompact) settings.hooks.PreCompact = [];
    settings.hooks.PreCompact.push({
      hooks: [{ type: 'command', command: PRE_COMPACT_COMMAND }],
    });

    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + '\n');
    initialized.push('settings.json (added PreCompact hook)');
  } catch {
    // Don't break init if settings.json is malformed — it'll use whatever's there.
  }
}
