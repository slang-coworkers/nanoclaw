/**
 * The allow-list governs EXTERNAL MCP servers. It does not govern NanoClaw's
 * own built-in tools.
 *
 * #1157 drew the boundary in the wrong place: it treated the built-in surface
 * as configurable and carved out a three-tool "mandatory transport floor" to
 * stop an empty list from muting the agent. That made an unrelated policy knob
 * able to revoke `ask_user_question`, `install_packages`, `create_agent` and
 * `record_decision` from a group whose coworker type simply did not enumerate
 * them — while adding no authority, because each of those already answers to
 * its own gate (see `src/builtin-mcp-gates.test.ts` for that inventory).
 *
 * Every test here fails on the #1157 tree.
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it, vi, beforeEach } from 'vitest';

let inventory: Record<string, string[]> = {};

vi.mock('./mcp-auth-proxy.js', () => ({
  getDiscoveredToolInventory: () => inventory,
}));

// Imported by name so this file COMPILES AND RUNS on the #1157 tree and its
// failures are behavioural, not "symbol is undefined". The two describes that
// necessarily touch new API are labelled where they appear.
const { isMcpToolPermitted, resolveMcpAllowlist, serverHasAllowedTools, toMcpPolicyWire } =
  await import('./mcp-allowlist.js');
type Group = Parameters<typeof resolveMcpAllowlist>[0];

/** Local, so the boundary assertions do not depend on the helper under test. */
const isBuiltin = (tool: string): boolean => tool.startsWith('mcp__nanoclaw__');

function group(overrides: Partial<Group> = {}): Group {
  return { allowed_mcp_tools: null, is_admin: 0, coworker_type: 'slang-fix', ...overrides } as Group;
}

/** The full built-in surface as registered in container/agent-runner/src/mcp-tools/. */
const BUILTIN_TOOLS = [
  'send_message',
  'send_file',
  'add_reaction',
  'report_pr_created',
  'record_decision',
  'ask_user_question',
  'send_card',
  'create_agent',
  'wire_agents',
  'install_packages',
  'add_mcp_server',
  'request_restart',
  'append_learning',
].map((t) => `mcp__nanoclaw__${t}`);

beforeEach(() => {
  inventory = { deepwiki: ['mcp__deepwiki__ask_question', 'mcp__deepwiki__read_wiki_contents'] };
});

describe('an explicit empty list denies external tools and touches no built-in', () => {
  const resolved = () => resolveMcpAllowlist(group({ allowed_mcp_tools: '[]' }));

  // REGRESSION GUARD, not failing-first: this already passed on #1157 and must
  // keep passing. Narrowing the scope to external servers must not reopen F03.
  it('still denies every external tool — the F03 fix is intact', () => {
    const r = resolved();
    expect(r.state).toBe('explicit');
    expect(isMcpToolPermitted(r, 'mcp__deepwiki__ask_question')).toBe(false);
    expect(isMcpToolPermitted(r, 'mcp__codex__codex')).toBe(false);
    expect(serverHasAllowedTools(r, 'codex')).toBe(false);
    expect(serverHasAllowedTools(r, 'deepwiki')).toBe(false);
    expect(r.blocked).toEqual(['mcp__deepwiki__ask_question', 'mcp__deepwiki__read_wiki_contents']);
  });

  it('reports the governed set as external-only', () => {
    expect(resolved().externalTools).toEqual([]);
  });

  it('permits EVERY built-in, not just a transport floor', () => {
    const r = resolved();
    for (const tool of BUILTIN_TOOLS) {
      expect(isMcpToolPermitted(r, tool), tool).toBe(true);
    }
  });

  it('always wires the built-in server', () => {
    expect(serverHasAllowedTools(resolved(), 'nanoclaw')).toBe(true);
  });

  it('never lists a built-in as blocked', () => {
    inventory = { ...inventory, nanoclaw: BUILTIN_TOOLS };
    expect(resolved().blocked.some(isBuiltin)).toBe(false);
  });
});

describe('a group with no explicit list is untouched on both sides of the boundary', () => {
  it('permits every external tool and every built-in', () => {
    const r = resolveMcpAllowlist(group({ coworker_type: 'thin' }));
    expect(r.state).toBe('inherited');
    expect(isMcpToolPermitted(r, 'mcp__deepwiki__ask_question')).toBe(true);
    for (const tool of BUILTIN_TOOLS) expect(isMcpToolPermitted(r, tool), tool).toBe(true);
  });
});

describe('a missing coworker registry changes nothing', () => {
  it('does not consult the registry at all — the manifest is not a permission grant', () => {
    // Running from a directory with no container/spines: pre-amendment this
    // was `unresolved` and denied everything external. Now the registry is
    // simply never asked, so a broken one cannot narrow a group.
    const dir = fs.mkdtempSync(path.join('/tmp', 'mcp-scope-no-registry-'));
    const cwd = process.cwd();
    try {
      process.chdir(dir);
      const r = resolveMcpAllowlist(group({ coworker_type: 'slang-fix' }));
      expect(r.state).toBe('inherited');
      expect(r.configurationError).toBeNull();
      expect(isMcpToolPermitted(r, 'mcp__deepwiki__ask_question')).toBe(true);
      expect(isMcpToolPermitted(r, 'mcp__codex__codex')).toBe(true);
      for (const tool of BUILTIN_TOOLS) expect(isMcpToolPermitted(r, tool), tool).toBe(true);
    } finally {
      process.chdir(cwd);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('a manifest that names a built-in is neither honoured nor punished', () => {
  // Touches `externalTools`, which this change introduces. The behavioural half
  // of the claim is the `isMcpToolPermitted` assertions at the end.
  it('drops built-in entries from the enforced list without changing the answer', () => {
    // Coworker manifests DO carry `mcp__nanoclaw__*` entries (base-nanoclaw's
    // allowed-tools). They are inert: the tool was already permitted.
    const withBuiltin = resolveMcpAllowlist(
      group({ allowed_mcp_tools: JSON.stringify(['mcp__nanoclaw__send_message', 'mcp__deepwiki__ask_question']) }),
    );
    const withoutBuiltin = resolveMcpAllowlist(
      group({ allowed_mcp_tools: JSON.stringify(['mcp__deepwiki__ask_question']) }),
    );
    expect(withBuiltin.externalTools).toEqual(withoutBuiltin.externalTools);
    expect(withBuiltin.externalTools).toEqual(['mcp__deepwiki__ask_question']);
    // `tools` keeps the stored value verbatim so the operator sees what they set.
    expect(withBuiltin.tools).toContain('mcp__nanoclaw__send_message');
    for (const r of [withBuiltin, withoutBuiltin]) {
      expect(isMcpToolPermitted(r, 'mcp__nanoclaw__send_message')).toBe(true);
      expect(isMcpToolPermitted(r, 'mcp__nanoclaw__install_packages')).toBe(true);
    }
  });
});

describe('the container never receives a built-in on the wire', () => {
  it('sends external tools only', () => {
    // Behavioural on the #1157 tree: it sent the transport floor.
    const wire = toMcpPolicyWire(
      resolveMcpAllowlist(
        group({ allowed_mcp_tools: JSON.stringify(['mcp__nanoclaw__send_message', 'mcp__deepwiki__ask_question']) }),
      ),
    );
    expect(wire.tools).toEqual(['mcp__deepwiki__ask_question']);
    expect(wire.tools.some(isBuiltin)).toBe(false);
  });
});

// NEW-API: these exercise symbols this change introduces, so on the #1157 tree
// they fail as "undefined", not as a wrong answer. Kept because a silent drift
// between the two runtimes' copies of the server name would reopen the hole.
describe('the built-in server name is defined once per runtime and must not drift', () => {
  it('matches the container copy', async () => {
    const { BUILTIN_MCP_SERVER } = await import('./mcp-allowlist.js');
    const containerSrc = fs.readFileSync(path.join(process.cwd(), 'container/agent-runner/src/mcp-policy.ts'), 'utf-8');
    const m = containerSrc.match(/export const BUILTIN_MCP_SERVER\s*=\s*'([^']+)'/);
    expect(m).not.toBeNull();
    expect(m![1]).toBe(BUILTIN_MCP_SERVER);
  });

  it('is a prefix test, so a built-in added tomorrow is out of scope automatically', async () => {
    const { isBuiltinMcpTool } = await import('./mcp-allowlist.js');
    expect(isBuiltinMcpTool('mcp__nanoclaw__a_tool_that_does_not_exist_yet')).toBe(true);
    expect(isBuiltinMcpTool('mcp__deepwiki__ask_question')).toBe(false);
    // Not fooled by a lookalike server name.
    expect(isBuiltinMcpTool('mcp__nanoclaw-evil__x')).toBe(false);
    expect(isBuiltinMcpTool('mcp__notnanoclaw__x')).toBe(false);
  });
});
