/**
 * Operator checks: the facts an operator used to read over SSH, gathered for
 * the dashboard.
 *
 * Per coworker (`GET /api/coworkers/:folder/checks`, the Checks section of the
 * Coworkers detail): the gate hooks its next container runs, the overlays that
 * opt it into gates, the state of its current task, and its hook events in the
 * last hour. For the fleet (`GET /api/checks`, Admin › Checks): model-policy
 * problems, the OneCLI secret mode of each group, input-gate decisions and the
 * models the cost feed cannot price. For Infra
 * (`GET /api/infrastructure/mcp-handshake`): how long an MCP `initialize`
 * takes on each local MCP server.
 *
 * Consider a Codex group whose image carries a plan gate. Its hooks do not live
 * in the group's settings.json, which only Claude, OpenCode and Pi read; Codex
 * runs the managed hook file baked into the image (container/codex-hooks.toml).
 * So the per-coworker check names its source: `settings` or `codex-image`.
 *
 * The parsers here are pure, so the tests feed them the shapes that the files,
 * tables and services return.
 */

export interface HookEntry {
  event: string;
  /** Tool matcher, or null when the hook runs for every tool. */
  matcher: string | null;
  /** Script file name, such as `gate-plan.sh`. */
  script: string;
}

const HOOK_RUNNERS = new Set(['bash', 'sh', 'bun', 'node', 'python3', 'tsx', 'npx']);

/**
 * Return the file name of the script a hook command runs. Environment
 * assignments and the interpreter are skipped:
 * `OVERLAY_HAS_PLAN=1 bash /app/hooks/gate-plan.sh` → `gate-plan.sh`, and
 * `bun /app/src/issue-close-hook.ts` → `issue-close-hook.ts`.
 */
export function hookScriptName(command: string): string {
  const words = command
    .trim()
    .split(/\s+/)
    .filter((w) => w && !/^[A-Za-z_][A-Za-z0-9_]*=/.test(w));
  const target = words.find((w) => !HOOK_RUNNERS.has(w)) ?? '';
  return target.split('/').pop() || target;
}

/** Return every command hook in a Claude-format settings.json, one entry per command. */
export function settingsHookEntries(settings: unknown): HookEntry[] {
  const hooks = (settings as { hooks?: unknown } | null)?.hooks;
  if (!hooks || typeof hooks !== 'object') return [];
  const out: HookEntry[] = [];
  for (const [event, groups] of Object.entries(hooks as Record<string, unknown>)) {
    if (!Array.isArray(groups)) continue;
    for (const group of groups as Array<{ matcher?: unknown; hooks?: unknown }>) {
      const matcher = typeof group?.matcher === 'string' && group.matcher ? group.matcher : null;
      const commands = Array.isArray(group?.hooks) ? (group.hooks as Array<{ command?: unknown }>) : [];
      for (const h of commands) {
        if (typeof h?.command === 'string') out.push({ event, matcher, script: hookScriptName(h.command) });
      }
    }
  }
  return out;
}

/**
 * Return every command hook in a Codex hook file (TOML). Each `[[hooks.<Event>]]`
 * table starts an entry; its `matcher` and the `command` of its nested
 * `[[hooks.<Event>.hooks]]` table complete it. Any other table ends the hooks.
 */
export function codexHookEntries(toml: string): HookEntry[] {
  const out: HookEntry[] = [];
  let event: string | null = null;
  let matcher: string | null = null;
  for (const raw of toml.split('\n')) {
    const line = raw.trim();
    const table = line.match(/^\[\[hooks\.([A-Za-z]+)\]\]$/);
    if (table) {
      event = table[1];
      matcher = null;
      continue;
    }
    if (line.startsWith('[[hooks.')) continue;
    if (line.startsWith('[')) {
      event = null;
      continue;
    }
    if (!event) continue;
    const m = line.match(/^matcher\s*=\s*"([^"]*)"/);
    if (m) {
      matcher = m[1] || null;
      continue;
    }
    const c = line.match(/^command\s*=\s*"([^"]*)"/);
    if (c) out.push({ event, matcher, script: hookScriptName(c[1]) });
  }
  return out;
}

/** Return the overlay names opted in by marker files: `.overlay-plan-gate` → `plan-gate`. */
export function overlayMarkers(fileNames: readonly string[]): string[] {
  return fileNames
    .filter((n) => n.startsWith('.overlay-') && n.length > '.overlay-'.length)
    .map((n) => n.slice('.overlay-'.length))
    .sort();
}

export interface WorkflowSummary {
  taskId: string | null;
  planWritten: boolean;
  planPath: string | null;
  critiqueRounds: number;
  editsSincePlan: number;
  startedAt: string | null;
}

/** Return the fields an operator reads from a group's workflow-state.json, or null when there is none. */
export function workflowSummary(state: unknown): WorkflowSummary | null {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return null;
  const s = state as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return {
    taskId: str(s.task_id),
    planWritten: s.plan_written === true,
    planPath: str(s.plan_path),
    critiqueRounds: num(s.critique_rounds),
    editsSincePlan: num(s.edits_since_plan),
    startedAt: str(s.started_at),
  };
}

export interface GroupChecks {
  folder: string;
  provider: string;
  /** Where `hooks` comes from: the group's settings.json, or the Codex hook file baked into the image. */
  hookSource: 'settings' | 'codex-image';
  hooks: HookEntry[];
  overlays: string[];
  workflow: WorkflowSummary | null;
  /** Hook events recorded for the group in the last hour, by event name. */
  hookEventsLastHour: Record<string, number>;
}

export interface SecretModeRow {
  groupId: string;
  folder: string;
  /** OneCLI's `secretMode` ("all" or "selective"), or "missing" when OneCLI has no agent for the group. */
  mode: string;
}

/**
 * Return the OneCLI secret mode of each group. OneCLI names an agent by the
 * group id (`identifier`). Only the mode leaves this function: an agent row
 * also carries its access token.
 */
export function secretModes(
  agents: ReadonlyArray<Record<string, unknown>>,
  groups: ReadonlyArray<{ id: string; folder: string }>,
): SecretModeRow[] {
  const byId = new Map<string, string>();
  for (const a of agents) {
    if (typeof a.identifier === 'string') byId.set(a.identifier, typeof a.secretMode === 'string' ? a.secretMode : '');
  }
  return groups
    .map((g) => ({ groupId: g.id, folder: g.folder, mode: byId.get(g.id) || 'missing' }))
    .sort((a, b) => a.folder.localeCompare(b.folder));
}

export interface McpHandshake {
  name: string;
  port: number;
  /** Milliseconds from the request to the end of the `initialize` response, or null when it failed. */
  ms: number | null;
  ok: boolean;
  error?: string;
}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/**
 * Time one MCP `initialize` on a local server, then end the session it opened.
 * The session matters: a stateful gateway starts a server process per session,
 * and that start is what made slang-mcp take 31 s when it waited for Discord.
 */
export async function mcpHandshake(
  name: string,
  port: number,
  opts: { fetchImpl?: FetchLike; timeoutMs?: number; now?: () => number } = {},
): Promise<McpHandshake> {
  const doFetch = opts.fetchImpl ?? (fetch as FetchLike);
  const now = opts.now ?? (() => performance.now());
  const url = `http://127.0.0.1:${port}/mcp`;
  const started = now();
  try {
    const res = await doFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'nanoclaw-dashboard-check', version: '1' },
        },
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 10_000),
    });
    const body = await res.text();
    const ms = Math.round(now() - started);
    const session = res.headers.get('mcp-session-id');
    if (session) {
      await doFetch(url, {
        method: 'DELETE',
        headers: { 'Mcp-Session-Id': session },
        signal: AbortSignal.timeout(2_000),
      }).catch(() => undefined);
    }
    if (!res.ok) return { name, port, ms, ok: false, error: `HTTP ${res.status}` };
    if (!body.includes('"result"')) return { name, port, ms, ok: false, error: 'no initialize result' };
    return { name, port, ms, ok: true };
  } catch (err) {
    const timedOut = (err as Error)?.name === 'TimeoutError';
    return { name, port, ms: null, ok: false, error: timedOut ? 'timed out' : String((err as Error)?.message || err) };
  }
}
