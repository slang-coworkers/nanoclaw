/**
 * The critique delivery gate for every message door (fork-owned).
 *
 * gate-critique-on-deliver.sh decides whether a delivery may go out: a message
 * that starts with a delivery marker such as `[Review Verdict]` needs the
 * required critique rounds first. The script is the one implementation. This
 * module runs it for each door a message can leave by:
 *
 *   mcp-tools/core.ts   the send_message and send_file tools, for every provider
 *   poll-loop.ts        <message> blocks (mid-turn and result) and the plain-text shortcut
 *
 * The Bash PreToolUse hook keeps the Bash half of the script (PR creation,
 * long comments). Before this module, the send_message half ran only as a
 * Claude Code hook, so Codex and Pi sends were never gated, and the poll loop
 * ran a TypeScript copy of the rules that had drifted from the script.
 *
 * The script is not idempotent on the allow path (it consumes a one-shot
 * admin bypass and journals a kill-switch release), so each delivery runs it
 * exactly once, at its own door.
 */
import fs from 'fs';
import path from 'path';

import { runHookCommand } from './settings-hooks.js';

export type DeliveryTool = 'send_message' | 'send_file';

export interface DeliveryGateResult {
  blocked: boolean;
  reason?: string;
}

const GATE_SCRIPT = 'gate-critique-on-deliver.sh';
const GATE_TIMEOUT_S = 15;
// A file larger than this is not read into the gate text; a report the gate
// cares about is a few KiB.
const MAX_FILE_GATE_BYTES = 256 * 1024;

function log(msg: string): void {
  console.error(`[delivery-gate] ${msg}`);
}

/** The directory of the hook scripts: `NANOCLAW_HOOKS_DIR`, else the image's `/app/hooks`. */
export function hooksDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.NANOCLAW_HOOKS_DIR || '/app/hooks';
}

/**
 * Run the critique gate on `text`, as the `tool` that delivers it. Resolves to
 * blocked with the script's reason when the script refuses (exit 2). A missing
 * script lets the delivery through, as a failed Claude Code hook does, and logs
 * it, because the image always ships the script.
 */
export async function checkDeliveryGate(
  text: string,
  tool: DeliveryTool = 'send_message',
  env: NodeJS.ProcessEnv = process.env,
): Promise<DeliveryGateResult> {
  const script = path.join(hooksDir(env), GATE_SCRIPT);
  if (!fs.existsSync(script)) {
    log(`ERROR ${script} is missing; delivery not gated`);
    return { blocked: false };
  }
  const outcome = await runHookCommand(
    { command: `bash ${JSON.stringify(script)}`, timeout: GATE_TIMEOUT_S },
    { hook_event_name: 'PreToolUse', tool_name: `mcp__nanoclaw__${tool}`, tool_input: { text } },
    env,
  );
  return outcome.block ? { blocked: true, reason: outcome.reason } : { blocked: false };
}

/**
 * The text the gate reads for a file delivery: the caption, then the file's
 * own text when it is UTF-8 text of at most 256 KiB. A report sent as a file
 * is a delivery like a report sent as a message.
 */
export function fileGateText(caption: string, filePath: string): string {
  try {
    if (fs.statSync(filePath).size > MAX_FILE_GATE_BYTES) return caption;
    const bytes = fs.readFileSync(filePath);
    if (bytes.includes(0)) return caption;
    return caption ? `${caption}\n${bytes.toString('utf-8')}` : bytes.toString('utf-8');
  } catch {
    return caption;
  }
}

// The settings the script reads. The NanoClaw MCP server is spawned with a
// literal env, so these are forwarded by name (index.ts).
const GATE_ENV_PREFIXES = ['CRITIQUE_', 'EXPLAIN_DIFF_'];
const GATE_ENV_KEYS = [
  'REVIEW_REQUEST_GATE',
  'OVERLAY_MARKER_DIR',
  'WORKFLOW_STATE_FILE',
  'NANOCLAW_HOOKS_DIR',
  'PATH',
  'HOME',
];

/**
 * The part of `env` the gate script reads, for the MCP server's literal env.
 * `CRITIQUE_GATE_ACTIVE=0` is copied too: the host's value is authoritative,
 * and without it the script falls back to a marker file the agent can delete.
 */
export function deliveryGateEnv(env: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) continue;
    if (GATE_ENV_KEYS.includes(key) || GATE_ENV_PREFIXES.some((p) => key.startsWith(p))) out[key] = value;
  }
  return out;
}
