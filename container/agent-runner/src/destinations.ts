/**
 * Destination map — lives in inbound.db's `destinations` table.
 *
 * The host writes this table before every container wake AND on demand
 * (e.g. when a new child agent is created mid-session). The container
 * queries the table live on every lookup, so admin changes take effect
 * immediately — no restart required.
 *
 * This table is BOTH the routing map and the container-visible ACL.
 * The host re-validates on the delivery side against the central DB,
 * so even if this table is stale the host's enforcement is authoritative.
 */
import { getAgentMailbox } from './mailbox/index.js';
import type { Destination } from './mailbox/types.js';

export interface DestinationEntry {
  name: string;
  displayName: string;
  type: 'channel' | 'agent';
  channelType?: string;
  platformId?: string;
  agentGroupId?: string;
}

export type SessionMode = { kind: 'chat' } | { kind: 'task'; taskId: string };

function destinationEntry(destination: Destination): DestinationEntry {
  return {
    name: destination.name,
    displayName: destination.displayName ?? destination.name,
    type: destination.type,
    channelType: destination.channelType ?? undefined,
    platformId: destination.platformId ?? undefined,
    agentGroupId: destination.agentGroupId ?? undefined,
  };
}

export function getAllDestinations(): DestinationEntry[] {
  return getAgentMailbox().operations.getDestinations().map(destinationEntry);
}

/**
 * Deterministic fingerprint of the destinations table — cheap to compute
 * on every poll iteration, changes iff any row's significant content
 * changes. Used by the poll loop to decide whether the system prompt's
 * destinations section needs to be rebuilt (the host refreshes this
 * table mid-session when new coworkers are wired; without a fingerprint
 * check the agent would operate from its startup snapshot forever).
 *
 * Format is intentionally opaque — callers must compare for equality,
 * not parse.
 */
export function getDestinationsFingerprint(): string {
  return getAgentMailbox()
    .operations.getDestinations()
    .map((d) =>
      [d.name, d.displayName ?? '', d.type, d.channelType ?? '', d.platformId ?? '', d.agentGroupId ?? ''].join('\x1f'),
    )
    .join('\x1e');
}

export function findByName(name: string): DestinationEntry | undefined {
  const destination = getAgentMailbox().operations.findDestinationByName(name);
  return destination && destinationEntry(destination);
}

export function findByRouting(
  channelType: string | null | undefined,
  platformId: string | null | undefined,
): DestinationEntry | undefined {
  if (!channelType || !platformId) return undefined;
  const destination = getAgentMailbox().operations.findDestinationByRouting(channelType, platformId);
  return destination && destinationEntry(destination);
}

/**
 * Generate the system-prompt addendum: agent identity + destination map.
 *
 * Identity is injected here (not in the shared CLAUDE.md) because it's
 * per-agent-group and changes when the operator renames an agent, while
 * the shared base is identical across all agents.
 */
export function buildSystemPromptAddendum(assistantName?: string, mode: SessionMode = { kind: 'chat' }): string {
  const sections: string[] = [];

  if (assistantName) {
    sections.push(
      [
        '# You are ' + assistantName,
        '',
        `Your name is **${assistantName}**. Use it when the channel asks who you are, when introducing yourself, and when signing any message that explicitly calls for a signature.`,
      ].join('\n'),
    );
  }

  sections.push(buildDestinationsSection(mode));

  return sections.join('\n\n');
}

function buildDestinationsSection(mode: SessionMode): string {
  const all = getAllDestinations();
  const lines = ['## Sending messages', ''];

  if (all.length === 0) {
    lines.push('You currently have no configured destinations. You cannot send messages until an admin wires one up.');
    if (mode.kind === 'chat') return lines.join('\n');
  } else if (all.length === 1) {
    const d = all[0];
    lines.push(
      `Your messages are delivered to \`${d.name}\`${destinationLabel(d)}. Just write your response directly — no special wrapping needed.`,
    );
  } else {
    lines.push('You can send messages to the following destinations:', '');
    for (const d of all) {
      lines.push(`- \`${d.name}\`${destinationLabel(d)}`);
    }
  }

  lines.push('');

  if (mode.kind === 'task') {
    lines.push(
      'This is an isolated task run with no attached chat. Only notify someone when the task asks you to. For a user-visible message, call `send_message({ to: "name", text: "..." })`; for a file, call `send_file` with `to`. Always pass the explicit named destination.',
    );
    const channelDestinations = all.filter((destination) => destination.type === 'channel');
    if (channelDestinations.length > 0) {
      const channelNames = channelDestinations.map((destination) => `\`${destination.name}\``).join(', ');
      lines.push(
        '',
        `For user-visible escalation output, default to your own channel destination(s): ${channelNames} — that's the operator's actual conversation with you. Use an agent-type destination like \`parent\` only when the task explicitly calls for routing through another agent, not as your default escalation path.`,
      );
    }
    lines.push(
      '',
      `Your final output is not sent to the user. End with a concise work-log summary. It is recorded automatically in \`tasks/${mode.taskId}.md\`. Read that file when you need context from earlier runs. Use \`ncl tasks append-log --msg "…"\` only for optional mid-run notes.`,
    );
    return lines.join('\n');
  }

  lines.push(
    'This list is regenerated at the top of every message you process — if the admin tells you they just created a new coworker, trust the list above rather than asking for a container restart. No restart is needed for the agent to see newly-wired coworkers.',
  );
  lines.push('');
  lines.push('To send a message, wrap it in a `<message to="name">...</message>` block.');
  lines.push('You can include multiple `<message>` blocks in one response to send to multiple destinations.');
  lines.push('Text outside of `<message>` blocks is scratchpad — logged but not sent anywhere.');
  lines.push('Use `<internal>...</internal>` to make scratchpad intent explicit.');
  lines.push('');
  lines.push(
    'The `send_message` MCP tool is the same delivery, available mid-turn — handy for a quick acknowledgment ("on it") before a slow tool call. Always pass its explicit `to` destination. Each `send_message` call and each final-response `<message>` block lands as its own message in the conversation, so they read as a sequence rather than as one combined reply.',
  );
  lines.push('');
  lines.push(
    'For a short turn, do not narrate. For longer work, send one acknowledgment and then updates only at meaningful milestones, especially before slow operations. Never narrate micro-steps; finish with the outcome, not a play-by-play.',
  );
  return lines.join('\n');
}

function destinationLabel(d: DestinationEntry): string {
  const parts: string[] = [];
  if (d.channelType) parts.push(d.channelType);
  if (d.displayName && d.displayName !== d.name) parts.push(d.displayName);
  return parts.length > 0 ? ` (${parts.join(' · ')})` : '';
}
