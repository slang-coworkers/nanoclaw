import fs from 'fs';
import path from 'path';

import { TIMEZONE, formatLocalStamp } from './timezone.js';

/**
 * The `conversations/` archive, written for EVERY provider.
 *
 * `container/CLAUDE.md` tells the agent unconditionally that "the
 * conversations/ folder in your workspace holds searchable transcripts of past
 * sessions with this group". That was only true under Claude: the archive was
 * produced by `ClaudeProvider`'s PreCompact hook, which parses the Claude Agent
 * SDK's own `.jsonl`. The other four providers never produced the folder at
 * all, so the contract pointed them at a directory that did not exist.
 *
 * Archiving per exchange in the poll loop fixes that by construction — the
 * `prompt`/`result` pair exists for every provider, so no provider has to opt
 * in. Claude's transcript archiving stays as-is: it retains tool calls and
 * intermediate reasoning that an exchange pair does not, so it remains the
 * richer record where it is available.
 */

/** Same default the claude provider has always used. */
const DEFAULT_DIR = '/workspace/agent/conversations';

/**
 * Per-message clamp, matching the transcript formatter. A single runaway turn
 * should not be able to dominate the day's file.
 */
const MAX_CONTENT_CHARS = 2000;

/**
 * Soft cap on the dated file. `container/CLAUDE.md` tells the agent to split any
 * file over ~500 lines, so the writer enforces the same bound rather than
 * trusting a reader to tidy up: past this, the day rolls to `-2`, `-3`, … Left
 * generous because a day of exchanges is the unit an agent wants to recall
 * whole.
 */
const MAX_FILE_LINES = 1200;

export function conversationsDir(): string {
  return process.env.NANOCLAW_CONVERSATIONS_DIR || DEFAULT_DIR;
}

function clamp(text: string): string {
  return text.length > MAX_CONTENT_CHARS ? text.slice(0, MAX_CONTENT_CHARS) + '...' : text;
}

/**
 * Resolve the file for today, rolling to a `-N` suffix once the current one
 * crosses `MAX_FILE_LINES`. Returns the path plus whether it still needs its
 * `# heading` (a fresh or rolled file does).
 */
function resolveTarget(dir: string, dateStr: string): { file: string; fresh: boolean } {
  let candidate = path.join(dir, `${dateStr}-conversation.md`);
  for (let n = 2; ; n++) {
    let lines: number;
    try {
      lines = fs.readFileSync(candidate, 'utf-8').split('\n').length;
    } catch {
      return { file: candidate, fresh: true }; // absent → new file
    }
    if (lines < MAX_FILE_LINES) return { file: candidate, fresh: false };
    candidate = path.join(dir, `${dateStr}-conversation-${n}.md`);
  }
}

/**
 * Append one prompt/result pair to today's conversation file.
 *
 * Best-effort by contract: archiving is a convenience for later recall, never a
 * reason to fail a turn that already delivered. Every failure is logged and
 * swallowed, and the caller gets a boolean rather than an exception.
 */
export function appendExchange(
  exchange: { prompt: string; result: string | null },
  opts: { assistantName?: string; log?: (msg: string) => void } = {},
): boolean {
  const emit = opts.log ?? (() => {});
  const prompt = exchange.prompt?.trim();
  const result = exchange.result?.trim();
  // Nothing to recall from a half-empty pair — skip rather than write a stub.
  if (!prompt || !result) return false;

  try {
    const dir = conversationsDir();
    fs.mkdirSync(dir, { recursive: true });

    // Local calendar date: the agent navigates conversations/ by these
    // prefixes, and the claude transcript archive already dates files the same
    // way, so the two paths interleave chronologically in a directory listing.
    const stamp = formatLocalStamp(new Date(), TIMEZONE);
    const { file, fresh } = resolveTarget(dir, stamp.slice(0, 10));

    const assistant = opts.assistantName || 'Assistant';
    const body = [
      fresh ? `# Conversation ${stamp.slice(0, 10)}\n` : '',
      `## ${stamp}`,
      '',
      `**User**: ${clamp(prompt)}`,
      '',
      `**${assistant}**: ${clamp(result)}`,
      '',
    ].join('\n');

    fs.appendFileSync(file, body);
    return true;
  } catch (err) {
    emit(`Failed to append conversation archive: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}
