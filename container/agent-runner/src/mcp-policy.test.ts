/**
 * The container's policy parser must never invent permission.
 *
 * The bug this guards: the previous contract (`NANOCLAW_ALLOWED_MCP_TOOLS`)
 * used one value — an absent/empty list — for two opposite intentions, "allow
 * nothing" and "the host said nothing", and read both as "restrict nothing".
 */
import { describe, it, expect } from 'bun:test';

import {
  allowedToolsForServer,
  isMcpToolAllowed,
  MANDATORY_MCP_TOOLS,
  parseMcpPolicy,
  sanitizeServerName,
  serverHasAllowedTools,
  UNRESOLVED_POLICY,
} from './mcp-policy.js';

describe('parseMcpPolicy', () => {
  it('reads an absent policy as unresolved, not as unrestricted', () => {
    expect(parseMcpPolicy({}).state).toBe('unresolved');
    expect(parseMcpPolicy({ NANOCLAW_MCP_POLICY: '' }).state).toBe('unresolved');
  });

  it('reads a corrupt or unknown-state policy as unresolved', () => {
    expect(parseMcpPolicy({ NANOCLAW_MCP_POLICY: 'not json' })).toEqual(UNRESOLVED_POLICY);
    expect(parseMcpPolicy({ NANOCLAW_MCP_POLICY: '{"state":"open","tools":["mcp__a__b"]}' }).state).toBe(
      'unresolved',
    );
    expect(parseMcpPolicy({ NANOCLAW_MCP_POLICY: '{"tools":["mcp__a__b"]}' }).state).toBe('unresolved');
  });

  it('keeps an explicit empty list as explicit — an answer, not an absence', () => {
    const p = parseMcpPolicy({ NANOCLAW_MCP_POLICY: '{"state":"explicit","tools":[],"origin":"x"}' });
    expect(p.state).toBe('explicit');
    // Only the transport floor survives; nothing configurable does.
    expect(p.tools.sort()).toEqual([...MANDATORY_MCP_TOOLS].sort());
    expect(isMcpToolAllowed(p, 'mcp__nanoclaw__install_packages')).toBe(false);
  });

  it('unions the mandatory floor in even when the host omits it', () => {
    const p = parseMcpPolicy({ NANOCLAW_MCP_POLICY: '{"state":"inherited","tools":["mcp__x__y"],"origin":"x"}' });
    for (const tool of MANDATORY_MCP_TOOLS) expect(isMcpToolAllowed(p, tool)).toBe(true);
    expect(isMcpToolAllowed(p, 'mcp__x__y')).toBe(true);
  });

  it('drops non-MCP entries rather than trusting the wire', () => {
    const p = parseMcpPolicy({ NANOCLAW_MCP_POLICY: '{"state":"explicit","tools":["Bash","mcp__x__y"]}' });
    expect(p.tools).not.toContain('Bash');
    expect(isMcpToolAllowed(p, 'Bash')).toBe(false);
  });

  it('permits by omission only under unrestricted', () => {
    const p = parseMcpPolicy({ NANOCLAW_MCP_POLICY: '{"state":"unrestricted","tools":[]}' });
    expect(isMcpToolAllowed(p, 'mcp__anything__at_all')).toBe(true);
  });
});

describe('server-level decisions', () => {
  const p = parseMcpPolicy({
    NANOCLAW_MCP_POLICY: JSON.stringify({ state: 'explicit', tools: ['mcp__slang-mcp__github_get_issue'] }),
  });

  it('wires a server only when the policy names a tool on it', () => {
    expect(serverHasAllowedTools(p, 'slang-mcp')).toBe(true);
    expect(serverHasAllowedTools(p, 'codex')).toBe(false);
    expect(serverHasAllowedTools(p, 'deepwiki')).toBe(false);
  });

  it('compares on the SDK-sanitized server name', () => {
    expect(sanitizeServerName('slang.mcp/v1')).toBe('slang_mcp_v1');
    const q = parseMcpPolicy({
      NANOCLAW_MCP_POLICY: JSON.stringify({ state: 'explicit', tools: ['mcp__slang_mcp_v1__x'] }),
    });
    expect(serverHasAllowedTools(q, 'slang.mcp/v1')).toBe(true);
  });

  it('lists the permitted tools per server', () => {
    expect(allowedToolsForServer(p, 'slang-mcp')).toEqual(['mcp__slang-mcp__github_get_issue']);
    expect(allowedToolsForServer(p, 'codex')).toEqual([]);
  });

  it('always considers the built-in server usable — it carries the transport floor', () => {
    const empty = parseMcpPolicy({ NANOCLAW_MCP_POLICY: '{"state":"explicit","tools":[]}' });
    expect(serverHasAllowedTools(empty, 'nanoclaw')).toBe(true);
  });
});
