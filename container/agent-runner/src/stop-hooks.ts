/**
 * Stop hooks for providers whose harness does not run them (fork-owned).
 *
 * The host registers two kinds of Stop hook in a group's settings.json: the
 * dashboard telemetry hook, which tells the dashboard the turn ended, and
 * gate-explain-on-stop.sh, which keeps the turn going once while a PR's
 * explanation comment is stale. The Claude Agent SDK runs them at the end of
 * every turn. OpenCode, Codex and Pi do not, so before this module their turns
 * never reported an end and the explanation gate never fired.
 *
 * The poll loop calls the runner at each turn result, the one turn boundary
 * every provider shares. A block becomes a correction pushed into the same
 * query, as Claude Code feeds a Stop block's reason back to the model.
 *
 * Consider an OpenCode fixer that pushes to a PR and ends its turn without
 * refreshing the explanation comment. The runner runs gate-explain-on-stop.sh
 * with `stop_hook_active: false`; the script blocks with the reason; the poll
 * loop pushes "Stop hook feedback: ..." as the next turn of the same query and
 * marks that turn as a Stop continuation. When that turn ends, the script sees
 * `stop_hook_active: true` and lets it stop.
 */
import { hookSettingsPath, readHookSettings, runHookEvent, type HookOutcome } from './settings-hooks.js';
import type { AgentProvider } from './providers/types.js';

export interface StopHookInput {
  /** The provider's session id (its continuation), as the tool hooks of the same session send it. */
  sessionId: string;
  /** True when this turn is itself a continuation caused by a Stop block. */
  stopHookActive: boolean;
  lastAssistantMessage: string | null;
  /** The turn ended in a provider error; Claude Code runs StopFailure then, whose result is telemetry only. */
  failed: boolean;
}

export type StopHookRunner = (input: StopHookInput) => Promise<HookOutcome>;

/**
 * Return the Stop hook runner for `provider`, or null when its own harness
 * runs the Stop hooks. For a provider that posts its own dashboard events,
 * the runner skips the settings.json telemetry hook, which would report the
 * same Stop a second time.
 */
export function createStopHookRunner(
  provider: Pick<AgentProvider, 'runsSettingsStopHooks' | 'reportsHookTelemetry'>,
  env: NodeJS.ProcessEnv = process.env,
): StopHookRunner | null {
  if (provider.runsSettingsStopHooks) return null;
  const hookUrl = env.NANOCLAW_HOOK_URL;
  const skip = provider.reportsHookTelemetry && hookUrl ? new RegExp(escapeRegExp(hookUrl)) : undefined;
  const settingsPath = hookSettingsPath(env);
  return async (input) => {
    const outcome = await runHookEvent(
      readHookSettings(settingsPath),
      input.failed ? 'StopFailure' : 'Stop',
      '',
      {
        session_id: input.sessionId,
        stop_hook_active: input.stopHookActive,
        last_assistant_message: input.lastAssistantMessage ?? '',
      },
      { skip },
    );
    return input.failed ? { block: false, reason: '' } : outcome;
  };
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
