/**
 * Agent-to-agent message routing.
 *
 * Outbound messages with `channel_type === 'agent'` target another agent
 * group rather than a channel. Permission is enforced via `agent_destinations` —
 * the source agent must have a row for the target. Content is copied into the
 * target's inbound DB; if the source message had `files` (from `send_file`),
 * the actual bytes are copied from the source's outbox into the target's
 * `inbox/<a2a-msg-id>/` directory and surfaced to the target agent as
 * `attachments` (existing formatter convention — see formatter.ts:230).
 * The target agent can then forward the file onward via its own `send_file`
 * call using the absolute `/workspace/inbox/<a2a-msg-id>/<filename>` path.
 *
 * Self-messages are always allowed (used for system notes injected back into
 * an agent's own session, e.g. post-approval follow-up prompts).
 *
 * Core delivery.ts dispatches into this via a dynamic import guarded by a
 * `channel_type === 'agent'` check. When the module is absent the check in
 * core throws with a "module not installed" message so retry → mark failed.
 */
import fs from 'fs';
import path from 'path';

import { isSafeAttachmentName } from '../../attachment-safety.js';
import { getSourceFor, recordSource, type A2aSessionSource } from '../../db/a2a-session-sources.js';
import { getAgentGroup } from '../../db/agent-groups.js';
import {
  createMessagingGroup,
  createMessagingGroupAgent,
  getMessagingGroupAgents,
  getMessagingGroupByPlatform,
} from '../../db/messaging-groups.js';
import { getInboundSourceSessionId, getMostRecentPeerSourceSessionId } from '../../db/session-db.js';
import { getSession } from '../../db/sessions.js';
import { wakeContainer } from '../../container-runner.js';
import { log } from '../../log.js';
import { openInboundDb, resolveSession, sessionDir, writeSessionMessage } from '../../session-manager.js';
import type { Session } from '../../types.js';
import { hasDestination } from './db/agent-destinations.js';

/**
 * Ensure a per-(source, recipient) messaging_group exists with a per-thread
 * wiring for the recipient. Idempotent; returns the mg id.
 *
 * Platform-id format: `agent:<source-ag>:<recipient-ag>` so two distinct
 * sources delegating into the same recipient with the same thread_id
 * (e.g. both picking "review-PR-A") get two distinct recipient sessions,
 * one per pair. The older `agent:<recipient>` form (sourceAgentGroupId=null)
 * is kept for back-compat callers that intentionally share across senders —
 * none in-tree today, but the signature leaves the door open.
 *
 * Rationale: per-thread session resolution needs a messaging_group_id as
 * part of its lookup key. Old code used `agent-shared` which ignores
 * messaging_group + thread_id entirely — that's kept as the fallback for
 * unthreaded (thread_id=null) a2a calls. Threaded a2a calls route through
 * this synthetic group so `(recipient, a2a_mg, thread_id)` can key a
 * unique session per delegation.
 *
 * Back-compat: pre-existing a2a wirings (rare — most installs have none
 * since agent-shared doesn't create mga rows) are upgraded via migration
 * 019. This helper's own UPDATE catches any slipped-through `'shared'`
 * rows on the synthetic group too, so first threaded delivery self-heals.
 */
export function ensureA2aWiring(
  targetAgentGroupId: string,
  sourceAgentGroupId: string | null = null,
  now: string = new Date().toISOString(),
): string {
  const platformId = sourceAgentGroupId
    ? `agent:${sourceAgentGroupId}:${targetAgentGroupId}`
    : `agent:${targetAgentGroupId}`;
  let mg = getMessagingGroupByPlatform('agent', platformId);
  if (!mg) {
    const mgId = `mg-a2a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    createMessagingGroup({
      id: mgId,
      channel_type: 'agent',
      platform_id: platformId,
      name: null,
      is_group: 0,
      unknown_sender_policy: 'public',
      admin_user_id: null,
      created_at: now,
    });
    mg = getMessagingGroupByPlatform('agent', platformId)!;
  }

  const existing = getMessagingGroupAgents(mg.id).find((a) => a.agent_group_id === targetAgentGroupId);
  if (!existing) {
    createMessagingGroupAgent({
      id: `mga-a2a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      messaging_group_id: mg.id,
      agent_group_id: targetAgentGroupId,
      engage_mode: 'always',
      engage_pattern: null,
      sender_scope: 'all',
      ignored_message_policy: 'drop',
      session_mode: 'per-thread',
      priority: 0,
      created_at: now,
    } as never);
  }
  return mg.id;
}

export { isSafeAttachmentName };

export interface ForwardedAttachment {
  name: string;
  filename: string;
  type: 'file';
  localPath: string;
}

/**
 * Copy file attachments from the source agent's outbox into the target
 * agent's inbox. Returns attachments using the formatter's existing
 * `{name, type, localPath}` convention — target agent reads `localPath`
 * as relative to `/workspace/`, matching how channel-inbound attachments
 * are surfaced today.
 *
 * Missing source files and unsafe (path-traversal) filenames are skipped
 * with a warning rather than failing the whole route — a bad filename
 * reference shouldn't kill the accompanying text.
 */
export function forwardAttachedFiles(
  source: { agentGroupId: string; sessionId: string; messageId: string; filenames: string[] },
  target: { agentGroupId: string; sessionId: string; messageId: string },
): ForwardedAttachment[] {
  if (source.filenames.length === 0) return [];

  const sourceDir = path.join(sessionDir(source.agentGroupId, source.sessionId), 'outbox', source.messageId);
  if (!fs.existsSync(sourceDir)) {
    log.warn('agent-route: source outbox dir missing, no files forwarded', {
      sourceMsgId: source.messageId,
      sourceDir,
    });
    return [];
  }

  const targetInboxDir = path.join(sessionDir(target.agentGroupId, target.sessionId), 'inbox', target.messageId);
  fs.mkdirSync(targetInboxDir, { recursive: true });

  const attachments: ForwardedAttachment[] = [];
  for (const filename of source.filenames) {
    if (!isSafeAttachmentName(filename)) {
      log.warn('agent-route: rejecting unsafe attachment filename (path traversal attempt?)', {
        sourceMsgId: source.messageId,
        filename,
      });
      continue;
    }
    const src = path.join(sourceDir, filename);
    if (!fs.existsSync(src)) {
      log.warn('agent-route: referenced file missing in source outbox, skipped', {
        sourceMsgId: source.messageId,
        filename,
      });
      continue;
    }
    const dst = path.join(targetInboxDir, filename);
    fs.copyFileSync(src, dst);
    attachments.push({
      name: filename,
      filename,
      type: 'file',
      localPath: `inbox/${target.messageId}/${filename}`,
    });
  }
  return attachments;
}

export interface RoutableAgentMessage {
  id: string;
  platform_id: string | null;
  /** Thread identifier carried from sender's context. When non-null, routes
   *  to a per-thread session under the recipient; when null, falls back to
   *  agent-shared for back-compat with pre-threading installs. */
  thread_id?: string | null;
  content: string;
  /** For replies, the id of the inbound message being replied to. The
   *  container's MCP tools (send_message/send_file) stamp this from
   *  current-batch.ts. Used here as layer 1.5 to look up the originating
   *  session in the source agent's inbound DB and route the reply there
   *  even when the target has multiple active sessions. */
  in_reply_to?: string | null;
}

/**
 * Try to resolve an explicit reply target via `in_reply_to`.
 *
 * Two layers, both backed by `messages_in.source_session_id` in the source
 * agent's inbound DB (stamped by `routeAgentMessage` when delivering
 * a2a inbound rows):
 *
 * 1. **Direct lookup** — if `msg.in_reply_to` is set, read the triggering
 *    inbound row's `source_session_id`. That's the session that initiated
 *    the conversation; replies should land there even when the target
 *    agent has multiple active sessions.
 *
 * 2. **Peer-affinity fallback** — if direct lookup misses (no in_reply_to,
 *    referenced row isn't an a2a inbound, or column is null), find the
 *    most recent a2a inbound from this peer in the source's inbound DB
 *    and use its `source_session_id`. Intuition: the last time this peer
 *    talked to me, which session was driving?
 *
 * Returns null if neither layer resolves to an active session in the
 * target agent group — caller falls through to the fork's existing
 * reply-detection / fresh-delegation logic below.
 */
function resolveExplicitReplyTarget(
  msg: RoutableAgentMessage,
  sourceSession: Session,
  targetAgentGroupId: string,
): Session | null {
  let srcDb;
  try {
    srcDb = openInboundDb(sourceSession.agent_group_id, sourceSession.id);
  } catch {
    // Source session's inbound DB may not exist yet (fresh source, never
    // received an inbound). No prior a2a inbounds means no source_session_id
    // to look up — fall through to existing reply-detection / fresh path.
    return null;
  }
  let originSessionId: string | null = null;
  try {
    if (msg.in_reply_to) {
      originSessionId = getInboundSourceSessionId(srcDb, msg.in_reply_to);
    }
    if (!originSessionId) {
      originSessionId = getMostRecentPeerSourceSessionId(srcDb, targetAgentGroupId);
    }
  } finally {
    srcDb.close();
  }
  if (!originSessionId) return null;
  const candidate = getSession(originSessionId);
  if (candidate && candidate.agent_group_id === targetAgentGroupId && candidate.status === 'active') {
    return candidate;
  }
  return null;
}

/**
 * Maximum a2a chain depth to walk when looking for an ancestor session.
 * Real chains are shallow (orchestrator → triager → fixer → reviewer is 4
 * sessions / 3 hops). The cap exists purely to bound runaway walks if
 * `a2a_session_sources` ever holds a corrupt cycle.
 */
const ANCESTOR_HOP_LIMIT = 16;

/**
 * Walk `a2a_session_sources` upward from `startSessionId`, looking for the
 * closest ancestor whose `source_agent_group_id` matches the target.
 *
 * Returns the matching `A2aSessionSource` row when found — its
 * `source_session_id` is the ancestor session to deliver into and
 * `source_thread_id` is the thread the ancestor used to delegate downward
 * (i.e. the thread the ancestor knows this conversation by).
 *
 * Returns null when:
 *   - the start session has no a2a source (it's a top-level / channel-side
 *     session), OR
 *   - no hop in the chain matches the target (the target is a peer or
 *     unrelated group, not an ancestor).
 *
 * Bounded by ANCESTOR_HOP_LIMIT and a visited set so corrupt cycles are
 * dropped instead of looping.
 */
function findAncestorRoute(
  startSessionId: string,
  targetAgentGroupId: string,
): A2aSessionSource | null {
  const visited = new Set<string>([startSessionId]);
  let cursor = getSourceFor(startSessionId);
  let hops = 0;
  while (cursor && hops < ANCESTOR_HOP_LIMIT) {
    if (cursor.source_agent_group_id === targetAgentGroupId) {
      return cursor;
    }
    if (visited.has(cursor.source_session_id)) {
      log.warn('a2a ancestor walk: cycle detected, dropping', {
        startSessionId,
        targetAgentGroupId,
        cycleAt: cursor.source_session_id,
      });
      return null;
    }
    visited.add(cursor.source_session_id);
    cursor = getSourceFor(cursor.source_session_id);
    hops++;
  }
  return null;
}

/**
 * Deliver an a2a outbound as a reply into the ancestor session identified
 * by `route` (a row from `a2a_session_sources`). Mirrors the previous
 * direct-parent reply handler — same stale-source / self-loop guards,
 * same write semantics — generalised to any depth.
 */
async function deliverAncestorReply(
  msg: RoutableAgentMessage,
  session: Session,
  route: A2aSessionSource,
): Promise<void> {
  const ancestorSession = getSession(route.source_session_id);
  if (!ancestorSession) {
    // Fail closed. The ancestor session the lineage points at is gone
    // (deleted, archived, reset). Synthesising a brand-new session would
    // silently stage reply content into an operator-less room. Drop with
    // an audit trail instead.
    log.warn('a2a ancestor reply dropped: ancestor session no longer exists', {
      msgId: msg.id,
      recipientSessionId: session.id,
      ancestorSessionId: route.source_session_id,
      ancestorAgentGroupId: route.source_agent_group_id,
      ancestorThreadId: route.source_thread_id,
    });
    return;
  }

  // Self-loop guard. A sourceHint pointing at self should never exist
  // (recordSource is gated by the main-route same-session guard), but if
  // a migration / backfill / future code path ever populates a self-
  // reference, drop here rather than write the agent's own outbound back
  // into its own inbox.
  if (ancestorSession.id === session.id) {
    log.warn('a2a ancestor reply self-loop dropped: walk landed on emitter', {
      msgId: msg.id,
      sessionId: session.id,
      agentGroupId: session.agent_group_id,
      ancestorAgentGroupId: route.source_agent_group_id,
      ancestorThreadId: route.source_thread_id,
    });
    return;
  }

  const a2aReplyId = `a2a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const forwardedReplyContent = forwardFileAttachments(
    msg,
    a2aReplyId,
    session,
    ancestorSession.agent_group_id,
    ancestorSession.id,
  );
  writeSessionMessage(ancestorSession.agent_group_id, ancestorSession.id, {
    id: a2aReplyId,
    kind: 'chat',
    timestamp: new Date().toISOString(),
    platformId: session.agent_group_id,
    channelType: 'agent',
    threadId: route.source_thread_id,
    content: injectA2aSourceThread(forwardedReplyContent, session.thread_id),
    sourceSessionId: session.id,
  });
  log.info('Agent reply routed back to ancestor session', {
    from: session.agent_group_id,
    recipientSessionId: session.id,
    to: ancestorSession.agent_group_id,
    targetSession: ancestorSession.id,
    threadId: route.source_thread_id,
    a2aMsgId: a2aReplyId,
    forwardedFileCount: countForwardedFiles(forwardedReplyContent),
  });
  const freshAncestor = getSession(ancestorSession.id);
  if (freshAncestor) await wakeContainer(freshAncestor);
}

export async function routeAgentMessage(msg: RoutableAgentMessage, session: Session): Promise<void> {
  const targetAgentGroupId = msg.platform_id;
  if (!targetAgentGroupId) {
    throw new Error(`agent-to-agent message ${msg.id} is missing a target agent group id`);
  }

  // Reply-detection branch — ancestor walk through a2a_session_sources.
  //
  // If the sending session is the recipient side of a prior a2a delegation
  // (a2a_session_sources has a row for it) AND the outbound is addressed
  // to an agent group anywhere in this session's source ancestry, route
  // the message into that ancestor's existing session instead of
  // synthesising a fresh one. This subsumes the original 1-hop "reply to
  // direct parent" shortcut and adds multi-hop ancestor delivery:
  //
  //   - 1 hop  = direct parent reply (e.g. fixer → triager in
  //              orchestrator → triager → fixer; existing behaviour)
  //   - 2+ hops = explicit ancestor report (e.g. fixer → orchestrator;
  //              previously created a fresh per-thread session like
  //              q7xfmf, fragmenting the dashboard view)
  //
  // The walk is bounded by ANCESTOR_HOP_LIMIT and a visited set so corrupt
  // cycles drop. Targets that are NOT in the ancestry fall through to the
  // normal route below — preserves peer-to-peer (e.g. reviewer → fixer
  // when neither is in the other's ancestry) and B → C fresh delegation.
  //
  // The contract is: default communication follows the lineage edge
  // upward; explicit communication may target an ancestor, but never
  // creates a new ancestor session if lineage proves an existing one.
  const ancestorRoute = findAncestorRoute(session.id, targetAgentGroupId);
  if (ancestorRoute) {
    await deliverAncestorReply(msg, session, ancestorRoute);
    return;
  }

  if (
    targetAgentGroupId !== session.agent_group_id &&
    !hasDestination(session.agent_group_id, 'agent', targetAgentGroupId)
  ) {
    throw new Error(
      `unauthorized agent-to-agent: ${session.agent_group_id} has no destination for ${targetAgentGroupId}`,
    );
  }
  if (!getAgentGroup(targetAgentGroupId)) {
    throw new Error(`target agent group ${targetAgentGroupId} not found for message ${msg.id}`);
  }

  // Layer 1.5: explicit in_reply_to / peer-affinity lookup.
  //
  // The fork's per-session reply-detection above misses two cases this
  // covers: (a) the sending session has been a recipient of multiple
  // distinct sources, so a2a_session_sources only records the LAST one;
  // (b) the in_reply_to references an inbound that pre-dates the
  // a2a_session_sources entry (e.g. session was replayed). When set,
  // the resolved session bypasses the fresh-delegation mg+thread path
  // — it's the conversation's actual originator.
  let targetSession: Session;
  let threadId: string | null;
  let usedExplicitReplyTarget = false;
  const explicitTarget = resolveExplicitReplyTarget(msg, session, targetAgentGroupId);
  if (explicitTarget) {
    targetSession = explicitTarget;
    threadId = explicitTarget.thread_id ?? null;
    usedExplicitReplyTarget = true;
  } else {
    // Fresh-delegation path:
    //  - thread_id present → per-thread session keyed on (recipient,
    //    agent:<source>:<recipient> mg, thread_id). Each unique
    //    (source, thread) pair starts its own isolated recipient session
    //    so two sources picking the same thread_id don't merge.
    //  - thread_id null but source session has one → inherit it, so outbound
    //    from a threaded session stays scoped (Slack-style DM isolation).
    //  - both null → per-source shared (each source↔recipient pair gets its
    //    own session, not a global agent-shared that collapses all sources).
    const explicitThread = msg.thread_id && msg.thread_id.trim() !== '' ? msg.thread_id : null;
    threadId = explicitThread || session.thread_id || null;
    const a2aMgId = ensureA2aWiring(targetAgentGroupId, session.agent_group_id);
    ({ session: targetSession } = resolveSession(
      targetAgentGroupId,
      a2aMgId,
      threadId,
      threadId ? 'per-thread' : 'shared',
    ));

    // L2 same-session guard — the host-side last line of defense against
    // engine self-loop (PR #355's regression class). If a self-targeted
    // a2a (channel='agent', platform_id=<own group>) leaks past the
    // formatter <system-notification> wrap (L3a), notifyAgent's
    // channelType='system' (L3b), and the poll-loop L1 platformId/system
    // gate, this guard drops the write before recordSource creates a
    // self-referential a2a_session_sources row and writeSessionMessage
    // delivers the agent's own outbound back into its own inbox.
    if (targetSession.id === session.id) {
      log.warn('a2a main-route self-target dropped: target session resolves to emitter', {
        msgId: msg.id,
        sessionId: session.id,
        agentGroupId: session.agent_group_id,
        targetAgentGroupId,
        threadId,
      });
      return;
    }

    // Stamp the route-back hint so the recipient's reply can find its way
    // home. Covers both per-thread and agent-shared paths — even shared
    // sessions benefit from the reply-detection branch above, so long as
    // only one source is active at a time against that recipient.
    recordSource({
      recipientSessionId: targetSession.id,
      recipientAgentGroupId: targetAgentGroupId,
      recipientThreadId: threadId,
      sourceSessionId: session.id,
      sourceAgentGroupId: session.agent_group_id,
      sourceThreadId: threadId,
    });
  }

  const a2aMsgId = `a2a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // If the source message references files (via `send_file`), forward the
  // bytes from the source's outbox into the target's inbox so the target
  // agent can actually see and re-send them. Without this, agent-to-agent
  // file attachments look like they arrive but the target has no way to
  // read the bytes — they live in a session dir it doesn't mount.
  const forwardedContent = forwardFileAttachments(msg, a2aMsgId, session, targetAgentGroupId, targetSession.id);

  writeSessionMessage(targetAgentGroupId, targetSession.id, {
    id: a2aMsgId,
    kind: 'chat',
    timestamp: new Date().toISOString(),
    platformId: session.agent_group_id,
    channelType: 'agent',
    threadId,
    content: injectA2aSourceThread(forwardedContent, session.thread_id),
    sourceSessionId: session.id,
  });
  log.info('Agent message routed', {
    from: session.agent_group_id,
    to: targetAgentGroupId,
    targetSession: targetSession.id,
    threadId,
    a2aMsgId,
    forwardedFileCount: countForwardedFiles(forwardedContent),
    via: usedExplicitReplyTarget ? 'in_reply_to' : 'fresh',
  });
  const fresh = getSession(targetSession.id);
  if (fresh) await wakeContainer(fresh);
}

/**
 * Parse source content, copy any referenced `files` from source outbox to
 * target inbox, and return a JSON string with an `attachments` array added
 * (formatter.ts:223 already knows how to render this shape).
 *
 * If the source content isn't JSON or has no files, returns the original
 * content string unchanged — this is safe to call on every route.
 */
function forwardFileAttachments(
  msg: RoutableAgentMessage,
  a2aMsgId: string,
  sourceSession: Session,
  targetAgentGroupId: string,
  targetSessionId: string,
): string {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(msg.content);
  } catch {
    return msg.content;
  }
  const files = parsed.files as unknown;
  if (!Array.isArray(files) || files.length === 0) return msg.content;
  const filenames = files.filter((f): f is string => typeof f === 'string');
  if (filenames.length === 0) return msg.content;

  const attachments = forwardAttachedFiles(
    {
      agentGroupId: sourceSession.agent_group_id,
      sessionId: sourceSession.id,
      messageId: msg.id,
      filenames,
    },
    {
      agentGroupId: targetAgentGroupId,
      sessionId: targetSessionId,
      messageId: a2aMsgId,
    },
  );

  // Merge into any existing `attachments` (unlikely in a2a context but safe).
  const existing = Array.isArray(parsed.attachments) ? (parsed.attachments as Record<string, unknown>[]) : [];
  parsed.attachments = [...existing, ...attachments];

  return JSON.stringify(parsed);
}

function injectA2aSourceThread(content: string, sourceThreadId: string | null): string {
  if (!sourceThreadId) return content;
  try {
    const parsed = JSON.parse(content);
    parsed._a2a_source_thread = sourceThreadId;
    return JSON.stringify(parsed);
  } catch {
    return content;
  }
}

function countForwardedFiles(contentStr: string): number {
  try {
    const parsed = JSON.parse(contentStr);
    return Array.isArray(parsed.attachments) ? parsed.attachments.length : 0;
  } catch {
    return 0;
  }
}
