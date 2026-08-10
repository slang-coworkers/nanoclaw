/**
 * Policy STATE, not list length.
 *
 * The pre-fix resolver had three states and no way to say "I could not work
 * this out". Every consumer therefore reduced the policy to `tools.length`,
 * and `0` meant "install no restrictions" — so an explicit `[]`, a coworker
 * type with no MCP skills, and a coworker registry that failed to load all
 * produced a container with every direct MCP namespace wildcard-allowed.
 */
import fs from 'fs';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

let inventory: Record<string, string[]> = {};
let inventoryThrows = false;

vi.mock('./mcp-auth-proxy.js', () => ({
  getDiscoveredToolInventory: () => {
    if (inventoryThrows) throw new Error('proxy not started');
    return inventory;
  },
}));

const { isMcpToolPermitted, resolveMcpAllowlist, serverHasAllowedTools, toMcpPolicyWire, UNRESTRICTED } =
  await import('./mcp-allowlist.js');
type Group = Parameters<typeof resolveMcpAllowlist>[0];

function group(overrides: Partial<Group> = {}): Group {
  return { allowed_mcp_tools: null, is_admin: 0, coworker_type: 'slang-fix', ...overrides } as Group;
}

const originalCwd = process.cwd();
const tempDirs: string[] = [];

beforeEach(() => {
  inventory = { deepwiki: ['mcp__deepwiki__ask_question', 'mcp__deepwiki__read_wiki_contents'] };
  inventoryThrows = false;
});

afterEach(() => {
  process.chdir(originalCwd);
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('an explicit empty list is a policy, not an absence', () => {
  const resolved = () => resolveMcpAllowlist(group({ allowed_mcp_tools: '[]' }));

  it('resolves to explicit with an empty configured list', () => {
    const r = resolved();
    expect(r.state).toBe('explicit');
    expect(r.tools).toEqual([]);
    expect(r.externalTools).toEqual([]);
  });

  it('denies the codex direct server and every proxied tool', () => {
    const r = resolved();
    expect(serverHasAllowedTools(r, 'codex')).toBe(false);
    expect(serverHasAllowedTools(r, 'deepwiki')).toBe(false);
    expect(isMcpToolPermitted(r, 'mcp__deepwiki__ask_question')).toBe(false);
    expect(r.blocked).toEqual(['mcp__deepwiki__ask_question', 'mcp__deepwiki__read_wiki_contents']);
  });
});

describe('a group with no explicit list restricts nothing', () => {
  it('is the default, and the default is unchanged behaviour', () => {
    const r = resolveMcpAllowlist(group({ coworker_type: 'thin' }));
    expect(r.state).toBe('inherited');
    expect(serverHasAllowedTools(r, 'codex')).toBe(true);
    expect(isMcpToolPermitted(r, 'mcp__deepwiki__ask_question')).toBe(true);
    expect(r.blocked).toEqual([]);
  });
});

describe('a configuration fault is reported, never enforced', () => {
  it('reports an unreadable inventory without narrowing anybody', () => {
    inventoryThrows = true;
    const r = resolveMcpAllowlist(group());
    expect(r.state).toBe('inherited');
    expect(r.configurationError).toMatch(/could not be read/);
    // Still restricts nothing: a broken proxy is a bug report, not a policy.
    expect(isMcpToolPermitted(r, 'mcp__deepwiki__ask_question')).toBe(true);
    expect(serverHasAllowedTools(r, 'codex')).toBe(true);
  });

  it('cannot lift an explicit restriction — the restrictive branch never reads the inventory', () => {
    inventoryThrows = true;
    const r = resolveMcpAllowlist(group({ allowed_mcp_tools: JSON.stringify(['mcp__deepwiki__ask_question']) }));
    expect(r.state).toBe('explicit');
    expect(r.configurationError).toMatch(/could not be read/);
    expect(isMcpToolPermitted(r, 'mcp__deepwiki__ask_question')).toBe(true);
    expect(isMcpToolPermitted(r, 'mcp__deepwiki__read_wiki_contents')).toBe(false);
    expect(isMcpToolPermitted(r, 'mcp__codex__codex')).toBe(false);
    // …but we do not claim to know the complete blocked set.
    expect(r.blocked).toEqual([]);
  });

  it('reports no fault when everything reads cleanly', () => {
    expect(resolveMcpAllowlist(group()).configurationError).toBeNull();
    expect(resolveMcpAllowlist(group({ allowed_mcp_tools: '[]' })).configurationError).toBeNull();
  });
});

describe('unrestricted is untouched', () => {
  it('permits by omission and blocks nothing', () => {
    const r = resolveMcpAllowlist(group({ allowed_mcp_tools: UNRESTRICTED }));
    expect(r.state).toBe('unrestricted');
    expect(isMcpToolPermitted(r, 'mcp__anything__at_all')).toBe(true);
    expect(serverHasAllowedTools(r, 'codex')).toBe(true);
    expect(r.blocked).toEqual([]);
  });
});

describe('explicit is the ONLY state that denies anything', () => {
  it.each([
    ['inherited (nothing stored)', null],
    ['unrestricted', UNRESTRICTED],
  ])('%s permits an arbitrary external tool', (_label, stored) => {
    const r = resolveMcpAllowlist(group({ allowed_mcp_tools: stored }));
    expect(isMcpToolPermitted(r, 'mcp__whatever__tool')).toBe(true);
    expect(serverHasAllowedTools(r, 'whatever')).toBe(true);
  });

  it('only an explicit list denies', () => {
    const r = resolveMcpAllowlist(group({ allowed_mcp_tools: '[]' }));
    expect(isMcpToolPermitted(r, 'mcp__whatever__tool')).toBe(false);
  });
});

describe('the container wire format says whether to filter, not where the policy came from', () => {
  it('an empty explicit list is distinguishable from silence', () => {
    const wire = toMcpPolicyWire(resolveMcpAllowlist(group({ allowed_mcp_tools: '[]' })));
    expect(wire.restrict).toBe(true);
    expect(wire.tools).toEqual([]);
    expect(JSON.parse(JSON.stringify(wire))).toEqual(wire);
  });

  it('no stored list tells the container to filter nothing', () => {
    expect(toMcpPolicyWire(resolveMcpAllowlist(group())).restrict).toBe(false);
  });
});
