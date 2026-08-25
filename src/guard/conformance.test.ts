/**
 * Guard conformance — checked with the real registries.
 *
 * The old registry walk is gone: an unmapped consult or an undeclared
 * unguarded registration is now unconstructible — await guard() takes the defined
 * GuardedAction value (a dropped module-edge import or typo'd name is a
 * compile error), and the keyed registries require a guard spec or an
 * explicit unguarded(<reason>) declaration. What's left to verify is the
 * cross-registry pairing the compiler can't see: every holding action has a
 * registered approve continuation. (At runtime a missing continuation is
 * handled loudly at click time — the requester is told no handler is
 * installed; this test keeps the tree from shipping that state.)
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

// Hermeticity: config.ts resolves the ledger-writer allowlist as
// `process.env.APPROVAL_LEDGER_WRITERS || envConfig.APPROVAL_LEDGER_WRITERS || ''`,
// where `envConfig` is captured once at import from the on-disk `.env`. On a box
// whose `.env` sets APPROVAL_LEDGER_WRITERS (e.g. prod), the "empty allowlist"
// test's `process.env = ''` override is falsy and falls through to that non-empty
// file value — so the allowlist is not actually empty and the deny reason changes
// from the "no writers configured" branch to the "group not on the list" branch,
// failing the assertion. Mock the env loader to report empty so "empty" means
// empty regardless of any on-disk `.env`. The other F14 tests set a non-empty
// `process.env.APPROVAL_LEDGER_WRITERS`, which takes precedence, so they are
// unaffected. (Mirrors github-webhook-participant-issue.test.ts.)
vi.mock('../env.js', () => ({
  readEnvFile: () => ({}) as Record<string, string>,
}));

// Production barrels — side-effect imports populate the real registries.
import '../cli/commands/index.js';
import '../modules/index.js';
import '../cli/delivery-action.js';
import '../cli/dispatch.js'; // registers the cli_command approval handler

import { commandGuard, listCommands } from '../cli/registry.js';
import { getApprovalHandler } from '../modules/approvals/primitive.js';
import { approvalLedgerRecordDecision, approvalLedgerRecordHumanVerdict } from '../modules/approval-ledger/guard.js';
import { guard } from './guard.js';
import { defineGuardedAction, listGuardedActions } from './guard-actions.js';
import { HOLD, type GuardInput } from './types.js';

describe('guard conformance', () => {
  it('every holding action pairs with a registered approval handler', () => {
    const holding = listGuardedActions().filter((spec) => spec.grantActionName);
    expect(holding.length).toBeGreaterThan(0);

    const dangling = holding.filter((spec) => !getApprovalHandler(spec.grantActionName as string));
    expect(dangling.map((s) => s.action)).toEqual([]);
  });

  it('every mutating ncl command derives a guard that holds via cli_command', () => {
    const mutating = listCommands().filter((cmd) => cmd.access === 'approval');
    expect(mutating.length).toBeGreaterThan(0);

    const wrong = mutating.filter((cmd) => commandGuard(cmd.name).grantActionName !== 'cli_command');
    expect(wrong.map((c) => c.name)).toEqual([]);
  });

  it('the domain catalog entries are defined once the module barrels load', () => {
    const actions = new Set(listGuardedActions().map((s) => s.action));
    for (const expected of [
      'agents.create',
      'a2a.send',
      'self_mod.install_packages',
      'self_mod.add_mcp_server',
      'senders.admit',
      'channels.register',
      'approval_ledger.record_decision',
      'approval_ledger.record_human_verdict',
    ]) {
      expect(actions.has(expected), `catalog is missing "${expected}"`).toBe(true);
    }
  });

  it('defining the same action twice throws — names are the catalog key', () => {
    defineGuardedAction({ action: 'test.dup-define', decide: () => HOLD('x') });
    expect(() => defineGuardedAction({ action: 'test.dup-define', decide: () => HOLD('x') })).toThrow(
      /already defined/,
    );
  });
});

/**
 * F14. `record_decision` and `record_human_verdict` are registered in the CORE
 * MCP server handed to EVERY container, and "PR-approver coworkers only" lived
 * solely in the tool descriptions — the host handlers took the unguarded path.
 * Any compromised or prompt-injected agent could therefore append (and, under
 * INSERT OR REPLACE, overwrite) rows in the ledger that feeds the
 * author-vs-approver calibration dashboards humans read to decide how far to
 * trust the bots.
 *
 * The allowlist is read per call (config.approvalLedgerWriters), so these tests
 * set it in the environment rather than mocking the module.
 */
describe('approval-ledger authorization (F14)', () => {
  const NON_APPROVER: GuardInput = {
    actor: { kind: 'agent', agentGroupId: 'ag-some-other-coworker', sessionId: 'sess-x' },
    payload: { repo: 'shader-slang/slang', pr_number: 11993, commit_sha: 'a'.repeat(40), decision: 'WOULD_APPROVE' },
  };

  const prevWriters = process.env.APPROVAL_LEDGER_WRITERS;
  afterEach(() => {
    if (prevWriters === undefined) delete process.env.APPROVAL_LEDGER_WRITERS;
    else process.env.APPROVAL_LEDGER_WRITERS = prevWriters;
  });

  it('a container without the ledger-writer capability cannot record a decision', async () => {
    process.env.APPROVAL_LEDGER_WRITERS = 'ag-slang-pr-approver';
    const d = await guard(approvalLedgerRecordDecision, NON_APPROVER);
    expect(d.effect).toBe('deny');
    // Specifically a refusal, NOT a hold: an approval card asking a human to
    // bless an unverifiable claim would launder the forgery, not stop it.
    expect(approvalLedgerRecordDecision.grantActionName).toBeUndefined();
  });

  it('a container without the ledger-writer capability cannot record a human verdict', async () => {
    process.env.APPROVAL_LEDGER_WRITERS = 'ag-slang-pr-approver';
    expect((await guard(approvalLedgerRecordHumanVerdict, NON_APPROVER)).effect).toBe('deny');
  });

  it('NO container may record a human verdict — not even a declared ledger writer', async () => {
    // The human outcome is not the agent's to report about its own work. The
    // host stamps it from the GitHub delivery that observed it.
    process.env.APPROVAL_LEDGER_WRITERS = 'ag-slang-pr-approver';
    const approver: GuardInput = {
      actor: { kind: 'agent', agentGroupId: 'ag-slang-pr-approver', sessionId: 'sess-a' },
      payload: NON_APPROVER.payload,
    };
    expect((await guard(approvalLedgerRecordHumanVerdict, approver)).effect).toBe('deny');
  });

  it('a declared ledger writer is allowed to record a decision', async () => {
    process.env.APPROVAL_LEDGER_WRITERS = 'ag-slang-pr-approver,slangpy-pr-approver';
    const approver: GuardInput = {
      actor: { kind: 'agent', agentGroupId: 'ag-slang-pr-approver', sessionId: 'sess-a' },
      payload: NON_APPROVER.payload,
    };
    expect((await guard(approvalLedgerRecordDecision, approver)).effect).toBe('allow');
  });

  it('an empty allowlist denies everyone — the capability is never implicit', async () => {
    // `= ''` is a truly empty allowlist here: the `../env.js` mock above forces the
    // envConfig fallback empty, so it can't leak a value from the host's on-disk `.env`.
    process.env.APPROVAL_LEDGER_WRITERS = '';
    const approver: GuardInput = {
      actor: { kind: 'agent', agentGroupId: 'ag-slang-pr-approver', sessionId: 'sess-a' },
      payload: NON_APPROVER.payload,
    };
    const d = await guard(approvalLedgerRecordDecision, approver);
    expect(d.effect).toBe('deny');
    expect(d.reason).toContain('APPROVAL_LEDGER_WRITERS');
  });

  it('a non-agent actor cannot reach the container-originated action', async () => {
    process.env.APPROVAL_LEDGER_WRITERS = 'ag-slang-pr-approver';
    expect((await guard(approvalLedgerRecordDecision, { actor: { kind: 'system' }, payload: {} })).effect).toBe('deny');
  });
});
