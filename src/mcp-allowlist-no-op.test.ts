/**
 * Deploying this must change nothing for any existing group.
 *
 * The governing rule: **nothing implicit may change a group's scope — only an
 * explicit `ncl groups mcp-tools set` may reduce or add it.** Every group on
 * the deployed instances has `allowed_mcp_tools: null`, so every one of them
 * must come out of this resolver with nothing denied, on every surface, no
 * matter what its coworker type declares, whether the registry loads, or
 * whether the MCP proxy is up.
 *
 * This is the test that would have caught #1157's real defect. #1157 was
 * correct about the empty-list fail-open and wrong about who else it applied
 * to: it derived a restriction from the coworker-type manifest, which meant
 * adopting a type silently narrowed a group that had never asked to be
 * narrowed. Nothing here asserts an implementation detail — it asserts that
 * the blast radius of the whole feature is zero until somebody opts in.
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

const { isMcpToolPermitted, resolveMcpAllowlist, serverHasAllowedTools, toMcpPolicyWire } =
  await import('./mcp-allowlist.js');
type Group = Parameters<typeof resolveMcpAllowlist>[0];

/** Every tool an agent might reach for, across every surface. */
const PROBES = [
  'mcp__deepwiki__ask_question',
  'mcp__slang-mcp__github_get_issue',
  'mcp__codex__codex',
  'mcp__codex__codex-reply',
  'mcp__nanoclaw__send_message',
  'mcp__nanoclaw__install_packages',
  'mcp__nanoclaw__create_agent',
  'mcp__brand_new_server__brand_new_tool',
];

const SERVERS = ['deepwiki', 'slang-mcp', 'codex', 'nanoclaw', 'brand_new_server'];

const originalCwd = process.cwd();
const tempDirs: string[] = [];
let savedAdminTools: string | undefined;

beforeEach(() => {
  inventory = { deepwiki: ['mcp__deepwiki__ask_question'] };
  inventoryThrows = false;
  savedAdminTools = process.env.ADMIN_MCP_TOOLS;
  delete process.env.ADMIN_MCP_TOOLS;
});

afterEach(() => {
  process.chdir(originalCwd);
  if (savedAdminTools === undefined) delete process.env.ADMIN_MCP_TOOLS;
  else process.env.ADMIN_MCP_TOOLS = savedAdminTools;
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

/**
 * Assert the resolution denies nothing, anywhere.
 *
 * Behavioural probes first, field checks last, deliberately: on a tree where
 * this policy is wrong the first failure should be "it denied deepwiki", not
 * "a field you added is undefined".
 */
function expectDeniesNothing(group: Group, label: string): void {
  const r = resolveMcpAllowlist(group);
  for (const tool of PROBES) {
    expect(isMcpToolPermitted(r, tool), `${label}: ${tool}`).toBe(true);
  }
  for (const server of SERVERS) {
    expect(serverHasAllowedTools(r, server), `${label}: server ${server}`).toBe(true);
  }
  expect(r.blocked, `${label}: blocked`).toEqual([]);
  expect(r.restricts, `${label}: restricts`).toBe(false);
  // And the container is told to filter nothing.
  expect(toMcpPolicyWire(r).restrict, `${label}: wire`).toBe(false);
}

describe('a group nobody has run `mcp-tools set` against is never restricted', () => {
  it.each([
    ['untyped, non-admin', { coworker_type: null, is_admin: 0 }],
    ['typed non-admin', { coworker_type: 'slang-fix', is_admin: 0 }],
    ['a type whose manifest declares no MCP tools', { coworker_type: 'thin', is_admin: 0 }],
    ['a type that does not exist at all', { coworker_type: 'no-such-type', is_admin: 0 }],
    ['admin', { coworker_type: null, is_admin: 1 }],
    ['admin with a type', { coworker_type: 'main', is_admin: 1 }],
  ])('%s', (label, overrides) => {
    expectDeniesNothing({ allowed_mcp_tools: null, ...overrides } as Group, label);
  });

  it('holds when the coworker registry cannot be read at all', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-noop-no-registry-'));
    tempDirs.push(dir);
    process.chdir(dir);
    expectDeniesNothing(
      { allowed_mcp_tools: null, is_admin: 0, coworker_type: 'slang-fix' } as Group,
      'broken registry',
    );
  });

  it('holds when the MCP proxy is down and the inventory is unreadable', () => {
    inventoryThrows = true;
    const group = { allowed_mcp_tools: null, is_admin: 0, coworker_type: 'slang-fix' } as Group;
    expectDeniesNothing(group, 'inventory unreadable');
    // …and it is reported, loudly, without changing the policy.
    expect(resolveMcpAllowlist(group).configurationError).toMatch(/could not be read/);
  });

  it('holds for the explicit `*` sentinel too', () => {
    expectDeniesNothing(
      { allowed_mcp_tools: '*', is_admin: 0, coworker_type: 'slang-fix' } as Group,
      'unrestricted sentinel',
    );
  });
});

describe('an explicit list is the only thing that changes anything', () => {
  it('an empty list denies every external tool — the F03 fix, opt-in only', () => {
    const r = resolveMcpAllowlist({
      allowed_mcp_tools: '[]',
      is_admin: 0,
      coworker_type: 'slang-fix',
    } as Group);
    expect(r.restricts).toBe(true);
    expect(toMcpPolicyWire(r)).toEqual({ restrict: true, tools: [], origin: expect.any(String) });
    expect(isMcpToolPermitted(r, 'mcp__deepwiki__ask_question')).toBe(false);
    expect(serverHasAllowedTools(r, 'codex')).toBe(false);
    // Built-ins are out of scope even then.
    expect(isMcpToolPermitted(r, 'mcp__nanoclaw__install_packages')).toBe(true);
  });

  it('a narrow list permits exactly what it names', () => {
    const r = resolveMcpAllowlist({
      allowed_mcp_tools: JSON.stringify(['mcp__slang-mcp__github_get_issue']),
      is_admin: 0,
      coworker_type: 'slang-fix',
    } as Group);
    expect(r.restricts).toBe(true);
    expect(isMcpToolPermitted(r, 'mcp__slang-mcp__github_get_issue')).toBe(true);
    expect(isMcpToolPermitted(r, 'mcp__deepwiki__ask_question')).toBe(false);
    expect(serverHasAllowedTools(r, 'slang-mcp')).toBe(true);
    expect(serverHasAllowedTools(r, 'codex')).toBe(false);
  });
});
