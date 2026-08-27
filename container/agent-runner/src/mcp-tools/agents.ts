/**
 * Agent management MCP tools: create_agent.
 *
 * send_to_agent was removed — sending to another agent is now just
 * send_message(to="agent-name") since agents and channels share the
 * unified destinations namespace.
 *
 * create_agent writes central-DB state. The host authorizes it by CLI scope:
 * trusted owner agent groups (scope 'global') create directly; confined groups
 * require admin approval (see src/modules/agent-to-agent/create-agent.ts). This
 * tool just writes the outbound request; authorization is enforced host-side,
 * not here — the container is untrusted and cannot be relied on to gate itself.
 */
import { writeMessageOut } from '../db/messages-out.js';
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

export const createAgent: McpToolDefinition = {
  tool: {
    name: 'create_agent',
    description:
      'Create a long-lived companion sub-agent (research assistant, task manager, specialist) — the name becomes your destination for it. May require admin approval before the agent is created. Fire-and-forget.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'Human-readable name (also becomes your destination name for this agent)',
        },
        instructions: {
          type: 'string',
          description: 'CLAUDE.md content for the new agent (personality, role, instructions)',
        },
        coworkerType: {
          type: 'string',
          description:
            'Coworker type key from the lego registry at container/{spines,skills}/*/coworker-types.yaml. Determines the composed spine, skill/workflow index, trait bindings, and derived MCP tool allowlist.',
        },
        allowedMcpTools: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Explicit list of allowed MCP tools (e.g., ["mcp__deepwiki__ask_question"]). Overrides type defaults.',
        },
        instructionOverlay: {
          type: 'string',
          description:
            'Name of an instruction overlay template (e.g., "code-reviewer", "terse-reporter"). Sets the communication style. See groups/templates/instructions/ for available overlays.',
        },
        agentProvider: {
          type: 'string',
          description:
            'Agent provider for this coworker ("claude" or "codex"). Defaults to "claude" if not specified.',
        },
        overlays: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Compose-time overlay names (e.g., ["critique-gate", "buddy-monitor"]). Overlays inject quality gates into workflows. Optional — defaults to none; operators can configure later via dashboard.',
        },
        group: {
          type: 'string',
          description:
            'Dashboard sidebar group for this coworker: "prod" for the shared group (default), or a user id (e.g. "dashboard:user1") to scope it under a specific user.',
        },
      },
      required: ['name'],
    },
  },
  async handler(args) {
    const name = args.name as string;
    if (!name) return err('name is required');

    const requestId = generateId();
    await writeMessageOut({
      id: requestId,
      kind: 'system',
      content: JSON.stringify({
        action: 'create_agent',
        requestId,
        name,
        instructions: (args.instructions as string) || null,
        coworkerType: (args.coworkerType as string) || null,
        allowedMcpTools: (args.allowedMcpTools as string[]) || null,
        instructionOverlay: (args.instructionOverlay as string) || null,
        agentProvider: (args.agentProvider as string) || null,
        overlays: (args.overlays as string[]) || null,
        group: (args.group as string) || null,
      }),
    });

    log(`create_agent: ${requestId} → "${name}"`);
    return ok(`Creating agent "${name}". You will be notified when it is ready.`);
  },
};

export const wireAgents: McpToolDefinition = {
  tool: {
    name: 'wire_agents',
    description:
      'Create a bidirectional communication link between two agents in your destination list. After wiring, both agents can send messages to each other directly without going through you. Admin-only.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        agent_a: {
          type: 'string',
          description: 'Destination name of first agent (from your destination list)',
        },
        agent_b: {
          type: 'string',
          description: 'Destination name of second agent (from your destination list)',
        },
      },
      required: ['agent_a', 'agent_b'],
    },
  },
  async handler(args) {
    const agentA = args.agent_a as string;
    const agentB = args.agent_b as string;
    if (!agentA || !agentB) return err('agent_a and agent_b are required');
    if (agentA === agentB) return err('Cannot wire an agent to itself');

    const requestId = generateId();
    writeMessageOut({
      id: requestId,
      kind: 'system',
      content: JSON.stringify({
        action: 'wire_agents',
        requestId,
        agentA,
        agentB,
      }),
    });

    log(`wire_agents: ${requestId} → "${agentA}" ↔ "${agentB}"`);
    return ok(
      `Wiring "${agentA}" ↔ "${agentB}". You will be notified when the link is ready.`,
    );
  },
};

registerTools([createAgent, wireAgents]);
