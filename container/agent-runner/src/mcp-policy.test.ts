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
  BUILTIN_MCP_SERVER,
  isBuiltinMcpTool,
  isMcpToolAllowed,
  parseMcpPolicy,
  sanitizeServerName,
  serverHasAllowedTools,
  NO_POLICY_STATED,
} from './mcp-policy.js';

describe('parseMcpPolicy', () => {
  // A host that says nothing must not narrow anybody: only an explicit
  // `ncl groups mcp-tools set` may change a group's scope, and the host has
  // already scoped the proxy token and withheld servers for a real restriction.
  it('reads an absent policy as "nothing stated", which restricts nothing', () => {
    expect(parseMcpPolicy({})).toEqual(NO_POLICY_STATED);
    expect(parseMcpPolicy({ NANOCLAW_MCP_POLICY: '' }).restrict).toBe(false);
    expect(isMcpToolAllowed(parseMcpPolicy({}), 'mcp__deepwiki__ask_question')).toBe(true);
  });

  it('reads a corrupt or shapeless policy the same way', () => {
    expect(parseMcpPolicy({ NANOCLAW_MCP_POLICY: 'not json' })).toEqual(NO_POLICY_STATED);
    expect(parseMcpPolicy({ NANOCLAW_MCP_POLICY: '{"tools":["mcp__a__b"]}' }).restrict).toBe(false);
    expect(parseMcpPolicy({ NANOCLAW_MCP_POLICY: '{"restrict":"yes"}' }).restrict).toBe(false);
  });

  it('keeps an explicit empty list as restricting — an answer, not an absence', () => {
    const p = parseMcpPolicy({ NANOCLAW_MCP_POLICY: '{"restrict":true,"tools":[],"origin":"x"}' });
    expect(p.restrict).toBe(true);
    expect(p.tools).toEqual([]);
    // No EXTERNAL tool survives...
    expect(isMcpToolAllowed(p, 'mcp__deepwiki__ask_question')).toBe(false);
    expect(isMcpToolAllowed(p, 'mcp__codex__codex')).toBe(false);
    // ...and every built-in still does: they are outside this policy.
    expect(isMcpToolAllowed(p, 'mcp__nanoclaw__install_packages')).toBe(true);
    expect(isMcpToolAllowed(p, 'mcp__nanoclaw__send_message')).toBe(true);
    expect(isMcpToolAllowed(p, 'mcp__nanoclaw__anything_added_later')).toBe(true);
  });

  it('drops built-in entries from the wire rather than treating them as grants', () => {
    const p = parseMcpPolicy({
      NANOCLAW_MCP_POLICY: '{"restrict":true,"tools":["mcp__nanoclaw__send_message","mcp__x__y"],"origin":"x"}',
    });
    expect(p.tools).toEqual(['mcp__x__y']);
    expect(isMcpToolAllowed(p, 'mcp__nanoclaw__send_message')).toBe(true);
    expect(isMcpToolAllowed(p, 'mcp__x__y')).toBe(true);
  });

  it('restricts nothing under a non-restricting policy — the default is today\'s behaviour', () => {
    const p = parseMcpPolicy({ NANOCLAW_MCP_POLICY: '{"restrict":false,"tools":[],"origin":"default"}' });
    expect(isMcpToolAllowed(p, 'mcp__nanoclaw__send_message')).toBe(true);
    expect(isMcpToolAllowed(p, 'mcp__deepwiki__ask_question')).toBe(true);
    expect(isMcpToolAllowed(p, 'mcp__codex__codex')).toBe(true);
    expect(serverHasAllowedTools(p, 'codex')).toBe(true);
  });

  it('drops non-MCP entries rather than trusting the wire', () => {
    const p = parseMcpPolicy({ NANOCLAW_MCP_POLICY: '{"restrict":true,"tools":["Bash","mcp__x__y"]}' });
    expect(p.tools).not.toContain('Bash');
    expect(isMcpToolAllowed(p, 'Bash')).toBe(false);
  });

  it('denies by omission only when the policy restricts', () => {
    const restricting = parseMcpPolicy({ NANOCLAW_MCP_POLICY: '{"restrict":true,"tools":[]}' });
    expect(isMcpToolAllowed(restricting, 'mcp__anything__at_all')).toBe(false);
    const open = parseMcpPolicy({ NANOCLAW_MCP_POLICY: '{"restrict":false,"tools":[]}' });
    expect(isMcpToolAllowed(open, 'mcp__anything__at_all')).toBe(true);
  });
});

describe('server-level decisions', () => {
  const p = parseMcpPolicy({
    NANOCLAW_MCP_POLICY: JSON.stringify({ restrict: true, tools: ['mcp__slang-mcp__github_get_issue'] }),
  });

  it('wires a server only when the policy names a tool on it', () => {
    expect(serverHasAllowedTools(p, 'slang-mcp')).toBe(true);
    expect(serverHasAllowedTools(p, 'codex')).toBe(false);
    expect(serverHasAllowedTools(p, 'deepwiki')).toBe(false);
  });

  it('compares on the SDK-sanitized server name', () => {
    expect(sanitizeServerName('slang.mcp/v1')).toBe('slang_mcp_v1');
    const q = parseMcpPolicy({
      NANOCLAW_MCP_POLICY: JSON.stringify({ restrict: true, tools: ['mcp__slang_mcp_v1__x'] }),
    });
    expect(serverHasAllowedTools(q, 'slang.mcp/v1')).toBe(true);
  });

  it('lists the permitted tools per server', () => {
    expect(allowedToolsForServer(p, 'slang-mcp')).toEqual(['mcp__slang-mcp__github_get_issue']);
    expect(allowedToolsForServer(p, 'codex')).toEqual([]);
  });

  it('always wires the built-in server — it is out of scope', () => {
    const empty = parseMcpPolicy({ NANOCLAW_MCP_POLICY: '{"restrict":true,"tools":[]}' });
    expect(serverHasAllowedTools(empty, BUILTIN_MCP_SERVER)).toBe(true);
    expect(serverHasAllowedTools(empty, 'codex')).toBe(false);
  });

  it('identifies built-ins by prefix, not by a list that can fall behind', () => {
    expect(isBuiltinMcpTool('mcp__nanoclaw__whatever')).toBe(true);
    expect(isBuiltinMcpTool('mcp__nanoclaw-evil__x')).toBe(false);
    expect(isBuiltinMcpTool('mcp__deepwiki__ask_question')).toBe(false);
  });
});
