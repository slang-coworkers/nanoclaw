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
 * rounds), which is why the host no longer registers it as a hook.
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
): Promise<void> {
  if (env.CRITIQUE_GATE_ACTIVE === undefined) return;
  const script = path.join(hooksDir(env), RECORD_SCRIPT);
  if (!fs.existsSync(script)) {
    log(`ERROR ${script} is missing; critique round not recorded`);
    return;
  }
  await runHookCommand(
    { command: `bash ${JSON.stringify(script)}`, timeout: RECORD_TIMEOUT_S },
    {
      hook_event_name: 'PostToolUse',
      tool_name: `mcp__codex__${tool}`,
      tool_input: input,
      tool_response: JSON.stringify({ threadId: result.threadId, content: result.text }),
    },
    env,
  );
}
