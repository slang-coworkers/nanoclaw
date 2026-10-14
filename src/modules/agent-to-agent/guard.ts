/**
 * Agent-to-agent guard adapter — the module's catalog entries, composed at
 * the module edge (imported by ./index.ts).
 *
 * agents.create — the cli_scope branch moved verbatim out of
 * create-agent.ts: `global` scope creates directly (create_agent is the
 * intended primitive for trusted owner agent groups); anything else — the
 * default `group` scope, and unknown/missing config, fail-closed — holds for
 * the requesting group's admin chain.
 *
 * a2a.send — the decision moved verbatim out of routeAgentMessage, in its
 * original check order: a missing destination row denies; a missing target
 * group denies; self-sends allow without a destination row; an
 * agent_message_policies row for the (from, to) pair holds for the row's
 * named approver. The ghost-policy edge (policy row with no destination row)
 * denies — the destination check precedes the policy check, exactly today's
 * outcome. Policy rows can only tighten (hold), never allow: absence of a
 * row falls through to the structural checks.
 *
 * One owner per GitHub item: when the router reports the delivery would mint
 * a FRESH session (`resource.route === 'fresh'`) on a GitHub thread whose item
 * the recipient group already owns through another live session, a2a.send
 * DENIES — including self-sends, since a group dispatching to itself on a new
 * sub-thread would mint the same second budget. A second session per item
 * starts with a fresh budget and none of the owner's context, which is how
 * per-session cost caps were routed around (#13406). Policy: raise the owner's
 * ceiling or don't run; there is no approval path for a second session. The
 * deny precedes the policy hold, so no grant can satisfy it.
 */
import { isAncestorGroup } from '../../db/a2a-session-sources.js';
import { getAgentGroup } from '../../db/agent-groups.js';
import { getContainerConfig } from '../../db/container-configs.js';
import { ALLOW, DENY, HOLD, defineGuardedAction } from '../../guard/index.js';
import { hasDestination } from './db/agent-destinations.js';
import { getMessagePolicy } from './db/agent-message-policies.js';
import { findItemOwnerConflict } from './item-ownership.js';

/**
 * pending_approvals action string for held a2a messages. Lives here (not in
 * agent-route.ts) so agent-route can import this adapter — loading the
 * consult site guarantees its catalog entry is registered — without a cycle.
 */
export const A2A_MESSAGE_GATE_ACTION = 'a2a_message_gate';

/** Reason prefix of the one-owner-per-item deny — the router keys its sender notice on it. */
export const ITEM_OWNER_DENY_PREFIX = 'one owner per item:';

export const agentsCreate = defineGuardedAction({
  action: 'agents.create',
  grantActionName: 'create_agent',
  // Bind a create_agent grant to the name that was approved.
  grantCoversRequest: (grant, input) => {
    try {
      return (JSON.parse(grant.payload) as { name?: string }).name === input.payload.name;
    } catch {
      return false;
    }
  },
  decide: async (input) => {
    if (input.actor.kind !== 'agent') return DENY('create_agent is a container-originated action.');
    const cliScope = (await getContainerConfig(input.actor.agentGroupId))?.cli_scope ?? 'group';
    if (cliScope === 'global') {
      // Trusted owner agent group — an approval tap on every sub-agent spawn
      // would be needless friction.
      return ALLOW('trusted global-scope agent group');
    }
    // The realistic prompt-injection victim (default `group` scope) — and any
    // unknown config value, fail-closed — requires an admin before any
    // central-DB write.
    return HOLD('agent-initiated create_agent requires admin approval');
  },
});

export const a2aSend = defineGuardedAction({
  action: 'a2a.send',
  grantActionName: A2A_MESSAGE_GATE_ACTION,
  // Bind an a2a grant to the exact held message target.
  grantCoversRequest: (grant, input) => {
    try {
      return (JSON.parse(grant.payload) as { platform_id?: string }).platform_id === input.resource?.to;
    } catch {
      return false;
    }
  },
  decide: async (input) => {
    if (input.actor.kind !== 'agent') return DENY('agent-to-agent send requires an agent actor');
    const from = input.actor.agentGroupId;
    const to = input.resource?.to ?? '';
    const isSelf = to === from;

    // Authorization, in order:
    //   1. self-send always allowed (system notes injected back into an
    //      agent's own session);
    //   2. LINEAGE — a child may reply upward to a genuine ancestor of its
    //      session chain with NO destination row: the a2a delegation chain
    //      itself proves reply privilege (isAncestorGroup walks
    //      a2a_session_sources from the sender's session; the router's
    //      findAncestorRoute shares that exact walk, so an allow here always
    //      has a real ancestor session to deliver into). Non-ancestor targets
    //      fall through — lineage never authorizes reaching an UNRELATED group;
    //   3. otherwise a fresh peer-to-peer send requires an explicit
    //      destination row (fail-closed).
    const sessionId = input.actor.sessionId;
    const isAncestorReply = !isSelf && sessionId != null && (await isAncestorGroup(sessionId, to));
    if (!isSelf && !isAncestorReply && !(await hasDestination(from, 'agent', to))) {
      return DENY(`unauthorized agent-to-agent: ${from} has no destination for ${to}`);
    }
    if (!(await getAgentGroup(to))) {
      return DENY(`target agent group ${to} not found for message ${String(input.payload.id)}`);
    }
    if (input.resource?.route === 'fresh') {
      const conflict = await findItemOwnerConflict(to, input.resource.thread);
      if (conflict) {
        return DENY(
          `${ITEM_OWNER_DENY_PREFIX} ${conflict.item.key} already has ${to} session(s) ` +
            `${conflict.owners.map((s) => s.id).join(', ')}; refusing a second on ${conflict.requestedThread}`,
        );
      }
    }
    if (isSelf) return ALLOW('self-send');
    // The per-edge message policy holds even an authorized send (lineage or
    // destination) for admin approval when a policy row names an approver.
    const policy = await getMessagePolicy(from, to);
    if (policy) {
      return HOLD(`a2a message policy ${from}→${to} holds for ${policy.approver}`, policy.approver);
    }
    return ALLOW(isAncestorReply ? 'lineage reply to ancestor' : 'destination grant exists');
  },
});
