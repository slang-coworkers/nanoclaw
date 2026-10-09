import path from 'path';

import { AnchoredDir } from './anchored-dir.js';
import { log } from './log.js';
import type { ProviderFileDiagnostic, ProviderFileTransformer } from './provider-contracts/registry.js';

const CLAUDE_SETTINGS_FILE = 'settings.json';
const PRE_COMPACT_COMMAND = 'bun /app/src/compact-instructions.ts';
const LEGACY_MEMORY_SESSION_START_COMMAND = 'bun /app/src/memory-hook.ts';

// Effectively "never" — Claude Code's own cleanupPeriodDays setting prunes
// ~/.claude/projects/*.jsonl at CLI startup (default 30 when unset). Every
// active group was silently losing its own transcript history to this on a
// rolling 30-day window — the file NanoClaw's own cost accounting (dashboard
// + fleet ccusage reporting) reads as its source of truth. Proven on prod:
// oldest-surviving-transcript date tracked (today - 30d) exactly, across
// every busy group; idle groups (whose `claude` never restarts to run the
// sweep) kept full history back to April. See issue #1327.
export const CLEANUP_PERIOD_DAYS_NEVER = 3650;

export const CLAUDE_DEFAULT_SETTINGS =
  JSON.stringify(
    {
      cleanupPeriodDays: CLEANUP_PERIOD_DAYS_NEVER,
      sandbox: {
        enabled: false,
      },
      preferences: {
        reasoningEffort: 'max',
      },
      // Strip Claude Code's native Workflow tool — the single largest tool
      // schema on every turn (~26KB) — because NanoClaw orchestrates its own
      // sessions (a2a messaging + host-side orchestration), so it is dead
      // weight. Matches merged upstream #3031 ("lean harness defaults").
      // NEW groups only; existing groups keep their settings.json (never
      // regenerated) — re-enable per group by editing that group's
      // .claude-shared/settings.json and restarting.
      disableWorkflows: true,
      autoMemoryEnabled: false,
      env: {
        CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD: '1',
        CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1',
      },
      hooks: {
        PreCompact: [
          {
            hooks: [
              {
                type: 'command',
                command: PRE_COMPACT_COMMAND,
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
 * Seed or reconcile `settings.json` in the Claude state directory. The
 * directory is a read-write mount, so the file is reached through the
 * directory's descriptor: a symlink or FIFO planted under its name is refused
 * and the settings are left alone. Returns what was done.
 */
export function prepareClaudeMemorySettings(claudeDir: string): 'created' | 'reconciled' | 'unchanged' {
  const settingsFile = path.join(claudeDir, CLAUDE_SETTINGS_FILE);
  let dir: AnchoredDir | null = null;
  try {
    dir = AnchoredDir.open(claudeDir, [], true);
    if (!dir) throw new Error(`Claude settings directory is missing: '${claudeDir}'`);
    let current: string;
    try {
      current = dir.readFile(CLAUDE_SETTINGS_FILE).toString('utf-8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      dir.writeNewFile(CLAUDE_SETTINGS_FILE, Buffer.from(CLAUDE_DEFAULT_SETTINGS));
      return 'created';
    }
    const result = claudeSettingsTransformer.transform(current, settingsFile);
    emitDiagnostics(result.diagnostics);
    if (result.kind === 'unchanged') return 'unchanged';
    dir.replaceFile(CLAUDE_SETTINGS_FILE, result.content);
    return 'reconciled';
  } catch (err) {
    emitDiagnostic(claudeSettingsTransformer.mapIoFailure(err, settingsFile));
    return 'unchanged';
  } finally {
    dir?.close();
  }
}

export const claudeSettingsTransformer: ProviderFileTransformer = {
  transform(current, settingsFile) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(current);
    } catch (err) {
      return {
        kind: 'unchanged',
        diagnostics: [failedDiagnostic(err, settingsFile)],
      };
    }
    if (!isRecord(parsed)) {
      return {
        kind: 'unchanged',
        diagnostics: [
          {
            level: 'warn',
            message: 'Claude settings root is not an object; leaving it unchanged',
            fields: { settingsFile },
          },
        ],
      };
    }

    let changed = false;
    if (parsed.autoMemoryEnabled !== false) {
      parsed.autoMemoryEnabled = false;
      changed = true;
    }

    const env = isRecord(parsed.env) ? parsed.env : {};
    if (env.CLAUDE_CODE_DISABLE_AUTO_MEMORY !== '1') {
      env.CLAUDE_CODE_DISABLE_AUTO_MEMORY = '1';
      changed = true;
    }
    if (parsed.env !== env) {
      parsed.env = env;
      changed = true;
    }

    const hooks = isRecord(parsed.hooks) ? parsed.hooks : {};
    const existingSessionStart = Array.isArray(hooks.SessionStart) ? hooks.SessionStart : [];
    const nextSessionStart = existingSessionStart
      .map(removeLegacyNanoClawMemoryHook)
      .filter((entry) => entry !== undefined);
    if (JSON.stringify(nextSessionStart) !== JSON.stringify(existingSessionStart)) {
      if (nextSessionStart.length > 0) hooks.SessionStart = nextSessionStart;
      else delete hooks.SessionStart;
      changed = true;
    }

    const preCompact = Array.isArray(hooks.PreCompact) ? hooks.PreCompact : [];
    if (!JSON.stringify(preCompact).includes(PRE_COMPACT_COMMAND)) {
      preCompact.push({ hooks: [{ type: 'command', command: PRE_COMPACT_COMMAND }] });
      hooks.PreCompact = preCompact;
      changed = true;
    }
    if (parsed.hooks !== hooks) {
      parsed.hooks = hooks;
      changed = true;
    }

    return changed ? { kind: 'replace', content: JSON.stringify(parsed, null, 2) + '\n' } : { kind: 'unchanged' };
  },
  mapIoFailure: failedDiagnostic,
};

function failedDiagnostic(err: unknown, settingsFile: string): ProviderFileDiagnostic {
  return {
    level: 'warn',
    message: 'Failed to reconcile Claude settings; leaving them unchanged',
    fields: {
      settingsFile,
      error: err instanceof Error ? err.message : String(err),
    },
  };
}

function emitDiagnostics(diagnostics: readonly ProviderFileDiagnostic[] | undefined): void {
  for (const diagnostic of diagnostics ?? []) emitDiagnostic(diagnostic);
}

function emitDiagnostic(diagnostic: ProviderFileDiagnostic): void {
  log[diagnostic.level](diagnostic.message, diagnostic.fields);
}

function removeLegacyNanoClawMemoryHook(value: unknown): unknown {
  if (!isRecord(value) || !Array.isArray(value.hooks)) return value;
  const remaining = value.hooks.filter((hook) => {
    if (!isRecord(hook)) return true;
    return hook.command !== LEGACY_MEMORY_SESSION_START_COMMAND;
  });
  return remaining.length > 0 ? { ...value, hooks: remaining } : undefined;
}

/**
 * Reconcile an EXISTING group's Claude settings with NanoClaw's shared memory
 * system; never creates the file. Fork-only: `/migrate-memory` runs it per group
 * through `scripts/migrate-claude-memory-settings.ts`, after that group's native
 * store is staged, and group init deliberately does not (see the script for the
 * ordering constraint). Same descriptor discipline as
 * `prepareClaudeMemorySettings`: a symlink or FIFO planted under the name is
 * refused, never read or written through.
 */
export function migrateClaudeMemorySettings(settingsFile: string): boolean {
  let dir: AnchoredDir | null = null;
  try {
    dir = AnchoredDir.open(path.dirname(settingsFile), []);
    if (!dir) throw new Error(`Claude settings directory is missing: '${path.dirname(settingsFile)}'`);
    const name = path.basename(settingsFile);
    const result = claudeSettingsTransformer.transform(dir.readFile(name).toString('utf-8'), settingsFile);
    emitDiagnostics(result.diagnostics);
    if (result.kind === 'unchanged') return false;
    dir.replaceFile(name, result.content);
    return true;
  } catch (err) {
    emitDiagnostic(claudeSettingsTransformer.mapIoFailure(err, settingsFile));
    return false;
  } finally {
    dir?.close();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
