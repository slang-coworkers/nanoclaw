/**
 * Legacy runner-facing outbound API, backed by the registered mailbox.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

import { getAgentMailbox } from '../mailbox/index.js';
import type { OutboundMessage } from '../mailbox/types.js';

export interface MessageOutRow {
  id: string;
  seq: number | null;
  in_reply_to: string | null;
  timestamp: string;
  deliver_after: string | null;
  recurrence: string | null;
  kind: string;
  platform_id: string | null;
  channel_type: string | null;
  thread_id: string | null;
  content: string;
}

export interface WriteMessageOut {
  id: string;
  in_reply_to?: string | null;
  deliver_after?: string | null;
  recurrence?: string | null;
  kind: string;
  platform_id?: string | null;
  channel_type?: string | null;
  thread_id?: string | null;
  content: string;
}

/**
 * Extra entries merged into system-action payloads for the duration of a
 * call, without the writing handler knowing about them. This is the seam
 * `extendTool` (../mcp-tools/server.ts) uses so an installed module can
 * add params to a base tool and have them land in the tool's outbound
 * payload while the base tool's source stays untouched.
 *
 * Scope is deliberately narrow: only `kind: 'system'` messages whose
 * content parses to a JSON object are decorated, and entries never
 * overwrite keys the handler wrote itself. Everything else passes through
 * byte-identical. With no active context (the default), this is a no-op.
 */
const outboundPassthrough = new AsyncLocalStorage<Record<string, unknown>>();

/** Run `fn` with `entries` merged into system-action payloads it writes. */
export function withOutboundPassthrough<T>(entries: Record<string, unknown>, fn: () => T): T {
  return outboundPassthrough.run(entries, fn);
}

/** Apply any active passthrough entries to a system-action JSON payload. */
function decorateContent(msg: WriteMessageOut): string {
  const entries = outboundPassthrough.getStore();
  if (!entries || msg.kind !== 'system') return msg.content;

  let parsed: unknown;
  try {
    parsed = JSON.parse(msg.content);
  } catch {
    return msg.content;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return msg.content;

  const payload = parsed as Record<string, unknown>;
  let changed = false;
  for (const [key, value] of Object.entries(entries)) {
    if (!Object.prototype.hasOwnProperty.call(payload, key)) {
      payload[key] = value;
      changed = true;
    }
  }
  return changed ? JSON.stringify(payload) : msg.content;
}

function messageRow(message: OutboundMessage): MessageOutRow {
  return {
    id: message.id,
    seq: message.sequence,
    in_reply_to: message.inReplyTo,
    timestamp: message.timestamp,
    deliver_after: message.deliverAfter,
    recurrence: message.recurrence,
    kind: message.kind,
    platform_id: message.platformId,
    channel_type: message.channelType,
    thread_id: message.threadId,
    content: message.content,
  };
}

export function writeMessageOut(msg: WriteMessageOut): Promise<number> {
  return getAgentMailbox().operations.writeMessageOut({
    id: msg.id,
    inReplyTo: msg.in_reply_to,
    deliverAfter: msg.deliver_after,
    recurrence: msg.recurrence,
    kind: msg.kind,
    platformId: msg.platform_id,
    channelType: msg.channel_type,
    threadId: msg.thread_id,
    content: decorateContent(msg),
  });
}

/**
 * The odd/even seq split between outbound and inbound is load-bearing here,
 * not just collision avoidance: seq is the agent-facing message ID returned by
 * send_message and accepted by add_reaction, and this lookup spans BOTH tables.
 * If inbound and outbound could share a seq, the agent's "react to message #5"
 * could resolve to the wrong row.
 */
export function getMessageIdBySeq(seq: number): string | null {
  return getAgentMailbox().operations.getMessageIdBySeq(seq);
}

export function getRoutingBySeq(
  seq: number,
): { channel_type: string | null; platform_id: string | null; thread_id: string | null } | null {
  const routing = getAgentMailbox().operations.getRoutingBySeq(seq);
  return (
    routing && {
      channel_type: routing.channelType,
      platform_id: routing.platformId,
      thread_id: routing.threadId,
    }
  );
}

/**
 * True if this session has previously written an outbound row to the same
 * (channel_type, platform_id, thread_id) tuple — i.e. we originated /
 * already dispatched on this thread to this destination. Used by the a2a
 * runtime guard in send_message to distinguish "I'm continuing my own
 * thread" from "I'm writing into a thread the peer owns" (the latter
 * should require in_reply_to to prove the link).
 */
export function hasOutboundToThread(channelType: string, platformId: string, threadId: string): boolean {
  return getAgentMailbox().operations.hasOutboundToThread(channelType, platformId, threadId);
}


/**
 * Highest outbound seq currently in `messages_out` (0 when empty).
 *
 * The poll loop samples this before a turn and again at its `result` event: a
 * strictly greater value means the turn produced at least one outbound row, by
 * ANY path. An in-process counter can't answer that — the MCP tools
 * (`send_message`, `send_file`, …) run in a separate stdio process and write
 * to the same file — so the watermark has to come from the DB. seq is
 * monotonic (container writes odd, never reused) and nothing deletes from
 * `messages_out`, so this only ever increases.
 */
export function outboundWatermark(): number {
  return getAgentMailbox().operations.outboundWatermark();
}

/** Get undelivered messages (for host polling — reads from outbound.db). */
export function getUndeliveredMessages(): MessageOutRow[] {
  return getAgentMailbox().operations.getUndeliveredMessages().map(messageRow);
}

/**
 * True when an outbound row already exists for (platformId, channelType) with
 * the same text and no in_reply_to — i.e. the agent already sent this exact
 * message via the MCP tool this turn. Used by sendToDestination to drop a
 * turn-final <message> echo of an already-sent task message (#943). Restored
 * on the upstream sync: nv-main re-added it in #943, and it coexists with the
 * one-door task-delivery change as defense-in-depth.
 */
export function hasIdenticalSend(platformId: string, channelType: string, text: string): boolean {
  return getAgentMailbox().operations.hasIdenticalSend(platformId, channelType, text);
}

