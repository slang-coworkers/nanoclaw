// Integration tests for container/hooks/intent-router.sh against a local fake
// model endpoint. A non-Claude group (AGENT_PROVIDER=codex) must classify through
// the OpenAI-compatible endpoint the Codex provider uses, never Anthropic's
// /v1/messages; a Claude group keeps the Anthropic call. Any failure stays a
// quiet no-op: exit 0 and no output.

import { spawn } from 'child_process';
import http from 'http';
import type { AddressInfo } from 'net';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const HOOK = path.resolve(process.cwd(), 'container', 'hooks', 'intent-router.sh');
const WORKFLOWS = 'plan:Any text deliverable;implement:Code or doc change';
const PROMPT = JSON.stringify({ prompt: 'please fix the null check in the router' });

interface Seen {
  path: string;
  headers: http.IncomingHttpHeaders;
  body: Record<string, unknown>;
}

let server: http.Server;
let baseUrl: string;
let seen: Seen[];
let reply: (path: string) => { status: number; json: unknown };
let delayMs: number;

function openAiReply(content: string) {
  return { status: 200, json: { choices: [{ message: { role: 'assistant', content } }] } };
}

function anthropicReply(text: string) {
  return { status: 200, json: { content: [{ type: 'text', text }] } };
}

beforeEach(async () => {
  seen = [];
  reply = () => ({ status: 404, json: {} });
  delayMs = 0;
  server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      seen.push({ path: req.url ?? '', headers: req.headers, body: raw ? JSON.parse(raw) : {} });
      const r = reply(req.url ?? '');
      setTimeout(() => {
        res.writeHead(r.status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(r.json));
      }, delayMs);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function runHook(env: Record<string, string>): Promise<{ status: number | null; stdout: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn('bash', [HOOK], {
      env: {
        PATH: process.env.PATH || '',
        OVERLAY_WORKFLOWS: WORKFLOWS,
        ANTHROPIC_BASE_URL: baseUrl,
        ANTHROPIC_API_KEY: 'placeholder',
        CODEX_BASE_URL: `${baseUrl}/v1`,
        NVIDIA_API_KEY: 'ROUTED_VIA_ONECLI_PROXY',
        ...env,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    child.stdout.on('data', (b) => (stdout += b.toString()));
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, stdout }));
    child.stdin.end(PROMPT);
  });
}

function routedWorkflow(stdout: string): string | null {
  if (!stdout.trim()) return null;
  const ctx = JSON.parse(stdout).hookSpecificOutput.additionalContext as string;
  return /Follow the \/(\S+) workflow/.exec(ctx)?.[1] ?? null;
}

describe('intent-router.sh in a non-Claude group', () => {
  it('classifies through the OpenAI-compatible endpoint with the luna model, and never calls /v1/messages', async () => {
    reply = (p) =>
      p === '/v1/chat/completions'
        ? openAiReply('{"workflow":"implement","reason":"asks for a code fix"}')
        : anthropicReply('{"workflow":"plan","reason":"wrong backend"}');

    const r = await runHook({ AGENT_PROVIDER: 'codex' });

    expect(r.status).toBe(0);
    expect(routedWorkflow(r.stdout)).toBe('implement');
    expect(seen.map((s) => s.path)).toEqual(['/v1/chat/completions']);
    expect(seen.some((s) => s.path.endsWith('/v1/messages'))).toBe(false);
    expect(seen[0].body.model).toBe('openai/openai/gpt-6-luna');
    expect(seen[0].headers.authorization).toBe('Bearer ROUTED_VIA_ONECLI_PROXY');
    expect(JSON.stringify(seen[0].body.messages)).toContain('please fix the null check');
  });

  it('turns luna reasoning off, which classification does not need', async () => {
    reply = () => openAiReply('{"workflow":"plan","reason":"r"}');
    await runHook({ AGENT_PROVIDER: 'codex' });
    expect(seen[0].body.reasoning_effort).toBe('none');
  });

  it('waits past 5 s for luna, which took up to 7.2 s through the gateway', { timeout: 15000 }, async () => {
    delayMs = 5500;
    reply = () => openAiReply('{"workflow":"implement","reason":"r"}');
    const r = await runHook({ AGENT_PROVIDER: 'codex' });
    expect(routedWorkflow(r.stdout)).toBe('implement');
  });

  it('strips a leading slash, which is how luna names the workflow', async () => {
    reply = () => openAiReply('{"workflow":"/implement","reason":"r"}');
    const r = await runHook({ AGENT_PROVIDER: 'codex' });
    expect(routedWorkflow(r.stdout)).toBe('implement');
  });

  it('uses INTENT_ROUTER_OPENAI_MODEL when set', async () => {
    reply = () => openAiReply('{"workflow":"plan","reason":"r"}');
    const r = await runHook({ AGENT_PROVIDER: 'codex', INTENT_ROUTER_OPENAI_MODEL: 'openai/openai/gpt-5.6-luna' });
    expect(routedWorkflow(r.stdout)).toBe('plan');
    expect(seen[0].body.model).toBe('openai/openai/gpt-5.6-luna');
  });

  it('accepts a fenced JSON answer, as the Anthropic path does', async () => {
    reply = () => openAiReply('```json\n{"workflow":"plan","reason":"r"}\n```');
    const r = await runHook({ AGENT_PROVIDER: 'codex' });
    expect(routedWorkflow(r.stdout)).toBe('plan');
  });

  it('outputs nothing when the model answers "none"', async () => {
    reply = () => openAiReply('{"workflow":"none","reason":"just a question"}');
    const r = await runHook({ AGENT_PROVIDER: 'codex' });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
    expect(seen.map((s) => s.path)).toEqual(['/v1/chat/completions']);
  });

  it('is a quiet no-op when the endpoint fails', async () => {
    reply = () => ({ status: 500, json: { error: 'boom' } });
    const r = await runHook({ AGENT_PROVIDER: 'codex' });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
    expect(seen.some((s) => s.path.endsWith('/v1/messages'))).toBe(false);
  });

  it('is a quiet no-op with no request when NVIDIA_API_KEY is empty', async () => {
    const r = await runHook({ AGENT_PROVIDER: 'codex', NVIDIA_API_KEY: '' });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
    expect(seen).toEqual([]);
  });
});

describe('intent-router.sh in a Claude group (unchanged)', () => {
  it.each([['claude'], ['']])('AGENT_PROVIDER=%j calls Anthropic /v1/messages', async (provider) => {
    reply = (p) =>
      p === '/v1/messages'
        ? anthropicReply('{"workflow":"plan","reason":"investigate"}')
        : openAiReply('{"workflow":"implement","reason":"wrong backend"}');

    const r = await runHook({ AGENT_PROVIDER: provider });

    expect(r.status).toBe(0);
    expect(routedWorkflow(r.stdout)).toBe('plan');
    expect(seen.map((s) => s.path)).toEqual(['/v1/messages']);
    expect(seen[0].body).not.toHaveProperty('reasoning_effort');
  });
});
