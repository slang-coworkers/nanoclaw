/**
 * astra-sandbox SessionDriver — runs each session as a claimed Astra sandbox POD
 * (image #1, router side). The A1 "ferry" model: the host writes/reads the
 * session's LOCAL two DBs as usual; this driver ferries them to the pod over the
 * local cdk sidecar (ASTRA_CDK_URL), which drives the pod via the sandbox-k8s
 * SDK's k8s-exec transport — no shared disk, no in-pod HTTP.
 *
 *   prepare(): cdk /claim  → seed CLAUDE.md + container.json + the local inbound.db
 *              into the pod; the pod's wait-for-seed entrypoint then starts the runner.
 *   start()  : ferry loop — tail local inbound.db → cdk /inject → write the pod's
 *              outbound rows into the local outbound.db (host delivery reads it).
 *   stop()   : cdk /release  (Model B: the pod's isolated PVC reaps at its TTL).
 *
 * Selected by NANOCLAW_RUNTIME_DRIVER=astra-sandbox (registered below; the import
 * is appended to `installed.ts`).
 */
import fs from 'fs';
import path from 'path';

import Database from 'better-sqlite3';

import { registerSessionDriver } from './driver-registry.js';
import type {
  DriverCapabilities,
  MountPolicy,
  SessionDriver,
  SessionEvent,
  SessionExecSpec,
  SessionHandle,
  SessionSnapshot,
  SessionSpec,
  SessionStatus,
  SessionWatch,
} from './types.js';

const CDK = process.env.ASTRA_CDK_URL || 'http://127.0.0.1:8899';
const FERRY_INTERVAL_MS = Number(process.env.ASTRA_FERRY_INTERVAL_MS || 750);

async function cdk(pathname: string, body?: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(`${CDK}${pathname}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`cdk ${pathname} -> ${res.status} ${await res.text()}`);
  return (await res.json()) as Record<string, unknown>;
}

interface OutRow {
  seq: number;
  kind: string;
  content: string;
  channel_type: string | null;
  platform_id: string | null;
  thread_id: string | null;
  in_reply_to: string | null;
}

class AstraSandboxHandle implements SessionHandle {
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastForwarded = 0;

  constructor(
    readonly key: SessionSpec['key'],
    readonly name: string,
    private readonly inboundPath: string,
    private readonly outboundPath: string,
  ) {}

  async start(): Promise<void> {
    this.timer = setInterval(
      () => void this.tick().catch((e) => console.error('[astra-sandbox ferry]', e)),
      FERRY_INTERVAL_MS,
    );
  }

  async status(): Promise<SessionStatus> {
    try {
      const s = await cdk(`/status?name=${encodeURIComponent(this.name)}`);
      const phase = String((s.phase as Record<string, unknown> | undefined)?.phase ?? s.phase ?? '');
      if (phase === 'Running') return { phase: 'running' };
      if (phase === 'Pending') return { phase: 'preparing' };
      if (phase === 'Succeeded') return { phase: 'stopped' };
      if (phase === 'Failed') return { phase: 'failed', failure: { kind: 'started-then-died', retryable: false } };
      return { phase: 'ready' };
    } catch {
      return { phase: 'failed', failure: { kind: 'runtime-unavailable', retryable: true } };
    }
  }

  async stop(_reason: string): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await cdk('/release', { name: this.name }).catch((e) => console.error('[astra-sandbox release]', e));
  }

  execSpec(command: string[]): SessionExecSpec {
    // Interactive attach = kubectl exec into the claimed pod (best-effort; not the
    // message path). `name` is the sandbox/pod name from the claim.
    const base = ['exec', '-n', process.env.ASTRA_SANDBOX_NAMESPACE || 'default', this.name, '--'];
    return {
      bin: 'kubectl',
      argsTty: [...base.slice(0, -1), '-it', '--', ...command],
      argsPlain: [...base, ...command],
    };
  }

  private async tick(): Promise<void> {
    if (!fs.existsSync(this.inboundPath)) return;
    const inDb = new Database(this.inboundPath, { readonly: true });
    let rows: Array<{
      seq: number;
      kind: string;
      content: string;
      channel_type: string | null;
      platform_id: string | null;
      thread_id: string | null;
    }> = [];
    try {
      rows = inDb
        .prepare(
          'SELECT seq, kind, content, channel_type, platform_id, thread_id FROM messages_in WHERE seq > ? ORDER BY seq',
        )
        .all(this.lastForwarded) as typeof rows;
    } finally {
      inDb.close();
    }
    for (const r of rows) {
      const resp = await cdk('/inject', {
        name: this.name,
        message: {
          content: r.content,
          kind: r.kind,
          channelType: r.channel_type,
          platformId: r.platform_id,
          threadId: r.thread_id,
        },
      });
      this.writeOutboundLocal((resp.rows as OutRow[]) ?? []);
      this.lastForwarded = r.seq;
    }
  }

  /** Write the pod's returned outbound rows into the host's local outbound.db. */
  private writeOutboundLocal(rows: OutRow[]): void {
    if (!rows.length) return;
    const db = new Database(this.outboundPath);
    try {
      db.pragma('journal_mode = DELETE');
      db.exec(`CREATE TABLE IF NOT EXISTS messages_out (
        id TEXT PRIMARY KEY, seq INTEGER UNIQUE, in_reply_to TEXT, timestamp TEXT NOT NULL,
        deliver_after TEXT, recurrence TEXT, kind TEXT NOT NULL, platform_id TEXT,
        channel_type TEXT, thread_id TEXT, content TEXT NOT NULL);`);
      const ins = db.prepare(
        `INSERT OR IGNORE INTO messages_out (id, seq, in_reply_to, timestamp, kind, platform_id, channel_type, thread_id, content)
         VALUES (@id, @seq, @in_reply_to, @ts, @kind, @platform_id, @channel_type, @thread_id, @content)`,
      );
      for (const r of rows) {
        const m = (db.prepare('SELECT COALESCE(MAX(seq),0) AS m FROM messages_out').get() as { m: number }).m;
        const seq = m < 1 ? 1 : m + (m % 2 === 0 ? 1 : 2); // container writes ODD seq
        ins.run({
          id: `astra-out-${r.seq}-${Date.now()}`,
          seq,
          in_reply_to: r.in_reply_to ?? null,
          ts: new Date().toISOString(),
          kind: r.kind ?? 'chat',
          platform_id: r.platform_id ?? null,
          channel_type: r.channel_type ?? null,
          thread_id: r.thread_id ?? null,
          content: r.content ?? '',
        });
      }
    } finally {
      db.close();
    }
  }
}

class AstraSandboxDriver implements SessionDriver {
  readonly kind = 'astra-sandbox';
  constructor(private readonly policy: MountPolicy) {}

  capabilities(): DriverCapabilities {
    return {
      isolationTiers: ['vm'], // Kata by default
      admissionEnforced: true,
      networkPolicy: 'declarative',
      encryptedVolumes: false,
      unrealized: [],
      sharedNetworkNamespace: false,
      auxiliaryContainers: false,
      imageBuild: false,
    };
  }

  async ensureReady(): Promise<void> {
    await cdk('/status?name=__ping__'); // throws if the cdk sidecar is down
  }

  async prepare(spec: SessionSpec): Promise<SessionHandle> {
    const { sessionId, agentGroupId } = spec.key;
    const sessionDir = path.join(this.policy.dataRoot, 'v2-sessions', sessionId);
    const inboundPath = path.join(sessionDir, 'inbound.db');
    const outboundPath = path.join(sessionDir, 'outbound.db');
    const agent = spec.containers.find((c) => c.role === 'agent') ?? spec.containers[0];

    const groupDir = path.join(this.policy.groupsRoot, agentGroupId);
    const files: Record<string, string> = {};
    for (const [dst, src] of [
      ['/workspace/agent/CLAUDE.md', path.join(groupDir, 'CLAUDE.md')],
      ['/workspace/agent/container.json', path.join(groupDir, 'container.json')],
    ] as const) {
      if (fs.existsSync(src)) files[dst] = fs.readFileSync(src, 'utf8');
    }
    const upload: Array<[string, string]> = fs.existsSync(inboundPath)
      ? [['/workspace/inbound.db', fs.readFileSync(inboundPath).toString('base64')]]
      : [];

    const claimed = await cdk('/claim', {
      session_id: sessionId,
      image: agent?.image,
      env: {
        SESSION_INBOUND_DB_PATH: '/workspace/inbound.db',
        SESSION_OUTBOUND_DB_PATH: '/workspace/outbound.db',
        WORKSPACE_AGENT: '/workspace/agent',
        ...(agent?.env ?? {}),
      },
      files,
      upload,
    });
    return new AstraSandboxHandle(spec.key, String(claimed.name ?? sessionId), inboundPath, outboundPath);
  }

  async listSessions(_installSlug: string): Promise<SessionSnapshot[]> {
    return []; // TODO: cdk-listed sandbox pods -> SessionSnapshot[] (adoption/reaping)
  }

  watchSessions(_installSlug: string, _onEvent: (e: SessionEvent) => void): SessionWatch {
    return { stop() {} }; // TODO: cdk watch -> terminal SessionEvents
  }
}

registerSessionDriver('astra-sandbox', (policy: MountPolicy) => new AstraSandboxDriver(policy));
