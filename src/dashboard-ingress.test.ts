import { once } from 'events';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { startDashboardIngress } from './dashboard-ingress.js';

let handles: Array<{ stop: () => Promise<void> }> = [];

afterEach(async () => {
  while (handles.length > 0) {
    await handles.pop()!.stop();
  }
});

describe('dashboard ingress', () => {
  it('routes browser chat into the host router', async () => {
    const routeInboundFn = vi.fn().mockResolvedValue(undefined);
    const handle = startDashboardIngress({
      host: '127.0.0.1',
      port: 0,
      isAdapterReady: () => true,
      routeInboundFn,
    });
    handles.push(handle);
    await once(handle.server, 'listening');
    const address = handle.server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected dashboard ingress to bind an ephemeral TCP port');
    }

    const res = await fetch(`http://127.0.0.1:${address.port}/api/dashboard/inbound`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group: 'reviewer', content: 'hello from dashboard' }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(routeInboundFn).toHaveBeenCalledTimes(1);
    expect(routeInboundFn).toHaveBeenCalledWith(
      expect.objectContaining({
        channelType: 'dashboard',
        platformId: 'dashboard:reviewer',
        threadId: null,
        message: expect.objectContaining({
          kind: 'chat',
          content: JSON.stringify({
            text: 'hello from dashboard',
            sender: 'dashboard-admin',
            senderId: 'dashboard-admin',
          }),
        }),
      }),
    );
  });

  it('passes thread_id through to routeInbound when provided', async () => {
    const routeInboundFn = vi.fn().mockResolvedValue(undefined);
    const handle = startDashboardIngress({
      host: '127.0.0.1',
      port: 0,
      isAdapterReady: () => true,
      routeInboundFn,
    });
    handles.push(handle);
    await once(handle.server, 'listening');
    const address = handle.server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected dashboard ingress to bind an ephemeral TCP port');
    }

    const res = await fetch(`http://127.0.0.1:${address.port}/api/dashboard/inbound`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group: 'reviewer', content: 'hello', thread_id: 'msg-abc-123' }),
    });

    expect(res.status).toBe(200);
    expect(routeInboundFn).toHaveBeenCalledWith(expect.objectContaining({ threadId: 'msg-abc-123' }));
  });

  it('trims whitespace and treats empty-after-trim thread_id as null', async () => {
    const routeInboundFn = vi.fn().mockResolvedValue(undefined);
    const handle = startDashboardIngress({
      host: '127.0.0.1',
      port: 0,
      isAdapterReady: () => true,
      routeInboundFn,
    });
    handles.push(handle);
    await once(handle.server, 'listening');
    const address = handle.server.address();
    if (!address || typeof address === 'string') throw new Error('bind failed');

    const res = await fetch(`http://127.0.0.1:${address.port}/api/dashboard/inbound`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group: 'reviewer', content: 'hello', thread_id: '   ' }),
    });

    expect(res.status).toBe(200);
    expect(routeInboundFn).toHaveBeenCalledWith(expect.objectContaining({ threadId: null }));
  });

  it('rejects non-string thread_id with 400', async () => {
    const routeInboundFn = vi.fn().mockResolvedValue(undefined);
    const handle = startDashboardIngress({
      host: '127.0.0.1',
      port: 0,
      isAdapterReady: () => true,
      routeInboundFn,
    });
    handles.push(handle);
    await once(handle.server, 'listening');
    const address = handle.server.address();
    if (!address || typeof address === 'string') throw new Error('bind failed');

    const res = await fetch(`http://127.0.0.1:${address.port}/api/dashboard/inbound`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group: 'reviewer', content: 'hello', thread_id: 123 }),
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'thread_id must be a string' });
    expect(routeInboundFn).not.toHaveBeenCalled();
  });

  it('rejects thread_id longer than 200 chars with 400', async () => {
    const routeInboundFn = vi.fn().mockResolvedValue(undefined);
    const handle = startDashboardIngress({
      host: '127.0.0.1',
      port: 0,
      isAdapterReady: () => true,
      routeInboundFn,
    });
    handles.push(handle);
    await once(handle.server, 'listening');
    const address = handle.server.address();
    if (!address || typeof address === 'string') throw new Error('bind failed');

    const res = await fetch(`http://127.0.0.1:${address.port}/api/dashboard/inbound`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group: 'reviewer', content: 'hello', thread_id: 'x'.repeat(201) }),
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'thread_id too long (max 200 chars)' });
    expect(routeInboundFn).not.toHaveBeenCalled();
  });

  it('returns 503 when the dashboard adapter is not ready in the host', async () => {
    const routeInboundFn = vi.fn().mockResolvedValue(undefined);
    const handle = startDashboardIngress({
      host: '127.0.0.1',
      port: 0,
      isAdapterReady: () => false,
      routeInboundFn,
    });
    handles.push(handle);
    await once(handle.server, 'listening');
    const address = handle.server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected dashboard ingress to bind an ephemeral TCP port');
    }

    const res = await fetch(`http://127.0.0.1:${address.port}/api/dashboard/inbound`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group: 'reviewer', content: 'hello from dashboard' }),
    });

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'Dashboard channel adapter not ready' });
    expect(routeInboundFn).not.toHaveBeenCalled();
  });
});

describe('dashboard ingress — sender_id (Discord sidecar, #2274)', () => {
  // The Discord sidecar posts on behalf of a Discord user. Without sender_id
  // every post arrives as dashboard-admin, the owner, so a Discord user would
  // pass the router's admin gates as the owner.
  async function post(body: Record<string, unknown>) {
    const routeInboundFn = vi.fn().mockResolvedValue(undefined);
    const handle = startDashboardIngress({ host: '127.0.0.1', port: 0, isAdapterReady: () => true, routeInboundFn });
    handles.push(handle);
    await once(handle.server, 'listening');
    const address = handle.server.address();
    if (!address || typeof address === 'string') throw new Error('bind failed');
    const res = await fetch(`http://127.0.0.1:${address.port}/api/dashboard/inbound`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group: 'support', content: 'hello', ...body }),
    });
    return { res, routeInboundFn };
  }

  function senderOf(routeInboundFn: ReturnType<typeof vi.fn>) {
    const content = JSON.parse(routeInboundFn.mock.calls[0][0].message.content);
    return { sender: content.sender, senderId: content.senderId };
  }

  it('routes a discord:<id> sender_id as that sender instead of dashboard-admin', async () => {
    const { res, routeInboundFn } = await post({ sender_id: 'discord:123456789012345678' });
    expect(res.status).toBe(200);
    expect(senderOf(routeInboundFn)).toEqual({
      sender: 'discord:123456789012345678',
      senderId: 'discord:123456789012345678',
    });
  });

  it('keeps dashboard-admin when sender_id is absent or null', async () => {
    for (const body of [{}, { sender_id: null }]) {
      const { res, routeInboundFn } = await post(body);
      expect(res.status).toBe(200);
      expect(senderOf(routeInboundFn)).toEqual({ sender: 'dashboard-admin', senderId: 'dashboard-admin' });
    }
  });

  it.each([
    ['dashboard-admin'],
    ['discord:'],
    ['discord:abc'],
    ['discord:1234'],
    ['discord:12345678901234567890123456'],
    ['slack:123456789'],
    [' discord:123456789'],
    ['discord:123456789\n'],
    [123456789],
  ])('rejects sender_id %j with 400 and routes nothing', async (senderId) => {
    const { res, routeInboundFn } = await post({ sender_id: senderId });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'sender_id must be discord:<numeric id>' });
    expect(routeInboundFn).not.toHaveBeenCalled();
  });
});

describe('dashboard ingress — session-cost-ceiling (NanoClaw #1, "set ceiling v2")', () => {
  async function post(port: number, body: unknown) {
    return fetch(`http://127.0.0.1:${port}/api/dashboard/session-cost-ceiling`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('transports the request body to the handler verbatim and writes its status+body back', async () => {
    const onSetCeilingFn = vi.fn().mockResolvedValue({
      status: 202,
      body: { ok: true, adjustmentId: 'cca-1', state: 'enqueued' },
    });
    const handle = startDashboardIngress({ host: '127.0.0.1', port: 0, onSetCeilingFn });
    handles.push(handle);
    await once(handle.server, 'listening');
    const address = handle.server.address();
    if (!address || typeof address === 'string') throw new Error('bind failed');

    const requestBody = {
      protocolVersion: 2,
      requestId: 'cca-1',
      sessionId: 'sess-1',
      targetCeilingCents: 17500,
      expectedEpochKey: '7',
      expectedCeilingCents: 15000,
    };
    const res = await post(address.port, requestBody);

    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ ok: true, adjustmentId: 'cca-1', state: 'enqueued' });
    expect(onSetCeilingFn).toHaveBeenCalledWith(requestBody);
  });

  it('propagates every status code the handler returns (400/404/409/422/426/503), not just 2xx', async () => {
    const handle = startDashboardIngress({
      host: '127.0.0.1',
      port: 0,
      onSetCeilingFn: vi.fn().mockResolvedValue({ status: 409, body: { ok: false, error: 'stale' } }),
    });
    handles.push(handle);
    await once(handle.server, 'listening');
    const address = handle.server.address();
    if (!address || typeof address === 'string') throw new Error('bind failed');

    const res = await post(address.port, { protocolVersion: 2 });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, error: 'stale' });
  });

  it('returns 501 when no handler is configured', async () => {
    const handle = startDashboardIngress({ host: '127.0.0.1', port: 0 });
    handles.push(handle);
    await once(handle.server, 'listening');
    const address = handle.server.address();
    if (!address || typeof address === 'string') throw new Error('bind failed');

    const res = await post(address.port, { protocolVersion: 2 });
    expect(res.status).toBe(501);
  });

  it('returns 400 on invalid JSON without ever calling the handler', async () => {
    const onSetCeilingFn = vi.fn();
    const handle = startDashboardIngress({ host: '127.0.0.1', port: 0, onSetCeilingFn });
    handles.push(handle);
    await once(handle.server, 'listening');
    const address = handle.server.address();
    if (!address || typeof address === 'string') throw new Error('bind failed');

    const res = await fetch(`http://127.0.0.1:${address.port}/api/dashboard/session-cost-ceiling`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    });

    expect(res.status).toBe(400);
    expect(onSetCeilingFn).not.toHaveBeenCalled();
  });

  it('returns 500 (not a crash) when the handler throws', async () => {
    const handle = startDashboardIngress({
      host: '127.0.0.1',
      port: 0,
      onSetCeilingFn: vi.fn().mockRejectedValue(new Error('boom')),
    });
    handles.push(handle);
    await once(handle.server, 'listening');
    const address = handle.server.address();
    if (!address || typeof address === 'string') throw new Error('bind failed');

    const res = await post(address.port, { protocolVersion: 2 });
    expect(res.status).toBe(500);
  });
});
