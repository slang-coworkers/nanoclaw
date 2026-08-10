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
import os from 'os';
import path from 'path';
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
  const resolved = () => resolveMcpAllowlist(group({ allowed_mcp_tools: '[]' }), []);

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

describe('an inherited manifest that resolves to zero tools behaves identically', () => {
  it('denies the same external surfaces as an explicit empty list', () => {
    const r = resolveMcpAllowlist(group({ coworker_type: 'thin' }), []);
    expect(r.state).toBe('inherited');
    expect(r.externalTools).toEqual([]);
    expect(serverHasAllowedTools(r, 'codex')).toBe(false);
    expect(isMcpToolPermitted(r, 'mcp__deepwiki__ask_question')).toBe(false);
  });
});

describe('resolution failure is unresolved, never an empty policy', () => {
  it('marks a coworker registry that cannot be read as unresolved', () => {
    // An empty directory has no coworker-types.yaml, so resolveCoworkerManifest
    // throws. Pre-fix that was swallowed into `tools: []` — a broken registry
    // silently became a policy, and an empty policy was no policy at all.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-allowlist-unresolved-'));
    tempDirs.push(dir);
    process.chdir(dir);

    const r = resolveMcpAllowlist(group({ coworker_type: 'slang-fix' }));
    expect(r.state).toBe('unresolved');
    expect(r.origin).toMatch(/could not be resolved/);
    expect(r.externalTools).toEqual([]);
    expect(isMcpToolPermitted(r, 'mcp__deepwiki__ask_question')).toBe(false);
  });

  it('marks an unreadable tool inventory as unresolved rather than "unrestricted over nothing"', () => {
    inventoryThrows = true;
    // `unrestricted` means "every discovered tool". If discovery cannot be
    // read, the honest answer is that the set is unknown — not that it is
    // empty, and not that everything is fine.
    const r = resolveMcpAllowlist(group({ allowed_mcp_tools: UNRESTRICTED }));
    expect(r.state).toBe('unresolved');
    expect(isMcpToolPermitted(r, 'mcp__deepwiki__ask_question')).toBe(false);

    const admin = resolveMcpAllowlist(group({ is_admin: 1 }));
    expect(admin.state).toBe('unresolved');
  });

  it('does not let an unreadable inventory weaken an explicit list', () => {
    inventoryThrows = true;
    const r = resolveMcpAllowlist(group({ allowed_mcp_tools: JSON.stringify(['mcp__deepwiki__ask_question']) }), []);
    expect(r.state).toBe('explicit');
    expect(isMcpToolPermitted(r, 'mcp__deepwiki__ask_question')).toBe(true);
    // Every other EXTERNAL tool is still denied — enforcement never needed the
    // inventory. Built-ins are a different question, answered in
    // mcp-allowlist-scope.test.ts.
    expect(isMcpToolPermitted(r, 'mcp__deepwiki__read_wiki_contents')).toBe(false);
    expect(isMcpToolPermitted(r, 'mcp__codex__codex')).toBe(false);
    // …but we do not claim to know the complete blocked set.
    expect(r.blocked).toEqual([]);
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

describe('the container wire format carries the state', () => {
  it('sends the external list and the state, so an empty list is distinguishable from silence', () => {
    const wire = toMcpPolicyWire(resolveMcpAllowlist(group({ allowed_mcp_tools: '[]' }), []));
    expect(wire.state).toBe('explicit');
    expect(wire.tools).toEqual([]);
    expect(JSON.parse(JSON.stringify(wire))).toEqual(wire);
  });
});
