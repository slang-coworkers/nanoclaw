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
      prBranch: null,
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
      prBranch: null,
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
      prBranch: null,
      rawBody: '{"action":"created"}',
      eventType: 'issue_comment',
      deliveryId: 'd-1',
    });

    expect(outcome).toBe('local');
    expect(captured).toHaveLength(0); // no forward
    expect(insertCalls).toHaveLength(1);
  });
});
