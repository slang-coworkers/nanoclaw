import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The shadow-mode guarantee: with the input gate on, processGitHubDelivery
// returns exactly what it returns with the gate off and routes the delivery
// exactly the same way, whatever the gate decides and even when its GitHub
// lookups fail. The decision only lands in input_gate_decisions.

vi.mock('./config.js', () => ({
  GITHUB_WEBHOOK_SECRET: 'test-secret',
  GITHUB_WEBHOOK_PORT: 0,
  GITHUB_WEBHOOK_BOT_MENTION: '@bot',
  GITHUB_WEBHOOK_OWNER_ALLOWLIST: [],
  GITHUB_WEBHOOK_OWNER_DENYLIST: [],
  INSTANCE_FORWARD_TARGETS: {},
  INSTANCE_SLUG: 'prod',
  ROUTE_ISSUES_TO: '',
  ROUTE_READY_PRS_TO: '',
  INTERNAL_REGISTER_SECRET: 'trust-secret',
  APPROVER_CI_GATE: false,
  CI_GATE_REQUIRED_SUITE: '',
  CI_GATE_REQUIRED_CHECK_RUN: {},
  CENTRAL_DB_PATH: ':memory:',
  ISSUE_BOT_OK_LABEL: 'bot-ok',
}));

vi.mock('./webhook-github.js', () => ({
  deliverGitHubMention: vi.fn(async () => 'local'),
  deliverGitHubIssueOpened: vi.fn(async () => 'local'),
  deliverGitHubPrReviewable: vi.fn(async () => 'local'),
  deliverGitHubPrEvent: vi.fn(async () => 'local'),
  releaseParkedReviewable: vi.fn(),
}));

vi.mock('./modules/pr-mapping/register-endpoint.js', () => ({ handleRegisterPr: vi.fn() }));
vi.mock('./modules/pr-mapping/store.js', () => ({ prMappingExists: vi.fn(() => false) }));
vi.mock('./modules/pending-reviewable/ci-check.js', () => ({ requiredCheckRunGreen: vi.fn(() => true) }));
vi.mock('./modules/pending-reviewable/store.js', () => ({ deleteParked: vi.fn(), findParkedByHead: vi.fn() }));
vi.mock('./env.js', () => ({ readEnvFile: () => ({}) }));

import { closeDb, initTestDb } from './db/connection.js';
import { runMigrations } from './db/migrations/index.js';
import { processGitHubDelivery } from './github-webhook-server.js';
import { drainInputGate, setInputGateDepsForTest } from './modules/input-gate/index.js';
import { listGateDecisions } from './modules/input-gate/store.js';
import { deliverGitHubIssueOpened, deliverGitHubMention } from './webhook-github.js';

const mentionMock = vi.mocked(deliverGitHubMention);
const issueMock = vi.mocked(deliverGitHubIssueOpened);

const externalMention = JSON.stringify({
  action: 'created',
  repository: { full_name: 'shader-slang/slang' },
  issue: { number: 11 },
  comment: {
    id: 900,
    body: 'Hey @bot please fix this',
    html_url: 'https://github.com/shader-slang/slang/issues/11#issuecomment-900',
    user: { login: 'stranger', id: 55, type: 'User' },
    author_association: 'MEMBER',
  },
});

const issueOpened = JSON.stringify({
  action: 'opened',
  repository: { full_name: 'shader-slang/slang' },
  issue: {
    number: 12,
    title: 'Crash',
    body: 'repro',
    html_url: 'https://github.com/shader-slang/slang/issues/12',
    user: { login: 'maint', id: 7, type: 'User' },
    author_association: 'MEMBER',
    labels: [],
  },
});

const shadow = {
  mode: 'shadow' as const,
  rosterPath: '/nonexistent',
  org: 'shader-slang',
  repos: null,
  openLane: null,
};
const off = { ...shadow, mode: 'off' as const };
const failingLookups = {
  repoPermission: async () => {
    throw new Error('gh: 401');
  },
  orgMember: async () => {
    throw new Error('gh: 401');
  },
};

beforeEach(async () => {
  await runMigrations(await initTestDb());
  mentionMock.mockClear();
  issueMock.mockClear();
});
afterEach(async () => {
  setInputGateDepsForTest(null);
  await closeDb();
});

async function run(eventType: string, rawBody: string, deliveryId: string) {
  return processGitHubDelivery({ eventType, rawBody, deliveryId, isPeerForward: false });
}

describe('input gate in shadow mode blocks nothing', () => {
  it('an external mention is routed exactly as with the gate off, and the would-block is logged', async () => {
    setInputGateDepsForTest({ settings: () => off });
    const withoutGate = await run('issue_comment', externalMention, 'd-off');
    expect(mentionMock).toHaveBeenCalledTimes(1);
    // The observation runs after the call returns and reads settings then.
    await drainInputGate();

    setInputGateDepsForTest({ settings: () => shadow, lookups: failingLookups });
    const withGate = await run('issue_comment', externalMention, 'd-on');
    expect(mentionMock).toHaveBeenCalledTimes(2);
    expect(withGate).toEqual(withoutGate);

    await vi.waitFor(async () => expect(await listGateDecisions()).toHaveLength(1));
    const [row] = await listGateDecisions();
    expect(row).toMatchObject({
      delivery_id: 'd-on',
      event: 'comment',
      actor_id: 55,
      starts_work: 1,
      outcome: 'external_blocked',
      reason: 'lookup_failed_permission',
      current_outcome: 'local',
    });
  });

  it('an issue opened by a maintainer still starts triage; the gate only logs that it would not', async () => {
    setInputGateDepsForTest({
      settings: () => shadow,
      lookups: { repoPermission: async () => 'write', orgMember: async () => true },
    });
    const result = await run('issues', issueOpened, 'd-issue');
    expect(result).toEqual({ status: 200, body: { ok: true, outcome: 'local' } });
    expect(issueMock).toHaveBeenCalledTimes(1);

    await vi.waitFor(async () => expect(await listGateDecisions()).toHaveLength(1));
    const [row] = await listGateDecisions();
    expect(row).toMatchObject({
      event: 'issue_opened',
      outcome: 'no_start',
      tier: 'allowlisted',
      tier_via: 'permission',
    });
  });

  it('with the gate off, nothing is logged', async () => {
    setInputGateDepsForTest({ settings: () => off });
    await run('issue_comment', externalMention, 'd-off-2');
    await new Promise((r) => setTimeout(r, 20));
    expect(await listGateDecisions()).toHaveLength(0);
  });
});
