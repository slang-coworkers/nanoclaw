/**
 * Core MCP tools: send_message, send_file, add_reaction.
 *
 * All outbound tools resolve destinations via the local destination map
 * (see destinations.ts). Agents reference destinations by name; the map
 * translates name → routing tuple. Permission enforcement happens on
 * the host side in delivery.ts via the agent_destinations table.
 */
import fs from 'fs';
import path from 'path';

import { getCurrentInReplyTo } from '../current-batch.js';
import { findByName, findByRouting, getAllDestinations } from '../destinations.js';
import { getMessageInBySeq, hasInboundFromThread, type MessageInRow } from '../db/messages-in.js';
import { getMessageIdBySeq, getRoutingBySeq, hasOutboundToThread, writeMessageOut } from '../db/messages-out.js';
import { getSessionRouting } from '../db/session-routing.js';
import { registerTools } from './server.js';
import type { McpToolDefinition } from './types.js';

function log(msg: string): void {
  console.error(`[mcp-tools] ${msg}`);
}

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function ok(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

function err(text: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${text}` }], isError: true };
}

function destinationList(): string {
  const all = getAllDestinations();
  if (all.length === 0) return '(none)';
  return all.map((d) => d.name).join(', ');
}

/**
 * Resolve a destination name to routing fields.
 *
 * If `to` is omitted, use the session's default reply routing (channel +
 * thread the conversation is in) — the agent replies in place.
 *
 * If `to` is specified, look up the named destination. If it resolves to
 * the same channel the session is bound to, the session's thread_id is
 * preserved so replies land in the correct thread.
 *
 * For cross-channel sends and agent-to-agent (a2a) destinations, the
 * sender's current `thread_id` auto-propagates so parallel delegations
 * don't collapse into one shared recipient session ("I'm working on
 * PR-A in my thread, reviewer gets a PR-A-scoped session; I delegate
 * PR-B in a different thread, reviewer gets a PR-B-scoped session").
 *
 * `explicitThreadId`, if provided by the caller, always wins — enables
 * fan-out (sender sends N distinct sub-delegations from one thread) and
 * fan-in (two sender-threads collapse into one recipient session).
 * Pass `null` or `undefined` to fall through to the auto-propagation
 * rules above.
 */
function resolveRouting(
  to: string | undefined,
  explicitThreadId: string | null,
):
  | { channel_type: string; platform_id: string; thread_id: string | null; resolvedName: string }
  | { error: string } {
  if (!to) {
    // Default: reply to whatever thread/channel this session is bound to.
    const session = getSessionRouting();
    if (session.channel_type && session.platform_id) {
      return {
        channel_type: session.channel_type,
        platform_id: session.platform_id,
        thread_id: explicitThreadId ?? session.thread_id,
        resolvedName: '(current conversation)',
      };
    }
    // No session routing (e.g., agent-shared or internal-only agent) —
    // fall back to the legacy single-destination shortcut.
    const all = getAllDestinations();
    if (all.length === 0) return { error: 'No destinations configured.' };
    if (all.length > 1) {
      return {
        error: `You have multiple destinations — specify "to". Options: ${all.map((d) => d.name).join(', ')}`,
      };
    }
    to = all[0].name;
  }
  const dest = findByName(to);
  if (!dest) return { error: `Unknown destination "${to}". Known: ${destinationList()}` };
  if (dest.type === 'channel') {
    // If the destination is the same channel the session is bound to,
    // preserve the thread_id so replies land in the correct thread.
    const session = getSessionRouting();
    const sameChannel =
      session.channel_type === dest.channelType && session.platform_id === dest.platformId;
    const threadId = explicitThreadId ?? (sameChannel ? session.thread_id : null);
    return {
      channel_type: dest.channelType!,
      platform_id: dest.platformId!,
      thread_id: threadId,
      resolvedName: to,
    };
  }
  // Agent-to-agent destination: auto-propagate sender's thread so each
  // sender-thread → one recipient-session. Explicit override wins for
  // fan-out / fan-in flows. Null → recipient's agent-shared root session
  // (back-compat with unthreaded installs).
  const session = getSessionRouting();
  const threadId = explicitThreadId ?? session.thread_id ?? null;
  return {
    channel_type: 'agent',
    platform_id: dest.agentGroupId!,
    thread_id: threadId,
    resolvedName: to,
  };
}

/** Normalise an optional thread_id tool argument. Matches the ingress
 *  contract: trim, empty → null, non-string → reject. */
function normalizeThreadIdArg(raw: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== 'string') return { ok: false, error: 'thread_id must be a string when provided' };
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: true, value: null };
  if (trimmed.length > 200) return { ok: false, error: 'thread_id too long (max 200 chars)' };
  return { ok: true, value: trimmed };
}

/**
 * Resolve `in_reply_to` arg → inbound row.
 *
 * Accepts the integer `seq` the agent sees as `<message id="N">`. Returns
 * `{ row: null }` when arg is omitted (caller falls through to the
 * batch-default in_reply_to from `getCurrentInReplyTo`). Rejects with a
 * specific error when arg is malformed or names a non-existent row, so
 * the model gets actionable feedback in a multi-thread batch instead of
 * silently mis-routing.
 */
function resolveInReplyTo(
  raw: unknown,
): { ok: true; row: MessageInRow | null } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, row: null };
  const seq = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isInteger(seq) || seq <= 0) {
    return { ok: false, error: 'in_reply_to must be the integer id shown on an inbound message (e.g. id="120" → 120)' };
  }
  const row = getMessageInBySeq(seq);
  if (!row) return { ok: false, error: `in_reply_to=${seq}: no inbound message with that id in this session` };
  return { ok: true, row };
}

/**
 * a2a runtime guard for bare writes to peer-owned threads.
 *
 * If an agent calls `send_message` to an a2a destination on a thread_id
 * the session has never originated AND has previously received from that
 * peer on that thread, the write is almost certainly a continuation — the
 * agent should be answering a specific inbound row, not blindly dropping
 * a message into an existing peer conversation. Without explicit
 * `in_reply_to`, the host can't reliably correlate the write with the
 * conversation it belongs to (the seq-129-class mis-tag bug).
 *
 * The guard rejects only when ALL of the following hold:
 *   - target channel is `agent` (a2a)
 *   - thread_id is set
 *   - agent did NOT pass `in_reply_to`
 *   - session has no prior outbound to (dest, thread)  [i.e. didn't originate]
 *   - session HAS a prior inbound from (dest, thread)  [peer is using it]
 *
 * Fresh dispatches (no prior inbound) are allowed without in_reply_to —
 * that's how new threads get started. Continuations of a thread we
 * originated (prior outbound exists) are allowed without in_reply_to —
 * we already own the thread.
 *
 * **Scope:** this guard catches *writes into peer-owned threads* without
 * explicit linkage. It does NOT detect content/thread mismatch on threads
 * the session originated — e.g. the seq-129 incident where the
 * orchestrator stamped slangpy-807 content onto thread_id=slang-11144
 * (both originated by the orchestrator) is NOT blocked here. That class
 * is addressed at the prevention layer: the formatter's `thread="…"`
 * attribute (so the agent sees thread context per inbound) plus the
 * `in_reply_to` arg on send_message/send_file (so the agent names the
 * exact inbound it's answering). Layering: prevention before 3b guard.
 */
function checkPeerThreadGuard(
  routing: { channel_type: string; platform_id: string; thread_id: string | null },
  inReplyRow: MessageInRow | null,
): { ok: true } | { ok: false; error: string } {
  if (routing.channel_type !== 'agent') return { ok: true };
  if (!routing.thread_id) return { ok: true };
  if (inReplyRow) return { ok: true };

  if (hasOutboundToThread(routing.channel_type, routing.platform_id, routing.thread_id)) {
    return { ok: true };
  }
  if (!hasInboundFromThread(routing.channel_type, routing.platform_id, routing.thread_id)) {
    return { ok: true };
  }
  return {
    ok: false,
    error:
      `Refusing to send to thread "${routing.thread_id}" without in_reply_to: this session has not originated this thread, ` +
      `but has received messages from the destination on it. Pass in_reply_to=<inbound id> to link to the message you're answering, ` +
      `or pick a different thread_id to start a new sub-conversation.`,
  };
}

/**
 * Apply in_reply_to overrides on top of `to`/`thread_id` args. When the
 * agent names an inbound row it's responding to, default both routing
 * destination and thread_id to the inbound's source — explicit args still
 * win. Returns the (possibly-rewritten) `to` and `thread_id` for
 * `resolveRouting`.
 */
function applyInReplyToDefaults(
  toArg: string | undefined,
  threadIdArg: string | null,
  inReplyRow: MessageInRow | null,
): { to: string | undefined; threadId: string | null } {
  if (!inReplyRow) return { to: toArg, threadId: threadIdArg };
  let resolvedTo = toArg;
  if (!resolvedTo && inReplyRow.channel_type && inReplyRow.platform_id) {
    const dest = findByRouting(inReplyRow.channel_type, inReplyRow.platform_id);
    if (dest) resolvedTo = dest.name;
  }
  // Pass inbound's thread_id as the "explicit" thread arg so resolveRouting
  // uses it instead of falling through to session-thread auto-propagation.
  // Caller's explicit thread_id arg always wins.
  const resolvedThread = threadIdArg !== null ? threadIdArg : inReplyRow.thread_id ?? null;
  return { to: resolvedTo, threadId: resolvedThread };
}

export const sendMessage: McpToolDefinition = {
  tool: {
    name: 'send_message',
    description:
      'Send a message to a named destination. If you have only one destination, you can omit `to`. For threaded contexts, thread_id auto-propagates from the sender\'s current thread unless explicitly overridden. When responding to a specific inbound message in a multi-message batch, pass `in_reply_to=<id>` (the integer id from `<message id="…">`) so routing/thread_id default to that inbound — avoids cross-thread mis-tagging when the batch contains several distinct conversations.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        to: { type: 'string', description: 'Destination name (e.g., "family", "worker-1"). Optional if you have only one destination, or if `in_reply_to` is set (defaults to that inbound\'s source).' },
        text: { type: 'string', description: 'Message content' },
        thread_id: {
          type: 'string',
          description:
            'Optional thread identifier. Defaults to `in_reply_to`\'s thread when set, otherwise the current session\'s thread_id. Pass an explicit value for fan-out ("review-PR-A") or fan-in (shared id).',
        },
        in_reply_to: {
          type: 'integer',
          description:
            'Optional inbound message id (the integer from `<message id="…">`). When set: routes to that inbound\'s source by default, copies its thread_id, and stamps the host\'s reply-correlation column so multi-hop a2a return paths land in the originating session. Use this whenever you reply to a specific inbound in a batch with several threads.',
        },
      },
      required: ['text'],
    },
  },
  async handler(args) {
    const text = args.text as string;
    if (!text) return err('text is required');

    const threadIdArg = normalizeThreadIdArg(args.thread_id);
    if (!threadIdArg.ok) return err(threadIdArg.error);

    const inReplyTo = resolveInReplyTo(args.in_reply_to);
    if (!inReplyTo.ok) return err(inReplyTo.error);
    const inReplyRow = inReplyTo.row;

    const { to: effectiveTo, threadId: effectiveThread } = applyInReplyToDefaults(
      typeof args.to === 'string' ? args.to : undefined,
      threadIdArg.value,
      inReplyRow,
    );
    const routing = resolveRouting(effectiveTo, effectiveThread);
    if ('error' in routing) return err(routing.error);

    const guard = checkPeerThreadGuard(routing, inReplyRow);
    if (!guard.ok) return err(guard.error);

    const id = generateId();
    const seq = writeMessageOut({
      id,
      kind: 'chat',
      platform_id: routing.platform_id,
      channel_type: routing.channel_type,
      thread_id: routing.thread_id,
      content: JSON.stringify({ text }),
      in_reply_to: inReplyRow ? inReplyRow.id : getCurrentInReplyTo(),
    });

    log(`send_message: #${seq} → ${routing.resolvedName}${routing.thread_id ? ` (thread=${routing.thread_id})` : ''}${inReplyRow ? ` (in_reply_to=${inReplyRow.seq})` : ''}`);
    return ok(`Message sent to ${routing.resolvedName} (id: ${seq})`);
  },
};

export const sendFile: McpToolDefinition = {
  tool: {
    name: 'send_file',
    description: 'Send a file to a named destination. If you have only one destination, you can omit `to`. Same in_reply_to semantics as send_message — pass `in_reply_to=<id>` to attach the file as a reply to a specific inbound message.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        to: { type: 'string', description: 'Destination name. Optional if you have only one destination, or if `in_reply_to` is set.' },
        path: { type: 'string', description: 'File path (relative to /workspace/agent/ or absolute)' },
        text: { type: 'string', description: 'Optional accompanying message' },
        filename: { type: 'string', description: 'Display name (default: basename of path)' },
        thread_id: {
          type: 'string',
          description:
            'Optional thread identifier. Same semantics as send_message: defaults to `in_reply_to`\'s thread when set, otherwise the current session\'s thread_id.',
        },
        in_reply_to: {
          type: 'integer',
          description:
            'Optional inbound message id (the integer from `<message id="…">`). Routes to that inbound\'s source by default and copies its thread_id; stamps the host\'s reply-correlation column.',
        },
      },
      required: ['path'],
    },
  },
  async handler(args) {
    const filePath = args.path as string;
    if (!filePath) return err('path is required');

    const threadIdArg = normalizeThreadIdArg(args.thread_id);
    if (!threadIdArg.ok) return err(threadIdArg.error);

    const inReplyTo = resolveInReplyTo(args.in_reply_to);
    if (!inReplyTo.ok) return err(inReplyTo.error);
    const inReplyRow = inReplyTo.row;

    const { to: effectiveTo, threadId: effectiveThread } = applyInReplyToDefaults(
      typeof args.to === 'string' ? args.to : undefined,
      threadIdArg.value,
      inReplyRow,
    );
    const routing = resolveRouting(effectiveTo, effectiveThread);
    if ('error' in routing) return err(routing.error);

    const guard = checkPeerThreadGuard(routing, inReplyRow);
    if (!guard.ok) return err(guard.error);

    const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve('/workspace/agent', filePath);
    if (!fs.existsSync(resolvedPath)) return err(`File not found: ${filePath}`);

    const id = generateId();
    const filename = (args.filename as string) || path.basename(resolvedPath);

    const outboxDir = path.join('/workspace/outbox', id);
    fs.mkdirSync(outboxDir, { recursive: true });
    fs.copyFileSync(resolvedPath, path.join(outboxDir, filename));

    writeMessageOut({
      id,
      kind: 'chat',
      platform_id: routing.platform_id,
      channel_type: routing.channel_type,
      thread_id: routing.thread_id,
      content: JSON.stringify({ text: (args.text as string) || '', files: [filename] }),
      in_reply_to: inReplyRow ? inReplyRow.id : getCurrentInReplyTo(),
    });

    log(`send_file: ${id} → ${routing.resolvedName} (${filename})${inReplyRow ? ` (in_reply_to=${inReplyRow.seq})` : ''}`);
    return ok(`File sent to ${routing.resolvedName} (id: ${id}, filename: ${filename})`);
  },
};

export const addReaction: McpToolDefinition = {
  tool: {
    name: 'add_reaction',
    description: 'Add an emoji reaction to a message.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        messageId: { type: 'integer', description: 'Message ID (the numeric id shown in messages)' },
        emoji: { type: 'string', description: 'Emoji name (e.g., thumbs_up, heart, check)' },
      },
      required: ['messageId', 'emoji'],
    },
  },
  async handler(args) {
    const seq = Number(args.messageId);
    const emoji = args.emoji as string;
    if (!seq || !emoji) return err('messageId and emoji are required');

    const platformId = getMessageIdBySeq(seq);
    if (!platformId) return err(`Message #${seq} not found`);

    const routing = getRoutingBySeq(seq);
    if (!routing || !routing.channel_type || !routing.platform_id) {
      return err(`Cannot determine destination for message #${seq}`);
    }

    const id = generateId();
    writeMessageOut({
      id,
      kind: 'chat',
      platform_id: routing.platform_id,
      channel_type: routing.channel_type,
      thread_id: routing.thread_id,
      content: JSON.stringify({ operation: 'reaction', messageId: platformId, emoji }),
    });

    log(`add_reaction: #${seq} → ${emoji} on ${platformId}`);
    return ok(`Reaction queued for #${seq}`);
  },
};

const reportPrCreated: McpToolDefinition = {
  tool: {
    name: 'report_pr_created',
    description:
      'Report that you created a GitHub PR. Enables webhook events (review comments, CI status) for this PR to route back to your current session instead of creating an orphan.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        repo: { type: 'string', description: 'Repository in owner/name format (e.g. shader-slang/slangpy)' },
        pr_number: { type: 'number', description: 'PR number' },
      },
      required: ['repo', 'pr_number'],
    },
  },
  async handler(args) {
    const repo = typeof args.repo === 'string' ? args.repo.trim() : '';
    const prNumber = typeof args.pr_number === 'number' ? args.pr_number : NaN;
    if (!repo || !Number.isFinite(prNumber)) {
      return err('repo (string) and pr_number (number) are required');
    }

    const seq = writeMessageOut({
      id: generateId(),
      kind: 'system',
      platform_id: null,
      channel_type: null,
      thread_id: null,
      content: JSON.stringify({ action: 'map_pr_session', repo, pr_number: prNumber }),
    });

    log(`report_pr_created: #${seq} → ${repo}#${prNumber} mapped to this session`);
    return ok(`PR ${repo}#${prNumber} mapped to this session. Webhook events will route here.`);
  },
};

registerTools([sendMessage, sendFile, addReaction, reportPrCreated]);
