/**
 * NanoClaw context extension for the pi harness.
 *
 * pi does not read CLAUDE.md and the RPC protocol has no per-turn system-prompt
 * parameter, so this extension injects NanoClaw's composed instructions
 * (resolved CLAUDE.md + the routing/destinations addendum) into pi's system
 * prompt via the `before_agent_start` hook — the pi-native equivalent of the
 * Codex provider's `baseInstructions`.
 *
 * The provider (pi.ts) writes the composed text to a file and passes its path
 * in `NANOCLAW_PI_SYSTEM_PROMPT_FILE`; we read it lazily so an updated file is
 * picked up on the next run without reloading the extension.
 *
 * Tool auto-approval is intentionally NOT handled here: pi's RPC mode executes
 * tools automatically with no approval gate (docs/security.md), so the
 * container sandbox is the only boundary — same posture as codex
 * `danger-full-access` and opencode auto-approve.
 *
 * Loaded via settings.json `extensions: ["<abs path to this file>"]`. jiti
 * transpiles the TS at load.
 *
 * The ExtensionAPI type is declared locally (only the one hook we use) rather
 * than imported from `@earendil-works/pi-coding-agent`: pi is a globally
 * installed image CLI, not an agent-runner bun dependency, so importing its
 * types would break the agent-runner typecheck. The real API is provided by pi
 * at load time.
 */
import fs from 'fs';

interface BeforeAgentStartEvent {
  systemPrompt: string;
}

interface ExtensionAPI {
  on(
    event: 'before_agent_start',
    handler: (event: BeforeAgentStartEvent) => { systemPrompt: string } | undefined,
  ): void;
}

function readInstructions(): string {
  const file = process.env.NANOCLAW_PI_SYSTEM_PROMPT_FILE;
  if (!file) return '';
  try {
    return fs.readFileSync(file, 'utf-8').trim();
  } catch {
    return '';
  }
}

export default function nanoclawContext(pi: ExtensionAPI): void {
  pi.on('before_agent_start', (event: { systemPrompt: string }) => {
    const instructions = readInstructions();
    if (!instructions) return undefined;
    return { systemPrompt: `${event.systemPrompt}\n\n---\n\n${instructions}` };
  });
}
