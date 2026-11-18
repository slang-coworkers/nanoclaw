/**
 * Critique rounds, recorded by the codex MCP bridge for every provider (fork-owned).
 *
 * track-critique.sh records each successful codex call as a critique round in
 * workflow-state.json: the round count, the stage named in the prompt, and the
 * verdict codex returned. The critique delivery gate reads them. The script ran
 * as a Claude Code PostToolUse hook (and through the OpenCode hook bridge), so
 * Codex and Pi groups never recorded a round, and every gated delivery there
 * was refused.
 *
 * The bridge serves the codex tools to every provider, so it records the round
 * itself, once per successful call, before it answers: the agent's next
 * delivery must already see the round. The script is not idempotent (it counts
 * rounds), which is why the host no longer registers it as a hook. The bridge
 * also reports each call's start and failure through the same script, which
 * keeps the one check of what counts as a critique call (not Buddy's).
 */
import fs from 'fs';
import path from 'path';

import { hooksDir } from './delivery-gate.js';
import { runHookCommand } from './settings-hooks.js';

const RECORD_SCRIPT = 'track-critique.sh';
const RECORD_TIMEOUT_S = 5;

function log(msg: string): void {
  console.error(`[critique-record] ${msg}`);
}

/**
 * Run track-critique.sh for one successful codex call, with the payload a
 * Claude Code PostToolUse hook gets: the tool's arguments, and the bridge's
 * structured result (`{threadId, content}`) as a JSON string, which the script
 * parses for the verdict and the thread's stage.
 *
 * The host sets CRITIQUE_GATE_ACTIVE (to 0 or 1) exactly for a group with the
 * critique overlay, where it used to register the hook; without it nothing is
 * recorded, as before.
 */
export async function recordCritiqueRound(
  tool: 'codex' | 'codex-reply',
  input: Record<string, unknown>,
  result: { threadId: string; text: string },
  env: NodeJS.ProcessEnv = process.env,
  callId?: string,
): Promise<void> {
  await runRecorder(
    {
      hook_event_name: 'PostToolUse',
      tool_name: `mcp__codex__${tool}`,
      tool_input: input,
      tool_response: JSON.stringify({ threadId: result.threadId, content: result.text }),
      ...(callId ? { tool_use_id: callId } : {}),
    },
    env,
  );
}

/**
 * Record that a codex call started (PreToolUse) or failed (PostToolUseFailure,
 * with the bridge's error text). Neither counts as a round. The host's
 * escalation sweep reads them to tell an agent that never tried the critique
 * from one whose critique is still running or whose critic is failing (for
 * example, rate-limited with 429s). `callId` is one id per bridge call, carried
 * as the payload's tool_use_id on its start, failure and round, so the host
 * matches each start to its result.
 */
export async function recordCritiqueAttempt(
  tool: 'codex' | 'codex-reply',
  input: Record<string, unknown>,
  outcome: { started: true } | { error: string },
  callId: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const base = { tool_name: `mcp__codex__${tool}`, tool_input: input, tool_use_id: callId };
  await runRecorder(
    'error' in outcome
      ? { hook_event_name: 'PostToolUseFailure', ...base, error: outcome.error }
      : { hook_event_name: 'PreToolUse', ...base },
    env,
  );
}

async function runRecorder(payload: Record<string, unknown>, env: NodeJS.ProcessEnv): Promise<void> {
  if (env.CRITIQUE_GATE_ACTIVE === undefined) return;
  const script = path.join(hooksDir(env), RECORD_SCRIPT);
  if (!fs.existsSync(script)) {
    log(`ERROR ${script} is missing; critique ${String(payload.hook_event_name)} not recorded`);
    return;
  }
  await runHookCommand({ command: `bash ${JSON.stringify(script)}`, timeout: RECORD_TIMEOUT_S }, payload, env);
}
