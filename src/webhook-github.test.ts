import http, { type IncomingMessage, type ServerResponse } from 'http';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const SECRET = 'fwd-secret';
const PEER_PATH = '/webhook/github';

let peerServer: http.Server;
let peerUrl: string;
let captured: { headers: Record<string, string | string[] | undefined>; body: string }[] = [];

beforeAll(
  () =>
    new Promise<void>((resolve) => {
      peerServer = http.createServer((req: IncomingMessage, res: ServerResponse) => {
        let body = '';
        req.on('data', (c) => {
          body += c.toString();
        });
        req.on('end', () => {
          captured.push({ headers: { ...req.headers }, body });
          res.writeHead(200);
          res.end('{}');
        });
      });
      peerServer.listen(0, '127.0.0.1', () => {
        const addr = peerServer.address();
        if (addr && typeof addr === 'object') {
          peerUrl = `http://127.0.0.1:${addr.port}${PEER_PATH}`;
        }
        resolve();
      });
    }),
);

afterAll(
  () =>
    new Promise<void>((resolve) => {
      peerServer.close(() => resolve());
    }),
);

beforeEach(() => {
  captured = [];
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function waitForCapture(min: number, timeoutMs = 1000): Promise<void> {
  const start = Date.now();
  while (captured.length < min && Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 20));
  }
}

describe('deliverGitHubMention — owner_instance routing', () => {
  it('forwards to peer when mapping says foreign owner', async () => {
    vi.doMock('./config.js', () => ({
      INSTANCE_FORWARD_TARGETS: { lego: peerUrl },
      INSTANCE_SLUG: 'prod',
      INTERNAL_REGISTER_SECRET: SECRET,
      ROUTE_ISSUES_TO: '',
      APPROVER_CI_GATE: false,
      CI_GATE_REQUIRED_SUITE: '',
    }));
    vi.doMock('./db/connection.js', () => ({
      getDb: () => ({
        prepare: () => ({
          get: () => ({
            agent_group_id: 'g-lego',
            session_id: 's-lego',
            thread_id: 't-lego',
            owner_instance: 'lego',
          }),
        }),
      }),
    }));
    vi.doMock('./db/sessions.js', () => ({
      findSessionByAgentGroup: () => undefined,
      findSessionByAgentThread: () => undefined,
      getSession: () => undefined,
      createSession: () => undefined,
      updateSessionTitle: () => true,
    }));
    vi.doMock('./db/agent-groups.js', () => ({
      getAdminAgentGroup: () => undefined,
      getAgentGroupByFolder: () => undefined,
    }));
    vi.doMock('./db/session-db.js', () => ({
      openInboundDb: () => ({
        // prepare().get() backs the idempotency guard added in #513
        // (SELECT 1 FROM messages_in WHERE id = ?). Returning undefined means
        // "not seen before" so delivery proceeds to insertMessage.
        prepare: () => ({ get: () => undefined, run: () => undefined }),
        close: () => undefined,
      }),
      insertMessage: () => undefined,
    }));

    const { deliverGitHubMention } = await import('./webhook-github.js');
    const outcome = deliverGitHubMention({
      repo: 'shader-slang/slang',
      issueNumber: 42,
      commentId: 1,
      commentUrl: '',
      commenter: 'a',
      body: '@nv-slang-bot fix this',
      isPr: true,

      rawBody: '{"action":"created"}',
      eventType: 'issue_comment',
      deliveryId: 'd-1',
    });

    expect(outcome).toBe('forwarded');
    await waitForCapture(1);
    expect(captured).toHaveLength(1);
    expect(captured[0].headers['x-webhook-trust']).toBe('pre-validated');
    expect(captured[0].headers['x-internal-signature-256']).toMatch(/^sha256=/);
    expect(captured[0].body).toBe('{"action":"created"}');
  });

  it('drops with warn when foreign owner has no forward target configured', async () => {
    vi.doMock('./config.js', () => ({
      INSTANCE_FORWARD_TARGETS: {}, // no targets at all
      INSTANCE_SLUG: 'prod',
      INTERNAL_REGISTER_SECRET: SECRET,
      APPROVER_CI_GATE: false,
      CI_GATE_REQUIRED_SUITE: '',
    }));
    vi.doMock('./db/connection.js', () => ({
      getDb: () => ({
        prepare: () => ({
          get: () => ({
            agent_group_id: 'g-lego',
            session_id: 's-lego',
            thread_id: 't',
            owner_instance: 'lego',
          }),
        }),
      }),
    }));
    vi.doMock('./db/sessions.js', () => ({
      findSessionByAgentGroup: () => undefined,
      findSessionByAgentThread: () => undefined,
      getSession: () => undefined,
      createSession: () => undefined,
      updateSessionTitle: () => true,
    }));
    vi.doMock('./db/agent-groups.js', () => ({
      getAdminAgentGroup: () => undefined,
      getAgentGroupByFolder: () => undefined,
    }));
    vi.doMock('./db/session-db.js', () => ({
      openInboundDb: () => ({
        // prepare().get() backs the idempotency guard added in #513
        // (SELECT 1 FROM messages_in WHERE id = ?). Returning undefined means
        // "not seen before" so delivery proceeds to insertMessage.
        prepare: () => ({ get: () => undefined, run: () => undefined }),
        close: () => undefined,
      }),
      insertMessage: () => undefined,
    }));

    const { deliverGitHubMention } = await import('./webhook-github.js');
    const outcome = deliverGitHubMention({
      repo: 'shader-slang/slang',
      issueNumber: 42,
      commentId: 1,
      commentUrl: '',
      commenter: 'a',
      body: '@nv-slang-bot',
      isPr: true,

      rawBody: '{"action":"created"}',
      eventType: 'issue_comment',
      deliveryId: 'd-1',
    });

    expect(outcome).toBe('dropped');
    expect(captured).toHaveLength(0);
  });

  it('delivers locally when mapping owner matches this instance', async () => {
    const insertCalls: unknown[] = [];
    vi.doMock('./config.js', () => ({
      INSTANCE_FORWARD_TARGETS: {},
      INSTANCE_SLUG: 'prod',
      INTERNAL_REGISTER_SECRET: SECRET,
      ROUTE_ISSUES_TO: '',
      APPROVER_CI_GATE: false,
      CI_GATE_REQUIRED_SUITE: '',
    }));
    vi.doMock('./db/connection.js', () => ({
      getDb: () => ({
        prepare: () => ({
          get: () => ({
            agent_group_id: 'g-prod',
            session_id: 's-prod',
            thread_id: 't',
            owner_instance: 'prod',
          }),
        }),
      }),
    }));
    vi.doMock('./db/sessions.js', () => ({
      findSessionByAgentGroup: () => undefined,
      findSessionByAgentThread: () => undefined,
      getSession: () => ({ id: 's-prod' }),
      createSession: () => undefined,
      updateSessionTitle: () => true,
    }));
    vi.doMock('./db/agent-groups.js', () => ({
      getAdminAgentGroup: () => undefined,
      getAgentGroupByFolder: () => undefined,
    }));
    vi.doMock('./db/session-db.js', () => ({
      openInboundDb: () => ({
        prepare: () => ({ get: () => undefined, run: () => undefined }),
        close: () => undefined,
      }),
      insertMessage: (_db: unknown, msg: unknown) => insertCalls.push(msg),
    }));
    vi.doMock('./session-manager.js', () => ({
      inboundDbPath: () => '/tmp/inbox.db',
      initSessionFolder: () => undefined,
    }));

    const { deliverGitHubMention } = await import('./webhook-github.js');
    const outcome = deliverGitHubMention({
      repo: 'shader-slang/slang',
      issueNumber: 42,
      commentId: 9,
      commentUrl: '',
      commenter: 'a',
      body: '@nv-slang-bot',
      isPr: true,

      rawBody: '{"action":"created"}',
      eventType: 'issue_comment',
      deliveryId: 'd-1',
    });

    expect(outcome).toBe('local');
    expect(captured).toHaveLength(0); // no forward
    expect(insertCalls).toHaveLength(1);
  });

  it('falls through to orchestrator on an unmapped PR mention, minting a gh-pr-<repo>-<num> thread', async () => {
    // A PR mention with no pr_session_mapping mints its own per-PR orchestrator
    // session (threadId `gh-pr-<repo>-<num>`, mintPerThread) so the foreign PR
    // gets a resumable tile instead of landing in the most-recent active
    // session (a junk drawer). Symmetric to the issue path's gh-issue-<...>.
    const insertCalls: unknown[] = [];
    const threadLookups: string[] = [];
    vi.doMock('./config.js', () => ({
      INSTANCE_FORWARD_TARGETS: {},
      INSTANCE_SLUG: 'prod',
      INTERNAL_REGISTER_SECRET: SECRET,
      ROUTE_ISSUES_TO: '',
      APPROVER_CI_GATE: false,
      CI_GATE_REQUIRED_SUITE: '',
    }));
    vi.doMock('./db/connection.js', () => ({
      getDb: () => ({ prepare: () => ({ get: () => undefined }) }), // no mapping row
    }));
    vi.doMock('./db/sessions.js', () => ({
      findSessionByAgentGroup: () => ({ id: 'sess-generic' }),
      findSessionByAgentThread: (_g: string, thread: string) => {
        threadLookups.push(thread);
        return { id: 'sess-pr-chain' };
      },
      getSession: () => undefined,
      createSession: () => undefined,
      updateSessionTitle: () => true,
    }));
    vi.doMock('./db/agent-groups.js', () => ({
      getAdminAgentGroup: () => ({ id: 'g-admin', name: 'orchestrator' }),
      getAgentGroupByFolder: () => undefined,
    }));
    vi.doMock('./db/session-db.js', () => ({
      openInboundDb: () => ({
        prepare: () => ({ get: () => undefined, run: () => undefined }),
        close: () => undefined,
      }),
      insertMessage: (_db: unknown, msg: unknown) => insertCalls.push(msg),
    }));
    vi.doMock('./session-manager.js', () => ({
      inboundDbPath: () => '/tmp/orch.db',
      initSessionFolder: () => undefined,
    }));

    const { deliverGitHubMention } = await import('./webhook-github.js');
    const outcome = deliverGitHubMention({
      repo: 'shader-slang/slang',
      issueNumber: 99,
      commentId: 5,
      commentUrl: '',
      commenter: 'a',
      body: '@nv-slang-bot triage this',
      isPr: true,
      rawBody: '{"action":"created"}',
      eventType: 'issue_comment',
      deliveryId: 'd-1',
    });

    expect(outcome).toBe('local');
    // Minted/found the per-PR thread, not the generic most-recent session.
    expect(threadLookups).toContain('gh-pr-shader-slang/slang-99');
    expect(insertCalls).toHaveLength(1);
    const inserted = insertCalls[0] as { id: string; threadId: string; content: string };
    expect(inserted.id).toBe('gh-5');
    expect(inserted.threadId).toBe('gh-pr-shader-slang/slang-99');
    expect(JSON.parse(inserted.content).event).toBe('github.pr_mention');
  });

  it('issue (non-PR) comment fall-through rejoins the issue chain via gh-issue-<repo>-<num> thread', async () => {
    // Regression: a forwarded issue_comment must land in the SAME session +
    // thread that deliverGitHubIssueOpened minted (mintPerThread, threadId
    // `gh-issue-<repo>-<num>`). The prior code used a bare String(issueNumber)
    // thread with no mintPerThread, orphaning the comment into a generic
    // session with none of the chain's history.
    const insertCalls: unknown[] = [];
    const threadLookups: string[] = [];
    vi.doMock('./config.js', () => ({
      INSTANCE_FORWARD_TARGETS: {},
      INSTANCE_SLUG: 'lego', // receiver: ROUTE_ISSUES_TO !== own slug guard not triggered
      INTERNAL_REGISTER_SECRET: SECRET,
      ROUTE_ISSUES_TO: '',
      APPROVER_CI_GATE: false,
      CI_GATE_REQUIRED_SUITE: '',
    }));
    vi.doMock('./db/connection.js', () => ({
      getDb: () => ({ prepare: () => ({ get: () => undefined }) }), // no mapping row
    }));
    vi.doMock('./db/sessions.js', () => ({
      findSessionByAgentGroup: () => ({ id: 'sess-generic' }),
      findSessionByAgentThread: (_g: string, thread: string) => {
        threadLookups.push(thread);
        return { id: 'sess-issue-chain' };
      },
      getSession: () => undefined,
      createSession: () => undefined,
      updateSessionTitle: () => true,
    }));
    vi.doMock('./db/agent-groups.js', () => ({
      getAdminAgentGroup: () => ({ id: 'g-admin', name: 'orchestrator' }),
      getAgentGroupByFolder: () => undefined,
    }));
    vi.doMock('./db/session-db.js', () => ({
      openInboundDb: () => ({
        prepare: () => ({ get: () => undefined, run: () => undefined }),
        close: () => undefined,
      }),
      insertMessage: (_db: unknown, msg: unknown) => insertCalls.push(msg),
    }));
    vi.doMock('./session-manager.js', () => ({
      inboundDbPath: () => '/tmp/orch.db',
      initSessionFolder: () => undefined,
    }));

    const { deliverGitHubMention } = await import('./webhook-github.js');
    const outcome = deliverGitHubMention({
      repo: 'shader-slang/slang',
      issueNumber: 11372,
      commentId: 4593542165,
      commentUrl: '',
      commenter: 'andersjel',
      body: 'follow-up on the void+out-param design',
      isPr: false, // ← issue comment, not a PR
      rawBody: '{"action":"created"}',
      eventType: 'issue_comment',
      deliveryId: 'd-bf',
    });

    expect(outcome).toBe('local');
    // Rejoined the issue's session via the namespaced per-issue thread key.
    expect(threadLookups).toContain('gh-issue-shader-slang/slang-11372');
    expect(insertCalls).toHaveLength(1);
    const inserted = insertCalls[0] as { id: string; threadId: string; content: string };
    expect(inserted.id).toBe('gh-4593542165');
    expect(inserted.threadId).toBe('gh-issue-shader-slang/slang-11372');
    expect(JSON.parse(inserted.content).event).toBe('github.pr_mention');
  });

  it('forwards issue (non-PR) comments to peer when ROUTE_ISSUES_TO is set', async () => {
    vi.doMock('./config.js', () => ({
      INSTANCE_FORWARD_TARGETS: { lego: peerUrl },
      INSTANCE_SLUG: 'prod',
      INTERNAL_REGISTER_SECRET: SECRET,
      ROUTE_ISSUES_TO: 'lego',
      APPROVER_CI_GATE: false,
      CI_GATE_REQUIRED_SUITE: '',
    }));
    vi.doMock('./db/connection.js', () => ({
      getDb: () => ({ prepare: () => ({ get: () => undefined }) }),
    }));
    vi.doMock('./db/sessions.js', () => ({
      findSessionByAgentGroup: () => undefined,
      findSessionByAgentThread: () => undefined,
      getSession: () => undefined,
      createSession: () => undefined,
      updateSessionTitle: () => true,
    }));
    vi.doMock('./db/agent-groups.js', () => ({
      getAdminAgentGroup: () => undefined,
      getAgentGroupByFolder: () => undefined,
    }));
    vi.doMock('./db/session-db.js', () => ({
      openInboundDb: () => ({
        // prepare().get() backs the idempotency guard added in #513
        // (SELECT 1 FROM messages_in WHERE id = ?). Returning undefined means
        // "not seen before" so delivery proceeds to insertMessage.
        prepare: () => ({ get: () => undefined, run: () => undefined }),
        close: () => undefined,
      }),
      insertMessage: () => undefined,
    }));

    const { deliverGitHubMention } = await import('./webhook-github.js');
    const outcome = deliverGitHubMention({
      repo: 'slang-coworkers/nanoclaw',
      issueNumber: 511,
      commentId: 4591326399,
      commentUrl: 'https://github.com/slang-coworkers/nanoclaw/issues/511#issuecomment-4591326399',
      commenter: 'szihs',
      body: '@nv-slang-bot route this',
      isPr: false,
      rawBody: '{"action":"created"}',
      eventType: 'issue_comment',
      deliveryId: 'd-issue-comment',
    });

    expect(outcome).toBe('forwarded');
    await waitForCapture(1);
    expect(captured).toHaveLength(1);
    expect(captured[0].headers['x-webhook-trust']).toBe('pre-validated');
    expect(captured[0].headers['x-github-event']).toBe('issue_comment');
    expect(captured[0].body).toBe('{"action":"created"}');
  });

  it('does NOT forward PR comments via ROUTE_ISSUES_TO (PR ownership owns that path)', async () => {
    const insertCalls: unknown[] = [];
    vi.doMock('./config.js', () => ({
      INSTANCE_FORWARD_TARGETS: { lego: peerUrl },
      INSTANCE_SLUG: 'prod',
      INTERNAL_REGISTER_SECRET: SECRET,
      ROUTE_ISSUES_TO: 'lego',
      APPROVER_CI_GATE: false,
      CI_GATE_REQUIRED_SUITE: '',
    }));
    vi.doMock('./db/connection.js', () => ({
      getDb: () => ({ prepare: () => ({ get: () => undefined }) }),
    }));
    vi.doMock('./db/sessions.js', () => ({
      findSessionByAgentGroup: () => ({ id: 'sess-orch' }),
      findSessionByAgentThread: () => ({ id: 'sess-orch' }),
      getSession: () => undefined,
      createSession: () => undefined,
      updateSessionTitle: () => true,
    }));
    vi.doMock('./db/agent-groups.js', () => ({
      getAdminAgentGroup: () => ({ id: 'g-admin', name: 'orchestrator' }),
      getAgentGroupByFolder: () => undefined,
    }));
    vi.doMock('./db/session-db.js', () => ({
      openInboundDb: () => ({
        prepare: () => ({ get: () => undefined, run: () => undefined }),
        close: () => undefined,
      }),
      insertMessage: (_db: unknown, msg: unknown) => insertCalls.push(msg),
    }));
    vi.doMock('./session-manager.js', () => ({
      inboundDbPath: () => '/tmp/orch.db',
      initSessionFolder: () => undefined,
    }));

    const { deliverGitHubMention } = await import('./webhook-github.js');
    const outcome = deliverGitHubMention({
      repo: 'shader-slang/slang',
      issueNumber: 100,
      commentId: 7,
      commentUrl: '',
      commenter: 'a',
      body: '@nv-slang-bot tell me about this PR',
      isPr: true,
      rawBody: '{"action":"created"}',
      eventType: 'issue_comment',
      deliveryId: 'd-pr-comment',
    });

    expect(outcome).toBe('local');
    expect(insertCalls).toHaveLength(1);
  });
});

describe('deliverGitHubPrEvent — review/CI routing (no orchestrator fallback)', () => {
  it('delivers locally to the mapped fixer session', async () => {
    const insertCalls: unknown[] = [];
    vi.doMock('./config.js', () => ({
      INSTANCE_FORWARD_TARGETS: {},
      INSTANCE_SLUG: 'lego',
      INTERNAL_REGISTER_SECRET: SECRET,
      ROUTE_ISSUES_TO: '',
      APPROVER_CI_GATE: false,
      CI_GATE_REQUIRED_SUITE: '',
    }));
    vi.doMock('./db/connection.js', () => ({
      getDb: () => ({
        prepare: () => ({
          get: () => ({
            agent_group_id: 'g-fixer',
            session_id: 's-fixer',
            thread_id: 't-pr',
            owner_instance: 'lego',
          }),
        }),
      }),
    }));
    vi.doMock('./db/sessions.js', () => ({
      findSessionByAgentGroup: () => undefined,
      findSessionByAgentThread: () => undefined,
      getSession: () => ({ id: 's-fixer' }),
      createSession: () => undefined,
      updateSessionTitle: () => true,
    }));
    vi.doMock('./db/agent-groups.js', () => ({
      getAdminAgentGroup: () => undefined,
      getAgentGroupByFolder: () => undefined,
    }));
    vi.doMock('./db/session-db.js', () => ({
      openInboundDb: () => ({
        prepare: () => ({ get: () => undefined, run: () => undefined }),
        close: () => undefined,
      }),
      insertMessage: (_db: unknown, msg: unknown) => insertCalls.push(msg),
    }));
    vi.doMock('./session-manager.js', () => ({
      inboundDbPath: () => '/tmp/fixer.db',
      initSessionFolder: () => undefined,
    }));

    const { deliverGitHubPrEvent } = await import('./webhook-github.js');
    const outcome = deliverGitHubPrEvent({
      repo: 'shader-slang/slang',
      prNumber: 11372,
      event: 'github.pr_review',
      rowId: 'gh-review-555001',
      payload: { review_state: 'changes_requested', body: 'fix this', reviewer: 'andersjel' },
      rawBody: '{"action":"submitted"}',
      eventType: 'pull_request_review',
      deliveryId: 'r-1',
    });

    expect(outcome).toBe('local');
    expect(insertCalls).toHaveLength(1);
    const inserted = insertCalls[0] as { id: string; threadId: string; content: string };
    expect(inserted.id).toBe('gh-review-555001');
    expect(inserted.threadId).toBe('t-pr');
    const parsed = JSON.parse(inserted.content);
    expect(parsed.event).toBe('github.pr_review');
    expect(parsed.is_pr).toBe(true);
    expect(parsed.review_state).toBe('changes_requested');
  });

  it('GCs the CI-gate park slot when the PR reaches a terminal state', async () => {
    // A parked reviewable row is released only by a later check_suite=success
    // for its head — which a merged/closed PR never emits — so without this GC
    // the row is immortal. Prod 2026-08-05: 112 parked, 74 of them for PRs that
    // had already finished. The table only ever grew.
    const deleted: Array<{ repo: string; pr: number }> = [];
    vi.doMock('./config.js', () => ({
      INSTANCE_FORWARD_TARGETS: {},
      INSTANCE_SLUG: 'lego',
      INTERNAL_REGISTER_SECRET: SECRET,
      ROUTE_ISSUES_TO: '',
      APPROVER_CI_GATE: true,
      CI_GATE_REQUIRED_SUITE: '',
    }));
    vi.doMock('./modules/pending-reviewable/store.js', () => ({
      parkReviewable: () => undefined,
      deleteParked: (_db: unknown, repo: string, pr: number) => deleted.push({ repo, pr }),
    }));
    // No approver decided this PR — the learning-loop side-channel no-ops, so
    // this test isolates the GC.
    vi.doMock('./modules/approval-ledger/store.js', () => ({ getDecisionSessionsForPr: () => [] }));
    vi.doMock('./db/connection.js', () => ({
      getDb: () => ({ prepare: () => ({ get: () => undefined }) }),
    }));
    vi.doMock('./db/sessions.js', () => ({
      findSessionByAgentGroup: () => undefined,
      findSessionByAgentThread: () => undefined,
      getSession: () => undefined,
      createSession: () => undefined,
      updateSessionTitle: () => true,
    }));
    vi.doMock('./db/agent-groups.js', () => ({
      getAdminAgentGroup: () => undefined,
      getAgentGroupByFolder: () => undefined,
      getAgentGroup: () => undefined,
    }));
    vi.doMock('./db/session-db.js', () => ({
      openInboundDb: () => ({
        prepare: () => ({ get: () => undefined, run: () => undefined }),
        close: () => undefined,
      }),
      insertMessage: () => undefined,
    }));
    vi.doMock('./session-manager.js', () => ({
      inboundDbPath: () => '/tmp/x.db',
      initSessionFolder: () => undefined,
    }));

    const { deliverGitHubPrEvent } = await import('./webhook-github.js');
    deliverGitHubPrEvent({
      repo: 'shader-slang/slang',
      prNumber: 12141,
      event: 'github.pr_merged',
      rowId: 'gh-merged-1',
      payload: {},
      rawBody: '{"action":"closed"}',
      eventType: 'pull_request',
      deliveryId: 'm-1',
    });

    expect(deleted).toEqual([{ repo: 'shader-slang/slang', pr: 12141 }]);
  });

  it('does NOT GC the park slot on a non-terminal PR event', async () => {
    const deleted: Array<{ repo: string; pr: number }> = [];
    vi.doMock('./config.js', () => ({
      INSTANCE_FORWARD_TARGETS: {},
      INSTANCE_SLUG: 'lego',
      INTERNAL_REGISTER_SECRET: SECRET,
      ROUTE_ISSUES_TO: '',
      APPROVER_CI_GATE: true,
      CI_GATE_REQUIRED_SUITE: '',
    }));
    vi.doMock('./modules/pending-reviewable/store.js', () => ({
      parkReviewable: () => undefined,
      deleteParked: (_db: unknown, repo: string, pr: number) => deleted.push({ repo, pr }),
    }));
    vi.doMock('./modules/approval-ledger/store.js', () => ({ getDecisionSessionsForPr: () => [] }));
    vi.doMock('./db/connection.js', () => ({
      getDb: () => ({ prepare: () => ({ get: () => undefined }) }),
    }));
    vi.doMock('./db/sessions.js', () => ({
      findSessionByAgentGroup: () => undefined,
      findSessionByAgentThread: () => undefined,
      getSession: () => undefined,
      createSession: () => undefined,
      updateSessionTitle: () => true,
    }));
    vi.doMock('./db/agent-groups.js', () => ({
      getAdminAgentGroup: () => undefined,
      getAgentGroupByFolder: () => undefined,
      getAgentGroup: () => undefined,
    }));
    vi.doMock('./db/session-db.js', () => ({
      openInboundDb: () => ({
        prepare: () => ({ get: () => undefined, run: () => undefined }),
        close: () => undefined,
      }),
      insertMessage: () => undefined,
    }));
    vi.doMock('./session-manager.js', () => ({
      inboundDbPath: () => '/tmp/x.db',
      initSessionFolder: () => undefined,
    }));

    const { deliverGitHubPrEvent } = await import('./webhook-github.js');
    deliverGitHubPrEvent({
      repo: 'shader-slang/slang',
      prNumber: 12141,
      event: 'github.pr_review',
      rowId: 'gh-review-1',
      payload: { review_state: 'commented' },
      rawBody: '{"action":"submitted"}',
      eventType: 'pull_request_review',
      deliveryId: 'r-9',
    });

    expect(deleted).toEqual([]); // the PR is still live; its park slot must survive
  });

  it('stamps the human verdict deterministically, without waiting for an agent turn', async () => {
    // The join used to require the woken LLM to choose to call the
    // record_human_verdict MCP tool, so a bounced or distracted turn silently
    // lost the record — the measurement of whether the approver can replace a
    // human sat inside the approver's own best-effort behaviour. The host has
    // the outcome (pr_merged vs pr_closed) and the decision rows already.
    const joins: Array<{ repo: string; pr: number; sha: string; verdict: string }> = [];
    vi.doMock('./config.js', () => ({
      INSTANCE_FORWARD_TARGETS: {},
      INSTANCE_SLUG: 'prod',
      INTERNAL_REGISTER_SECRET: SECRET,
      ROUTE_ISSUES_TO: '',
      APPROVER_CI_GATE: false,
      CI_GATE_REQUIRED_SUITE: '',
    }));
    vi.doMock('./modules/approval-ledger/store.js', () => ({
      getDecisionSessionsForPr: () => [
        { agent_group_id: 'g-app', session_id: 's-app', thread_id: null, commit_sha: 'a'.repeat(40) },
      ],
      recordHumanVerdict: (_db: unknown, repo: string, pr: number, sha: string, verdict: string) => {
        joins.push({ repo, pr, sha, verdict });
        return true;
      },
    }));
    vi.doMock('./modules/pending-reviewable/store.js', () => ({
      parkReviewable: () => undefined,
      deleteParked: () => undefined,
    }));
    vi.doMock('./db/connection.js', () => ({ getDb: () => ({ prepare: () => ({ get: () => undefined }) }) }));
    vi.doMock('./db/sessions.js', () => ({
      findSessionByAgentGroup: () => undefined,
      findSessionByAgentThread: () => undefined,
      getSession: () => undefined,
      createSession: () => undefined,
      updateSessionTitle: () => true,
    }));
    vi.doMock('./db/agent-groups.js', () => ({
      getAdminAgentGroup: () => undefined,
      getAgentGroupByFolder: () => undefined,
      getAgentGroup: () => undefined,
    }));
    vi.doMock('./db/session-db.js', () => ({
      openInboundDb: () => ({
        prepare: () => ({ get: () => undefined, run: () => undefined }),
        close: () => undefined,
      }),
      insertMessage: () => undefined,
    }));
    vi.doMock('./session-manager.js', () => ({
      inboundDbPath: () => '/tmp/x.db',
      initSessionFolder: () => undefined,
    }));

    const { deliverGitHubPrEvent } = await import('./webhook-github.js');
    deliverGitHubPrEvent({
      repo: 'shader-slang/slang',
      prNumber: 12034,
      event: 'github.pr_merged',
      rowId: 'gh-merged-2',
      // The PR ended on a head the approver never decided ('f'…), which is the
      // common case — recordHumanVerdict resolves that to head_advanced.
      payload: { state: 'merged', merged: true, head_sha: 'f'.repeat(40) },
      rawBody: '{"action":"closed"}',
      eventType: 'pull_request',
      deliveryId: 'm-2',
    });

    // No agent was woken (thread_id null ⇒ the learning delivery is skipped),
    // yet the verdict is still recorded.
    expect(joins).toEqual([{ repo: 'shader-slang/slang', pr: 12034, sha: 'f'.repeat(40), verdict: 'MERGED' }]);
  });

  it('maps a closed-unmerged PR to CHANGES_REQUESTED-equivalent', async () => {
    const joins: Array<{ verdict: string }> = [];
    vi.doMock('./config.js', () => ({
      INSTANCE_FORWARD_TARGETS: {},
      INSTANCE_SLUG: 'prod',
      INTERNAL_REGISTER_SECRET: SECRET,
      ROUTE_ISSUES_TO: '',
      APPROVER_CI_GATE: false,
      CI_GATE_REQUIRED_SUITE: '',
    }));
    vi.doMock('./modules/approval-ledger/store.js', () => ({
      getDecisionSessionsForPr: () => [
        { agent_group_id: 'g-app', session_id: 's-app', thread_id: null, commit_sha: 'a'.repeat(40) },
      ],
      recordHumanVerdict: (_d: unknown, _r: string, _p: number, _s: string, verdict: string) => {
        joins.push({ verdict });
        return true;
      },
    }));
    vi.doMock('./modules/pending-reviewable/store.js', () => ({
      parkReviewable: () => undefined,
      deleteParked: () => undefined,
    }));
    vi.doMock('./db/connection.js', () => ({ getDb: () => ({ prepare: () => ({ get: () => undefined }) }) }));
    vi.doMock('./db/sessions.js', () => ({
      findSessionByAgentGroup: () => undefined,
      findSessionByAgentThread: () => undefined,
      getSession: () => undefined,
      createSession: () => undefined,
      updateSessionTitle: () => true,
    }));
    vi.doMock('./db/agent-groups.js', () => ({
      getAdminAgentGroup: () => undefined,
      getAgentGroupByFolder: () => undefined,
      getAgentGroup: () => undefined,
    }));
    vi.doMock('./db/session-db.js', () => ({
      openInboundDb: () => ({
        prepare: () => ({ get: () => undefined, run: () => undefined }),
        close: () => undefined,
      }),
      insertMessage: () => undefined,
    }));
    vi.doMock('./session-manager.js', () => ({
      inboundDbPath: () => '/tmp/x.db',
      initSessionFolder: () => undefined,
    }));

    const { deliverGitHubPrEvent } = await import('./webhook-github.js');
    deliverGitHubPrEvent({
      repo: 'shader-slang/slang',
      prNumber: 12035,
      event: 'github.pr_closed',
      rowId: 'gh-closed-2',
      payload: { state: 'closed', merged: false, head_sha: 'b'.repeat(40) },
      rawBody: '{"action":"closed"}',
      eventType: 'pull_request',
      deliveryId: 'c-2',
    });

    expect(joins).toEqual([{ verdict: 'CLOSED_UNMERGED' }]);
  });

  it('forwards to the foreign owner instance', async () => {
    vi.doMock('./config.js', () => ({
      INSTANCE_FORWARD_TARGETS: { lego: peerUrl },
      INSTANCE_SLUG: 'prod',
      INTERNAL_REGISTER_SECRET: SECRET,
      ROUTE_ISSUES_TO: '',
      APPROVER_CI_GATE: false,
      CI_GATE_REQUIRED_SUITE: '',
    }));
    vi.doMock('./db/connection.js', () => ({
      getDb: () => ({
        prepare: () => ({
          get: () => ({
            agent_group_id: 'g-lego',
            session_id: 's-lego',
            thread_id: 't',
            owner_instance: 'lego',
          }),
        }),
      }),
    }));
    vi.doMock('./db/sessions.js', () => ({
      findSessionByAgentGroup: () => undefined,
      findSessionByAgentThread: () => undefined,
      getSession: () => undefined,
      createSession: () => undefined,
      updateSessionTitle: () => true,
    }));
    vi.doMock('./db/agent-groups.js', () => ({
      getAdminAgentGroup: () => undefined,
      getAgentGroupByFolder: () => undefined,
    }));
    vi.doMock('./db/session-db.js', () => ({
      openInboundDb: () => ({
        prepare: () => ({ get: () => undefined, run: () => undefined }),
        close: () => undefined,
      }),
      insertMessage: () => undefined,
    }));
    vi.doMock('./session-manager.js', () => ({
      inboundDbPath: () => '/tmp/x.db',
      initSessionFolder: () => undefined,
    }));

    const { deliverGitHubPrEvent } = await import('./webhook-github.js');
    const outcome = deliverGitHubPrEvent({
      repo: 'shader-slang/slang',
      prNumber: 11372,
      event: 'github.ci_failed',
      rowId: 'gh-checks-888003',
      payload: { conclusion: 'failure' },
      rawBody: '{"action":"completed"}',
      eventType: 'check_suite',
      deliveryId: 'c-1',
    });

    expect(outcome).toBe('forwarded');
    await waitForCapture(1);
    expect(captured).toHaveLength(1);
    expect(captured[0].headers['x-github-event']).toBe('check_suite');
    expect(captured[0].body).toBe('{"action":"completed"}');
  });

  it('DROPS (no orchestrator fallback) when there is no mapping', async () => {
    const insertCalls: unknown[] = [];
    vi.doMock('./config.js', () => ({
      INSTANCE_FORWARD_TARGETS: {},
      INSTANCE_SLUG: 'lego',
      INTERNAL_REGISTER_SECRET: SECRET,
      ROUTE_ISSUES_TO: '',
      APPROVER_CI_GATE: false,
      CI_GATE_REQUIRED_SUITE: '',
    }));
    vi.doMock('./db/connection.js', () => ({
      getDb: () => ({ prepare: () => ({ get: () => undefined }) }), // no mapping row
    }));
    vi.doMock('./db/sessions.js', () => ({
      // Even if an orchestrator session exists, a PR event must NOT use it.
      findSessionByAgentGroup: () => ({ id: 'sess-orch' }),
      findSessionByAgentThread: () => ({ id: 'sess-orch' }),
      getSession: () => undefined,
      createSession: () => undefined,
      updateSessionTitle: () => true,
    }));
    vi.doMock('./db/agent-groups.js', () => ({
      getAdminAgentGroup: () => ({ id: 'g-admin', name: 'orchestrator' }),
      getAgentGroupByFolder: () => undefined,
    }));
    vi.doMock('./db/session-db.js', () => ({
      openInboundDb: () => ({
        prepare: () => ({ get: () => undefined, run: () => undefined }),
        close: () => undefined,
      }),
      insertMessage: (_db: unknown, msg: unknown) => insertCalls.push(msg),
    }));
    vi.doMock('./session-manager.js', () => ({
      inboundDbPath: () => '/tmp/orch.db',
      initSessionFolder: () => undefined,
    }));

    const { deliverGitHubPrEvent } = await import('./webhook-github.js');
    const outcome = deliverGitHubPrEvent({
      repo: 'shader-slang/slang',
      prNumber: 99999,
      event: 'github.pr_review',
      rowId: 'gh-review-1',
      payload: { review_state: 'approved' },
      rawBody: '{}',
      eventType: 'pull_request_review',
      deliveryId: 'r-x',
    });

    expect(outcome).toBe('dropped');
    expect(insertCalls).toHaveLength(0); // never touched the orchestrator
    expect(captured).toHaveLength(0);
  });
});

describe('deliverGitHubIssueOpened', () => {
  it('routes new issues to orchestrator with github.issue_opened event (default, ROUTE_ISSUES_TO unset)', async () => {
    const insertCalls: unknown[] = [];
    vi.doMock('./config.js', () => ({
      INSTANCE_FORWARD_TARGETS: {},
      INSTANCE_SLUG: 'prod',
      INTERNAL_REGISTER_SECRET: SECRET,
      ROUTE_ISSUES_TO: '',
      APPROVER_CI_GATE: false,
      CI_GATE_REQUIRED_SUITE: '',
    }));
    vi.doMock('./db/connection.js', () => ({
      getDb: () => ({ prepare: () => ({ get: () => undefined }) }),
    }));
    vi.doMock('./db/sessions.js', () => ({
      findSessionByAgentGroup: () => ({ id: 'sess-orch' }),
      findSessionByAgentThread: () => ({ id: 'sess-orch' }),
      getSession: () => undefined,
      createSession: () => undefined,
      updateSessionTitle: () => true,
    }));
    vi.doMock('./db/agent-groups.js', () => ({
      getAdminAgentGroup: () => ({ id: 'g-admin', name: 'orchestrator' }),
      getAgentGroupByFolder: () => undefined,
    }));
    vi.doMock('./db/session-db.js', () => ({
      openInboundDb: () => ({
        prepare: () => ({ get: () => undefined, run: () => undefined }),
        close: () => undefined,
      }),
      insertMessage: (_db: unknown, msg: unknown) => insertCalls.push(msg),
    }));
    vi.doMock('./session-manager.js', () => ({
      inboundDbPath: () => '/tmp/orch.db',
      initSessionFolder: () => undefined,
    }));

    const { deliverGitHubIssueOpened } = await import('./webhook-github.js');
    const outcome = deliverGitHubIssueOpened({
      repo: 'shader-slang/slang',
      issueNumber: 1234,
      issueUrl: 'https://github.com/shader-slang/slang/issues/1234',
      title: 'Crash on null deref',
      body: 'Repro: ...',
      author: 'reporter',
      labels: ['bug'],
      deliveryId: 'd-issues-1',
    });

    expect(outcome).toBe('local');
    expect(insertCalls).toHaveLength(1);
    const msg = insertCalls[0] as { id: string; content: string; channelType: string };
    expect(msg.id).toBe('gh-issue-shader-slang/slang-1234');
    expect(msg.channelType).toBe('github');
    const parsed = JSON.parse(msg.content);
    expect(parsed.event).toBe('github.issue_opened');
    expect(parsed.title).toBe('Crash on null deref');
    expect(parsed.labels).toEqual(['bug']);
  });

  it('records the issue filer into gh_thread_origin when minting the thread session, keyed by thread_id', async () => {
    const originRuns: unknown[] = [];
    vi.doMock('./config.js', () => ({
      INSTANCE_FORWARD_TARGETS: {},
      INSTANCE_SLUG: 'prod',
      INTERNAL_REGISTER_SECRET: SECRET,
      ROUTE_ISSUES_TO: '',
      APPROVER_CI_GATE: false,
      CI_GATE_REQUIRED_SUITE: '',
    }));
    // No existing session on this thread → deliverToAgentGroup takes the
    // mint branch (mintOrchestratorSession), which is the one place origin
    // capture is meant to fire.
    vi.doMock('./db/connection.js', () => ({
      getDb: () => ({
        prepare: (sql: string) => ({
          run: (...args: unknown[]) => originRuns.push({ sql, args }),
        }),
      }),
    }));
    vi.doMock('./db/sessions.js', () => ({
      findSessionByAgentGroup: () => undefined,
      findSessionByAgentThread: () => undefined,
      getSession: () => undefined,
      createSession: () => undefined,
      updateSessionTitle: () => true,
    }));
    vi.doMock('./db/agent-groups.js', () => ({
      getAdminAgentGroup: () => ({ id: 'g-admin', name: 'orchestrator' }),
      getAgentGroupByFolder: () => undefined,
    }));
    vi.doMock('./db/session-db.js', () => ({
      openInboundDb: () => ({
        prepare: () => ({ get: () => undefined, run: () => undefined }),
        close: () => undefined,
      }),
      insertMessage: () => undefined,
    }));
    vi.doMock('./session-manager.js', () => ({
      inboundDbPath: () => '/tmp/orch.db',
      initSessionFolder: () => undefined,
    }));

    const { deliverGitHubIssueOpened } = await import('./webhook-github.js');
    const outcome = deliverGitHubIssueOpened({
      repo: 'shader-slang/slang',
      issueNumber: 1234,
      issueUrl: 'https://github.com/shader-slang/slang/issues/1234',
      title: 'Crash on null deref',
      body: 'Repro: ...',
      author: 'reporter-login',
      labels: ['bug'],
      deliveryId: 'd-issues-1',
    });

    expect(outcome).toBe('local');
    expect(originRuns).toHaveLength(1);
    const run = originRuns[0] as { sql: string; args: unknown[] };
    expect(run.sql).toMatch(/INSERT OR IGNORE INTO gh_thread_origin/);
    expect(run.args).toEqual(['gh-issue-shader-slang/slang-1234', 'shader-slang/slang', 1234, 'issue', 'reporter-login']);
  });

  it('does not record gh_thread_origin when the thread session already exists (no mint)', async () => {
    const originRuns: unknown[] = [];
    vi.doMock('./config.js', () => ({
      INSTANCE_FORWARD_TARGETS: {},
      INSTANCE_SLUG: 'prod',
      INTERNAL_REGISTER_SECRET: SECRET,
      ROUTE_ISSUES_TO: '',
      APPROVER_CI_GATE: false,
      CI_GATE_REQUIRED_SUITE: '',
    }));
    vi.doMock('./db/connection.js', () => ({
      getDb: () => ({
        prepare: (sql: string) => ({
          run: (...args: unknown[]) => originRuns.push({ sql, args }),
        }),
      }),
    }));
    vi.doMock('./db/sessions.js', () => ({
      findSessionByAgentGroup: () => undefined,
      // A session already exists on this thread — deliverToAgentGroup takes
      // the "found" branch, never mints, and must not write an origin row.
      findSessionByAgentThread: () => ({ id: 'sess-orch-existing' }),
      getSession: () => undefined,
      createSession: () => undefined,
      updateSessionTitle: () => true,
    }));
    vi.doMock('./db/agent-groups.js', () => ({
      getAdminAgentGroup: () => ({ id: 'g-admin', name: 'orchestrator' }),
      getAgentGroupByFolder: () => undefined,
    }));
    vi.doMock('./db/session-db.js', () => ({
      openInboundDb: () => ({
        prepare: () => ({ get: () => undefined, run: () => undefined }),
        close: () => undefined,
      }),
      insertMessage: () => undefined,
    }));
    vi.doMock('./session-manager.js', () => ({
      inboundDbPath: () => '/tmp/orch.db',
      initSessionFolder: () => undefined,
    }));

    const { deliverGitHubIssueOpened } = await import('./webhook-github.js');
    const outcome = deliverGitHubIssueOpened({
      repo: 'shader-slang/slang',
      issueNumber: 1234,
      issueUrl: 'https://github.com/shader-slang/slang/issues/1234',
      title: 'Crash on null deref',
      body: 'Repro: ...',
      author: 'reporter-login',
      labels: ['bug'],
      deliveryId: 'd-issues-2',
    });

    expect(outcome).toBe('local');
    expect(originRuns).toHaveLength(0);
  });

  it('forwards new issues to peer when ROUTE_ISSUES_TO is set', async () => {
    const insertCalls: unknown[] = [];
    vi.doMock('./config.js', () => ({
      INSTANCE_FORWARD_TARGETS: { lego: peerUrl },
      INSTANCE_SLUG: 'prod',
      INTERNAL_REGISTER_SECRET: SECRET,
      ROUTE_ISSUES_TO: 'lego',
      APPROVER_CI_GATE: false,
      CI_GATE_REQUIRED_SUITE: '',
    }));
    vi.doMock('./db/connection.js', () => ({ getDb: () => ({}) }));
    vi.doMock('./db/sessions.js', () => ({
      findSessionByAgentGroup: () => undefined,
      findSessionByAgentThread: () => undefined,
      getSession: () => undefined,
      createSession: () => undefined,
      updateSessionTitle: () => true,
    }));
    vi.doMock('./db/agent-groups.js', () => ({
      getAdminAgentGroup: () => undefined,
      getAgentGroupByFolder: () => undefined,
    }));
    vi.doMock('./db/session-db.js', () => ({
      openInboundDb: () => ({
        prepare: () => ({ get: () => undefined, run: () => undefined }),
        close: () => undefined,
      }),
      insertMessage: (_db: unknown, msg: unknown) => insertCalls.push(msg),
    }));
    vi.doMock('./session-manager.js', () => ({ inboundDbPath: () => '/tmp/x.db', initSessionFolder: () => undefined }));

    const { deliverGitHubIssueOpened } = await import('./webhook-github.js');
    const rawBody = JSON.stringify({ action: 'opened', issue: { number: 5555 } });
    const outcome = deliverGitHubIssueOpened({
      repo: 'shader-slang/slang',
      issueNumber: 5555,
      issueUrl: 'https://example.com/i/5555',
      title: 'dev-routed test issue',
      body: 'body',
      author: 'reporter',
      labels: [],
      rawBody,
      eventType: 'issues',
      deliveryId: 'd-issue-fwd',
    });

    expect(outcome).toBe('forwarded');
    expect(insertCalls).toHaveLength(0); // never delivered locally
    await waitForCapture(1);
    expect(captured).toHaveLength(1);
    expect(captured[0].headers['x-webhook-trust']).toBe('pre-validated');
    expect(captured[0].headers['x-internal-signature-256']).toMatch(/^sha256=/);
    expect(captured[0].headers['x-github-event']).toBe('issues');
    expect(captured[0].headers['x-github-delivery']).toBe('d-issue-fwd');
    expect(captured[0].body).toBe(rawBody);
  });

  it('drops with warn when ROUTE_ISSUES_TO is set but the target is not in INSTANCE_FORWARD_TARGETS', async () => {
    const insertCalls: unknown[] = [];
    vi.doMock('./config.js', () => ({
      INSTANCE_FORWARD_TARGETS: {}, // no lego URL configured
      INSTANCE_SLUG: 'prod',
      INTERNAL_REGISTER_SECRET: SECRET,
      ROUTE_ISSUES_TO: 'lego',
      APPROVER_CI_GATE: false,
      CI_GATE_REQUIRED_SUITE: '',
    }));
    vi.doMock('./db/connection.js', () => ({ getDb: () => ({}) }));
    vi.doMock('./db/sessions.js', () => ({
      findSessionByAgentGroup: () => undefined,
      findSessionByAgentThread: () => undefined,
      getSession: () => undefined,
      createSession: () => undefined,
      updateSessionTitle: () => true,
    }));
    vi.doMock('./db/agent-groups.js', () => ({
      getAdminAgentGroup: () => undefined,
      getAgentGroupByFolder: () => undefined,
    }));
    vi.doMock('./db/session-db.js', () => ({
      openInboundDb: () => ({
        prepare: () => ({ get: () => undefined, run: () => undefined }),
        close: () => undefined,
      }),
      insertMessage: (_db: unknown, msg: unknown) => insertCalls.push(msg),
    }));
    vi.doMock('./session-manager.js', () => ({ inboundDbPath: () => '/tmp/x.db', initSessionFolder: () => undefined }));

    const { deliverGitHubIssueOpened } = await import('./webhook-github.js');
    const outcome = deliverGitHubIssueOpened({
      repo: 'shader-slang/slang',
      issueNumber: 5555,
      issueUrl: '',
      title: 't',
      body: '',
      author: '',
      labels: [],
      rawBody: '{}',
      eventType: 'issues',
      deliveryId: 'd-1',
    });

    expect(outcome).toBe('dropped');
    expect(insertCalls).toHaveLength(0);
    expect(captured).toHaveLength(0);
  });

  it('falls through to local orchestrator when ROUTE_ISSUES_TO equals own INSTANCE_SLUG', async () => {
    // On lego: INSTANCE_SLUG='lego' and (hypothetically) ROUTE_ISSUES_TO='lego'.
    // Don't loop-forward to self — handle locally.
    const insertCalls: unknown[] = [];
    vi.doMock('./config.js', () => ({
      INSTANCE_FORWARD_TARGETS: { lego: peerUrl },
      INSTANCE_SLUG: 'lego',
      INTERNAL_REGISTER_SECRET: SECRET,
      ROUTE_ISSUES_TO: 'lego',
      APPROVER_CI_GATE: false,
      CI_GATE_REQUIRED_SUITE: '',
    }));
    vi.doMock('./db/connection.js', () => ({ getDb: () => ({}) }));
    vi.doMock('./db/sessions.js', () => ({
      findSessionByAgentGroup: () => ({ id: 'sess-orch' }),
      findSessionByAgentThread: () => ({ id: 'sess-orch' }),
      getSession: () => undefined,
      createSession: () => undefined,
      updateSessionTitle: () => true,
    }));
    vi.doMock('./db/agent-groups.js', () => ({
      getAdminAgentGroup: () => ({ id: 'g-admin', name: 'lego-orchestrator' }),
      getAgentGroupByFolder: () => undefined,
    }));
    vi.doMock('./db/session-db.js', () => ({
      openInboundDb: () => ({
        prepare: () => ({ get: () => undefined, run: () => undefined }),
        close: () => undefined,
      }),
      insertMessage: (_db: unknown, msg: unknown) => insertCalls.push(msg),
    }));
    vi.doMock('./session-manager.js', () => ({
      inboundDbPath: () => '/tmp/orch.db',
      initSessionFolder: () => undefined,
    }));

    const { deliverGitHubIssueOpened } = await import('./webhook-github.js');
    const outcome = deliverGitHubIssueOpened({
      repo: 'x/y',
      issueNumber: 1,
      issueUrl: '',
      title: 't',
      body: '',
      author: '',
      labels: [],
      rawBody: '{}',
      eventType: 'issues',
      deliveryId: 'd-1',
    });

    expect(outcome).toBe('local');
    expect(insertCalls).toHaveLength(1);
    expect(captured).toHaveLength(0);
  });
});

describe('deliverGitHubPrReviewable', () => {
  it('forwards to peer when ROUTE_READY_PRS_TO is set and differs from INSTANCE_SLUG', async () => {
    vi.doMock('./config.js', () => ({
      INSTANCE_FORWARD_TARGETS: { lego: peerUrl },
      INSTANCE_SLUG: 'prod',
      INTERNAL_REGISTER_SECRET: SECRET,
      ROUTE_ISSUES_TO: '',
      APPROVER_CI_GATE: false,
      CI_GATE_REQUIRED_SUITE: '',
      ROUTE_READY_PRS_TO: 'lego',
    }));
    vi.doMock('./db/connection.js', () => ({ getDb: () => ({}) }));
    vi.doMock('./db/sessions.js', () => ({
      findSessionByAgentGroup: () => undefined,
      findSessionByAgentThread: () => undefined,
      getSession: () => undefined,
      createSession: () => undefined,
      updateSessionTitle: () => true,
    }));
    vi.doMock('./db/agent-groups.js', () => ({
      getAdminAgentGroup: () => undefined,
      getAgentGroupByFolder: () => undefined,
    }));
    vi.doMock('./db/session-db.js', () => ({
      openInboundDb: () => ({
        prepare: () => ({ get: () => undefined, run: () => undefined }),
        close: () => undefined,
      }),
      insertMessage: () => undefined,
    }));

    const { deliverGitHubPrReviewable } = await import('./webhook-github.js');
    const outcome = deliverGitHubPrReviewable({
      repo: 'shader-slang/slang',
      prNumber: 321,
      prUrl: 'https://github.com/shader-slang/slang/pull/321',
      title: 'feat',
      author: 'a-human',
      reason: 'ready_for_review',
      rawBody: '{"action":"ready_for_review"}',
      eventType: 'pull_request',
      deliveryId: 'd-ready-1',
    });

    expect(outcome).toBe('forwarded');
    await waitForCapture(1);
    expect(captured).toHaveLength(1);
    expect(captured[0].headers['x-webhook-trust']).toBe('pre-validated');
    expect(captured[0].body).toBe('{"action":"ready_for_review"}');
  });

  it('drops with warn when ROUTE_READY_PRS_TO is set but the target is missing', async () => {
    vi.doMock('./config.js', () => ({
      INSTANCE_FORWARD_TARGETS: {}, // no target for 'lego'
      INSTANCE_SLUG: 'prod',
      INTERNAL_REGISTER_SECRET: SECRET,
      ROUTE_ISSUES_TO: '',
      APPROVER_CI_GATE: false,
      CI_GATE_REQUIRED_SUITE: '',
      ROUTE_READY_PRS_TO: 'lego',
    }));
    vi.doMock('./db/connection.js', () => ({ getDb: () => ({}) }));
    vi.doMock('./db/sessions.js', () => ({
      findSessionByAgentGroup: () => undefined,
      findSessionByAgentThread: () => undefined,
      getSession: () => undefined,
      createSession: () => undefined,
      updateSessionTitle: () => true,
    }));
    vi.doMock('./db/agent-groups.js', () => ({
      getAdminAgentGroup: () => undefined,
      getAgentGroupByFolder: () => undefined,
    }));
    vi.doMock('./db/session-db.js', () => ({
      openInboundDb: () => ({
        prepare: () => ({ get: () => undefined, run: () => undefined }),
        close: () => undefined,
      }),
      insertMessage: () => undefined,
    }));

    const { deliverGitHubPrReviewable } = await import('./webhook-github.js');
    const outcome = deliverGitHubPrReviewable({
      repo: 'shader-slang/slang',
      prNumber: 321,
      prUrl: '',
      title: '',
      author: '',
      reason: 'ready_for_review',
      rawBody: '{}',
      eventType: 'pull_request',
      deliveryId: 'd-ready-1',
    });

    expect(outcome).toBe('dropped');
    expect(captured).toHaveLength(0);
  });

  it('delivers to the orchestrator on gh-pr-<repo>-<num>, minting the session', async () => {
    const insertCalls: Array<Record<string, unknown>> = [];
    const threadLookups: string[] = [];
    vi.doMock('./config.js', () => ({
      INSTANCE_FORWARD_TARGETS: {},
      INSTANCE_SLUG: 'lego',
      INTERNAL_REGISTER_SECRET: SECRET,
      ROUTE_ISSUES_TO: '',
      APPROVER_CI_GATE: false,
      CI_GATE_REQUIRED_SUITE: '',
      ROUTE_READY_PRS_TO: '', // consumer: handle locally
    }));
    vi.doMock('./db/connection.js', () => ({ getDb: () => ({}) }));
    vi.doMock('./db/sessions.js', () => ({
      findSessionByAgentGroup: () => undefined,
      findSessionByAgentThread: (_g: string, thread: string) => {
        threadLookups.push(thread);
        return { id: 'sess-orch' };
      },
      getSession: () => undefined,
      createSession: () => undefined,
      updateSessionTitle: () => true,
    }));
    vi.doMock('./db/agent-groups.js', () => ({
      getAdminAgentGroup: () => ({ id: 'g-admin', name: 'orchestrator' }),
      getAgentGroupByFolder: () => undefined,
    }));
    vi.doMock('./db/session-db.js', () => ({
      openInboundDb: () => ({
        prepare: () => ({ get: () => undefined, run: () => undefined }),
        close: () => undefined,
      }),
      insertMessage: (_db: unknown, msg: Record<string, unknown>) => insertCalls.push(msg),
    }));
    vi.doMock('./session-manager.js', () => ({
      inboundDbPath: () => '/tmp/orch.db',
      initSessionFolder: () => undefined,
    }));

    const { deliverGitHubPrReviewable } = await import('./webhook-github.js');
    const outcome = deliverGitHubPrReviewable({
      repo: 'shader-slang/slang',
      prNumber: 321,
      prUrl: 'https://github.com/shader-slang/slang/pull/321',
      title: 'My feature',
      author: 'a-human',
      reason: 'opened',
      rawBody: '{}',
      eventType: 'pull_request',
      deliveryId: 'd-ready-1',
    });

    expect(outcome).toBe('local');
    expect(captured).toHaveLength(0); // not forwarded
    expect(threadLookups).toEqual(['gh-pr-shader-slang/slang-321']);
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0].id).toBe('gh-pr-ready-shader-slang/slang-321-d-ready-1');
    const content = JSON.parse(insertCalls[0].content as string);
    expect(content.event).toBe('github.pr_ready_for_review');
    expect(content.reason).toBe('opened');
    expect(content.is_pr).toBe(true);
  });

  it('records the PR submitter into gh_thread_origin when minting the thread session', async () => {
    const originRuns: unknown[] = [];
    vi.doMock('./config.js', () => ({
      INSTANCE_FORWARD_TARGETS: {},
      INSTANCE_SLUG: 'lego',
      INTERNAL_REGISTER_SECRET: SECRET,
      ROUTE_ISSUES_TO: '',
      APPROVER_CI_GATE: false,
      CI_GATE_REQUIRED_SUITE: '',
      ROUTE_READY_PRS_TO: '', // consumer: handle locally
    }));
    vi.doMock('./db/connection.js', () => ({
      getDb: () => ({
        prepare: (sql: string) => ({
          run: (...args: unknown[]) => originRuns.push({ sql, args }),
        }),
      }),
    }));
    vi.doMock('./db/sessions.js', () => ({
      findSessionByAgentGroup: () => undefined,
      // No existing session on this thread → mint branch fires.
      findSessionByAgentThread: () => undefined,
      getSession: () => undefined,
      createSession: () => undefined,
      updateSessionTitle: () => true,
    }));
    vi.doMock('./db/agent-groups.js', () => ({
      getAdminAgentGroup: () => ({ id: 'g-admin', name: 'orchestrator' }),
      getAgentGroupByFolder: () => undefined,
    }));
    vi.doMock('./db/session-db.js', () => ({
      openInboundDb: () => ({
        prepare: () => ({ get: () => undefined, run: () => undefined }),
        close: () => undefined,
      }),
      insertMessage: () => undefined,
    }));
    vi.doMock('./session-manager.js', () => ({
      inboundDbPath: () => '/tmp/orch.db',
      initSessionFolder: () => undefined,
    }));

    const { deliverGitHubPrReviewable } = await import('./webhook-github.js');
    const outcome = deliverGitHubPrReviewable({
      repo: 'shader-slang/slang',
      prNumber: 321,
      prUrl: 'https://github.com/shader-slang/slang/pull/321',
      title: 'My feature',
      author: 'contributor-login',
      reason: 'opened',
      rawBody: '{}',
      eventType: 'pull_request',
      deliveryId: 'd-ready-2',
    });

    expect(outcome).toBe('local');
    expect(originRuns).toHaveLength(1);
    const run = originRuns[0] as { sql: string; args: unknown[] };
    expect(run.sql).toMatch(/INSERT OR IGNORE INTO gh_thread_origin/);
    expect(run.args).toEqual(['gh-pr-shader-slang/slang-321', 'shader-slang/slang', 321, 'pr', 'contributor-login']);
  });

  it('re-fires on a new deliveryId but dedups a repeat of the same delivery', async () => {
    // Two reviewable events arrive as distinct deliveries → two distinct rowIds
    // → two inserts. A retry of the SAME delivery hits the idempotency guard
    // (SELECT 1 finds the existing row) → no second insert.
    const seenIds = new Set<string>();
    const insertCalls: Array<Record<string, unknown>> = [];
    vi.doMock('./config.js', () => ({
      INSTANCE_FORWARD_TARGETS: {},
      INSTANCE_SLUG: 'lego',
      INTERNAL_REGISTER_SECRET: SECRET,
      ROUTE_ISSUES_TO: '',
      APPROVER_CI_GATE: false,
      CI_GATE_REQUIRED_SUITE: '',
      ROUTE_READY_PRS_TO: '',
    }));
    vi.doMock('./db/connection.js', () => ({ getDb: () => ({}) }));
    vi.doMock('./db/sessions.js', () => ({
      findSessionByAgentGroup: () => undefined,
      findSessionByAgentThread: () => ({ id: 'sess-orch' }),
      getSession: () => undefined,
      createSession: () => undefined,
      updateSessionTitle: () => true,
    }));
    vi.doMock('./db/agent-groups.js', () => ({
      getAdminAgentGroup: () => ({ id: 'g-admin', name: 'orchestrator' }),
      getAgentGroupByFolder: () => undefined,
    }));
    vi.doMock('./db/session-db.js', () => ({
      openInboundDb: () => ({
        // Idempotency guard: report a row as existing iff we've inserted its id.
        prepare: (sql: string) => ({
          get: (id: string) => (sql.includes('SELECT 1') && seenIds.has(id) ? { 1: 1 } : undefined),
          run: () => undefined,
        }),
        close: () => undefined,
      }),
      insertMessage: (_db: unknown, msg: Record<string, unknown>) => {
        insertCalls.push(msg);
        seenIds.add(msg.id as string);
      },
    }));
    vi.doMock('./session-manager.js', () => ({
      inboundDbPath: () => '/tmp/orch.db',
      initSessionFolder: () => undefined,
    }));

    const { deliverGitHubPrReviewable } = await import('./webhook-github.js');
    const base = {
      repo: 'shader-slang/slang',
      prNumber: 321,
      prUrl: '',
      title: 't',
      author: 'a',
      reason: 'synchronize',
      rawBody: '{}',
      eventType: 'pull_request',
    } as const;

    // First push.
    expect(deliverGitHubPrReviewable({ ...base, deliveryId: 'd-1' })).toBe('local');
    // Same delivery retried → dedup.
    expect(deliverGitHubPrReviewable({ ...base, deliveryId: 'd-1' })).toBe('local');
    // Second push (new delivery) → re-fire.
    expect(deliverGitHubPrReviewable({ ...base, deliveryId: 'd-2' })).toBe('local');

    expect(insertCalls).toHaveLength(2);
    expect(insertCalls.map((m) => m.id)).toEqual([
      'gh-pr-ready-shader-slang/slang-321-d-1',
      'gh-pr-ready-shader-slang/slang-321-d-2',
    ]);
  });
});
