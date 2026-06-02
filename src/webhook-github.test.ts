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

  it('falls through to orchestrator when no mapping exists', async () => {
    const insertCalls: unknown[] = [];
    vi.doMock('./config.js', () => ({
      INSTANCE_FORWARD_TARGETS: {},
      INSTANCE_SLUG: 'prod',
      INTERNAL_REGISTER_SECRET: SECRET,
      ROUTE_ISSUES_TO: '',
    }));
    vi.doMock('./db/connection.js', () => ({
      getDb: () => ({ prepare: () => ({ get: () => undefined }) }), // no mapping row
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
    expect(insertCalls).toHaveLength(1);
    const inserted = insertCalls[0] as { content: string };
    expect(JSON.parse(inserted.content).event).toBe('github.pr_mention');
  });

  it('forwards issue (non-PR) comments to peer when ROUTE_ISSUES_TO is set', async () => {
    vi.doMock('./config.js', () => ({
      INSTANCE_FORWARD_TARGETS: { lego: peerUrl },
      INSTANCE_SLUG: 'prod',
      INTERNAL_REGISTER_SECRET: SECRET,
      ROUTE_ISSUES_TO: 'lego',
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

describe('deliverGitHubIssueOpened', () => {
  it('routes new issues to orchestrator with github.issue_opened event (default, ROUTE_ISSUES_TO unset)', async () => {
    const insertCalls: unknown[] = [];
    vi.doMock('./config.js', () => ({
      INSTANCE_FORWARD_TARGETS: {},
      INSTANCE_SLUG: 'prod',
      INTERNAL_REGISTER_SECRET: SECRET,
      ROUTE_ISSUES_TO: '',
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

  it('forwards new issues to peer when ROUTE_ISSUES_TO is set', async () => {
    const insertCalls: unknown[] = [];
    vi.doMock('./config.js', () => ({
      INSTANCE_FORWARD_TARGETS: { lego: peerUrl },
      INSTANCE_SLUG: 'prod',
      INTERNAL_REGISTER_SECRET: SECRET,
      ROUTE_ISSUES_TO: 'lego',
    }));
    vi.doMock('./db/connection.js', () => ({ getDb: () => ({}) }));
    vi.doMock('./db/sessions.js', () => ({
      findSessionByAgentGroup: () => undefined,
      findSessionByAgentThread: () => undefined,
      getSession: () => undefined,
      createSession: () => undefined,
      updateSessionTitle: () => true,
    }));
    vi.doMock('./db/agent-groups.js', () => ({ getAdminAgentGroup: () => undefined }));
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
    }));
    vi.doMock('./db/connection.js', () => ({ getDb: () => ({}) }));
    vi.doMock('./db/sessions.js', () => ({
      findSessionByAgentGroup: () => undefined,
      findSessionByAgentThread: () => undefined,
      getSession: () => undefined,
      createSession: () => undefined,
      updateSessionTitle: () => true,
    }));
    vi.doMock('./db/agent-groups.js', () => ({ getAdminAgentGroup: () => undefined }));
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
