/**
 * Legacy runner-facing inbound API, backed by the registered mailbox.
 */
import { getConfig } from '../config.js';
import { getAgentMailbox } from '../mailbox/index.js';
import type { InboundMessage } from '../mailbox/types.js';

export interface MessageInRow {
  id: string;
  seq: number | null;
  kind: InboundMessage['kind'];
  timestamp: string;
  status: string;
  process_after: string | null;
  recurrence: string | null;
  series_id: string | null;
  tries: number;
  /** 1 = wake-eligible (default); 0 = accumulated context only */
  trigger: number;
  platform_id: string | null;
  channel_type: string | null;
  thread_id: string | null;
  content: string;
  source_session_id: string | null;
  on_wake: number;
}

function messageRow(message: InboundMessage): MessageInRow {
  return {
    id: message.id,
    seq: message.sequence,
    kind: message.kind,
    timestamp: message.timestamp,
    status: message.status,
    process_after: message.processAfter,
    recurrence: message.recurrence,
    series_id: message.seriesId,
    tries: message.tries,
    trigger: message.trigger ? 1 : 0,
    platform_id: message.platformId,
    channel_type: message.channelType,
    thread_id: message.threadId,
    content: message.content,
    source_session_id: message.sourceSessionId,
    on_wake: message.onWake ? 1 : 0,
  };
}

// Cap on how many messages reach the agent in one prompt. Read from
// container.json; falls back to 10.
function getMaxMessagesPerPrompt(): number {
  try {
    return getConfig().maxMessagesPerPrompt;
  } catch {
    // Config not loaded yet (e.g. test harness) — use default
    return 10;
  }
}

/**
 * Sidecar `content.type` values that are private host↔tool handshakes, never
 * agent-turn input: the `ncl` CLI and `ask_user_question` MCP tool each read
 * their own row by `content LIKE requestId` and ack it via processing_ack.
 * (Other system rows, e.g. action=register_group / create_agent results, ARE
 * surfaced to the agent as <system_response> and must NOT be filtered — hence
 * we key on the sidecar `type`, not a blanket kind='system'.)
 *
 * These rows carry `process_after = NULL` (always "due"), and a timed-out ncl
 * pollResponse leaves one `pending` forever with no reaper. If they were
 * counted by the cap window below they would pile up at high seq and starve
 * lower-seq scheduled tasks (kind='task'), which then never fire — and since
 * handleRecurrence only advances a series on completion, the whole recurrence
 * freezes (observed 2026-07-09: the daily learnings-wiki synth stalled behind
 * 83 orphaned cli_response rows; re-arming process_after can't help because
 * starvation is on seq/position, not time). So the filter must run BEFORE the
 * cap window, on the full unclaimed set — never after it.
 */
const SIDECAR_TYPES = new Set(['cli_response', 'question_response']);

/** Ask the mailbox for the whole unclaimed due set; this file re-windows. */
const NO_CAP = 1_000_000;

function isSidecar(content: string): boolean {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return false;
    const type = (parsed as Record<string, unknown>).type;
    return typeof type === 'string' && SIDECAR_TYPES.has(type);
  } catch {
    return false;
  }
}

/**
 * Fetch pending messages that are due for processing.
 * Fetch pending messages while excluding work already claimed by this runner.
 *
 * Selection is two-phase so accumulated context can never crowd a wake row
 * out of the batch: all due trigger=1 rows come first (oldest-first, up to
 * `maxMessagesPerPrompt`), then remaining slots fill with the NEWEST due
 * trigger=0 rows. Without this, ≥cap accumulated context rows (e.g.
 * non-engaged group messages) newer than a due task row would push the task
 * itself out of the batch. The combined batch is returned in chronological
 * order (oldest first). Host's countDueMessages gates waking on trigger=1
 * separately through the host mailbox contract.
 *
 * ORDER MATTERS: claim filtering runs BEFORE the cap windowing. Rows this
 * runner already claimed can remain pending until the host sweep syncs state;
 * windowing first
 * would let a cap-sized batch of those claimed rows fill the window, the
 * ack filter would then empty it, and genuinely new rows beyond the window
 * would be invisible for the rest of the turn.
 */
export function getPendingMessages(isFirstPoll = false): MessageInRow[] {
  // NO_CAP asks the mailbox for every unclaimed due row so the sidecar filter
  // and the cap window below both run on the complete set (see isSidecar).
  const all = getAgentMailbox()
    .operations.getPendingMessages(NO_CAP, isFirstPoll)
    .map(messageRow)
    .filter((m) => !isSidecar(m.content));

  const cap = getMaxMessagesPerPrompt();
  const wake = all.filter((m) => m.trigger === 1).slice(0, cap);
  const remaining = cap - wake.length;
  const context = remaining > 0 ? all.filter((m) => m.trigger === 0).slice(-remaining) : [];
  return [...wake, ...context].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
}

export function markProcessing(ids: string[]): void {
  getAgentMailbox().operations.markMessages(ids, 'processing');
}

export function markCompleted(ids: string[]): void {
  getAgentMailbox().operations.markMessages(ids, 'completed');
}

export function markScriptSkipped(skips: Array<{ id: string; reason: string }>): void {
  getAgentMailbox().operations.markScriptSkipped(skips);
}

/**
 * Mark trigger messages as a transient a2a bounce — the turn errored on a
 * transient/unknown provider fault (auth outage, gateway 5xx, …) and produced
 * no delivered output, so the handoff was NOT actioned. We write a distinct
 * processing_ack status instead of 'completed' so:
 *   - the host's syncProcessingAcks (which only maps completed/failed/
 *     script-skip:error) leaves the trigger `messages_in` row PENDING, and
 *   - the host redrive sweep (redriveBouncedA2a) can find these rows by status
 *     and re-arm them with an outage-scale backoff, or dead-letter on exhaustion.
 * `status` is 'bounced-transient' (long retry budget) or 'bounced-unknown'
 * (short budget → fast dead-letter). Container startup deliberately does NOT
 * clear these (only 'processing'), so the host stays the sole re-arm authority.
 */
export function markBounced(ids: string[], status: 'bounced-transient' | 'bounced-unknown'): void {
  if (ids.length === 0) return;
  getAgentMailbox().operations.markMessages(ids, status);
}

/** Mark a single message as failed — writes to processing_ack in outbound.db. */
export function markFailed(id: string): void {
  getAgentMailbox().operations.markMessages([id], 'failed');
}

export function getMessageIn(id: string): MessageInRow | undefined {
  const message = getAgentMailbox().operations.getMessageIn(id);
  return message && messageRow(message);
}

/** Get a message by seq (the integer id surfaced to the agent in formatted
 *  messages, e.g. `<message id="120">`). Used by the `in_reply_to` arg on
 *  send_message/send_file so the agent can name an exact inbound row when
 *  the batch contains several. */
export function getMessageInBySeq(seq: number): MessageInRow | undefined {
  const message = getAgentMailbox().operations.getMessageInBySeq(seq);
  return message && messageRow(message);
}

/**
 * True if this session has ever received an inbound row from the given
 * (channel_type, platform_id, thread_id) tuple — i.e. the peer has talked
 * to us on this thread before. Pairs with `hasOutboundToThread` for the
 * a2a runtime guard: a write to a peer-owned thread without explicit
 * in_reply_to indicates the agent is dropping context.
 */
export function hasInboundFromThread(channelType: string, platformId: string, threadId: string): boolean {
  return getAgentMailbox().operations.hasInboundFromThread(channelType, platformId, threadId);
}

/**
 * Inbound rows on the given (channel_type, platform_id, thread_id) tuple
 * that have NOT yet been responded to (no outbound row has
 * `in_reply_to = inbound.id`). Returned newest-first.
 *
 * Used to auto-default `in_reply_to` when the agent calls send_message on a
 * peer-originated thread without specifying which inbound it's answering.
 * The "unresponded" filter prevents re-linking to inbounds the agent has
 * already replied to — those are no longer the active conversation.
 */
export function getUnrespondedInboundsFromThread(
  channelType: string,
  platformId: string,
  threadId: string,
): MessageInRow[] {
  return getAgentMailbox()
    .operations.getUnrespondedInboundsFromThread(channelType, platformId, threadId)
    .map(messageRow);
}

/**
 * Find a pending response to a question (by questionId in content).
 * Reads from inbound.db, checks processing_ack to skip already-handled responses.
 */
export function findQuestionResponse(questionId: string): MessageInRow | undefined {
  const message = getAgentMailbox().operations.findQuestionResponse(questionId);
  return message && messageRow(message);
}

export function findCliResponse(requestId: string): MessageInRow | undefined {
  const message = getAgentMailbox().operations.findCliResponse(requestId);
  return message && messageRow(message);
}
