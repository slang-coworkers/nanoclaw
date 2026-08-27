import http, { type IncomingMessage, type ServerResponse } from 'http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { forwardWebhookToPeer } from './forward.js';
import { TRUST_SIGNATURE_HEADER, WEBHOOK_TRUST_HEADER, verifyTrustedSignature } from './register-client.js';

const SECRET = 'forward-secret-1234';

interface CapturedRequest {
  method: string | undefined;
  url: string | undefined;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

let server: http.Server;
let serverUrl: string;
let captured: CapturedRequest[] = [];

beforeAll(
  () =>
    new Promise<void>((resolve) => {
      server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
        let body = '';
        req.on('data', (c) => {
          body += c.toString();
        });
        req.on('end', () => {
          captured.push({ method: req.method, url: req.url, headers: { ...req.headers }, body });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end('{"ok":true}');
        });
      });
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          serverUrl = `http://127.0.0.1:${addr.port}/webhook/github`;
        }
        resolve();
      });
    }),
);

afterAll(
  () =>
    new Promise<void>((resolve) => {
      server.close(() => resolve());
    }),
);

async function waitForCapture(min: number, timeoutMs = 1000): Promise<void> {
  const start = Date.now();
  while (captured.length < min && Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 20));
  }
}

describe('forwardWebhookToPeer', () => {
  it('signs the body with the trust secret and adds the trust header', async () => {
    captured = [];
    const body = JSON.stringify({ action: 'created', issue: { number: 7 } });
    forwardWebhookToPeer({
      url: serverUrl,
      secret: SECRET,
      rawBody: body,
      event: 'issue_comment',
      delivery: 'd-abc',
    });
    await waitForCapture(1);

    expect(captured).toHaveLength(1);
    const req = captured[0];
    expect(req.method).toBe('POST');
    expect(req.body).toBe(body);
    expect(req.headers['x-github-event']).toBe('issue_comment');
    expect(req.headers['x-github-delivery']).toBe('d-abc');
    expect(req.headers[WEBHOOK_TRUST_HEADER]).toBe('pre-validated');
    const sig = String(req.headers[TRUST_SIGNATURE_HEADER] ?? '');
    expect(verifyTrustedSignature(SECRET, body, sig)).toBe(true);
  });

  it('skips when url or secret is missing (no fetch attempted)', () => {
    captured = [];
    forwardWebhookToPeer({ url: '', secret: SECRET, rawBody: 'x', event: 'issue_comment', delivery: '' });
    forwardWebhookToPeer({ url: serverUrl, secret: '', rawBody: 'x', event: 'issue_comment', delivery: '' });
    expect(captured).toHaveLength(0);
  });
});
