/**
 * Inbound message routing for v2.
 *
 * Channel adapter event → resolve messaging group → access gate → resolve
 * agent group → resolve/create session → write messages_in → wake container.
 *
 * Privilege / access model:
 *   - Owners and global admins: always allowed
 *   - Scoped admins: allowed in their agent group
 *   - Known members (agent_group_members row): allowed in that agent group
 *   - Everyone else: message is dropped per `messaging_groups.unknown_sender_policy`
 *     (strict / request_approval / public)
 *
 * Sender normalization: we derive a namespaced user id from the message
 * content. This is best-effort — native adapters put `sender` in content,
 * chat-sdk-bridge adapters put `senderId`. Adapters should populate both
 * wherever possible so the gate can land on a real user row.
 */
import { canAccessAgentGroup } from './access.js';
import { getChannelAdapter } from './channels/channel-registry.js';
import { isMember } from './db/agent-group-members.js';
import { getMessagingGroupByPlatform, createMessagingGroup, getMessagingGroupAgents } from './db/messaging-groups.js';
import { upsertUser, getUser } from './db/users.js';
import { triggerTyping } from './delivery.js';
import { log } from './log.js';
import { resolveSession, writeSessionMessage } from './session-manager.js';
import { wakeContainer } from './container-runner.js';
import { getSession } from './db/sessions.js';
import type { MessagingGroup, MessagingGroupAgent } from './types.js';

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface InboundEvent {
  channelType: string;
  platformId: string;
  threadId: string | null;
  message: {
    id: string;
    kind: 'chat' | 'chat-sdk';
    content: string; // JSON blob
    timestamp: string;
  };
}

/**
 * Route an inbound message from a channel adapter to the correct session.
 * Creates messaging group + session if they don't exist yet.
 */
export async function routeInbound(event: InboundEvent): Promise<void> {
  // 0. Apply the adapter's thread policy. Non-threaded adapters (Telegram,
  //    WhatsApp, iMessage, email) collapse threads to the channel — the
  //    agent always replies to the main channel regardless of where the
  //    inbound came from.
  const adapter = getChannelAdapter(event.channelType);
  if (adapter && !adapter.supportsThreads) {
    event = { ...event, threadId: null };
  }

  // 1. Resolve messaging group
  let mg = getMessagingGroupByPlatform(event.channelType, event.platformId);

  if (!mg) {
    const mgId = `mg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    mg = {
      id: mgId,
      channel_type: event.channelType,
      platform_id: event.platformId,
      name: null,
      is_group: 0,
      unknown_sender_policy: 'strict',
      created_at: new Date().toISOString(),
    };
    createMessagingGroup(mg);
    log.info('Auto-created messaging group', {
      id: mgId,
      channelType: event.channelType,
      platformId: event.platformId,
    });
  }

  // 2. Resolve sender → user id. Upsert into users table on first sight so
  //    subsequent messages find an existing row. `userId` is null if the
  //    adapter didn't give us enough to identify a sender (the gate will
  //    then apply unknown_sender_policy).
  const userId = extractAndUpsertUser(event);

  // 3. Resolve agent groups wired to this messaging group
  const agents = getMessagingGroupAgents(mg.id);
  if (agents.length === 0) {
    log.warn('MESSAGE DROPPED — no agent groups wired to this channel. Run setup register step to configure.', {
      messagingGroupId: mg.id,
      channelType: event.channelType,
      platformId: event.platformId,
    });
    return;
  }

  // Pick the best matching agent (highest priority, trigger matching in future)
  const match = pickAgent(agents, event);
  if (!match) {
    log.warn('MESSAGE DROPPED — no agent matched trigger rules', {
      messagingGroupId: mg.id,
      channelType: event.channelType,
    });
    return;
  }

  // 4. Access gate. Public channels skip the gate entirely.
  if (mg.unknown_sender_policy !== 'public') {
    const gate = enforceAccess(userId, match.agent_group_id);
    if (!gate.allowed) {
      handleUnknownSender(mg, userId, match.agent_group_id, gate.reason);
      return;
    }
  }

  // 5. Resolve or create session.
  //
  // Adapter thread policy overrides the wiring's session_mode: if the adapter
  // is threaded, each thread gets its own session regardless of what the
  // wiring says, because "thread = session" is the first-class model for
  // threaded platforms. Agent-shared is preserved because it expresses a
  // cross-channel intent the adapter can't know about.
  let effectiveSessionMode = match.session_mode;
  if (adapter && adapter.supportsThreads && effectiveSessionMode !== 'agent-shared') {
    effectiveSessionMode = 'per-thread';
  }
  const { session, created } = resolveSession(match.agent_group_id, mg.id, event.threadId, effectiveSessionMode);

  // 6. Write message to session DB
  writeSessionMessage(session.agent_group_id, session.id, {
    id: event.message.id || generateId(),
    kind: event.message.kind,
    timestamp: event.message.timestamp,
    platformId: event.platformId,
    channelType: event.channelType,
    threadId: event.threadId,
    content: event.message.content,
  });

  log.info('Message routed', {
    sessionId: session.id,
    agentGroup: match.agent_group_id,
    kind: event.message.kind,
    userId,
    created,
  });

  // 7. Show typing indicator while agent processes
  triggerTyping(event.channelType, event.platformId, event.threadId);

  // 8. Wake container
  const freshSession = getSession(session.id);
  if (freshSession) {
    await wakeContainer(freshSession);
  }
}

/**
 * Pick the matching agent for an inbound event.
 * Currently: highest priority agent. Future: trigger rule matching.
 */
function pickAgent(agents: MessagingGroupAgent[], _event: InboundEvent): MessagingGroupAgent | null {
  // Agents are already ordered by priority DESC from the DB query
  // TODO: apply trigger_rules matching (pattern, mentionOnly, etc.)
  return agents[0] ?? null;
}

/**
 * Best-effort sender extraction. Returns a namespaced user id like
 * `telegram:123` or null if nothing usable is present.
 *
 * Side-effect: upserts the user into the `users` table so access/approval
 * lookups can find them on subsequent messages.
 *
 * The namespace uses the channel_type as `kind` for now — e.g. `whatsapp:...`
 * rather than `phone:...`. That's imprecise (a phone number is really the
 * identifier, not the channel) but it keeps the first cut simple. A proper
 * kind mapping (channel → kind) can happen when we start linking identities
 * across channels.
 */
function extractAndUpsertUser(event: InboundEvent): string | null {
  let content: Record<string, unknown>;
  try {
    content = JSON.parse(event.message.content) as Record<string, unknown>;
  } catch {
    return null;
  }

  const senderId = typeof content.senderId === 'string' ? content.senderId : undefined;
  const sender = typeof content.sender === 'string' ? content.sender : undefined;
  const senderName = typeof content.senderName === 'string' ? content.senderName : undefined;

  const handle = senderId ?? sender;
  if (!handle) return null;

  const userId = `${event.channelType}:${handle}`;
  if (!getUser(userId)) {
    upsertUser({
      id: userId,
      kind: event.channelType,
      display_name: senderName ?? null,
      created_at: new Date().toISOString(),
    });
  }
  return userId;
}

function enforceAccess(userId: string | null, agentGroupId: string): { allowed: boolean; reason: string } {
  if (!userId) return { allowed: false, reason: 'unknown_user' };
  const decision = canAccessAgentGroup(userId, agentGroupId);
  if (decision.allowed) return { allowed: true, reason: decision.reason };
  return { allowed: false, reason: decision.reason };
}

function handleUnknownSender(
  mg: MessagingGroup,
  userId: string | null,
  agentGroupId: string,
  accessReason: string,
): void {
  // In 'strict' mode we just drop. In 'request_approval' mode we log and
  // queue an approval to add the sender as a member — the approval flow
  // itself is a follow-up (needs an action kind like `add_group_member`).
  if (mg.unknown_sender_policy === 'strict') {
    log.info('MESSAGE DROPPED — unknown sender (strict policy)', {
      messagingGroupId: mg.id,
      agentGroupId,
      userId,
      accessReason,
    });
    return;
  }

  if (mg.unknown_sender_policy === 'request_approval') {
    // Placeholder: drop for now but log as a request. Follow-up wires this
    // into the approval flow (request admin-of-group / owner to add user).
    log.info('MESSAGE DROPPED — unknown sender (approval flow TODO)', {
      messagingGroupId: mg.id,
      agentGroupId,
      userId,
      accessReason,
    });
    return;
  }

  // Should be unreachable — 'public' was handled before the gate.
  // Ensure the membership invariant isn't in an odd state.
  void isMember;
}
