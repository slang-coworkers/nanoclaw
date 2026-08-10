/**
 * The built-in `nanoclaw` MCP server filters itself.
 *
 * It is the one direct server that is always wired — it carries the mandatory
 * message transport — so unlike `codex` it cannot be revoked by simply not
 * starting it. Denied tools are neither advertised nor answered.
 */
import { describe, it, expect } from 'bun:test';

import { MANDATORY_MCP_TOOLS, type McpPolicy } from '../mcp-policy.js';
import { isBuiltinToolAllowed } from './server.js';

function policy(state: McpPolicy['state'], tools: string[]): McpPolicy {
  return { state, tools, origin: 'test' };
}

// The privileged half of the built-in surface: every one of these produces a
// host-side effect (a container rebuild, a new agent group, a ledger row).
const PRIVILEGED = [
  'install_packages',
  'add_mcp_server',
  'request_restart',
  'create_agent',
  'wire_agents',
  'record_decision',
  'report_pr_created',
  'append_learning',
  'ask_user_question',
  'send_card',
];

describe('built-in tool filtering', () => {
  it('denies every privileged built-in under an explicit empty allow-list', () => {
    const p = policy('explicit', [...MANDATORY_MCP_TOOLS]);
    for (const tool of PRIVILEGED) {
      expect(isBuiltinToolAllowed(p, tool)).toBe(false);
    }
  });

  it('never denies the mandatory message transport', () => {
    for (const state of ['explicit', 'inherited', 'unresolved'] as const) {
      const p = policy(state, [...MANDATORY_MCP_TOOLS]);
      expect(isBuiltinToolAllowed(p, 'send_message')).toBe(true);
      expect(isBuiltinToolAllowed(p, 'send_file')).toBe(true);
      expect(isBuiltinToolAllowed(p, 'add_reaction')).toBe(true);
    }
  });

  it('permits exactly the built-ins an inherited manifest names', () => {
    const p = policy('inherited', [...MANDATORY_MCP_TOOLS, 'mcp__nanoclaw__append_learning']);
    expect(isBuiltinToolAllowed(p, 'append_learning')).toBe(true);
    expect(isBuiltinToolAllowed(p, 'install_packages')).toBe(false);
  });

  it('permits everything under unrestricted', () => {
    const p = policy('unrestricted', []);
    for (const tool of PRIVILEGED) {
      expect(isBuiltinToolAllowed(p, tool)).toBe(true);
    }
  });
});
