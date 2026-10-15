// Tests for the wake decision in sweep-gate.mjs. Importing the script does not
// run the sweep (main() is guarded on argv[1]), so these tests drive the pure
// helpers with fixture payloads shaped like the entries the sweep emits.
//
// Run with: node --test 'container/skills/slang-ci-babysitter/scripts/*.test.mjs'
import test from 'node:test';
import assert from 'node:assert/strict';
import { decideWake, fingerprintPr, sleepSummary, errorGate } from './sweep-gate.mjs';

const check = (name) => ({ name, id: 1, target_url: null });

// A floor entry as exclusionFieldsForFloor builds it, with overrides.
const prEntry = (number, overrides = {}) => ({
  number,
  title: 'PR ' + number,
  updatedAt: '2026-10-15T00:00:00Z',
  inFloor: true,
  hasNewActivity: false,
  fullScan: false,
  headSha: 'sha-' + number,
  exclusionChecked: true,
  mergeStateStatus: 'BLOCKED',
  excludedChecks: [],
  signatureMismatches: [],
  baseSkewChecks: [],
  baseSkewVerificationSkipped: [],
  blockedChecks: [],
  actionableFailingChecks: [],
  allFailuresExcluded: false,
  onlyBlocked: false,
  ...overrides,
});

const summary = (prs, extra = {}) => ({ driftCheck: { status: 'ok' }, prs, evicted: [], ...extra });

const reasonsFor = (result, number) => result.wakeReasons.filter((r) => r.number === number).map((r) => r.reason);

test('no failing checks on any selected PR: asleep, nothing tracked', () => {
  const r = decideWake(summary([prEntry(1), prEntry(2)]), null);
  assert.equal(r.wakeAgent, false);
  assert.deepEqual(r.wakeReasons, []);
  assert.deepEqual(r.nextState.prs, {});
});

test('failing check explained by the tracked-regression ledger: asleep', () => {
  const pr = prEntry(10, {
    excludedChecks: [{ name: 'test-slang', issue: 13024 }],
    allFailuresExcluded: true,
  });
  const r = decideWake(summary([pr]), null);
  assert.equal(r.wakeAgent, false);
  assert.deepEqual(r.nextState.prs, {});
});

test('failing check explained as base-skew needs-rebase: asleep', () => {
  const pr = prEntry(11, {
    baseSkewChecks: [{ name: 'SlangPy Tests', landingPr: 12986, verdict: 'needs-rebase' }],
    allFailuresExcluded: true,
  });
  assert.equal(decideWake(summary([pr]), null).wakeAgent, false);
});

test('failing check nothing explains: wake with the PR number and check names', () => {
  const pr = prEntry(12, { actionableFailingChecks: [check('build-linux'), check('test-slang')] });
  const r = decideWake(summary([pr]), null);
  assert.equal(r.wakeAgent, true);
  assert.deepEqual(r.wakeReasons, [
    { number: 12, reason: 'failing-unexcluded', checks: ['build-linux', 'test-slang'] },
  ]);
  assert.deepEqual(r.nextState.prs['12'], {
    headSha: 'sha-12',
    failing: ['build-linux', 'test-slang'],
    blocked: [],
    rollupUnexplained: false,
  });
});

test('same failing PR as the previous fire: still wakes while it is red', () => {
  const pr = prEntry(12, { actionableFailingChecks: [check('build-linux')] });
  const first = decideWake(summary([pr]), null);
  const second = decideWake(summary([pr]), first.nextState);
  assert.equal(second.wakeAgent, true);
  assert.deepEqual(reasonsFor(second, 12), ['failing-unexcluded']);
  assert.deepEqual(second.nextState, first.nextState);
});

test('tracked PR whose head moved: wake even when the new head is clean', () => {
  const red = prEntry(13, { actionableFailingChecks: [check('build-linux')] });
  const previous = decideWake(summary([red]), null).nextState;
  const pushed = prEntry(13, { headSha: 'sha-13-b' });
  const r = decideWake(summary([pushed]), previous);
  assert.equal(r.wakeAgent, true);
  assert.deepEqual(r.wakeReasons, [
    { number: 13, reason: 'tracked-head-changed', from: 'sha-13', to: 'sha-13-b' },
  ]);
  assert.deepEqual(r.nextState.prs, {}, 'a clean PR drops out of the tracked set');
});

test('tracked PR whose failures cleared on the same head: wake once, then asleep', () => {
  const red = prEntry(14, { actionableFailingChecks: [check('test-slang')] });
  const previous = decideWake(summary([red]), null).nextState;
  const cleared = decideWake(summary([prEntry(14)]), previous);
  assert.equal(cleared.wakeAgent, true);
  assert.deepEqual(cleared.wakeReasons, [{ number: 14, reason: 'tracked-failures-cleared', checks: ['test-slang'] }]);
  const quiet = decideWake(summary([prEntry(14)]), cleared.nextState);
  assert.equal(quiet.wakeAgent, false);
});

test('untracked PR whose head moved while green: asleep', () => {
  const previous = decideWake(summary([prEntry(15)]), null).nextState;
  const r = decideWake(summary([prEntry(15, { headSha: 'sha-15-b' })]), previous);
  assert.equal(r.wakeAgent, false);
});

test('blocked check wakes when it first appears, then stays quiet while unchanged', () => {
  const blocked = prEntry(16, {
    blockedChecks: [{ name: 'falcor-build-approval-gate', status: 'waiting', id: 5 }],
    onlyBlocked: true,
  });
  const first = decideWake(summary([blocked]), null);
  assert.equal(first.wakeAgent, true);
  assert.deepEqual(first.wakeReasons, [{ number: 16, reason: 'newly-blocked', checks: ['falcor-build-approval-gate'] }]);
  const second = decideWake(summary([blocked]), first.nextState);
  assert.equal(second.wakeAgent, false);
  assert.deepEqual(second.nextState.prs['16'].blocked, ['falcor-build-approval-gate']);
});

test('unexplained non-green rollup on a full-scan tail entry: wake', () => {
  const pr = prEntry(17, { exclusionChecked: false, fullScan: true, rollup: 'FAILURE', rollupUnexplained: true });
  const r = decideWake(summary([pr]), null);
  assert.equal(r.wakeAgent, true);
  assert.deepEqual(reasonsFor(r, 17), ['rollup-unexplained']);
});

test('merge-queue eviction with unexplained failing jobs: wake once per eviction run', () => {
  const evicted = [{
    number: 18, mergeGroupRunId: 900, workflow: 'CI', conclusion: 'failure',
    exclusionChecked: true, excludedChecks: [], blockedChecks: [],
    actionableFailingChecks: [check('test-slang')], allFailuresExcluded: false,
  }];
  const first = decideWake(summary([], { evicted }), null);
  assert.equal(first.wakeAgent, true);
  assert.deepEqual(first.wakeReasons, [{ number: 18, reason: 'evicted-from-merge-queue', runId: 900, checks: ['test-slang'] }]);
  assert.deepEqual(first.nextState.evictedRunIds, [900]);
  const second = decideWake(summary([], { evicted }), first.nextState);
  assert.equal(second.wakeAgent, false);
  const again = decideWake(summary([], { evicted: [{ ...evicted[0], mergeGroupRunId: 901 }] }), second.nextState);
  assert.equal(again.wakeAgent, true, 'a new eviction run of the same PR is a new decision');
});

test('merge-queue eviction fully explained by the ledger: asleep', () => {
  const evicted = [{
    number: 19, mergeGroupRunId: 910, exclusionChecked: true,
    excludedChecks: [{ name: 'test-slang', issue: 13024 }], blockedChecks: [],
    actionableFailingChecks: [], allFailuresExcluded: true,
  }];
  assert.equal(decideWake(summary([], { evicted }), null).wakeAgent, false);
});

test('eviction whose jobs could not be fetched, or an eviction-scan error: wake', () => {
  const unknown = [{ number: 20, mergeGroupRunId: 920, exclusionChecked: false, jobsError: 'GitHub API 502' }];
  assert.deepEqual(reasonsFor(decideWake(summary([], { evicted: unknown }), null), 20), ['evicted-from-merge-queue']);
  const r = decideWake(summary([], { evicted: [{ error: 'GitHub API 503 for /actions/runs' }] }), null);
  assert.equal(r.wakeAgent, true);
  assert.equal(r.wakeReasons[0].reason, 'evicted-scan-error');
});

test('deployment drift wakes on every fire; unknown drift status does not', () => {
  const drift = decideWake(summary([], { driftCheck: { status: 'drift', deployedHash: 'a', onDiskHash: 'b' } }), null);
  assert.deepEqual(drift.wakeReasons, [{ number: null, reason: 'deployment-drift' }]);
  const unknown = decideWake(summary([], { driftCheck: { status: 'unknown', reason: 'never stamped' } }), null);
  assert.equal(unknown.wakeAgent, false);
});

test('fingerprintPr sorts names and accepts bare-name tail shapes', () => {
  const fp = fingerprintPr({ headSha: 'h', actionableFailingChecks: ['b', { name: 'a' }], blockedChecks: [{ name: 'z' }] });
  assert.deepEqual(fp, { headSha: 'h', failing: ['a', 'b'], blocked: ['z'], rollupUnexplained: false });
});

test('sleepSummary carries counts only, no per-PR entries', () => {
  const data = {
    totalNonDraft: 135, prCount: 22, mode: 'floor+activity', driftCheck: { status: 'ok' },
    floorCheckRunErrors: 0, activityErrors: 0,
    exclusions: { activeCount: 2, loadError: null, prsWithBlockedChecks: 1 },
    prs: [prEntry(1, { excludedChecks: [{ name: 'x', issue: 1 }], allFailuresExcluded: true }), prEntry(2)],
    evicted: [],
  };
  const out = sleepSummary(data, { prs: {}, evictedRunIds: [] });
  assert.equal(out.prsWithFailures, 1);
  assert.equal(out.prsAllFailuresExcluded, 1);
  assert.equal(out.trackedPrs, 0);
  assert.equal('prs' in out, false);
  for (const v of Object.values(out)) assert.ok(v === null || typeof v !== 'object', 'summary values are scalars');
});

test('error path wakes and carries the message', () => {
  const out = errorGate({ status: 'ok' }, new Error('GitHub API 502 Bad Gateway for /pulls'));
  assert.equal(out.wakeAgent, true);
  assert.equal(out.data.error, 'GitHub API 502 Bad Gateway for /pulls');
});
