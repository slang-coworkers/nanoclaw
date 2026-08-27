// The MCP allow-list policy, in one place — see src/mcp-allowlist.ts.
//
// What these lock down (each was a way the read path, the write path and the
// spawn path disagreed before):
//   - an EXPLICIT list wins for every group, admin included: an admin's
//     restriction used to be discarded at spawn, so it silently vanished on
//     the next respawn
//   - `inherited` (nothing stored) and `unrestricted` are distinct states,
//     not both spelled NULL
//   - `blocked` is computed from the EFFECTIVE list, so a default group is no
//     longer reported as unrestricted-with-nothing-blocked
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const inventory: Record<string, string[]> = {};
vi.mock('./mcp-auth-proxy.js', () => ({
  getDiscoveredToolInventory: () => inventory,
}));
vi.mock('./log.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { parseAllowlistFlag, parseStoredAllowlist, resolveMcpAllowlist, UNRESTRICTED } =
  await import('./mcp-allowlist.js');

type Group = Parameters<typeof resolveMcpAllowlist>[0];

const ALL = ['mcp__srv__read', 'mcp__srv__write', 'mcp__other__deploy'];

function group(overrides: Partial<Group> = {}): Group {
  return { allowed_mcp_tools: null, is_admin: 0, coworker_type: 'slang-fix', ...overrides } as Group;
}

let savedAdminTools: string | undefined;

beforeEach(() => {
  savedAdminTools = process.env.ADMIN_MCP_TOOLS;
  delete process.env.ADMIN_MCP_TOOLS;
  for (const k of Object.keys(inventory)) delete inventory[k];
  inventory.srv = ['mcp__srv__read', 'mcp__srv__write'];
  inventory.other = ['mcp__other__deploy'];
});

afterEach(() => {
  if (savedAdminTools === undefined) delete process.env.ADMIN_MCP_TOOLS;
  else process.env.ADMIN_MCP_TOOLS = savedAdminTools;
});

describe('resolveMcpAllowlist', () => {
  it('an explicit list is explicit, and blocks everything else discovered', () => {
    const r = resolveMcpAllowlist(group({ allowed_mcp_tools: JSON.stringify(['mcp__srv__read']) }));
    expect(r.state).toBe('explicit');
    expect(r.tools).toEqual(['mcp__srv__read']);
    expect(r.blocked).toEqual(['mcp__srv__write', 'mcp__other__deploy']);
  });

  it('an ADMIN group keeps its explicit list — it does not silently widen on respawn', () => {
    // The security-relevant regression: the admin branch returned every
    // discovered tool and never looked at the stored column, so an admin
    // restriction survived only until the container respawned.
    const r = resolveMcpAllowlist(group({ is_admin: 1, allowed_mcp_tools: JSON.stringify(['mcp__srv__read']) }));
    expect(r.state).toBe('explicit');
    expect(r.tools).toEqual(['mcp__srv__read']);
    expect(r.tools).not.toEqual(expect.arrayContaining(['mcp__other__deploy']));
  });

  it('nothing stored restricts NOTHING — the coworker-type manifest is not a permission grant', () => {
    // Superseded #1116 semantics: this used to resolve to the type manifest,
    // which meant adopting a coworker type silently narrowed the group. Scope
    // now changes only when someone runs `ncl groups mcp-tools set`.
    const r = resolveMcpAllowlist(group());
    expect(r.state).toBe('inherited');
    expect(r.restricts).toBe(false);
    expect(r.blocked).toEqual([]);
    expect(r.tools).toEqual(ALL);
  });

  it('nothing stored on an ADMIN group also restricts nothing', () => {
    const r = resolveMcpAllowlist(group({ is_admin: 1 }));
    expect(r.restricts).toBe(false);
    expect(r.tools).toEqual(ALL);
    expect(r.blocked).toEqual([]);
  });

  it('ADMIN_MCP_TOOLS still narrows an admin group — an operator env var, set on purpose', () => {
    process.env.ADMIN_MCP_TOOLS = 'mcp__srv__read, mcp__other__deploy';
    const r = resolveMcpAllowlist(group({ is_admin: 1 }));
    // `state` says where it came from; `restricts` says whether it filters.
    // This is the one case where they differ, which is why they are separate.
    expect(r.state).toBe('inherited');
    expect(r.restricts).toBe(true);
    expect(r.tools).toEqual(['mcp__srv__read', 'mcp__other__deploy']);
    expect(r.origin).toContain('ADMIN_MCP_TOOLS');
  });

  it('an explicit list still beats ADMIN_MCP_TOOLS', () => {
    process.env.ADMIN_MCP_TOOLS = 'mcp__other__deploy';
    const r = resolveMcpAllowlist(group({ is_admin: 1, allowed_mcp_tools: JSON.stringify(['mcp__srv__read']) }));
    expect(r.tools).toEqual(['mcp__srv__read']);
  });

  it('the unrestricted sentinel is a state of its own', () => {
    const r = resolveMcpAllowlist(group({ allowed_mcp_tools: UNRESTRICTED }));
    expect(r.state).toBe('unrestricted');
    expect(r.restricts).toBe(false);
    expect(r.tools).toEqual(ALL);
    expect(r.blocked).toEqual([]);
  });

  it('reads the legacy comma-separated column as an explicit list', () => {
    const r = resolveMcpAllowlist(group({ allowed_mcp_tools: 'mcp__srv__read,mcp__srv__write' }));
    expect(r.state).toBe('explicit');
    expect(r.tools).toEqual(['mcp__srv__read', 'mcp__srv__write']);
  });
});

describe('parseStoredAllowlist', () => {
  it('maps every stored shape to one intention', () => {
    expect(parseStoredAllowlist(null)).toBeNull();
    expect(parseStoredAllowlist('')).toBeNull();
    expect(parseStoredAllowlist('   ')).toBeNull();
    expect(parseStoredAllowlist('*')).toBe('unrestricted');
    expect(parseStoredAllowlist('"*"')).toBe('unrestricted');
    expect(parseStoredAllowlist('["*"]')).toBe('unrestricted');
    expect(parseStoredAllowlist('["mcp__a__b"]')).toEqual(['mcp__a__b']);
    expect(parseStoredAllowlist('mcp__a__b, mcp__c__d')).toEqual(['mcp__a__b', 'mcp__c__d']);
  });
});

describe('parseAllowlistFlag', () => {
  it('stores an explicit array as JSON', () => {
    expect(parseAllowlistFlag('["mcp__a__b"]')).toBe('["mcp__a__b"]');
  });

  it("'inherit' and 'null' clear the column — they do NOT mean unrestricted", () => {
    expect(parseAllowlistFlag('inherit')).toBeNull();
    expect(parseAllowlistFlag('null')).toBeNull();
    expect(parseAllowlistFlag(null)).toBeNull();
  });

  it("'unrestricted' is spelled out, and stores the sentinel", () => {
    expect(parseAllowlistFlag('unrestricted')).toBe(UNRESTRICTED);
    expect(parseAllowlistFlag('*')).toBe(UNRESTRICTED);
  });

  it('rejects non-MCP names and a missing flag', () => {
    expect(() => parseAllowlistFlag('["Bash"]')).toThrow(/Not MCP tool names/);
    expect(() => parseAllowlistFlag(undefined)).toThrow(/--tools is required/);
    expect(() => parseAllowlistFlag('"a string"')).toThrow(/must be a JSON array/);
  });
});
