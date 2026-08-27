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
