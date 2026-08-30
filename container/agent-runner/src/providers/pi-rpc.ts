/**
 * pi RPC-mode transport primitives.
 *
 * Communicates with `pi --mode rpc` over stdio using strict JSONL (one JSON
 * object per line, LF-delimited). This module is just the plumbing — spawn the
 * process, send commands, correlate responses by `id`, dispatch events, and
 * surface process death. Higher-level semantics (session start/resume, turn
 * pumping, event translation) live in pi.ts.
 *
 * Kept separate so the transport can be unit-tested without pulling in the
 * full provider, mirroring codex-app-server.ts.
 */
import fs from 'fs';
import { spawn, type ChildProcess } from 'child_process';

function log(msg: string): void {
  console.error(`[pi-rpc] ${msg}`);
}

/** True only for an existing regular file (a resumable pi transcript). */
function sessionFileUsable(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

const INIT_TIMEOUT_MS = 30_000;

/**
 * Errors from `switch_session` that mean the stored session path is unusable —
 * the JSONL transcript was pruned, the container was wiped, or the id is from a
 * different pi version. Only these trigger a silent fall-back to a fresh
 * session; anything else bubbles up. Scoped to session/transcript wording (not
 * a bare `ENOENT`) so an unrelated file error can't erase a valid continuation.
 * Shared with pi.ts's `isSessionInvalid`.
 */
export const STALE_SESSION_RE =
  /session\s+not\s+found|no\s+such\s+session|unknown\s+session|invalid\s+session|cannot\s+(?:open|read)\s+session|ENOENT[^\n]*(?:session|\.jsonl)|(?:session|\.jsonl)[^\n]*ENOENT/i;

// ── JSONL message types ──────────────────────────────────────────────────────

let nextRequestId = 1;

/** A command reply, echoing the request `id` and `command`. */
export interface PiResponse {
  type: 'response';
  id?: string;
  command?: string;
  success: boolean;
  error?: string;
  data?: Record<string, unknown>;
}

/** Any streamed event line (agent_start, message_update, agent_settled, …). */
export interface PiEvent {
  type: string;
  [key: string]: unknown;
}

function isResponse(msg: PiResponse | PiEvent): msg is PiResponse {
  return msg.type === 'response';
}

// ── Server handle ────────────────────────────────────────────────────────────

export interface PiRpcServer {
  process: ChildProcess;
  pending: Map<string, { resolve: (r: PiResponse) => void; reject: (e: Error) => void }>;
  eventHandlers: ((e: PiEvent) => void)[];
  /** Fired once when the process dies or stdin errors, so in-flight turns wake. */
  terminalHandlers: ((e: Error) => void)[];
  terminalError: Error | null;
}

export interface SpawnPiOptions {
  /** Directory pi persists session JSONL transcripts to. */
  sessionDir: string;
  /** Working directory for pi's file/shell tools (the agent workspace). */
  cwd: string;
  /** Extra env (merged over process.env) — config dir, API-key stub, etc. */
  env?: Record<string, string | undefined>;
}

function markTerminal(server: PiRpcServer, err: Error): void {
  if (server.terminalError) return;
  server.terminalError = err;
  for (const [, handler] of server.pending) handler.reject(err);
  server.pending.clear();
  for (const h of server.terminalHandlers) {
    try {
      h(err);
    } catch {
      /* ignore */
    }
  }
}

export function spawnPiRpc(opts: SpawnPiOptions): PiRpcServer {
  const args = ['--mode', 'rpc', '--session-dir', opts.sessionDir];

  log(`Spawning: pi ${args.join(' ')} (cwd=${opts.cwd})`);
  const proc = spawn('pi', args, {
    cwd: opts.cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, ...opts.env },
  });

  const server: PiRpcServer = {
    process: proc,
    pending: new Map(),
    eventHandlers: [],
    terminalHandlers: [],
    terminalError: null,
  };

  proc.stderr?.on('data', (chunk: Buffer) => {
    const text = chunk.toString().trim();
    if (text) log(`[stderr] ${text}`);
  });

  // A stdin stream 'error' (e.g. EPIPE after the child dies) is emitted on the
  // stream itself; without a listener Node throws and crashes the runner. The
  // per-write callback also calls markTerminal, but this covers async EPIPEs
  // that arrive with no write in flight.
  proc.stdin?.on('error', (err: Error) => markTerminal(server, err));

  // Strict JSONL: buffer decoded stdout and split ONLY on `\n`. pi's docs warn
  // against generic line readers (Node `readline`) because they also break on
  // U+2028/U+2029, which appear inside valid JSON string payloads and would
  // corrupt framing — dropping message_end / agent_settled and hanging a turn.
  let buf = '';
  proc.stdout?.setEncoding('utf8');
  proc.stdout?.on('data', (chunk: string) => {
    buf += chunk;
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).replace(/\r$/, '');
      buf = buf.slice(nl + 1);
      if (!line.trim()) continue;
      let msg: PiResponse | PiEvent;
      try {
        msg = JSON.parse(line);
      } catch {
        log(`[parse-error] ${line.slice(0, 200)}`);
        continue;
      }
      if (isResponse(msg)) {
        const key = msg.id;
        if (key != null && server.pending.has(key)) {
          const handler = server.pending.get(key)!;
          server.pending.delete(key);
          handler.resolve(msg);
        }
        // Responses without a tracked id are informational — ignore.
      } else {
        for (const h of server.eventHandlers) h(msg);
      }
    }
  });

  proc.on('error', (err) => {
    log(`[process-error] ${err.message}`);
    markTerminal(server, err);
  });

  proc.on('exit', (code, signal) => {
    log(`[exit] code=${code} signal=${signal}`);
    markTerminal(server, new Error(`pi rpc exited: code=${code} signal=${signal}`));
  });

  return server;
}

/**
 * Send a command and await its `{type:'response'}` reply, correlated by an
 * auto-assigned `id`. Rejects immediately if the process has already died.
 */
export function sendPiCommand(
  server: PiRpcServer,
  command: Record<string, unknown>,
  timeoutMs = 60_000,
): Promise<PiResponse> {
  if (server.terminalError) return Promise.reject(server.terminalError);

  const id = `req-${nextRequestId++}`;
  const line = JSON.stringify({ id, ...command }) + '\n';

  return new Promise<PiResponse>((resolve, reject) => {
    const timer = setTimeout(() => {
      server.pending.delete(id);
      reject(new Error(`Timeout waiting for ${command.type} response (${timeoutMs}ms)`));
    }, timeoutMs);

    server.pending.set(id, {
      resolve: (r) => {
        clearTimeout(timer);
        resolve(r);
      },
      reject: (e) => {
        clearTimeout(timer);
        reject(e);
      },
    });

    const stdin = server.process.stdin;
    if (!stdin) {
      clearTimeout(timer);
      server.pending.delete(id);
      reject(new Error('pi rpc stdin unavailable'));
      return;
    }
    stdin.write(line, (err) => {
      if (err) {
        clearTimeout(timer);
        server.pending.delete(id);
        markTerminal(server, err);
        reject(err);
      }
    });
  });
}

export function killPiRpc(server: PiRpcServer): void {
  try {
    server.process.kill('SIGTERM');
  } catch {
    /* ignore */
  }
}

// ── High-level helpers ───────────────────────────────────────────────────────

/**
 * Start or resume a pi session. If `sessionPath` is provided, attempts
 * `switch_session` and falls back to a fresh `new_session` on a recognized
 * stale-session error. Returns the active session file path (the resume token)
 * read back from `get_state`, or undefined if pi didn't surface one.
 */
export async function startOrResumePiSession(
  server: PiRpcServer,
  sessionPath: string | undefined,
): Promise<string | undefined> {
  let resumed = false;
  if (sessionPath) {
    // pi 0.84.3 accepts a missing .jsonl path in switch_session (returns
    // success and echoes it back from get_state), so a deleted transcript would
    // silently lose history and STALE_SESSION_RE would never fire. Guard by
    // checking the file exists before attempting resume.
    if (!sessionFileUsable(sessionPath)) {
      log(`Session file missing (${sessionPath}); starting fresh.`);
    } else {
      log(`Resuming session: ${sessionPath}`);
      const resp = await sendPiCommand(server, { type: 'switch_session', sessionPath }, INIT_TIMEOUT_MS);
      if (resp.success) {
        resumed = true;
        log('Session resumed');
      } else if (STALE_SESSION_RE.test(resp.error || '')) {
        log(`Stale session ${sessionPath}; starting fresh.`);
      } else {
        throw new Error(`switch_session failed: ${resp.error}`);
      }
    }
  }

  if (!resumed) {
    log('Starting new session…');
    const resp = await sendPiCommand(server, { type: 'new_session' }, INIT_TIMEOUT_MS);
    if (!resp.success) throw new Error(`new_session failed: ${resp.error}`);
  }

  const state = await sendPiCommand(server, { type: 'get_state' }, INIT_TIMEOUT_MS);
  if (!state.success) {
    log(`get_state failed (continuation not tracked this turn): ${state.error}`);
    return undefined;
  }
  const file = state.data?.sessionFile;
  return typeof file === 'string' && file.length > 0 ? file : undefined;
}

/** Apply model / provider / thinking-level to the active session. Best-effort. */
export async function applyPiModel(
  server: PiRpcServer,
  opts: { provider?: string; model?: string; thinkingLevel?: string },
): Promise<void> {
  if (opts.model) {
    const resp = await sendPiCommand(server, {
      type: 'set_model',
      provider: opts.provider || 'anthropic',
      modelId: opts.model,
    });
    if (!resp.success) log(`set_model failed (continuing with default): ${resp.error}`);
  }
  if (opts.thinkingLevel) {
    const resp = await sendPiCommand(server, { type: 'set_thinking_level', level: opts.thinkingLevel });
    if (!resp.success) log(`set_thinking_level failed (continuing): ${resp.error}`);
  }
}
