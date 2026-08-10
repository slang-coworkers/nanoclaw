/**
 * MCP server bootstrap + tool self-registration.
 *
 * Each tool module calls `registerTools([...])` at import time. The
 * barrel (`index.ts`) imports every tool module for side effects, then
 * calls `startMcpServer()` which uses whatever was registered.
 *
 * Default when only `core.ts` is imported: the core `send_message` /
 * `send_file` / `add_reaction` tools are available.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { isMcpToolAllowed, parseMcpPolicy, type McpPolicy } from '../mcp-policy.js';
import type { McpToolDefinition } from './types.js';

function log(msg: string): void {
  console.error(`[mcp-tools] ${msg}`);
}

const allTools: McpToolDefinition[] = [];
const toolMap = new Map<string, McpToolDefinition>();

export function registerTools(tools: McpToolDefinition[]): void {
  for (const t of tools) {
    if (toolMap.has(t.tool.name)) {
      log(`Warning: tool "${t.tool.name}" already registered, skipping duplicate`);
      continue;
    }
    allTools.push(t);
    toolMap.set(t.tool.name, t);
  }
}

/**
 * Is this built-in tool allowed under the session's MCP policy?
 *
 * The built-in server is the one MCP server that is always wired, because it
 * carries the mandatory message transport. So unlike every other direct
 * server — which is simply not started when nothing on it is allowed — this
 * one has to filter itself, per tool.
 *
 * Doing it here rather than only in the SDK's `disallowedTools` matters for
 * two reasons: a denied tool is not advertised at all (the model never sees
 * it, so it never burns a turn on a call that will be refused), and the refusal
 * does not depend on how the SDK's pattern matcher interprets a namespace
 * wildcard.
 *
 * Exported for tests — the policy is read once at boot in production.
 */
export function isBuiltinToolAllowed(policy: McpPolicy, toolName: string): boolean {
  return isMcpToolAllowed(policy, `mcp__nanoclaw__${toolName}`);
}

export async function startMcpServer(): Promise<void> {
  const server = new Server({ name: 'nanoclaw', version: '2.0.0' }, { capabilities: { tools: {} } });
  const policy = parseMcpPolicy(process.env as Record<string, string | undefined>);
  const allowed = allTools.filter((t) => isBuiltinToolAllowed(policy, t.tool.name));
  const denied = allTools.filter((t) => !isBuiltinToolAllowed(policy, t.tool.name)).map((t) => t.tool.name);

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allowed.map((t) => t.tool),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = toolMap.get(name);
    if (!tool) {
      return { content: [{ type: 'text', text: `Unknown tool: ${name}` }] };
    }
    // Belt and braces: an unlisted tool is still callable over the wire, so
    // check on the call path too rather than trusting the listing to be the
    // only thing the client ever reads.
    if (!isBuiltinToolAllowed(policy, name)) {
      log(`Denied ${name}: not in this agent group's MCP allow-list (${policy.state})`);
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text:
              `Tool "${name}" is not in this agent group's MCP tool allow-list ` +
              `(policy: ${policy.state} — ${policy.origin}). An admin can change it with ` +
              `\`ncl groups mcp-tools set\`; you cannot change your own.`,
          },
        ],
      };
    }
    return tool.handler(args ?? {});
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log(
    `MCP server started with ${allowed.length}/${allTools.length} tools under the ${policy.state} policy: ` +
      `${allowed.map((t) => t.tool.name).join(', ')}` +
      (denied.length > 0 ? ` | denied: ${denied.join(', ')}` : ''),
  );
}
