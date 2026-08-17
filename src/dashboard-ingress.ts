import crypto from 'crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http';

import { DASHBOARD_INGRESS_HOST, DASHBOARD_INGRESS_PORT, DASHBOARD_SECRET } from './config.js';
import { getChannelAdapter } from './channels/channel-registry.js';
import { log } from './log.js';
import { routeInbound, routeInboundToSession } from './router.js';
import type { InboundEvent } from './channels/adapter.js';
import { CANONICAL_DECISIONS, canonicalizeDecision } from './modules/approvals/decision.js';

const MAX_BODY_SIZE = 1024 * 1024; // 1 MB
const VALID_DECISIONS = new Set<string>(CANONICAL_DECISIONS);

export interface DashboardIngressHandle {
  server: Server;
  stop(): Promise<void>;
}

interface DashboardIngressOptions {
  host?: string;
  port?: number;
  secret?: string;
  isAdapterReady?: () => boolean;
  routeInboundFn?: (event: InboundEvent) => Promise<void>;
  /** Inject for tests: bypass-messaging-group session-direct write. */
  routeInboundToSessionFn?: (opts: {
    sessionId: string;
    content: string;
    parentMessage?: InboundEvent['parentMessage'];
  }) => Promise<void>;
  onActionFn?: (questionId: string, selectedOption: string, userId: string) => Promise<void>;
  /** Handle arbitrary question responses (no VALID_DECISIONS restriction). */
  onQuestionFn?: (questionId: string, selectedOption: string, userId: string) => Promise<void>;
  /** Handle credential submission (value held only long enough to call OneCLI). */
  onCredentialSubmitFn?: (credentialId: string, value: string) => Promise<void>;
  /** Handle credential rejection. */
  onCredentialRejectFn?: (credentialId: string) => Promise<void>;
  /** Handle a cost-cap override decision from the dashboard (NanoClaw #1). */
  onCostOverrideFn?: (sessionId: string, decision: 'continue' | 'stop') => Promise<void>;
}

function generateMessageId(): string {
  return `dash-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function writeJson(res: ServerResponse, status: number, payload: Record<string, unknown>): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function readBody(req: IncomingMessage, res: ServerResponse): Promise<string | null> {
  return new Promise((resolve) => {
    let body = '';
    let exceeded = false;
    req.on('data', (chunk: Buffer | string) => {
      body += chunk.toString();
      if (body.length > MAX_BODY_SIZE && !exceeded) {
        exceeded = true;
        writeJson(res, 413, { error: 'Request body too large' });
        req.destroy();
        resolve(null);
      }
    });
    req.on('end', () => {
      if (!exceeded) resolve(body);
    });
    req.on('error', () => {
      if (!exceeded) resolve(null);
    });
  });
}

async function handleApprovalAction(
  req: IncomingMessage,
  res: ServerResponse,
  onActionFn: DashboardIngressOptions['onActionFn'],
): Promise<void> {
  const body = await readBody(req, res);
  if (body === null) return;
  try {
    const parsed = JSON.parse(body);
    const approvalId = typeof parsed.approvalId === 'string' ? parsed.approvalId.trim() : '';
    // Canonical field is 'decision'; 'response' is a legacy compat shim (remove after next release)
    const decision =
      typeof parsed.decision === 'string'
        ? parsed.decision.trim()
        : typeof parsed.response === 'string'
          ? parsed.response.trim()
          : '';
    if (!approvalId || !decision) {
      writeJson(res, 400, { error: 'approvalId and decision required' });
      return;
    }
    const canonical = canonicalizeDecision(decision);
    if (!canonical) {
      writeJson(res, 400, {
        error: `Invalid decision "${decision}". Must be one of: ${[...VALID_DECISIONS].join(', ')}`,
      });
      return;
    }
    if (!onActionFn) {
      writeJson(res, 501, { error: 'action handler not configured' });
      return;
    }
    await onActionFn(approvalId, canonical, 'dashboard-admin');
    log.info('Dashboard approval action', { approvalId, decision: canonical });
    writeJson(res, 200, { ok: true });
  } catch (err) {
    log.error('Failed to handle dashboard action', { err });
    writeJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
  }
}

export function startDashboardIngress(options: DashboardIngressOptions = {}): DashboardIngressHandle {
  const host = options.host || DASHBOARD_INGRESS_HOST;
  const port = options.port ?? DASHBOARD_INGRESS_PORT;
  const secret = options.secret ?? DASHBOARD_SECRET;
  const isAdapterReady = options.isAdapterReady || (() => Boolean(getChannelAdapter('dashboard')));
  const routeInboundFn = options.routeInboundFn || routeInbound;
  const routeInboundToSessionFn = options.routeInboundToSessionFn ?? null;
  const onActionFn = options.onActionFn;
  const onQuestionFn = options.onQuestionFn;
  const onCredentialSubmitFn = options.onCredentialSubmitFn;
  const onCredentialRejectFn = options.onCredentialRejectFn;
  const onCostOverrideFn = options.onCostOverrideFn;

  const server = createServer(async (req, res) => {
    if (req.method !== 'POST') {
      writeJson(res, 404, { error: 'not found' });
      return;
    }

    if (secret) {
      const auth = req.headers.authorization || '';
      const expected = `Bearer ${secret}`;
      const authOk =
        auth.length === expected.length && crypto.timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
      if (!authOk) {
        writeJson(res, 401, { error: 'unauthorized' });
        return;
      }
    }

    // Approval action endpoint
    if (req.url === '/api/dashboard/action') {
      await handleApprovalAction(req, res, onActionFn);
      return;
    }

    // Question response endpoint — accepts arbitrary options (no VALID_DECISIONS gate)
    if (req.url === '/api/dashboard/question-response') {
      const body = await readBody(req, res);
      if (body === null) return;
      try {
        const parsed = JSON.parse(body);
        const questionId = typeof parsed.questionId === 'string' ? parsed.questionId.trim() : '';
        const selectedOption = typeof parsed.selectedOption === 'string' ? parsed.selectedOption.trim() : '';
        if (!questionId || !selectedOption) {
          writeJson(res, 400, { error: 'questionId and selectedOption required' });
          return;
        }
        if (!onQuestionFn) {
          writeJson(res, 501, { error: 'question handler not configured' });
          return;
        }
        await onQuestionFn(questionId, selectedOption, 'dashboard-admin');
        log.info('Dashboard question response', { questionId, selectedOption });
        writeJson(res, 200, { ok: true });
      } catch (err) {
        log.error('Failed to handle dashboard question response', { err });
        writeJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
      }
      return;
    }

    // Credential submit endpoint
    if (req.url === '/api/dashboard/credential-submit') {
      const body = await readBody(req, res);
      if (body === null) return;
      try {
        const parsed = JSON.parse(body);
        const credentialId = typeof parsed.credentialId === 'string' ? parsed.credentialId.trim() : '';
        const value = typeof parsed.value === 'string' ? parsed.value : '';
        if (!credentialId || !value) {
          writeJson(res, 400, { error: 'credentialId and value required' });
          return;
        }
        if (!onCredentialSubmitFn) {
          writeJson(res, 501, { error: 'credential submit handler not configured' });
          return;
        }
        await onCredentialSubmitFn(credentialId, value);
        log.info('Dashboard credential submitted', { credentialId });
        writeJson(res, 200, { ok: true });
      } catch (err) {
        log.error('Failed to handle dashboard credential submit', { err });
        writeJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
      }
      return;
    }

    // Credential reject endpoint
    if (req.url === '/api/dashboard/credential-reject') {
      const body = await readBody(req, res);
      if (body === null) return;
      try {
        const parsed = JSON.parse(body);
        const credentialId = typeof parsed.credentialId === 'string' ? parsed.credentialId.trim() : '';
        if (!credentialId) {
          writeJson(res, 400, { error: 'credentialId required' });
          return;
        }
        if (!onCredentialRejectFn) {
          writeJson(res, 501, { error: 'credential reject handler not configured' });
          return;
        }
        await onCredentialRejectFn(credentialId);
        log.info('Dashboard credential rejected', { credentialId });
        writeJson(res, 200, { ok: true });
      } catch (err) {
        log.error('Failed to handle dashboard credential reject', { err });
        writeJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
      }
      return;
    }

    // Session-direct write — bypass messaging-group routing for admin
    // replies into a specific a2a session opened from the dashboard.
    if (req.url === '/api/dashboard/inbound-session') {
      const body = await readBody(req, res);
      if (body === null) return;
      let parsed: { session_id?: unknown; content?: unknown; parent_message?: unknown };
      try {
        parsed = JSON.parse(body);
      } catch {
        writeJson(res, 400, { error: 'invalid json' });
        return;
      }
      const sessionId = typeof parsed.session_id === 'string' ? parsed.session_id.trim() : '';
      const content = typeof parsed.content === 'string' ? parsed.content.trim() : '';
      if (!sessionId || !content) {
        writeJson(res, 400, { error: 'session_id and content required' });
        return;
      }
      let parentMessage: InboundEvent['parentMessage'] | undefined;
      if (parsed.parent_message !== undefined && parsed.parent_message !== null) {
        if (typeof parsed.parent_message !== 'object' || Array.isArray(parsed.parent_message)) {
          writeJson(res, 400, { error: 'parent_message must be an object' });
          return;
        }
        const pm = parsed.parent_message as Record<string, unknown>;
        const pmContent = typeof pm.content === 'string' ? pm.content : '';
        if (pmContent && pmContent.length <= 32 * 1024) {
          parentMessage = {
            content: pmContent,
            ...(typeof pm.timestamp === 'string' ? { timestamp: pm.timestamp } : {}),
            ...(typeof pm.sender === 'string' ? { sender: pm.sender } : {}),
            ...(pm.direction === 'outgoing' || pm.direction === 'incoming'
              ? { direction: pm.direction as 'outgoing' | 'incoming' }
              : {}),
          };
        }
      }
      try {
        await (routeInboundToSessionFn ?? routeInboundToSession)({
          sessionId,
          content,
          ...(parentMessage ? { parentMessage } : {}),
        });
        writeJson(res, 200, { ok: true });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const status = msg.startsWith('session not found') ? 404 : 500;
        log.error('Failed to route session-direct dashboard message', { sessionId, err });
        writeJson(res, status, { error: msg });
      }
      return;
    }

    // Cost-cap override endpoint (NanoClaw #1). Mirrors inbound-session: the
    // dashboard proxies the admin's Continue/Stop decision here, and we route it
    // into the session's inbound.db + wake the container.
    // SECURITY BOUNDARY: the dashboard is SSO-protected, so SSO is the boundary
    // here; setting DASHBOARD_SECRET adds a Bearer check that would close this
    // endpoint to anything but the authenticated dashboard.
    if (req.url === '/api/dashboard/cost-override') {
      const body = await readBody(req, res);
      if (body === null) return;
      let parsed: { session_id?: unknown; decision?: unknown };
      try {
        parsed = JSON.parse(body);
      } catch {
        writeJson(res, 400, { error: 'invalid json' });
        return;
      }
      const sessionId = typeof parsed.session_id === 'string' ? parsed.session_id.trim() : '';
      const decision = typeof parsed.decision === 'string' ? parsed.decision.trim() : '';
      if (!sessionId || (decision !== 'continue' && decision !== 'stop')) {
        writeJson(res, 400, { error: 'session_id and decision (continue|stop) required' });
        return;
      }
      if (!onCostOverrideFn) {
        writeJson(res, 501, { error: 'cost override handler not configured' });
        return;
      }
      try {
        await onCostOverrideFn(sessionId, decision as 'continue' | 'stop');
        writeJson(res, 200, { ok: true });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const status = msg.startsWith('session not found') ? 404 : 500;
        log.error('Failed to route cost-override', { sessionId, decision, err });
        writeJson(res, status, { error: msg });
      }
      return;
    }

    // Chat message endpoint
    if (req.url !== '/api/dashboard/inbound') {
      writeJson(res, 404, { error: 'not found' });
      return;
    }

    const body = await readBody(req, res);
    if (body === null) return;

    let parsed: {
      group?: unknown;
      content?: unknown;
      thread_id?: unknown;
      parent_message?: unknown;
    };
    try {
      parsed = JSON.parse(body);
    } catch {
      writeJson(res, 400, { error: 'invalid json' });
      return;
    }

    const group = typeof parsed.group === 'string' ? parsed.group.trim() : '';
    const content = typeof parsed.content === 'string' ? parsed.content.trim() : '';
    if (!group || !content) {
      writeJson(res, 400, { error: 'group and content required' });
      return;
    }

    let threadId: string | null = null;
    if (parsed.thread_id !== undefined && parsed.thread_id !== null) {
      if (typeof parsed.thread_id !== 'string') {
        writeJson(res, 400, { error: 'thread_id must be a string' });
        return;
      }
      const trimmed = parsed.thread_id.trim();
      if (trimmed.length > 200) {
        writeJson(res, 400, { error: 'thread_id too long (max 200 chars)' });
        return;
      }
      threadId = trimmed.length > 0 ? trimmed : null;
    }

    // parent_message: optional seed for brand-new per-thread sessions.
    // See InboundEvent.parentMessage in src/channels/adapter.ts.
    let parentMessage: InboundEvent['parentMessage'] | undefined;
    if (parsed.parent_message !== undefined && parsed.parent_message !== null) {
      if (typeof parsed.parent_message !== 'object' || Array.isArray(parsed.parent_message)) {
        writeJson(res, 400, { error: 'parent_message must be an object' });
        return;
      }
      const pm = parsed.parent_message as Record<string, unknown>;
      const pmContent = typeof pm.content === 'string' ? pm.content : '';
      if (!pmContent) {
        writeJson(res, 400, { error: 'parent_message.content required' });
        return;
      }
      const MAX_PARENT = 32 * 1024; // 32 KB — comfortably larger than any single chat turn
      if (pmContent.length > MAX_PARENT) {
        writeJson(res, 400, { error: `parent_message.content too long (max ${MAX_PARENT} chars)` });
        return;
      }
      const pmTs = typeof pm.timestamp === 'string' ? pm.timestamp : undefined;
      const pmSender = typeof pm.sender === 'string' ? pm.sender : undefined;
      const pmDir = pm.direction === 'outgoing' || pm.direction === 'incoming' ? pm.direction : undefined;
      parentMessage = {
        content: pmContent,
        ...(pmTs ? { timestamp: pmTs } : {}),
        ...(pmSender ? { sender: pmSender } : {}),
        ...(pmDir ? { direction: pmDir } : {}),
      };
    }

    if (!isAdapterReady()) {
      writeJson(res, 503, { error: 'Dashboard channel adapter not ready' });
      return;
    }

    try {
      await routeInboundFn({
        channelType: 'dashboard',
        platformId: `dashboard:${group}`,
        threadId,
        message: {
          id: generateMessageId(),
          kind: 'chat',
          content: JSON.stringify({ text: content, sender: 'dashboard-admin', senderId: 'dashboard-admin' }),
          timestamp: new Date().toISOString(),
        },
        ...(parentMessage ? { parentMessage } : {}),
      });
      writeJson(res, 200, { ok: true });
    } catch (err) {
      log.error('Failed to route dashboard inbound message', { group, err });
      writeJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
    }
  });

  server.listen(port, host, () => {
    log.info('Dashboard ingress listening', { host, port });
  });

  return {
    server,
    stop() {
      return new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    },
  };
}
