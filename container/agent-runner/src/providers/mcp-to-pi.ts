import type { McpServerConfig } from './types.js';

/**
 * pi `.mcp.json` entry shapes, consumed by the `pi-mcp-adapter` extension
 * (which connects to each server and exposes its tools to pi). stdio servers
 * carry `command`/`args`/`env`; HTTP (streamable) servers carry `url`/`headers`.
 */
export type PiMcpStdio = {
  command: string;
  args: string[];
  env?: Record<string, string>;
};

export type PiMcpHttp = {
  url: string;
  headers?: Record<string, string>;
};

export type PiMcpEntry = PiMcpStdio | PiMcpHttp;

/**
 * The runner's MCP map is typed as stdio-only (`McpServerConfig`), but at
 * runtime index.ts also injects HTTP entries (`{type:'http', url, headers}`,
 * cast `as any`) via the MCP-proxy auto-discovery path. We therefore accept a
 * loose union and discriminate on the actual fields — reading `cfg.env`
 * unconditionally would throw on an HTTP entry and crash config materialization
 * before pi ever starts.
 */
type LooseMcpEntry =
  | { command: string; args?: string[]; env?: Record<string, string> }
  | { type?: string; url: string; headers?: Record<string, string> };

/**
 * Map NanoClaw MCP definitions (Claude Agent SDK shape) into the pi
 * `.mcp.json` `mcpServers` map. Handles both stdio and streamable-HTTP.
 */
export function mcpServersToPiConfig(servers: Record<string, McpServerConfig> | undefined): Record<string, PiMcpEntry> {
  const out: Record<string, PiMcpEntry> = {};
  if (!servers) return out;

  for (const [name, raw] of Object.entries(servers)) {
    const cfg = raw as unknown as LooseMcpEntry;
    if ('command' in cfg && cfg.command) {
      const env = cfg.env ?? {};
      out[name] = {
        command: cfg.command,
        args: cfg.args ?? [],
        ...(Object.keys(env).length > 0 ? { env } : {}),
      };
    } else if ('url' in cfg && cfg.url) {
      out[name] = {
        url: cfg.url,
        ...(cfg.headers && Object.keys(cfg.headers).length > 0 ? { headers: cfg.headers } : {}),
      };
    }
    // Anything else (no command and no url) is not a shape pi understands — skip.
  }

  return out;
}
