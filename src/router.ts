/**
 * Inbound message routing for v2.
 *
 * Channel adapter event → resolve messaging group → resolve agent group
 * → resolve/create session → write messages_in → wake container
 */
import { getChannelAdapter } from './channels/channel-registry.js';
import { getMessagingGroupByPlatform, createMessagingGroup, getMessagingGroupAgents } from './db/messaging-groups.js';
import { triggerTyping } from './delivery.js';
import { log } from './log.js';
import { resolveSession, writeSessionMessage } from './session-manager.js';
import { wakeContainer } from './container-runner.js';
import { getSession } from './db/sessions.js';
import type { MessagingGroupAgent, Session } from './types.js';

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
    // Auto-create messaging group (adapter already decided to forward this)
    const mgId = `mg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    mg = {
      id: mgId,
      channel_type: event.channelType,
      platform_id: event.platformId,
      name: null,
      is_group: 0,
      admin_user_id: null,
      created_at: new Date().toISOString(),
    };
    createMessagingGroup(mg);
    log.info('Auto-created messaging group', {
      id: mgId,
      channelType: event.channelType,
      platformId: event.platformId,
    });
  }

  // 2. Resolve agent group via messaging_group_agents
  const agents = getMessagingGroupAgents(mg.id);
  if (agents.length === 0) {
    // This is a common fresh-install issue: channels work but no agent group
    // is wired to handle messages. Run setup/register to create the wiring.
    log.warn('MESSAGE DROPPED — no agent groups wired to this channel. Run setup register step to configure.', {
      messagingGroupId: mg.id,
      channelType: event.channelType,
      platformId: event.platformId,
    });
    return;
  }

  // Pick matching agents (supports fan-out for @CoworkerName mentions)
  const matches = pickAgents(agents, event);
  if (matches.length === 0) {
    log.warn('MESSAGE DROPPED — no agent matched trigger rules', {
      messagingGroupId: mg.id,
      channelType: event.channelType,
    });
    return;
  }

  // Route to each matched agent — write messages synchronously (DB ops),
  // then wake all containers in parallel.
  const wakeTargets: Session[] = [];
  for (const match of matches) {
    let effectiveSessionMode = match.session_mode;
    if (adapter && adapter.supportsThreads && effectiveSessionMode !== 'agent-shared') {
      effectiveSessionMode = 'per-thread';
    }
    const { session, created } = resolveSession(match.agent_group_id, mg.id, event.threadId, effectiveSessionMode);

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
      created,
    });

    const freshSession = getSession(session.id);
    if (freshSession) wakeTargets.push(freshSession);
  }

  // Typing + parallel container wakes
  triggerTyping(event.channelType, event.platformId, event.threadId);
  await Promise.all(wakeTargets.map((s) => wakeContainer(s)));
}

/** Cache compiled trigger regexes by pattern string to avoid re-creation on every message. */
const triggerRegexCache = new Map<string, RegExp | null>();

function getOrCompileRegex(pattern: string): RegExp | null {
  let re = triggerRegexCache.get(pattern);
  if (re !== undefined) return re;
  try {
    re = new RegExp(pattern, 'i');
  } catch {
    re = null;
  }
  triggerRegexCache.set(pattern, re);
  return re;
}

/**
 * Pick matching agents for an inbound event.
 * Supports fan-out: @CoworkerName mentions can route to multiple agents.
 * Falls back to highest-priority agent without trigger requirement.
 */
function pickAgents(agents: MessagingGroupAgent[], event: InboundEvent): MessagingGroupAgent[] {
  let text = '';
  try {
    const content = JSON.parse(event.message.content);
    text = content.text || content.markdown || content.body || '';
    if (typeof text !== 'string') text = '';
  } catch {
    text = '';
  }

  const triggered: MessagingGroupAgent[] = [];
  let defaultAgent: MessagingGroupAgent | null = null;

  for (const agent of agents) {
    if (!agent.trigger_rules) {
      if (!defaultAgent) defaultAgent = agent;
      continue;
    }

    let rules: { pattern?: string; requiresTrigger?: boolean };
    try {
      rules = JSON.parse(agent.trigger_rules);
    } catch {
      if (!defaultAgent) defaultAgent = agent;
      continue;
    }

    if (rules.requiresTrigger && rules.pattern) {
      const re = getOrCompileRegex(rules.pattern);
      if (re?.test(text)) triggered.push(agent);
    } else if (!rules.requiresTrigger) {
      if (!defaultAgent) defaultAgent = agent;
    }
  }

  if (triggered.length > 0) return triggered;
  return defaultAgent ? [defaultAgent] : [];
}
