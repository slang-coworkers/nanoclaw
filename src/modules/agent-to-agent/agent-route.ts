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
import { ensureContainedInboxDir, isPathInside } from '../../inbox-safety.js';
import { findAncestorSource, recordSource, type A2aSessionSource } from '../../db/a2a-session-sources.js';
import { getAgentGroup } from '../../db/agent-groups.js';
import { recordDroppedMessage } from '../../db/dropped-messages.js';
import {
  createMessagingGroup,
  createMessagingGroupAgent,
  getMessagingGroupAgents,
  getMessagingGroupByPlatform,
} from '../../db/messaging-groups.js';
import { getSession } from '../../db/sessions.js';
import { wakeContainer } from '../../container-runner.js';
import { log } from '../../log.js';
import { resolveSession, sessionDir, withExistingMailboxSession, writeSessionMessage } from '../../session-manager.js';
import { GuardDenyError, guard } from '../../guard/index.js';
import type { PendingApproval, Session } from '../../types.js';
import { requestApproval } from '../approvals/index.js';
import { evaluateEchoDrop, extractText } from '../runaway/echo-drop.js';
import { A2A_MESSAGE_GATE_ACTION, a2aSend } from './guard.js';

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
export async function ensureA2aWiring(
  targetAgentGroupId: string,
  sourceAgentGroupId: string | null = null,
  now: string = new Date().toISOString(),
): Promise<string> {
  const platformId = sourceAgentGroupId
    ? `agent:${sourceAgentGroupId}:${targetAgentGroupId}`
    : `agent:${targetAgentGroupId}`;
  let mg = await getMessagingGroupByPlatform('agent', platformId);
  if (!mg) {
    const mgId = `mg-a2a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await createMessagingGroup({
      id: mgId,
      channel_type: 'agent',
      platform_id: platformId,
      name: null,
      is_group: 0,
      unknown_sender_policy: 'public',
      admin_user_id: null,
      created_at: now,
    });
    mg = (await getMessagingGroupByPlatform('agent', platformId))!;
  }

  const existing = (await getMessagingGroupAgents(mg.id)).find((a) => a.agent_group_id === targetAgentGroupId);
  if (!existing) {
    await createMessagingGroupAgent({
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

  if (!isSafeAttachmentName(source.messageId)) {
    log.warn('agent-route: rejecting unsafe source outbox message id', { sourceMsgId: source.messageId });
    return [];
  }

  const sourceDir = path.join(sessionDir(source.agentGroupId, source.sessionId), 'outbox', source.messageId);
  if (!fs.existsSync(sourceDir)) {
    log.warn('agent-route: source outbox dir missing, no files forwarded', {
      sourceMsgId: source.messageId,
      sourceDir,
    });
    return [];
  }

  let realSourceDir: string;
  try {
    const sourceDirStat = fs.lstatSync(sourceDir);
    if (!sourceDirStat.isDirectory() || sourceDirStat.isSymbolicLink()) {
      log.warn('agent-route: rejecting unsafe source outbox dir', {
        sourceMsgId: source.messageId,
        sourceDir,
      });
      return [];
    }
    realSourceDir = fs.realpathSync(sourceDir);
  } catch (err) {
    log.warn('agent-route: failed to inspect source outbox dir', {
      sourceMsgId: source.messageId,
      sourceDir,
      err,
    });
    return [];
  }

  // Target-side containment — shared with the channel-inbound path. A
  // compromised target agent can write inside its own session dir, so it could
  // pre-place `inbox` (or `inbox/<future-msgId>`) as a symlink pointing
  // anywhere host-writable; ensureContainedInboxDir refuses the symlink before
  // any copy lands outside the sandbox (#2828, CWE-59).
  const inboxRoot = path.join(sessionDir(target.agentGroupId, target.sessionId), 'inbox');
  const targetInboxDir = ensureContainedInboxDir(inboxRoot, target.messageId, {
    targetGroup: target.agentGroupId,
    targetSession: target.sessionId,
    targetMsgId: target.messageId,
  });
  if (!targetInboxDir) {
    return [];
  }

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
    let realSrc: string;
    try {
      const srcStat = fs.lstatSync(src);
      if (!srcStat.isFile() || srcStat.isSymbolicLink()) {
        log.warn('agent-route: rejecting unsafe source outbox file', {
          sourceMsgId: source.messageId,
          filename,
        });
        continue;
      }
      realSrc = fs.realpathSync(src);
    } catch {
      log.warn('agent-route: referenced file missing in source outbox, skipped', {
        sourceMsgId: source.messageId,
        filename,
      });
      continue;
    }
    if (!isPathInside(realSourceDir, realSrc)) {
      log.warn('agent-route: rejecting source file outside source outbox dir', {
        sourceMsgId: source.messageId,
        filename,
      });
      continue;
    }
    const dst = path.join(targetInboxDir, filename);
    try {
      // COPYFILE_EXCL: fail with EEXIST rather than follow or overwrite a
      // pre-placed symlink / existing file at dst — the host is the sole
      // writer of these attachments.
      fs.copyFileSync(realSrc, dst, fs.constants.COPYFILE_EXCL);
    } catch (err) {
      log.warn('agent-route: refusing to write target inbox file', {
        sourceMsgId: source.messageId,
        targetMsgId: target.messageId,
        filename,
        err,
      });
      continue;
    }
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
  /** Sender-pinned recipient session id. When set, routing delivers to
   *  that exact session if (a) it belongs to the resolved target agent
   *  group and (b) it is active. Falls through to the existing routing
   *  layers on any validation mismatch. The pin narrows session selection
   *  within an authorized recipient — it does NOT bypass the destination
   *  authorization check. Use to wake a specific paused session whose
   *  context you want to resume (e.g. orchestrator lifting a pause for
   *  queued work that was originally handed off by a peer chain). */
  target_session_id?: string | null;
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
async function resolveExplicitReplyTarget(
  msg: RoutableAgentMessage,
  sourceSession: Session,
  targetAgentGroupId: string,
): Promise<Session | null> {
  // withExistingMailboxSession resolves undefined when the source session has
  // no provisioned mailbox yet (fresh source, never received an inbound). No
  // prior a2a inbounds means no source_session_id to look up — fall through to
  // existing reply-detection / fresh path.
  const resolved = await withExistingMailboxSession(sourceSession.agent_group_id, sourceSession.id, (srcDb) => {
    let originSessionId: string | null = null;
    let viaDirectInReplyTo = false;
    if (msg.in_reply_to) {
      originSessionId = srcDb.getInboundSourceSessionId(msg.in_reply_to);
      if (originSessionId) viaDirectInReplyTo = true;
    }
    if (!originSessionId) {
      // Pass msg.thread_id so peer-affinity respects the thread the sender
      // explicitly addressed. Without this filter, an outbound to peer P
      // on thread X would route to whichever P-session most recently
      // talked to us — even if that session belongs to thread Y. With
      // multi-thread fan-out (a parent dispatches to one peer agent group
      // on two distinct threads), the unfiltered heuristic mis-routes;
      // the thread-scoped lookup pins to the right peer session.
      const threadId = msg.thread_id?.trim() || null;
      originSessionId = srcDb.getMostRecentPeerSourceSessionId(targetAgentGroupId, threadId);
    }
    return { originSessionId, viaDirectInReplyTo };
  });
  if (!resolved?.originSessionId) return null;
  const { originSessionId, viaDirectInReplyTo } = resolved;
  const candidate = await getSession(originSessionId);
  if (!candidate || candidate.agent_group_id !== targetAgentGroupId || candidate.status !== 'active') {
    return null;
  }

  // Cross-thread hijack guard (D1): a DIRECT in_reply_to hit whose origin
  // session sits on a thread matching NEITHER the thread the agent stamped on
  // this outbound NOR the sender's own thread is a stale reference — the named
  // inbound belongs to a different conversation than the one the agent actually
  // addressed. Honoring it delivers the message into an unrelated session and
  // skips the auth + message gate the ancestor/fresh path enforces. Fall
  // through so the stamped thread's own routing applies instead. Untouched:
  // same-thread replies (candidate.thread_id === stamped), replies to a
  // threadless session e.g. the orchestrator (candidate.thread_id null),
  // same-thread-as-sender replies (candidate.thread_id === sender's), the
  // already-thread-filtered peer-affinity path, and genuine ancestor replies
  // (the Layer-2 ancestor walk re-resolves them to the same session).
  const stamped = msg.thread_id?.trim() || null;
  if (
    viaDirectInReplyTo &&
    stamped &&
    candidate.thread_id &&
    candidate.thread_id !== stamped &&
    candidate.thread_id !== sourceSession.thread_id
  ) {
    log.warn('a2a in_reply_to cross-thread reference rejected (D1 guard)', {
      source: sourceSession.id,
      sourceThread: sourceSession.thread_id,
      stampedThread: stamped,
      candidate: candidate.id,
      candidateThread: candidate.thread_id,
      inReplyTo: msg.in_reply_to,
    });
    return null;
  }

  return candidate;
}

/**
 * Resolve a sender-pinned recipient session id (`target_session_id`).
 *
 * Validates that the pinned session (a) exists, (b) belongs to the resolved
 * target agent group, (c) is active, and (d) is not the sender's own session
 * (self-target — caught by the existing main-route guard later, but rejected
 * here too so we don't silently route a pin to self). Returns null on any
 * mismatch, with a warning log; caller falls through to the existing routing
 * layers as if the pin had not been set.
 *
 * Authorization: this resolver intentionally does NOT bypass the destination
 * row check. The pin narrows session selection within an *already-authorized*
 * recipient — `routeAgentMessage` keeps the regular `hasDestination` gate on
 * the pin path so a coworker without write access to the target group can't
 * shortcut to a session via this field.
 */
async function resolvePinnedTarget(
  msg: RoutableAgentMessage,
  sourceSession: Session,
  targetAgentGroupId: string,
): Promise<Session | null> {
  const pinned = msg.target_session_id?.trim() || null;
  if (!pinned) return null;

  if (pinned === sourceSession.id) {
    log.warn('a2a target_session_id: pin to self rejected', {
      msgId: msg.id,
      sessionId: sourceSession.id,
    });
    return null;
  }
  const candidate = await getSession(pinned);
  if (!candidate) {
    log.warn('a2a target_session_id: session not found, falling through', {
      msgId: msg.id,
      pinned,
      targetAgentGroupId,
    });
    return null;
  }
  if (candidate.agent_group_id !== targetAgentGroupId) {
    log.warn('a2a target_session_id: belongs to different agent group, falling through', {
      msgId: msg.id,
      pinned,
      expected: targetAgentGroupId,
      actual: candidate.agent_group_id,
    });
    return null;
  }
  if (candidate.status !== 'active') {
    log.warn('a2a target_session_id: session not active, falling through', {
      msgId: msg.id,
      pinned,
      status: candidate.status,
    });
    return null;
  }
  return candidate;
}

/**
 * Ancestor walk — delegates to the shared `findAncestorSource` in
 * `db/a2a-session-sources.ts`, which is ALSO what the a2a.send guard consults
 * (via `isAncestorGroup`). Sharing one implementation guarantees the guard's
 * lineage-authorization decision and this router's delivery target can never
 * diverge: if the guard allows an upward reply on lineage grounds, this walk
 * finds the same ancestor row to deliver into. Bounded by ANCESTOR_HOP_LIMIT +
 * a visited-set cycle guard inside the shared helper.
 */
const findAncestorRoute = findAncestorSource;

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
  const ancestorSession = await getSession(route.source_session_id);
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

  // Closed/archived ancestor: refuse to write or wake. Mirrors the active-
  // status guard in resolveExplicitReplyTarget (see line ~250). A closed
  // session row can still be returned by getSession, but staging a new
  // inbound row + waking its container would resurrect a conversation the
  // operator explicitly ended. Drop with an audit trail.
  if (ancestorSession.status !== 'active') {
    log.warn('a2a ancestor reply dropped: ancestor session not active', {
      msgId: msg.id,
      recipientSessionId: session.id,
      ancestorSessionId: ancestorSession.id,
      ancestorAgentGroupId: ancestorSession.agent_group_id,
      ancestorThreadId: route.source_thread_id,
      ancestorStatus: ancestorSession.status,
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
  await writeSessionMessage(ancestorSession.agent_group_id, ancestorSession.id, {
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
  const freshAncestor = await getSession(ancestorSession.id);
  if (freshAncestor) await wakeContainer(freshAncestor);
}

export async function routeAgentMessage(
  msg: RoutableAgentMessage,
  session: Session,
  opts: { grant?: PendingApproval } = {},
): Promise<void> {
  const targetAgentGroupId = msg.platform_id;
  if (!targetAgentGroupId) {
    throw new Error(`agent-to-agent message ${msg.id} is missing a target agent group id`);
  }

  // Authorization + per-edge gate go through the guard seam (guard.ts a2aSend).
  // Its decision carries the full a2a contract: self-send allow, LINEAGE allow
  // (child→ancestor with no destination row — see isAncestorGroup), destination
  // ACL deny, target-exists deny, message-policy hold. An approved replay
  // carries the grant (opts.grant) — the policy hold is satisfied, but the
  // structural checks re-run live, so revoking a destination between hold and
  // approve still blocks delivery.
  //
  // Session resolution + delivery stay in performAgentRoute (the fork's layered
  // Layer-0..3 routing). Because the guard has already authorized here, it is
  // called with enforceGate=false so its own (now-redundant) inline gate never
  // double-fires.
  const decision = await guard(a2aSend, {
    actor: { kind: 'agent', agentGroupId: session.agent_group_id, sessionId: session.id },
    resource: { from: session.agent_group_id, to: targetAgentGroupId },
    payload: { id: msg.id, platform_id: targetAgentGroupId, content: msg.content, in_reply_to: msg.in_reply_to ?? '' },
    grant: opts.grant ?? null,
  });

  if (decision.effect === 'deny') {
    throw new GuardDenyError(decision.reason);
  }

  if (decision.effect === 'hold') {
    const sourceName = (await getAgentGroup(session.agent_group_id))?.name ?? session.agent_group_id;
    const targetName = (await getAgentGroup(targetAgentGroupId))?.name ?? targetAgentGroupId;
    await requestApproval({
      session,
      agentName: sourceName,
      action: A2A_MESSAGE_GATE_ACTION,
      approverUserId: decision.approverUserId,
      title: 'Message approval',
      question: buildGateQuestion(sourceName, targetName, msg.content),
      payload: {
        id: msg.id,
        platform_id: targetAgentGroupId,
        content: msg.content,
        in_reply_to: msg.in_reply_to,
      },
    });
    log.info('Agent message held for approval', {
      from: session.agent_group_id,
      to: targetAgentGroupId,
      msgId: msg.id,
    });
    return;
  }

  await performAgentRoute(msg, session, targetAgentGroupId, false);
}

// Re-exported for back-compat: callers (index.ts, tests) import the gate
// action name from here; its definition lives in guard.ts.
export { A2A_MESSAGE_GATE_ACTION };

const GATE_CARD_BODY_MAX = 1500;

function parseMessageContent(contentStr: string): { text: string; files: string[] } {
  try {
    const parsed = JSON.parse(contentStr) as { text?: unknown; files?: unknown };
    return {
      text: typeof parsed.text === 'string' ? parsed.text : '',
      files: Array.isArray(parsed.files) ? parsed.files.filter((f): f is string => typeof f === 'string') : [],
    };
  } catch {
    return { text: contentStr, files: [] };
  }
}

function buildGateQuestion(sourceName: string, targetName: string, contentStr: string): string {
  const { text, files } = parseMessageContent(contentStr);
  const body = text.length > GATE_CARD_BODY_MAX ? `${text.slice(0, GATE_CARD_BODY_MAX)}… (truncated)` : text;
  const lines = [`Agent "${sourceName}" wants to send a message to "${targetName}":`, '', body];
  if (files.length > 0) lines.push('', `Attachments: ${files.join(', ')}`);
  lines.push(
    '',
    `Approve, Reject, or "Reject with reason…" to decline and then type a short reason I'll relay to "${sourceName}".`,
  );
  return lines.join('\n');
}

/**
 * Cross-session route: pick the target session via the fork's layered routing
 * (Layer 0 sender-pinned, Layer 1 explicit in_reply_to / peer-affinity, Layer 2
 * ancestor walk, Layer 3 fresh per-thread/per-source), enforce the destination
 * auth + the optional per-edge message gate, forward files, write to the target
 * inbox, and wake it. The gate approve-handler re-enters here with
 * `enforceGate=false` so an approved message is delivered rather than re-held.
 */
export async function performAgentRoute(
  msg: RoutableAgentMessage,
  session: Session,
  targetAgentGroupId: string,
  enforceGate = false,
): Promise<void> {
  // Layer 0: sender-pinned recipient session id.
  //
  // When `msg.target_session_id` is set, the sender has explicitly chosen
  // which session within the recipient agent group to deliver into. Used
  // for resume-paused-session flows (e.g. orchestrator wakes a peer chain's
  // existing fixer session by id rather than letting routing mint a fresh
  // per-thread session that has no inbox attachments / no working context).
  //
  // The pin only narrows session selection; the auth gate further down still
  // requires a destination row. Validation (ownership + active + not-self)
  // happens in resolvePinnedTarget — invalid pins fall through silently
  // (with a warning) so a stale or wrong id never blocks delivery.
  //
  // Precedence: in_reply_to (Layer 1) wins over the pin because in_reply_to
  // names a specific inbound, which is more semantic than a structural
  // session id; if both are set and they disagree, the inbound being
  // replied-to is the better signal of intent.
  const pinnedTarget = await resolvePinnedTarget(msg, session, targetAgentGroupId);

  // Layer 1: explicit in_reply_to / peer-affinity wins.
  //
  // If the agent named the exact inbound it's answering (or peer-affinity
  // recovers it from the source's inbound DB), the target session is
  // already determined. Resolve it FIRST so it beats the ancestor walk
  // below — "exact inbound named by the sender" is a stronger signal than
  // "target group is in my lineage." Without this precedence, an agent
  // that explicitly references a specific cross-thread inbound would be
  // overridden by the ancestor row keyed only on agent group, losing the
  // routing the sender clearly intended.
  //
  // resolveExplicitReplyTarget already filters to active sessions of the
  // target agent group, so a hit is always a valid delivery target.
  const explicitTarget = await resolveExplicitReplyTarget(msg, session, targetAgentGroupId);

  // Layer 2: ancestor walk through a2a_session_sources.
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
  // Ancestor walk is implicitly authorised by lineage — a child writing
  // upward to its source chain doesn't need a destination row. This
  // mirrors the original 1-hop reply-detection branch, which also bypassed
  // the destination check on the same reasoning.
  //
  // The contract is: default communication follows the lineage edge
  // upward; explicit communication may target an ancestor, but never
  // creates a new ancestor session if lineage proves an existing one.
  // The pin (Layer 0) preempts the ancestor walk. A sender that named a
  // specific session id has overridden the ancestor heuristic — if the pin
  // happens to be the ancestor session anyway, the result is the same;
  // if it's a different session, the pin is what the sender meant.
  if (!explicitTarget && !pinnedTarget) {
    const ancestorRoute = await findAncestorRoute(session.id, targetAgentGroupId);
    if (ancestorRoute) {
      await deliverAncestorReply(msg, session, ancestorRoute);
      return;
    }
  }

  // Authorization + the per-edge message gate are enforced by the guard seam
  // in routeAgentMessage (guard.ts a2aSend) BEFORE this function is called —
  // including the lineage allow (child→ancestor with no destination row). This
  // body is delivery-only; `enforceGate` is retained for signature/back-compat
  // but the gate no longer lives here. A defensive target-exists check stays.
  if (!(await getAgentGroup(targetAgentGroupId))) {
    throw new Error(`target agent group ${targetAgentGroupId} not found for message ${msg.id}`);
  }

  // Layer 3: deliver — using the explicit target resolved at Layer 1, the
  // sender-pinned target from Layer 0, or a fresh per-thread / per-source
  // session as a final fallback. All three share the rest of the writeback
  // path below.
  let targetSession: Session;
  let threadId: string | null;
  let usedExplicitReplyTarget = false;
  let usedPinnedTarget = false;
  if (explicitTarget) {
    targetSession = explicitTarget;
    threadId = explicitTarget.thread_id ?? null;
    usedExplicitReplyTarget = true;
  } else if (pinnedTarget) {
    // Skip the fresh-mg / per-thread mint path: we already know exactly
    // which session to deliver into.
    targetSession = pinnedTarget;
    threadId = pinnedTarget.thread_id ?? null;
    usedPinnedTarget = true;
    log.info('a2a target pinned: routing to sender-named session', {
      msgId: msg.id,
      sessionId: pinnedTarget.id,
      targetAgentGroupId,
    });
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
    const a2aMgId = await ensureA2aWiring(targetAgentGroupId, session.agent_group_id);
    ({ session: targetSession } = await resolveSession(
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
    await recordSource({
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

  // Echo-drop: a no-op coworker message (a bare ack, or the same text looping)
  // is persisted as context-only and does NOT wake the recipient — skipping the
  // expensive full-context replay that a wake triggers. Sibling guard to the L2
  // self-loop drop above; see modules/runaway/echo-drop.ts for the rationale
  // (a runaway "Ignored." echo loop was ~21% of a month's spend).
  const echo = evaluateEchoDrop(targetSession.id, session.id, extractText(msg.content));

  await writeSessionMessage(targetAgentGroupId, targetSession.id, {
    id: a2aMsgId,
    kind: 'chat',
    timestamp: new Date().toISOString(),
    platformId: session.agent_group_id,
    channelType: 'agent',
    threadId,
    content: injectA2aSourceThread(forwardedContent, session.thread_id),
    sourceSessionId: session.id,
    // Dropped echoes accumulate as context (trigger:0) but never wake. NOTE:
    // writeSessionMessage defaults trigger to 1, so this MUST be explicit.
    trigger: !echo.drop,
  });
  log.info('Agent message routed', {
    from: session.agent_group_id,
    to: targetAgentGroupId,
    targetSession: targetSession.id,
    threadId,
    a2aMsgId,
    forwardedFileCount: countForwardedFiles(forwardedContent),
    via: usedExplicitReplyTarget ? 'in_reply_to' : usedPinnedTarget ? 'target_session_id' : 'fresh',
    echoDropped: echo.drop ? echo.reason : undefined,
  });

  if (echo.drop) {
    // Audit the drop (mirrors the no_agent_engaged drop path) and skip the wake.
    await recordDroppedMessage({
      channel_type: 'agent',
      platform_id: session.agent_group_id,
      user_id: null,
      sender_name: session.agent_group_id,
      reason: `echo_drop:${echo.reason}`,
      messaging_group_id: null,
      agent_group_id: targetAgentGroupId,
    });
    return;
  }

  const fresh = await getSession(targetSession.id);
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
