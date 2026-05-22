/**
 * Gate audit — **soft enforcement** that the agent invoked declared gates
 * (`/buddy`, `/codex-critique`) before emitting a stage-passing message
 * (`[Fix Report]`, `[Resolution]`).
 *
 * Reads the active SDK session jsonl (Claude Agent SDK transcript) and
 * counts `tool_use` entries by name. When `send_message` carries a marker
 * declaring a stage transition, we check whether the required tool was
 * invoked — if not, append an audit warning to the tool response and emit
 * via `log()` so the skip is visible to:
 *   - the agent itself (the tool response lands on its next turn's context)
 *   - the host log stream (`logs/nanoclaw.log` and the dashboard log feed)
 *
 * The audit is NOT injected into the outbound message body — the recipient
 * (parent agent / channel) does not see it. If/when we want recipient-side
 * visibility, modify the outbound `content.text` before `writeMessageOut`.
 *
 * KNOWN LIMITATIONS (auditable, not yet hard enforcement):
 *
 * 1. **Audit fires after the message is already written.** `send_message`
 *    writes to messages_out, then audits. The audit is visible in the tool
 *    response and the host log, but the outbound has already been
 *    delivered. Hard enforcement (refuse before write) requires moving the
 *    audit ahead of `writeMessageOut` and treating it as a guard error.
 *    Track-and-flip: replace `return ok(audit ? ...)` with
 *    `if (audit && process.env.NANOCLAW_GATE_HARD_ENFORCE) return err(...)`.
 *
 * 2. **"Latest jsonl" by mtime is not deterministic per-session.** Each
 *    container has one active SDK session at a time, so within a container
 *    this is correct. But concurrent agent-runners on the same agent-group
 *    filesystem could produce ambiguous mtime ordering. Future fix: pin
 *    the jsonl path at session start (env var or sentinel file) so the
 *    audit never reads a sibling's transcript.
 *
 * 3. **Stale evidence is accepted.** `countToolUsesInSession` counts ANY
 *    prior `mcp__codex__codex` call in the session — a codex call from an
 *    earlier stage satisfies a later stage's gate. Future fix: temporally
 *    bound the count to "calls made AFTER the most recent inbound on the
 *    thread we're replying to" (i.e. evidence the agent fetched fresh
 *    critique, not echo of an old one).
 *
 * 4. **Codex-driven sessions don't write Claude SDK jsonl** — the helper
 *    returns 0 for any tool, the audit always fires for those agents.
 *    Per memory `project_codex_no_overlays.md`, codex agents have
 *    `disable_overlays=1` so they shouldn't be emitting these markers in
 *    the first place. Acceptable false-positive.
 */

import fs from 'fs';
import path from 'path';

const DEFAULT_JSONL_DIR = '/home/node/.claude/projects/-workspace-agent';

function getJsonlDir(): string {
  return process.env.NANOCLAW_SDK_JSONL_DIR ?? DEFAULT_JSONL_DIR;
}

/** Latest jsonl in the SDK projects dir, or null if none. */
export function findActiveSessionJsonl(dir: string = getJsonlDir()): string | null {
  if (!fs.existsSync(dir)) return null;
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return null;
  }
  let latest: { path: string; mtime: number } | null = null;
  for (const entry of entries) {
    if (!entry.endsWith('.jsonl')) continue;
    const full = path.join(dir, entry);
    try {
      const stat = fs.statSync(full);
      if (!latest || stat.mtimeMs > latest.mtime) {
        latest = { path: full, mtime: stat.mtimeMs };
      }
    } catch {
      /* skip unreadable entries */
    }
  }
  return latest?.path ?? null;
}

/**
 * Count `tool_use` entries with the given `toolName` in the active jsonl.
 * If `skillFilter` is set, only count `Skill` calls whose `input.skill`
 * matches. Returns 0 when no jsonl is found (test mode with no fs context,
 * or codex-mode agents).
 */
export function countToolUsesInSession(
  toolName: string,
  opts: { skillFilter?: string; jsonlPath?: string } = {},
): number {
  const jsonl = opts.jsonlPath ?? findActiveSessionJsonl();
  if (!jsonl) return 0;
  let buf: string;
  try {
    buf = fs.readFileSync(jsonl, 'utf8');
  } catch {
    return 0;
  }
  let count = 0;
  for (const line of buf.split('\n')) {
    if (!line.trim()) continue;
    let d: unknown;
    try {
      d = JSON.parse(line);
    } catch {
      continue;
    }
    const message = (d as { message?: { content?: unknown } } | undefined)?.message;
    const content = message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content as Array<Record<string, unknown>>) {
      if (block?.type !== 'tool_use') continue;
      if (block.name !== toolName) continue;
      if (opts.skillFilter) {
        const input = block.input as { skill?: string } | undefined;
        if (input?.skill !== opts.skillFilter) continue;
      }
      count++;
    }
  }
  return count;
}

interface GateRule {
  /** Stage-passing marker in the outbound message text. */
  marker: RegExp;
  /** Any one of these tool calls satisfies the gate. */
  required: Array<{ tool: string; skillFilter?: string }>;
  /** Human-readable name for the audit message. */
  description: string;
}

/**
 * Stage-passing markers → required tool calls. The list is intentionally
 * narrow: only markers that signal a chain transition where the spine
 * declares a buddy or critique gate. Reviewer's `[Resolution]` is the
 * sign-off message and gates on codex-critique evidence (the reviewer is
 * supposed to use codex independently).
 *
 * Adding new markers here is the cheap way to extend audit coverage to
 * other workflows without wiring a per-coworker gate registry.
 */
const GATE_REQUIREMENTS: GateRule[] = [
  {
    marker: /\[Fix Report\]/,
    required: [{ tool: 'mcp__codex__codex' }],
    description: 'codex-critique (CRITIQUE OVERLAY GATE)',
  },
  {
    marker: /\[Resolution\]/,
    required: [{ tool: 'mcp__codex__codex' }],
    description: 'codex-critique (CRITIQUE OVERLAY GATE)',
  },
];

/**
 * Returns an audit warning string to APPEND to the tool response, or null
 * if no markers apply or all gates were satisfied.
 */
export function auditCompletionMarkers(text: string): string | null {
  const lines: string[] = [];
  for (const rule of GATE_REQUIREMENTS) {
    if (!rule.marker.test(text)) continue;
    const satisfied = rule.required.some(
      (req) => countToolUsesInSession(req.tool, { skillFilter: req.skillFilter }) > 0,
    );
    if (!satisfied) {
      const requiredDesc = rule.required
        .map((r) => (r.skillFilter ? `${r.tool}(skill="${r.skillFilter}")` : r.tool))
        .join(' or ');
      lines.push(
        `[GATE AUDIT] message contains "${rule.marker.source}" but ${rule.description} (${requiredDesc}) was never invoked in this session — gate skipped`,
      );
    }
  }
  return lines.length > 0 ? lines.join('\n') : null;
}
