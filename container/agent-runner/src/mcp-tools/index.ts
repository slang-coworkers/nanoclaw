/**
 * MCP tools barrel — collects all tool modules and starts the server.
 *
 * Each module exports a McpToolDefinition[] array. This file registers
 * them all with the MCP server. Adding a new tool module requires only
 * importing it here and spreading its tools array.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import type { McpToolDefinition } from './types.js';
import { coreTools } from './core.js';
import { schedulingTools } from './scheduling.js';
import { interactiveTools } from './interactive.js';
import { agentTools } from './agents.js';
import { selfModTools } from './self-mod.js';
import { credentialTools } from './credentials.js';
import { learningTools } from './learnings.js';

function log(msg: string): void {
  console.error(`[mcp-tools] ${msg}`);
}

// Only admin agents get the create_agent tool. Non-admins never see it in the
// listTools response; the host also re-checks permission on receive as defense
// in depth (see delivery.ts create_agent handler).
const isAdmin = process.env.NANOCLAW_IS_ADMIN === '1';
const conditionalAgentTools = isAdmin ? agentTools : [];

const allTools: McpToolDefinition[] = [
  ...coreTools,
  ...schedulingTools,
  ...interactiveTools,
  ...conditionalAgentTools,
  ...selfModTools,
  ...credentialTools,
  ...learningTools,
];

const toolMap = new Map<string, McpToolDefinition>();
for (const t of allTools) {
  toolMap.set(t.tool.name, t);
}

async function startMcpServer(): Promise<void> {
  const server = new Server({ name: 'nanoclaw', version: '2.0.0' }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allTools.map((t) => t.tool),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = toolMap.get(name);
    if (!tool) {
      return { content: [{ type: 'text', text: `Unknown tool: ${name}` }] };
    }
    return tool.handler(args ?? {});
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log(`MCP server started with ${allTools.length} tools: ${allTools.map((t) => t.tool.name).join(', ')}`);
}

startMcpServer().catch((err) => {
  log(`MCP server error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
