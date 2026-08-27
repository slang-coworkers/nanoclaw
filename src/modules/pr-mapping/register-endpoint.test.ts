import http, { type IncomingMessage, type ServerResponse } from 'http';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { closeDb, initTestDb } from '../../db/connection.js';
import { runMigrations } from '../../db/migrations/index.js';
import { signRegisterBody, REGISTER_SIGNATURE_HEADER } from './register-client.js';
import { handleRegisterPr } from './register-endpoint.js';

const SECRET = 'test-secret-1234';

let serverUrl: string;
let server: http.Server;

interface PostResult {
  status: number;
  body: string;
}

async function postRaw(url: string, headers: Record<string, string>, body: string): Promise<PostResult> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
  });
  return { status: res.status, body: await res.text() };
}

beforeAll(
  () =>
    new Promise<void>((resolve) => {
      server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
        // route every POST to handleRegisterPr regardless of URL — simpler test harness
        void handleRegisterPr(req, res, SECRET);
      });
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          serverUrl = `http://127.0.0.1:${addr.port}/internal/register-pr`;
        }
        resolve();
      });
    }),
);

beforeEach(async () => {
  await runMigrations(await initTestDb());
});

afterEach(async () => {
  await closeDb();
});

describe('POST /internal/register-pr', () => {
  it('rejects missing signature with 401', async () => {
    const body = JSON.stringify({ repo: 'a/b', pr_number: 1, owner_instance: 'prod' });
    const r = await postRaw(serverUrl, {}, body);
    expect(r.status).toBe(401);
  });

  it('rejects bad signature with 401', async () => {
    const body = JSON.stringify({ repo: 'a/b', pr_number: 1 });
    const r = await postRaw(serverUrl, { [REGISTER_SIGNATURE_HEADER]: 'sha256=garbage' }, body);
    expect(r.status).toBe(401);
  });

  it('rejects missing required fields with 400', async () => {
    const body = JSON.stringify({ repo: 'a/b' });
    const r = await postRaw(serverUrl, { [REGISTER_SIGNATURE_HEADER]: signRegisterBody(SECRET, body) }, body);
    expect(r.status).toBe(400);
    expect(JSON.parse(r.body).error).toBe('missing required fields');
  });

  it('rejects unknown owner_instance with 400', async () => {
    const body = JSON.stringify({
      repo: 'shader-slang/slang',
      pr_number: 999,
      owner_instance: 'staging',
      agent_group_id: 'g1',
      session_id: 's1',
      thread_id: null,
    });
    const r = await postRaw(serverUrl, { [REGISTER_SIGNATURE_HEADER]: signRegisterBody(SECRET, body) }, body);
    expect(r.status).toBe(400);
    expect(JSON.parse(r.body).error).toBe('unknown owner_instance');
  });

  it('writes the mapping on a valid signed body', async () => {
    const db = await initTestDb();
    await runMigrations(db);

    const body = JSON.stringify({
      repo: 'shader-slang/slang',
      pr_number: 555,
      owner_instance: 'lego',
      agent_group_id: 'g-ext',
      session_id: 's-ext',
      thread_id: 't-ext',
    });
    const r = await postRaw(serverUrl, { [REGISTER_SIGNATURE_HEADER]: signRegisterBody(SECRET, body) }, body);
    expect(r.status).toBe(200);

    const row = await db.get<{ owner_instance: string; session_id: string }>(
      'SELECT owner_instance, session_id FROM pr_session_mappings WHERE repo = ? AND pr_number = ?',
      'shader-slang/slang',
      555,
    );
    expect(row?.owner_instance).toBe('lego');
    expect(row?.session_id).toBe('s-ext');
  });

  it('rejects payload over the 64 KB body limit', async () => {
    const big = 'x'.repeat(65 * 1024);
    const body = JSON.stringify({
      repo: 'shader-slang/slang',
      pr_number: 1,
      owner_instance: 'prod',
      agent_group_id: big,
      session_id: 's1',
      thread_id: null,
    });
    // signature would be valid but server should drop on size
    const r = await postRaw(serverUrl, { [REGISTER_SIGNATURE_HEADER]: signRegisterBody(SECRET, body) }, body);
    expect(r.status).toBe(413);
  });
});
