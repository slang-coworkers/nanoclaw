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
      getSession: () => undefined,
    }));
    vi.doMock('./db/agent-groups.js', () => ({
      getAdminAgentGroup: () => undefined,
      getAgentGroupByFolder: () => undefined,
    }));
    vi.doMock('./db/session-db.js', () => ({
      openInboundDb: () => ({ close: () => undefined }),
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
    vi.doMock('./db/sessions.js', () => ({ findSessionByAgentGroup: () => undefined, getSession: () => undefined }));
    vi.doMock('./db/agent-groups.js', () => ({
      getAdminAgentGroup: () => undefined,
      getAgentGroupByFolder: () => undefined,
    }));
    vi.doMock('./db/session-db.js', () => ({
      openInboundDb: () => ({ close: () => undefined }),
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
      getSession: () => ({ id: 's-prod' }),
    }));
    vi.doMock('./db/agent-groups.js', () => ({
      getAdminAgentGroup: () => undefined,
      getAgentGroupByFolder: () => undefined,
    }));
    vi.doMock('./db/session-db.js', () => ({
      openInboundDb: () => ({ close: () => undefined }),
      insertMessage: (_db: unknown, msg: unknown) => insertCalls.push(msg),
    }));
    vi.doMock('./session-manager.js', () => ({ inboundDbPath: () => '/tmp/inbox.db' }));

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
    }));
    vi.doMock('./db/connection.js', () => ({
      getDb: () => ({ prepare: () => ({ get: () => undefined }) }), // no mapping row
    }));
    vi.doMock('./db/sessions.js', () => ({
      findSessionByAgentGroup: () => ({ id: 'sess-orch' }),
      getSession: () => undefined,
    }));
    vi.doMock('./db/agent-groups.js', () => ({
      getAdminAgentGroup: () => ({ id: 'g-admin', name: 'orchestrator' }),
    }));
    vi.doMock('./db/session-db.js', () => ({
      openInboundDb: () => ({ close: () => undefined }),
      insertMessage: (_db: unknown, msg: unknown) => insertCalls.push(msg),
    }));
    vi.doMock('./session-manager.js', () => ({ inboundDbPath: () => '/tmp/orch.db' }));

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
});

describe('deliverGitHubIssueOpened', () => {
  it('routes new issues to orchestrator with github.issue_opened event', async () => {
    const insertCalls: unknown[] = [];
    vi.doMock('./config.js', () => ({
      INSTANCE_FORWARD_TARGETS: {},
      INSTANCE_SLUG: 'prod',
      INTERNAL_REGISTER_SECRET: SECRET,
    }));
    vi.doMock('./db/connection.js', () => ({
      getDb: () => ({ prepare: () => ({ get: () => undefined }) }),
    }));
    vi.doMock('./db/sessions.js', () => ({
      findSessionByAgentGroup: () => ({ id: 'sess-orch' }),
      getSession: () => undefined,
    }));
    vi.doMock('./db/agent-groups.js', () => ({
      getAdminAgentGroup: () => ({ id: 'g-admin', name: 'orchestrator' }),
    }));
    vi.doMock('./db/session-db.js', () => ({
      openInboundDb: () => ({ close: () => undefined }),
      insertMessage: (_db: unknown, msg: unknown) => insertCalls.push(msg),
    }));
    vi.doMock('./session-manager.js', () => ({ inboundDbPath: () => '/tmp/orch.db' }));

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
});
