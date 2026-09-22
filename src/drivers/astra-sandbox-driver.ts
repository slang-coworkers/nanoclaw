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
import { GROUP_FOLDER_LABEL } from './types.js';

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
  // Re-entrancy guard. setInterval fires every FERRY_INTERVAL_MS regardless of
  // whether the previous tick finished, but a tick's k8s-exec /inject takes
  // seconds — so overlapping ticks all read the same stale `lastForwarded` and
  // re-inject the same inbound message N times (observed: one "Helo" injected 15×,
  // the agent answering the flood). Serialize: skip a tick while one is in flight.
  private ticking = false;

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
    if (this.ticking) return; // a prior tick's /inject is still in flight — don't overlap
    this.ticking = true;
    try {
      await this.tickOnce();
    } finally {
      this.ticking = false;
    }
  }

  private async tickOnce(): Promise<void> {
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
    // Forward each NEW inbound row exactly once. /inject appends the message and
    // BLOCKS until the agent's turn quiesces, returning that turn's reply rows; the
    // re-entrancy guard on tick() guarantees these never overlap (concurrent injects
    // re-sent the same message N times — the flood). Advance lastForwarded per row.
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
          // STABLE id keyed on the pod's own outbound seq — no Date.now(). A pod
          // reply that gets re-read (the ferry re-injects/re-reads on retries) is
          // the same row, so INSERT OR IGNORE dedupes it and the host delivers it
          // exactly once. A Date.now() suffix made every re-read a "new" row →
          // the same reply was delivered N times.
          id: `astra-out-${r.seq}`,
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
    // Session DBs live under v2-sessions/<agentGroupId>/<sessionId>/ — the host
    // session-manager's layout, the same subtree admission pins group-state to.
    // The earlier v2-sessions/<sessionId>/ dropped the group segment, so
    // inboundPath never existed (empty upload → the pod runner died "unable to
    // open database file") and outboundPath pointed at a file the host delivery
    // never polls (a reply would never be delivered).
    const sessionDir = path.join(this.policy.dataRoot, 'v2-sessions', agentGroupId, sessionId);
    const inboundPath = path.join(sessionDir, 'inbound.db');
    const outboundPath = path.join(sessionDir, 'outbound.db');
    const agent = spec.containers.find((c) => c.role === 'agent') ?? spec.containers[0];

    // The group folder is named by agentGroup.folder (stamped as GROUP_FOLDER_LABEL),
    // NOT the agentGroupId. Reading groupsRoot/<agentGroupId> found nothing, so the
    // pod started with no CLAUDE.md/container.json ("using defaults").
    const groupFolder = spec.labels[GROUP_FOLDER_LABEL] ?? agentGroupId;
    const groupDir = path.join(this.policy.groupsRoot, groupFolder);
    const files: Record<string, string> = {};
    for (const [dst, src] of [
      ['/workspace/agent/CLAUDE.md', path.join(groupDir, 'CLAUDE.md')],
      ['/workspace/agent/container.json', path.join(groupDir, 'container.json')],
    ] as const) {
      if (fs.existsSync(src)) files[dst] = fs.readFileSync(src, 'utf8');
    }
    // Seed BOTH session DBs. The host session-manager creates each with its full
    // schema before the container starts; the container never runs migrations, it
    // just opens them. inbound.db carries the message; outbound.db must arrive with
    // its tables (messages_out, processing_ack, session_state, container_state) or
    // the runner dies "no such table: processing_ack" on its first ack write —
    // before producing any reply. The agent then writes its outbound rows into this
    // seeded pod copy; the ferry reads them back (read-outbound.ts) and mirrors them
    // into the host outbound.db that delivery polls.
    const upload: Array<[string, string]> = [];
    if (fs.existsSync(inboundPath)) {
      upload.push(['/workspace/inbound.db', fs.readFileSync(inboundPath).toString('base64')]);
    }
    if (fs.existsSync(outboundPath)) {
      upload.push(['/workspace/outbound.db', fs.readFileSync(outboundPath).toString('base64')]);
    }

    const claimEnv: Record<string, string> = {
      SESSION_INBOUND_DB_PATH: '/workspace/inbound.db',
      SESSION_OUTBOUND_DB_PATH: '/workspace/outbound.db',
      WORKSPACE_AGENT: '/workspace/agent',
      ...(agent?.env ?? {}),
      // The Astra sandbox pod runs readOnlyRootFilesystem:true — only /workspace
      // and /tmp are writable emptyDir mounts. nanoclaw's container-runner sets
      // HOME=/home/node for the Docker path (the agent image chmods it 777), but
      // /home/node is on the immutable rootfs here, so the Claude SDK's first act
      // — mkdir ~/.claude — dies EROFS before any model call. Point HOME at the
      // writable session scratch so ~/.claude et al. land under /workspace.
      HOME: '/workspace',
      // DIRECT MODE (no OneCLI on Astra): the agent's Claude SDK authenticates
      // straight to ANTHROPIC_BASE_URL with a real bearer. The `env` lane above
      // carries ANTHROPIC_BASE_URL + ANTHROPIC_MODEL (forkContainerEnv), but the
      // token is a credential-NAMED (_TOKEN) key the spec's `env` lane forbids,
      // and the claude provider otherwise emits only the OneCLI sentinel
      // (ROUTED_VIA_ONECLI_PROXY) on the dropped `contributedEnv` lane. With no
      // proxy on Astra that sentinel would 401, so forward the router's own real
      // token (Vault → router pod env) into the pod. Guarded on a non-sentinel
      // value so an eventual OneCLI-on-Astra deploy — where the router holds no
      // raw token — is unaffected.
      ...(process.env.ANTHROPIC_AUTH_TOKEN && process.env.ANTHROPIC_AUTH_TOKEN !== 'ROUTED_VIA_ONECLI_PROXY'
        ? { ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN }
        : {}),
    };
    // claude-trace is a HOST-only wrapper: the Docker realization mounts it at
    // /opt/claude-trace and points CLAUDE_CODE_EXECUTABLE at it. The sandbox pod
    // runs the plain agent image — the NATIVE claude binary is baked in, and there
    // is no claude-trace — so the router's trace-exec override makes every SDK query
    // fail "Claude Code native binary not found at /opt/claude-trace/...". Drop it so
    // the SDK falls back to the baked binary.
    delete claimEnv.CLAUDE_CODE_EXECUTABLE;
    delete claimEnv.CLAUDE_TRACE_DIR;

    const claimed = await cdk('/claim', {
      session_id: sessionId,
      image: agent?.image,
      env: claimEnv,
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
