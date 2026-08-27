/**
 * The gate inventory for NanoClaw's own MCP tools, as a test.
 *
 * The MCP allow-list does not govern `mcp__nanoclaw__*` (see
 * `src/mcp-allowlist.ts`). That is only defensible if every built-in with a
 * host-side effect answers to a gate of its own. This file pins that claim to
 * the registry instead of to prose, so the day someone registers a new
 * privileged action without a guard, this goes red rather than the security
 * argument quietly becoming false.
 *
 * Two built-ins are recorded here as KNOWN-WEAK: they run unguarded by
 * declaration and are reachable by any agent group. They are documented in
 * `docs/mcp-allowlist.md`, not hidden. If you tighten one, this test tells you
 * to move it out of the weak list — which is the point.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('./container-runner.js', () => ({
  wakeContainer: vi.fn().mockResolvedValue(undefined),
  isContainerRunning: vi.fn().mockReturnValue(false),
  getActiveContainerCount: vi.fn().mockReturnValue(0),
  killContainer: vi.fn(),
  buildAgentGroupImage: vi.fn().mockResolvedValue(undefined),
}));

const { describeDeliveryActionGuard } = await import('./delivery.js');
// Side-effect imports: each module registers its delivery actions.
await import('./modules/self-mod/index.js');
await import('./modules/agent-to-agent/index.js');
await import('./modules/approval-ledger/index.js');
await import('./modules/pr-mapping/index.js');

/**
 * Every built-in tool that produces a host-side effect, and the delivery
 * action it writes. The names differ in one case — `report_pr_created` writes
 * `map_pr_session` — which is exactly why this is written out rather than
 * derived.
 *
 * The pure messaging tools (`send_message`, `send_file`, `add_reaction`,
 * `ask_user_question`, `send_card`) are absent because they write ordinary
 * outbound messages, not actions: their gate is the destination ACL in
 * `deliverMessage`, asserted separately in `delivery.test.ts`.
 */
const BUILTIN_TOOL_ACTIONS: Record<string, string> = {
  install_packages: 'install_packages',
  add_mcp_server: 'add_mcp_server',
  request_restart: 'request_restart',
  create_agent: 'create_agent',
  wire_agents: 'wire_agents',
  append_learning: 'append_learning',
  record_decision: 'record_decision',
  report_pr_created: 'map_pr_session',
};

/** Built-ins held behind the guard seam — approval or a capability check. */
const GUARD_HELD = ['install_packages', 'add_mcp_server', 'create_agent', 'record_decision'];

/**
 * Built-ins that run unguarded at the delivery seam AND whose own handler
 * enforces nothing an untrusted agent could not satisfy.
 *
 * **Empty.** Both former entries were fixed rather than left recorded:
 *
 * - `report_pr_created` used to write `pr_session_mappings` with
 *   `INSERT OR REPLACE`, so any group could claim any `(repo, pr_number)` and
 *   redirect that PR's GitHub webhooks to its own session — silently, when the
 *   takeover was same-instance. It is now first-claim-wins with a refusal
 *   logged at ERROR (`modules/pr-mapping/store.ts`), and corrections go
 *   through the approval-gated `ncl pr-mappings remap`.
 * - `append_learning` still writes into the shared directory every group
 *   reads — restricting that would break the feature — but the write is no
 *   longer anonymous: each learning records its author group and session, and
 *   the index shows the author beside every entry.
 *
 * Neither is guard-HELD, which is why they are classified below as
 * `HANDLER_ENFORCED` rather than moved to `GUARD_HELD`: the authorization is
 * in the handler, in a form the guard seam cannot express (it is a check on
 * the arguments against existing state, not a hold for approval).
 */
const KNOWN_WEAK: string[] = [];

/**
 * Unguarded at the delivery seam, but the handler itself enforces authority.
 *
 * - `wire_agents` refuses a non-`is_admin` caller.
 * - `report_pr_created` refuses a claim on a PR another group holds.
 * - `append_learning` attributes every write to its author.
 */
const HANDLER_ENFORCED = ['wire_agents', 'report_pr_created', 'append_learning'];

/** Unguarded and deliberately so — no privilege is being exercised. */
const NOT_PRIVILEGED = ['request_restart'];

describe('every built-in MCP tool with a host-side effect is registered', () => {
  it.each(Object.entries(BUILTIN_TOOL_ACTIONS))('%s → delivery action %s', (_tool, action) => {
    expect(describeDeliveryActionGuard(action).registered).toBe(true);
  });
});

describe('the gate inventory matches the registry', () => {
  it('holds the privilege-escalating built-ins behind the guard seam', () => {
    for (const tool of GUARD_HELD) {
      const desc = describeDeliveryActionGuard(BUILTIN_TOOL_ACTIONS[tool]);
      expect(desc, `${tool} must be registered`).toMatchObject({ registered: true });
      expect(desc, `${tool} must be guard-held, not unguarded`).toMatchObject({ guarded: true });
    }
  });

  it('records every unguarded built-in with its stated reason', () => {
    for (const tool of [...KNOWN_WEAK, ...HANDLER_ENFORCED, ...NOT_PRIVILEGED]) {
      const desc = describeDeliveryActionGuard(BUILTIN_TOOL_ACTIONS[tool]);
      expect(desc, `${tool}`).toMatchObject({ registered: true, guarded: false });
      // `unguarded(reason)` is the only way to register without a guard, so a
      // reason always exists — the declaration IS the audit trail.
      expect((desc as { reason: string }).reason.length).toBeGreaterThan(0);
    }
  });

  it('classifies every built-in exactly once', () => {
    const classified = [...GUARD_HELD, ...KNOWN_WEAK, ...HANDLER_ENFORCED, ...NOT_PRIVILEGED];
    expect([...classified].sort()).toEqual(Object.keys(BUILTIN_TOOL_ACTIONS).sort());
    expect(new Set(classified).size).toBe(classified.length);
  });
});

describe('nothing is left in the known-weak list', () => {
  // The canary moved with the code rather than being deleted. It used to
  // assert that `report_pr_created` and `append_learning` were still weak, so
  // that fixing one would go red and force the docs to be updated in the same
  // change — which is exactly what happened. It now asserts the list is empty,
  // so ADDING a knowingly-weak built-in is the thing that has to be deliberate.
  it('is empty — a new entry here needs an entry in docs/mcp-allowlist.md too', () => {
    expect(KNOWN_WEAK).toEqual([]);
  });
});

describe('actions that are not agent MCP tools stay out of the inventory', () => {
  it('cli_request and record_human_verdict are not built-in tool actions', () => {
    // `cli_request` is the ncl bridge over Bash — gated by cli_scope and the
    // dispatch guard. `record_human_verdict` arrives from the GitHub webhook,
    // not from a tool call. Neither has an MCP-tool identity.
    expect(Object.values(BUILTIN_TOOL_ACTIONS)).not.toContain('cli_request');
    expect(Object.values(BUILTIN_TOOL_ACTIONS)).not.toContain('record_human_verdict');
  });
});
