/**
 * NanoClaw Dashboard Server
 *
 * Four-tab dashboard:
 *   Tab 1: Pixel Art Office — real-time interactive coworker visualization
 *   Tab 2: Coworkers — manage coworker agents, containers, files
 *   Tab 3: Timeline — all-time metrics, task history, analytics
 *   Tab 4: Admin — config, debug, infrastructure, logs, skills, chat
 *
 * Reads NanoClaw state read-only (SQLite + IPC files + coworker-types.json).
 * Receives real-time hook events via POST /api/hook-event.
 */

import { createServer } from 'http';
import { createHash } from 'crypto';
import { exec, execSync } from 'child_process';
import { readFileSync, readdirSync, existsSync, statSync, writeFileSync, unlinkSync, mkdirSync, rmSync, copyFileSync } from 'fs';
import { join, resolve, relative, isAbsolute, extname } from 'path';
import Database from 'better-sqlite3';

/**
 * Check if `target` is inside (or equal to) `baseDir`.
 * Uses path.relative to avoid the startsWith('/foo/bar') vs '/foo/bar-evil' bug.
 * Mirrors ensureWithinBase() from src/group-folder.ts.
 */
/** Safe decodeURIComponent — returns null on malformed input instead of throwing. */
function safeDecode(s: string): string | null {
  try {
    return decodeURIComponent(s);
  } catch {
    return null;
  }
}

function isInsideDir(baseDir: string, target: string): boolean {
  const rel = relative(resolve(baseDir), resolve(target));
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

const PROJECT_ROOT = resolve(import.meta.dirname, '..');
const PUBLIC_DIR = resolve(import.meta.dirname, 'public');
const DB_PATH = join(PROJECT_ROOT, 'store', 'messages.db');
const GROUPS_DIR = join(PROJECT_ROOT, 'groups');
const DATA_DIR = join(PROJECT_ROOT, 'data');
const SKILLS_DIR = join(PROJECT_ROOT, 'container', 'skills');
const CHANNELS_DIR = join(PROJECT_ROOT, 'src', 'channels');
const LOGS_DIR = join(PROJECT_ROOT, 'logs');
const COWORKER_TYPES_PATH = join(GROUPS_DIR, 'coworker-types.json');
const PORT = parseInt(process.env.DASHBOARD_PORT || '3737', 10);
const DASHBOARD_HOST = process.env.DASHBOARD_HOST || '127.0.0.1'; // localhost-only; set to 0.0.0.0 to expose on all interfaces
const MAX_CONCURRENT_CONTAINERS = Math.max(1, parseInt(process.env.MAX_CONCURRENT_CONTAINERS || '5', 10) || 5);
// DASHBOARD_SECRET is read dynamically so tests can toggle it via process.env

// --- SQLite (read-only) ---

function openDb(): Database.Database | null {
  try {
    return new Database(DB_PATH, { readonly: true, fileMustExist: true });
  } catch {
    console.warn(`[dashboard] Cannot open DB at ${DB_PATH} — running without DB`);
    return null;
  }
}

let db = openDb();

// Persistent write connection (lazy-opened, reused across requests)
let writeDb: Database.Database | null = null;

function getWriteDb(): Database.Database | null {
  if (writeDb) return writeDb;
  try {
    writeDb = new Database(DB_PATH, { fileMustExist: true });
    return writeDb;
  } catch {
    return null;
  }
}

// --- State snapshot ---

interface CoworkerState {
  folder: string;
  name: string;
  type: string;
  description: string;
  status: 'idle' | 'working' | 'error' | 'thinking';
  currentTask: string | null;
  lastActivity: string | null;
  taskCount: number;
  color: string;
  // live hook data
  lastToolUse: string | null;
  lastNotification: string | null;
  hookTimestamp: number | null;
  subagents: SubagentState[];
  isAutoUpdate: boolean;
  allowedMcpTools: string[];
  disallowedMcpTools: string[];
  lastMessageTs: string | null;
}

interface SubagentState {
  agentId: string;
  agentType: string | null;
  phase: 'active' | 'leaving';
  status: 'idle' | 'working' | 'error' | 'thinking';
  lastToolUse: string | null;
  lastNotification: string | null;
  startedAt: number;
  lastActivity: number;
  sessionId: string | null;
  exitAt: number | null;
}

interface DashboardState {
  coworkers: CoworkerState[];
  tasks: any[];
  taskRunLogs: any[];
  registeredGroups: any[];
  hookEvents: HookEvent[];
  timestamp: number;
}

interface HookEvent {
  group: string;
  event: string;
  tool?: string;
  message?: string;
  tool_input?: string;
  tool_response?: string;
  session_id?: string;
  agent_id?: string;
  agent_type?: string;
  tool_use_id?: string;
  transcript_path?: string;
  cwd?: string;
  extra?: Record<string, any>;
  timestamp: number;
}

// Ring buffer for recent hook events (live state)
const hookEvents: HookEvent[] = [];
const MAX_HOOK_EVENTS = 200;

// Hook events DB (write connection, lazy-opened)
let hookEventsDb: Database.Database | null = null;

function getHookEventsDb(): Database.Database | null {
  if (hookEventsDb) return hookEventsDb;
  try {
    const dbPath = join(PROJECT_ROOT, 'store', 'messages.db');
    hookEventsDb = new Database(dbPath, { fileMustExist: true });
    hookEventsDb.pragma('journal_mode = WAL');
    // Schema owned by the dashboard skill — hook_events table is created in main's
    // messages.db because the dashboard needs to correlate events with message history.
    // If this table needs columns added, update here and in dashboard.server.test.ts.
    hookEventsDb.exec(`
      CREATE TABLE IF NOT EXISTS hook_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_folder TEXT NOT NULL,
        event TEXT NOT NULL,
        tool TEXT,
        tool_use_id TEXT,
        message TEXT,
        tool_input TEXT,
        tool_response TEXT,
        session_id TEXT,
        agent_id TEXT,
        agent_type TEXT,
        transcript_path TEXT,
        cwd TEXT,
        extra TEXT,
        timestamp INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_he_group ON hook_events(group_folder);
      CREATE INDEX IF NOT EXISTS idx_he_session ON hook_events(session_id);
      CREATE INDEX IF NOT EXISTS idx_he_tool_use ON hook_events(tool_use_id);
      CREATE INDEX IF NOT EXISTS idx_he_ts ON hook_events(timestamp);
    `);
    return hookEventsDb;
  } catch {
    return null;
  }
}

// Bootstrap ring buffer from DB so timeline has history after restart
function bootstrapHookEvents(): void {
  const db = getHookEventsDb();
  if (!db) return;
  try {
    const rows = db.prepare(
      'SELECT group_folder, event, tool, tool_use_id, message, tool_input, tool_response, session_id, agent_id, agent_type, transcript_path, cwd, extra, timestamp FROM hook_events ORDER BY timestamp DESC LIMIT ?'
    ).all(MAX_HOOK_EVENTS) as any[];
    for (const row of rows.reverse()) {
      const extra = row.extra ? (() => { try { return JSON.parse(row.extra); } catch { return undefined; } })() : undefined;
      hookEvents.push({
        group: row.group_folder,
        event: row.event,
        tool: row.tool || undefined,
        tool_use_id: row.tool_use_id || undefined,
        message: row.message || undefined,
        tool_input: row.tool_input || undefined,
        tool_response: row.tool_response || undefined,
        session_id: row.session_id || undefined,
        agent_id: row.agent_id || undefined,
        agent_type: row.agent_type || undefined,
        transcript_path: row.transcript_path || undefined,
        cwd: row.cwd || undefined,
        extra,
        timestamp: row.timestamp,
      });
    }
  } catch { /* DB not ready yet — buffer stays empty, events will arrive live */ }
}
bootstrapHookEvents();

// Last message timestamp cache (group_folder -> ISO timestamp)
const lastMessageTsCache = new Map<string, string>();

function refreshMessageTimestamps(): void {
  const db = getHookEventsDb();
  if (!db) return;
  try {
    const rows = db.prepare(
      `SELECT rg.folder, MAX(m.timestamp) as last_ts
       FROM messages m
       JOIN registered_groups rg ON m.chat_jid = rg.jid
       GROUP BY rg.folder`
    ).all() as { folder: string; last_ts: string }[];
    for (const row of rows) {
      if (row.last_ts) lastMessageTsCache.set(row.folder, row.last_ts);
    }
  } catch { /* DB not ready */ }
}
refreshMessageTimestamps();
const msgTsTimer = setInterval(refreshMessageTimestamps, 30000);
msgTsTimer.unref?.();

// Live status from hooks (group_folder -> latest state)
const liveHookState = new Map<string, {
  tool?: string;
  notification?: string;
  status: CoworkerState['status'];
  ts: number;
  agentActive: boolean;
}>();
const liveSubagentState = new Map<string, Map<string, SubagentState>>();
const SUBAGENT_STALE_MS = 5 * 60 * 1000;
const SUBAGENT_EXIT_MS = 12 * 1000;
// Groups that have ever sent a hook event — prevents "container running + no hookState" from
// being treated as "working" after hook state expires following a Stop event.
const hookEverSeen = new Set<string>();

// Cached set of running container name prefixes (refreshed async every 5s)
const runningContainers = new Set<string>();

function refreshContainerStatus(): void {
  exec(
    'docker ps --format "{{.Names}}" 2>/dev/null',
    { timeout: 3000 },
    (_err, stdout) => {
      runningContainers.clear();
      if (stdout) {
        for (const name of stdout.trim().split('\n')) {
          if (name) runningContainers.add(name);
        }
      }
    },
  );
}

// Initial refresh + periodic update
refreshContainerStatus();
setInterval(refreshContainerStatus, 5000);

/** Check if a group folder has a running container (from cache). */
function hasRunningContainer(folder: string): boolean {
  return findRunningContainer(folder) !== null;
}

let cachedTypes: { data: Record<string, any>; mtimeMs: number } | null = null;
function getCoworkerTypes(): Record<string, any> {
  try {
    const st = statSync(COWORKER_TYPES_PATH);
    if (cachedTypes && cachedTypes.mtimeMs === st.mtimeMs) return cachedTypes.data;
    const data = JSON.parse(readFileSync(COWORKER_TYPES_PATH, 'utf-8'));
    cachedTypes = { data, mtimeMs: st.mtimeMs };
    return data;
  } catch {
    return {};
  }
}

function findRunningContainer(folder: string): string | null {
  const containerName = folder.replace(/_/g, '-');
  for (const name of runningContainers) {
    if (name.startsWith(`nanoclaw-${containerName}`)) return name;
  }
  return null;
}

/** Load coworker type colors from coworker-types.json. Cached. */
let _typeColors: Record<string, string> | null = null;
function getTypeColors(): Record<string, string> {
  if (_typeColors) return _typeColors;
  _typeColors = {};
  try {
    const types = JSON.parse(readFileSync(COWORKER_TYPES_PATH, 'utf-8'));
    for (const [name, entry] of Object.entries(types) as [string, any][]) {
      if (entry.color) _typeColors[name] = entry.color;
    }
  } catch { /* file missing — no colors */ }
  return _typeColors;
}

/** Full MCP tool inventory — loaded from proxy at startup, refreshed on demand. */
let _mcpAllTools: string[] = [];

async function refreshMcpTools(): Promise<void> {
  try {
    const proxyPort = process.env.MCP_PROXY_PORT || '3100';
    const res = await fetch(`http://127.0.0.1:${proxyPort}/tools`);
    const data = await res.json() as Record<string, string[]>;
    _mcpAllTools = Object.values(data).flat();
  } catch { /* proxy not ready — will retry later */ }
}

// Default MCP tools for base-tier coworkers. Can be overridden per-type via
// allowedMcpTools in coworker-types.json.
const BASE_TIER_TOOLS = [
  'mcp__deepwiki__ask_question',
  'mcp__slang-mcp__github_get_issue',
  'mcp__slang-mcp__github_get_pull_request',
  'mcp__slang-mcp__github_get_pull_request_comments',
  'mcp__slang-mcp__github_get_pull_request_reviews',
];

function resolveAllowedMcpTools(
  dbAllowed: string[] | null,
  coworkerType: string | null,
  isMain: boolean,
  types: Record<string, any>,
): string[] {
  if (dbAllowed && dbAllowed.length > 0) return dbAllowed;
  if (coworkerType && types[coworkerType]?.allowedMcpTools) return types[coworkerType].allowedMcpTools;
  if (isMain) return ['mcp__deepwiki__ask_question'];
  return BASE_TIER_TOOLS;
}

function computeDisallowed(allowed: string[]): string[] {
  const set = new Set(allowed);
  return _mcpAllTools.filter(t => !set.has(t));
}

const READISH_TOOLS = new Set(['Read', 'Grep', 'Glob', 'LS', 'TodoRead', 'NotebookRead']);
const WRITEISH_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'Bash', 'NotebookEdit', 'TodoWrite']);

function classifyToolStatus(tool: string | undefined, fallback: CoworkerState['status'] = 'working'): CoworkerState['status'] {
  if (!tool) return fallback;
  if (READISH_TOOLS.has(tool)) return 'thinking';
  if (WRITEISH_TOOLS.has(tool)) return 'working';
  return fallback;
}

function classifyEventStatus(
  event: Pick<HookEvent, 'event' | 'tool' | 'message'>,
  previous: CoworkerState['status'] = 'working',
): CoworkerState['status'] {
  if (event.event === 'PostToolUseFailure') return 'error';
  if (event.event === 'PreToolUse' || event.event === 'PostToolUse') {
    return classifyToolStatus(event.tool, previous);
  }
  if (event.event === 'Notification') {
    const msg = (event.message || '').toLowerCase();
    if (/(waiting|approval|permission|confirm|blocked|input required)/.test(msg)) return 'thinking';
  }
  if (event.event === 'SessionEnd' || event.event === 'Stop') return 'idle';
  return previous;
}

function getOrCreateGroupSubagents(group: string): Map<string, SubagentState> {
  let groupMap = liveSubagentState.get(group);
  if (!groupMap) {
    groupMap = new Map<string, SubagentState>();
    liveSubagentState.set(group, groupMap);
  }
  return groupMap;
}

function updateLiveSubagentState(event: HookEvent): void {
  if (!event.group || !event.agent_id) return;

  if (event.event === 'SubagentStart') {
    const groupMap = getOrCreateGroupSubagents(event.group);
    const previous = groupMap.get(event.agent_id);
    groupMap.set(event.agent_id, {
      agentId: event.agent_id,
      agentType: event.agent_type || previous?.agentType || null,
      phase: 'active',
      status: classifyEventStatus(event, previous?.status || 'working'),
      lastToolUse: previous?.lastToolUse || null,
      lastNotification: event.message || previous?.lastNotification || null,
      startedAt: previous?.startedAt || event.timestamp,
      lastActivity: event.timestamp,
      sessionId: event.session_id || previous?.sessionId || null,
      exitAt: null,
    });
    return;
  }

  const groupMap = liveSubagentState.get(event.group);
  if (!groupMap || !groupMap.has(event.agent_id)) return;

  if (event.event === 'SubagentStop') {
    const previous = groupMap.get(event.agent_id)!;
    groupMap.set(event.agent_id, {
      ...previous,
      phase: 'leaving',
      status: 'idle',
      lastNotification: event.message || previous.lastNotification || 'Leaving desk',
      lastActivity: event.timestamp,
      exitAt: event.timestamp + SUBAGENT_EXIT_MS,
    });
    return;
  }

  const previous = groupMap.get(event.agent_id)!;
  groupMap.set(event.agent_id, {
    agentId: event.agent_id,
    agentType: event.agent_type || previous.agentType,
    phase: 'active',
    status: classifyEventStatus(event, previous.status),
    lastToolUse: event.tool || previous.lastToolUse,
    lastNotification: event.message || previous.lastNotification,
    startedAt: previous.startedAt,
    lastActivity: event.timestamp,
    sessionId: event.session_id || previous.sessionId,
    exitAt: null,
  });
}

function getState(): DashboardState {
  const types = getCoworkerTypes();
  const coworkers: CoworkerState[] = [];

  // Scan groups/ for spawned instances (slang_* folders)
  try {
    const folders = readdirSync(GROUPS_DIR).filter(
      (f) => statSync(join(GROUPS_DIR, f)).isDirectory() && !f.startsWith('.'),
    );

    // Collect registered group folders for filtering
    const registeredFolders = new Set<string>();
    if (db) {
      try {
        const rows = db.prepare('SELECT folder FROM registered_groups').all() as { folder: string }[];
        for (const r of rows) registeredFolders.add(r.folder);
      } catch { /* ignore */ }
    }

    for (const folder of folders) {
      // Skip non-instance folders: global (shared memory), main (legacy placeholder unless registered)
      if (folder === 'global') continue;
      if (folder === 'main') continue;
      // Skip folders not registered in the DB (deleted coworkers leave stale folders)
      if (registeredFolders.size > 0 && !registeredFolders.has(folder)) continue;

      // Determine coworker type
      let type = 'unknown';
      let description = '';
      let name = folder;
      let isAutoUpdate = false;

      // Check if this is a template folder (matches a type key)
      // but allow it if it's registered as a coworker in the DB
      if (types[folder] && !registeredFolders.has(folder)) {
        continue;
      }

      // Match spawned instances (e.g., slang_ir-generics -> slang-ir type)
      for (const [typeName, typeInfo] of Object.entries(types) as [string, any][]) {
        if (folder.startsWith(typeName.replace(/-/g, '_') + '_') || folder.startsWith(typeName + '_')) {
          type = typeName;
          description = typeInfo.description || '';
          name = folder.replace(/^slang_/, '');
          isAutoUpdate = true;
          break;
        }
      }

      // Resolve type, name, and MCP tools from DB
      let dbAllowedMcp: string[] | null = null;
      let isMainGroup = false;
      if (type === 'unknown' && db) {
        try {
          const row = db.prepare('SELECT name, folder, coworker_type, allowed_mcp_tools, is_main FROM registered_groups WHERE folder = ?').get(folder) as any;
          if (row) {
            name = row.name || folder;
            isMainGroup = !!row.is_main;
            dbAllowedMcp = row.allowed_mcp_tools ? JSON.parse(row.allowed_mcp_tools) : null;
            if (row.coworker_type) {
              type = row.coworker_type;
              if (types[row.coworker_type]) {
                description = (types[row.coworker_type] as any).description || '';
                isAutoUpdate = true;
              } else {
                description = `Custom type (no template)`;
              }
            } else if (row.is_main) {
              type = 'coordinator';
              description = 'Main coordinator — orchestrates all coworkers';
            }
          }
        } catch { /* ignore */ }
      }

      // Skip non-coworker folders
      if (folder === 'global') continue;

      // Determine status from IPC and task state
      let status: CoworkerState['status'] = 'idle';
      let currentTask: string | null = null;
      let lastActivity: string | null = null;
      let taskCount = 0;

      if (db) {
        try {
          // Check for active tasks
          const activeTasks = db
            .prepare("SELECT prompt, last_run FROM scheduled_tasks WHERE group_folder = ? AND status = 'active' ORDER BY next_run LIMIT 1")
            .all(folder) as any[];
          if (activeTasks.length > 0) {
            currentTask = activeTasks[0].prompt;
            // Having a scheduled task doesn't mean working — only a running container does
          }

          // Count total tasks
          const countRow = db
            .prepare('SELECT COUNT(*) as cnt FROM scheduled_tasks WHERE group_folder = ?')
            .get(folder) as any;
          taskCount = countRow?.cnt || 0;

          // Last activity from task run logs
          const lastLog = db
            .prepare('SELECT run_at, status as log_status FROM task_run_logs WHERE task_id IN (SELECT id FROM scheduled_tasks WHERE group_folder = ?) ORDER BY run_at DESC LIMIT 1')
            .get(folder) as any;
          if (lastLog) {
            lastActivity = lastLog.run_at;
            if (lastLog.log_status === 'error') status = 'error';
          }
        } catch { /* ignore query errors */ }
      }

      // Check for active container via IPC input directory
      const inputDir = join(DATA_DIR, 'ipc', folder, 'input');
      if (existsSync(inputDir)) {
        try {
          const files = readdirSync(inputDir);
          if (files.some((f) => f.endsWith('.json'))) {
            status = 'thinking'; // has pending input
          }
        } catch { /* ignore */ }
      }

      // Use agent hook state for real-time status (preferred over container check)
      const hookState = liveHookState.get(folder);
      const containerRunning = hasRunningContainer(folder);
      if (hookState && hookState.agentActive) {
        // Agent is actively processing — use live hook-derived status.
        // No time limit: long-running tools (builds) can take minutes;
        // agentActive is cleared explicitly by Stop/SessionEnd events.
        status = hookState.status || classifyToolStatus(hookState.tool, 'working');
      } else if (status === 'idle' && containerRunning && !hookState && !hookEverSeen.has(folder)) {
        // Container running but never sent any hook events (e.g. agent just started).
        // Once a group has sent hooks, we trust the hook state lifecycle instead.
        status = 'working';
      }

      const subagents = Array.from(liveSubagentState.get(folder)?.values() || [])
        .sort((a, b) => a.startedAt - b.startedAt)
        .map((subagent) => ({ ...subagent }));

      // If subagents are active, parent should show working
      if (status === 'idle' && subagents.length > 0) {
        status = 'working';
      }

      coworkers.push({
        folder,
        name,
        type,
        description,
        status,
        currentTask,
        lastActivity,
        taskCount,
        color: getTypeColors()[type] || '#6B7280',
        lastToolUse: hookState?.tool || null,
        lastNotification: hookState?.notification || null,
        hookTimestamp: hookState?.ts || null,
        subagents,
        isAutoUpdate,
        allowedMcpTools: resolveAllowedMcpTools(dbAllowedMcp, type !== 'unknown' && type !== 'coordinator' ? type : null, isMainGroup, types),
        disallowedMcpTools: [],
        lastMessageTs: lastMessageTsCache.get(folder) || null,
      });
      // Compute disallowed after push (needs allowedMcpTools)
      const last = coworkers[coworkers.length - 1];
      last.disallowedMcpTools = computeDisallowed(last.allowedMcpTools);
    }
  } catch { /* groups dir may not exist */ }

  // Add transient entries for groups that have live hook state but no folder yet
  const knownFolders = new Set(coworkers.map((c) => c.folder));
  for (const [folder, hookState] of liveHookState.entries()) {
    if (knownFolders.has(folder)) continue;
    coworkers.push({
      folder,
      name: folder,
      type: 'unknown',
      description: '',
      status: hookState.status || classifyToolStatus(hookState.tool, 'working'),
      currentTask: null,
      lastActivity: new Date(hookState.ts).toISOString(),
      taskCount: 0,
      color: '#6B7280',
      lastToolUse: hookState.tool || null,
      lastNotification: hookState.notification || null,
      isAutoUpdate: false,
      hookTimestamp: hookState.ts || null,
      subagents: Array.from(liveSubagentState.get(folder)?.values() || []),
      allowedMcpTools: BASE_TIER_TOOLS,
      disallowedMcpTools: computeDisallowed(BASE_TIER_TOOLS),
      lastMessageTs: lastMessageTsCache.get(folder) || null,
    });
  }

  // Get all tasks and run logs
  let tasks: any[] = [];
  let taskRunLogs: any[] = [];
  let registeredGroups: any[] = [];

  if (db) {
    try {
      tasks = db.prepare('SELECT * FROM scheduled_tasks ORDER BY created_at DESC LIMIT 100').all();
      taskRunLogs = db.prepare('SELECT * FROM task_run_logs ORDER BY run_at DESC LIMIT 500').all();
      registeredGroups = db.prepare('SELECT * FROM registered_groups').all();
    } catch { /* ignore */ }
  }

  return {
    coworkers,
    tasks,
    taskRunLogs,
    registeredGroups,
    hookEvents: hookEvents.slice(-MAX_HOOK_EVENTS),
    timestamp: Date.now(),
    maxConcurrentContainers: MAX_CONCURRENT_CONTAINERS,
  };
}

// --- WebSocket (manual, no external dep) ---

function computeAcceptKey(key: string): string {
  return createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-5AB5DC6552AA')
    .digest('base64');
}

const wsClients = new Set<any>();
const sseClients = new Set<import('http').ServerResponse>();

export function resetTransientDashboardStateForTests(): void {
  hookEvents.length = 0;
  liveHookState.clear();
  liveSubagentState.clear();
  wsClients.clear();
  sseClients.clear();
}

function broadcastState(): void {
  if (wsClients.size === 0 && sseClients.size === 0) return;
  const state = JSON.stringify({ type: 'state', data: getState() });
  for (const ws of wsClients) {
    try {
      const buf = Buffer.from(state);
      const frame = createWsFrame(buf);
      ws.write(frame);
    } catch {
      wsClients.delete(ws);
    }
  }
  const ssePayload = `data: ${state}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(ssePayload);
    } catch {
      sseClients.delete(client);
    }
  }
}

function createWsFrame(data: Buffer, opcode = 0x1): Buffer {
  const len = data.length;
  let header: Buffer;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x80 | (opcode & 0x0f);
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | (opcode & 0x0f);
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | (opcode & 0x0f);
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, data]);
}

function parseWsFrame(buf: Buffer): { opcode: number; payload: Buffer; consumed: number } | null {
  if (buf.length < 2) return null;
  const opcode = buf[0] & 0x0f;
  const masked = (buf[1] & 0x80) !== 0;
  let payloadLen = buf[1] & 0x7f;
  let offset = 2;
  if (payloadLen === 126) {
    if (buf.length < 4) return null;
    payloadLen = buf.readUInt16BE(2);
    offset = 4;
  } else if (payloadLen === 127) {
    if (buf.length < 10) return null;
    payloadLen = Number(buf.readBigUInt64BE(2));
    offset = 10;
  }
  if (masked) {
    if (buf.length < offset + 4 + payloadLen) return null;
    const mask = buf.subarray(offset, offset + 4);
    offset += 4;
    const payload = Buffer.alloc(payloadLen);
    for (let i = 0; i < payloadLen; i++) {
      payload[i] = buf[offset + i] ^ mask[i % 4];
    }
    return { opcode, payload, consumed: offset + payloadLen };
  }
  if (buf.length < offset + payloadLen) return null;
  return { opcode, payload: buf.subarray(offset, offset + payloadLen), consumed: offset + payloadLen };
}

// --- HTTP Server ---

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

/**
 * Check DASHBOARD_SECRET for admin-mutating requests.
 * If DASHBOARD_SECRET is set, requires Authorization: Bearer <secret> header.
 * Hook events from containers are exempt (they use their own auth path).
 */
function requireAuth(req: import('http').IncomingMessage, res: import('http').ServerResponse): boolean {
  const secret = process.env.DASHBOARD_SECRET || '';
  if (!secret) return true; // no secret configured → open (localhost-only by default)
  const auth = req.headers.authorization || '';
  if (auth === `Bearer ${secret}`) return true;
  res.writeHead(401, { 'Content-Type': 'application/json' });
  res.end('{"error":"unauthorized"}');
  return false;
}

/** Strict auth — always requires DASHBOARD_SECRET, even when unset.
 *  Used for dangerous operations (exec, config writes) that should
 *  never be open by default regardless of bind address. */
function requireStrictAuth(req: import('http').IncomingMessage, res: import('http').ServerResponse): boolean {
  const secret = process.env.DASHBOARD_SECRET || '';
  if (!secret) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end('{"error":"DASHBOARD_SECRET must be set to use this endpoint"}');
    return false;
  }
  return requireAuth(req, res);
}

const MAX_BODY_SIZE = 1024 * 1024; // 1 MB

/** Read request body with size limit. Rejects with 413 if exceeded. */
function readBody(req: import('http').IncomingMessage, res: import('http').ServerResponse): Promise<string | null> {
  return new Promise((resolve) => {
    let body = '';
    let exceeded = false;
    req.on('data', (chunk: string) => {
      body += chunk;
      if (body.length > MAX_BODY_SIZE && !exceeded) {
        exceeded = true;
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end('{"error":"Request body too large"}');
        req.destroy();
        resolve(null);
      }
    });
    req.on('end', () => { if (!exceeded) resolve(body); });
    req.on('error', () => { if (!exceeded) resolve(null); });
  });
}

/** Exported for testing — handles all HTTP requests. */
export async function handleRequest(req: import('http').IncomingMessage, res: import('http').ServerResponse): Promise<void> {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);

  // API: receive hook events from containers
  if (req.method === 'POST' && url.pathname === '/api/hook-event') {
    const body = await readBody(req, res);
    if (body === null) return;
    try {
      const raw = JSON.parse(body);
      // Normalize Claude Code's native HTTP hook payload into our HookEvent format.
      // HTTP hooks send the raw SDK JSON with different field names than our old
      // bash-script format. We accept both for backwards compatibility.
      const event: HookEvent = {
        group:
          raw.group ||
          req.headers['x-group-folder'] as string ||
          '',
        event:
          raw.event ||
          raw.hook_event_name ||
          '',
        tool:
          raw.tool ||
          raw.tool_name ||
          undefined,
        message:
          raw.message ||
          raw.notification ||
          raw.prompt ||
          undefined,
        tool_input:
          typeof raw.tool_input === 'string'
            ? raw.tool_input
            : raw.tool_input
              ? JSON.stringify(raw.tool_input)
              : undefined,
        tool_response:
          typeof raw.tool_response === 'string'
            ? raw.tool_response
            : typeof raw.tool_result === 'string'
              ? raw.tool_result
              : raw.tool_result
                ? JSON.stringify(raw.tool_result)
                : raw.tool_response
                  ? JSON.stringify(raw.tool_response)
                  : undefined,
        tool_use_id: raw.tool_use_id || undefined,
        session_id: raw.session_id || undefined,
        agent_id: raw.agent_id || undefined,
        agent_type: raw.agent_type || undefined,
        transcript_path:
          raw.transcript_path ||
          raw.agent_transcript_path ||
          undefined,
        cwd: raw.cwd || undefined,
        timestamp: Date.now(),
      } as HookEvent;

      // Pack additional fields into extra
      const extra: Record<string, any> = {};
      if (typeof raw.extra === 'object' && raw.extra !== null) {
        Object.assign(extra, raw.extra);
      } else if (typeof raw.extra === 'string') {
        try { Object.assign(extra, JSON.parse(raw.extra)); } catch { /* ignore */ }
      }
      // Capture event-specific fields that aren't in our core schema
      for (const key of [
        'source', 'stop_hook_active', 'files_modified', 'error_message',
        'error_code', 'error', 'is_interrupt', 'tool_count',
        'permission_mode', 'model', 'last_assistant_message',
        'compact_summary', 'trigger', 'custom_instructions',
        'teammate_name', 'team_name', 'task_id', 'task_subject',
        'task_description', 'file_path', 'memory_type', 'load_reason',
        'notification_type', 'mcp_server_name', 'permission_suggestions',
      ]) {
        if (raw[key] !== undefined && raw[key] !== null) extra[key] = raw[key];
      }
      event.extra = Object.keys(extra).length > 0 ? extra : undefined;

      // All events go into ring buffer (including PreToolUse for tool-pair correlation)
      hookEvents.push(event);
      if (hookEvents.length > MAX_HOOK_EVENTS) hookEvents.shift();

      // Persist to database
      const heDb = getHookEventsDb();
      if (heDb) {
        try {
          heDb.prepare(`INSERT INTO hook_events
            (group_folder, event, tool, tool_use_id, message, tool_input, tool_response,
             session_id, agent_id, agent_type, transcript_path, cwd, extra, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
            event.group || '',
            event.event || '',
            event.tool || null,
            event.tool_use_id || null,
            event.message || null,
            event.tool_input || null,
            event.tool_response || null,
            event.session_id || null,
            event.agent_id || null,
            event.agent_type || null,
            event.transcript_path || null,
            event.cwd || null,
            event.extra ? JSON.stringify(event.extra) : null,
            event.timestamp,
          );
        } catch { /* DB write failure — non-fatal */ }
      }

      // Update live state
      if (event.group) {
        hookEverSeen.add(event.group);
        const prev = liveHookState.get(event.group);
        const isStopEvent = event.event === 'Stop' || event.event === 'SessionEnd';
        const isActiveEvent = !isStopEvent && event.event !== 'Notification';
        const nextStatus = classifyEventStatus(event, prev?.status || 'working');
        liveHookState.set(event.group, {
          tool: isStopEvent ? undefined : (event.tool || prev?.tool),
          notification: event.message || prev?.notification,
          status: nextStatus,
          ts: Date.now(),
          agentActive: isStopEvent ? false : (isActiveEvent || prev?.agentActive || false),
        });
      }
      updateLiveSubagentState(event);

      broadcastState();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    } catch {
      res.writeHead(400);
      res.end('{"error":"invalid json"}');
    }
    return;
  }

  // API: get current state
  if (url.pathname === '/api/state') {
    if (!requireAuth(req, res)) return;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(getState()));
    return;
  }

  if (url.pathname === '/api/events') {
    if (!requireAuth(req, res)) return;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(': connected\n\n');
    res.write(`data: ${JSON.stringify({ type: 'state', data: getState() })}\n\n`);
    sseClients.add(res);
    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  // API: get coworker types
  if (url.pathname === '/api/types') {
    if (!requireAuth(req, res)) return;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(getCoworkerTypes()));
    return;
  }

  // API: get coworker CLAUDE.md
  // Returns X-Readonly: true header for typed coworkers (CLAUDE.md rebuilt from templates)
  if (req.method === 'GET' && url.pathname.startsWith('/api/memory/')) {
    if (!requireAuth(req, res)) return;
    const folder = safeDecode(url.pathname.replace('/api/memory/', ''));
    if (folder === null) { res.writeHead(400); res.end('bad request'); return; }
    const mdPath = resolve(GROUPS_DIR, folder, 'CLAUDE.md');
    if (!isInsideDir(GROUPS_DIR, mdPath)) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }
    try {
      const content = readFileSync(mdPath, 'utf-8');
      const headers: Record<string, string> = { 'Content-Type': 'text/plain' };
      const rdb = db;
      if (rdb) {
        const row = rdb.prepare('SELECT coworker_type FROM registered_groups WHERE folder = ?').get(folder) as any;
        if (row?.coworker_type) {
          headers['X-Readonly'] = 'true';
          headers['X-Readonly-Reason'] = `Template: ${row.coworker_type} (rebuilt on startup)`;
        }
      }
      res.writeHead(200, headers);
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
    return;
  }

  // API: get hook events filtered by group
  if (url.pathname === '/api/hook-events') {
    if (!requireAuth(req, res)) return;
    const group = url.searchParams.get('group');
    const filtered = group
      ? hookEvents.filter((e) => e.group === group)
      : hookEvents;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(filtered.slice(-200)));
    return;
  }

  // API: paginated hook event history from DB
  if (url.pathname === '/api/hook-events/history') {
    if (!requireAuth(req, res)) return;
    const heDb = getHookEventsDb();
    if (!heDb) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('[]');
      return;
    }
    const group = url.searchParams.get('group');
    const sessionId = url.searchParams.get('session_id');
    const eventFilter = url.searchParams.get('event');
    const since = url.searchParams.get('since');
    const before = url.searchParams.get('before');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 500);

    const conditions: string[] = [];
    const params: any[] = [];
    if (group) { conditions.push('group_folder = ?'); params.push(group); }
    if (sessionId) { conditions.push('session_id = ?'); params.push(sessionId); }
    if (eventFilter) { conditions.push('event = ?'); params.push(eventFilter); }
    if (since) { conditions.push('timestamp >= ?'); params.push(parseInt(since, 10)); }
    if (before) { conditions.push('timestamp < ?'); params.push(parseInt(before, 10)); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    try {
      const rows = heDb.prepare(`SELECT * FROM hook_events ${where} ORDER BY timestamp DESC LIMIT ?`).all(...params, limit);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(rows));
    } catch (e: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // API: list distinct sessions from hook_events
  if (url.pathname === '/api/hook-events/sessions') {
    if (!requireAuth(req, res)) return;
    const heDb = getHookEventsDb();
    if (!heDb) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('[]');
      return;
    }
    const group = url.searchParams.get('group');
    try {
      const query = group
        ? `SELECT session_id, group_folder, MIN(timestamp) as first_ts, MAX(timestamp) as last_ts, COUNT(*) as event_count
           FROM hook_events WHERE session_id IS NOT NULL AND session_id != '' AND group_folder = ?
           GROUP BY session_id ORDER BY last_ts DESC LIMIT 50`
        : `SELECT session_id, group_folder, MIN(timestamp) as first_ts, MAX(timestamp) as last_ts, COUNT(*) as event_count
           FROM hook_events WHERE session_id IS NOT NULL AND session_id != ''
           GROUP BY session_id ORDER BY last_ts DESC LIMIT 50`;
      const rows = group ? heDb.prepare(query).all(group) : heDb.prepare(query).all();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(rows));
    } catch (e: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // API: structured session flow — pairs Pre/PostToolUse, nests subagents
  if (url.pathname === '/api/hook-events/session-flow') {
    if (!requireAuth(req, res)) return;
    const heDb = getHookEventsDb();
    const group = url.searchParams.get('group');
    const sessionId = url.searchParams.get('session_id');
    if (!heDb || !sessionId) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"entries":[]}');
      return;
    }
    try {
      const conditions = ['session_id = ?'];
      const params: any[] = [sessionId];
      if (group) { conditions.push('group_folder = ?'); params.push(group); }
      const rows: any[] = heDb.prepare(
        `SELECT * FROM hook_events WHERE ${conditions.join(' AND ')} ORDER BY timestamp ASC`
      ).all(...params);

      // Build structured flow entries
      const entries: any[] = [];
      const preToolMap = new Map<string, any>(); // tool_use_id -> PreToolUse row
      const subagentStack: any[] = []; // nested subagent tracking

      for (const row of rows) {
        const extra = row.extra ? JSON.parse(row.extra) : {};

        if (row.event === 'SessionStart') {
          entries.push({ type: 'session_start', timestamp: row.timestamp, extra });
        } else if (row.event === 'UserPromptSubmit') {
          entries.push({ type: 'user_prompt', timestamp: row.timestamp, message: row.message || '' });
        } else if (row.event === 'PreToolUse') {
          if (row.tool_use_id) preToolMap.set(row.tool_use_id, row);
        } else if (row.event === 'PostToolUse' || row.event === 'PostToolUseFailure') {
          const pre = row.tool_use_id ? preToolMap.get(row.tool_use_id) : null;
          const duration = pre ? row.timestamp - pre.timestamp : null;
          const entry: any = {
            type: 'tool_call',
            tool: row.tool,
            tool_use_id: row.tool_use_id,
            timestamp: row.timestamp,
            duration,
            tool_input: row.tool_input,
            tool_response: row.tool_response,
            failed: row.event === 'PostToolUseFailure',
            agent_id: row.agent_id,
          };
          if (subagentStack.length > 0) {
            subagentStack[subagentStack.length - 1].children.push(entry);
          } else {
            entries.push(entry);
          }
          if (row.tool_use_id) preToolMap.delete(row.tool_use_id);
        } else if (row.event === 'SubagentStart') {
          const block: any = {
            type: 'subagent_block',
            agent_id: row.agent_id,
            agent_type: row.agent_type,
            timestamp: row.timestamp,
            children: [],
          };
          subagentStack.push(block);
        } else if (row.event === 'SubagentStop') {
          const block = subagentStack.pop();
          if (block) {
            block.end_timestamp = row.timestamp;
            block.duration = row.timestamp - block.timestamp;
            if (subagentStack.length > 0) {
              subagentStack[subagentStack.length - 1].children.push(block);
            } else {
              entries.push(block);
            }
          }
        } else if (row.event === 'PreCompact') {
          entries.push({ type: 'compact', timestamp: row.timestamp });
        } else if (row.event === 'Notification') {
          entries.push({ type: 'notification', timestamp: row.timestamp, message: row.message || '' });
        } else if (row.event === 'Stop' || row.event === 'SessionEnd') {
          entries.push({ type: 'session_end', timestamp: row.timestamp, extra });
        }
      }

      // Flush any unclosed subagent blocks
      while (subagentStack.length > 0) {
        const block = subagentStack.pop()!;
        if (subagentStack.length > 0) {
          subagentStack[subagentStack.length - 1].children.push(block);
        } else {
          entries.push(block);
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ entries }));
    } catch (e: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // API: get recent messages from SQLite (for timeline integration + admin panel)
  // Messages table: id, chat_jid, sender, sender_name, content, timestamp, is_from_me, is_bot_message
  // Group folder resolved via registered_groups.jid -> folder
  if (url.pathname === '/api/messages') {
    if (!requireAuth(req, res)) return;
    const group = url.searchParams.get('group'); // group folder name
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '200', 10), 500);
    const before = url.searchParams.get('before'); // ISO timestamp for pagination
    let messages: any[] = [];
    let hasMore = false;
    if (db) {
      try {
        // Join to get group_folder, add direction/body aliases for client compat
        const base = `SELECT m.*, rg.folder as group_folder,
          CASE WHEN m.is_from_me = 1 THEN 'outgoing' ELSE 'incoming' END as direction,
          m.content as body, m.timestamp as created_at
          FROM messages m LEFT JOIN registered_groups rg ON m.chat_jid = rg.jid`;
        if (group && before) {
          messages = db.prepare(`${base} WHERE rg.folder = ? AND m.timestamp < ? ORDER BY m.timestamp DESC LIMIT ?`).all(group, before, limit + 1);
        } else if (group) {
          messages = db.prepare(`${base} WHERE rg.folder = ? ORDER BY m.timestamp DESC LIMIT ?`).all(group, limit + 1);
        } else if (before) {
          messages = db.prepare(`${base} WHERE m.timestamp < ? ORDER BY m.timestamp DESC LIMIT ?`).all(before, limit + 1);
        } else {
          messages = db.prepare(`${base} ORDER BY m.timestamp DESC LIMIT ?`).all(limit + 1);
        }
        if (messages.length > limit) {
          hasMore = true;
          messages = messages.slice(0, limit);
        }
      } catch { /* messages table may not exist */ }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ messages, hasMore }));
    return;
  }

  // API: admin overview stats
  if (url.pathname === '/api/overview') {
    if (!requireAuth(req, res)) return;
    const result: any = { uptime: process.uptime(), groups: { total: 0 }, tasks: { active: 0, paused: 0, completed: 0 }, messages: { total: 0 }, sessions: 0 };
    if (db) {
      try {
        result.groups.total = (db.prepare('SELECT COUNT(*) as c FROM registered_groups').get() as any)?.c || 0;
        const taskCounts = db.prepare("SELECT status, COUNT(*) as c FROM scheduled_tasks GROUP BY status").all() as any[];
        for (const r of taskCounts) {
          if (r.status === 'active') result.tasks.active = r.c;
          else if (r.status === 'paused') result.tasks.paused = r.c;
          else result.tasks.completed = r.c;
        }
        result.messages.total = (db.prepare('SELECT COUNT(*) as c FROM messages').get() as any)?.c || 0;
        result.sessions = (db.prepare('SELECT COUNT(*) as c FROM sessions').get() as any)?.c || 0;
      } catch { /* ignore */ }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  // API: admin tasks with recent run logs
  if (url.pathname === '/api/tasks') {
    if (!requireAuth(req, res)) return;
    let tasks: any[] = [];
    if (db) {
      try {
        tasks = db.prepare('SELECT * FROM scheduled_tasks ORDER BY created_at DESC').all() as any[];
        for (const task of tasks) {
          task.recentLogs = db.prepare('SELECT * FROM task_run_logs WHERE task_id = ? ORDER BY run_at DESC LIMIT 5').all(task.id);
        }
      } catch { /* ignore */ }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(tasks));
    return;
  }

  // API: pause task
  if (req.method === 'POST' && /^\/api\/tasks\/(\d+)\/pause$/.test(url.pathname)) {
    if (!requireAuth(req, res)) return;
    const id = url.pathname.match(/\/api\/tasks\/(\d+)\/pause/)![1];
    const wdb = getWriteDb();
    if (wdb) {
      try {
        wdb.prepare("UPDATE scheduled_tasks SET status='paused' WHERE id=?").run(id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    } else {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end('{"error":"db unavailable"}');
    }
    return;
  }

  // API: resume task
  if (req.method === 'POST' && /^\/api\/tasks\/(\d+)\/resume$/.test(url.pathname)) {
    if (!requireAuth(req, res)) return;
    const id = url.pathname.match(/\/api\/tasks\/(\d+)\/resume/)![1];
    const wdb = getWriteDb();
    if (wdb) {
      try {
        wdb.prepare("UPDATE scheduled_tasks SET status='active' WHERE id=?").run(id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    } else {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end('{"error":"db unavailable"}');
    }
    return;
  }

  // API: list sessions
  if (req.method === 'GET' && url.pathname === '/api/sessions') {
    if (!requireAuth(req, res)) return;
    let sessions: any[] = [];
    if (db) {
      try {
        sessions = db.prepare('SELECT s.group_folder, s.session_id, rg.name as group_name FROM sessions s LEFT JOIN registered_groups rg ON s.group_folder = rg.folder').all();
      } catch { /* ignore */ }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(sessions));
    return;
  }

  // API: delete sessions for a group folder
  if (req.method === 'DELETE' && /^\/api\/sessions\//.test(url.pathname)) {
    if (!requireAuth(req, res)) return;
    const folder = safeDecode(url.pathname.replace('/api/sessions/', ''));
    if (folder === null) { res.writeHead(400); res.end('bad request'); return; }
    const wdb = getWriteDb();
    if (wdb) {
      try {
        wdb.prepare('DELETE FROM sessions WHERE group_folder=?').run(folder);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    } else {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end('{"error":"db unavailable"}');
    }
    return;
  }

  // API: list skills
  if (req.method === 'GET' && url.pathname === '/api/skills') {
    if (!requireAuth(req, res)) return;
    const skills: any[] = [];
    try {
      if (existsSync(SKILLS_DIR)) {
        for (const name of readdirSync(SKILLS_DIR)) {
          const skillDir = join(SKILLS_DIR, name);
          if (!statSync(skillDir).isDirectory()) continue;
          const info: any = { name, enabled: !existsSync(join(skillDir, '.disabled')), files: [] };
          const skillMd = join(skillDir, 'SKILL.md');
          if (existsSync(skillMd)) {
            const content = readFileSync(skillMd, 'utf-8');
            const titleMatch = content.match(/^#\s+(.+)/m);
            info.title = titleMatch ? titleMatch[1] : name;
            info.description = content.split('\n').find((l: string) => l.trim() && !l.startsWith('#'))?.trim() || '';
          }
          info.files = readdirSync(skillDir).filter((f: string) => !f.startsWith('.'));
          skills.push(info);
        }
      }
    } catch { /* ignore */ }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(skills));
    return;
  }

  // API: toggle skill enabled/disabled
  if (req.method === 'POST' && /^\/api\/skills\/[^/]+\/toggle$/.test(url.pathname)) {
    if (!requireAuth(req, res)) return;
    const name = safeDecode(url.pathname.match(/\/api\/skills\/([^/]+)\/toggle/)![1]);
    if (name === null) { res.writeHead(400); res.end('bad request'); return; }
    const skillDir = resolve(SKILLS_DIR, name);
    if (!isInsideDir(SKILLS_DIR, skillDir)) {
      res.writeHead(403);
      res.end('{"error":"forbidden"}');
      return;
    }
    const disabledFile = join(skillDir, '.disabled');
    let enabled: boolean;
    try {
      if (existsSync(disabledFile)) {
        unlinkSync(disabledFile);
        enabled = true;
      } else {
        writeFileSync(disabledFile, '');
        enabled = false;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ enabled }));
    } catch (e: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // API: group details
  if (req.method === 'GET' && url.pathname === '/api/groups/detail') {
    if (!requireAuth(req, res)) return;
    let groups: any[] = [];
    if (db) {
      try {
        groups = db.prepare('SELECT * FROM registered_groups').all() as any[];
        for (const g of groups) {
          // Count sessions
          g.sessionCount = (db.prepare('SELECT COUNT(*) as c FROM sessions WHERE group_folder = ?').get(g.folder) as any)?.c || 0;
          // Read CLAUDE.md
          const mdPath = join(GROUPS_DIR, g.folder, 'CLAUDE.md');
          try {
            g.memory = readFileSync(mdPath, 'utf-8');
          } catch {
            g.memory = null;
          }
          // Check for running container (from async cache)
          g.containerRunning = hasRunningContainer(g.folder);
        }
      } catch { /* ignore */ }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(groups));
    return;
  }

  // API: create coworker
  if (req.method === 'POST' && url.pathname === '/api/coworkers') {
    if (!requireAuth(req, res)) return;
    const body = await readBody(req, res);
    if (body === null) return;
    try {
      const { name, folder, types, type, trigger } = JSON.parse(body);
      if (!name || !folder) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end('{"error":"name and folder required"}');
        return;
      }
      if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(folder)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end('{"error":"invalid folder name (alphanumeric, hyphens, underscores, 1-64 chars)"}');
        return;
      }
      if (folder === 'global' || folder === 'main') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end('{"error":"reserved folder name"}');
        return;
      }
      const wdb = getWriteDb();
      if (!wdb) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end('{"error":"db unavailable"}');
        return;
      }
      const jid = `dashboard:${folder}`;
      const existing = wdb.prepare('SELECT jid FROM registered_groups WHERE jid = ? OR folder = ?').get(jid, folder);
      if (existing) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end('{"error":"coworker already exists with this folder or JID"}');
        return;
      }

      // Resolve coworkerType: single type, or composite from multiple
      const selectedTypes: string[] = types || (type ? [type] : []);
      let coworkerType: string | null = null;
      if (selectedTypes.length === 1) {
        coworkerType = selectedTypes[0];
      } else if (selectedTypes.length > 1) {
        // Create composite entry in coworker-types.json
        const allTypes = getCoworkerTypes();
        const compositeKey = selectedTypes.join('+');
        if (!allTypes[compositeKey]) {
          const templates: string[] = [];
          const focusFiles: string[] = [];
          const descriptions: string[] = [];
          const mcpToolsSet = new Set<string>();
          for (const t of selectedTypes) {
            const entry = allTypes[t];
            if (entry) {
              const tpls = Array.isArray(entry.template) ? entry.template : [entry.template];
              templates.push(...tpls);
              if (entry.focusFiles) focusFiles.push(...entry.focusFiles);
              if (entry.allowedMcpTools) entry.allowedMcpTools.forEach((tool: string) => mcpToolsSet.add(tool));
              descriptions.push(entry.description || t);
            }
          }
          allTypes[compositeKey] = {
            description: descriptions.join(' + '),
            template: templates,
            base: 'slang-build',
            focusFiles,
            allowedMcpTools: [...mcpToolsSet],
          };
          writeFileSync(COWORKER_TYPES_PATH, JSON.stringify(allTypes, null, 2) + '\n');
          cachedTypes = null; // invalidate cache
        }
        coworkerType = compositeKey;
      }

      const groupDir = join(GROUPS_DIR, folder);
      mkdirSync(groupDir, { recursive: true });
      const triggerPattern = trigger || `@${name.replace(/\s+/g, '')}`;
      const now = new Date().toISOString();
      // Resolve MCP tools from coworker type
      const allTypesNow = getCoworkerTypes();
      const resolvedMcpTools = coworkerType && allTypesNow[coworkerType]?.allowedMcpTools
        ? JSON.stringify(allTypesNow[coworkerType].allowedMcpTools)
        : null;
      wdb.prepare(
        'INSERT INTO registered_groups (jid, name, folder, trigger_pattern, added_at, requires_trigger, is_main, coworker_type, allowed_mcp_tools) VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)',
      ).run(jid, name, folder, triggerPattern, now, coworkerType, resolvedMcpTools);
      // Seed CLAUDE.md from global template (container-runner re-composes from coworkerType at startup)
      const globalMd = join(GROUPS_DIR, 'global', 'CLAUDE.md');
      const cwMd = join(groupDir, 'CLAUDE.md');
      if (existsSync(globalMd) && !existsSync(cwMd)) {
        copyFileSync(globalMd, cwMd);
      }
      // Also register in chats table
      wdb.prepare(
        'INSERT OR IGNORE INTO chats (jid, name, channel, is_group) VALUES (?, ?, ?, 0)',
      ).run(jid, name, 'dashboard');
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, jid, folder, name, trigger: triggerPattern }));
    } catch (e: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // API: update coworker
  if (req.method === 'PUT' && /^\/api\/coworkers\/[^/]+$/.test(url.pathname)) {
    if (!requireAuth(req, res)) return;
    const folder = safeDecode(url.pathname.replace('/api/coworkers/', ''));
    if (!folder) { res.writeHead(400); res.end('{"error":"invalid folder"}'); return; }
    const body = await readBody(req, res);
    if (body === null) return;
    try {
      const updates = JSON.parse(body);
      const wdb = getWriteDb();
      if (!wdb) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end('{"error":"db unavailable"}');
        return;
      }
      const existing = wdb.prepare('SELECT * FROM registered_groups WHERE folder = ?').get(folder) as any;
      if (!existing) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end('{"error":"coworker not found"}');
        return;
      }
      if (updates.name) {
        wdb.prepare('UPDATE registered_groups SET name = ? WHERE folder = ?').run(updates.name, folder);
      }
      if (updates.trigger_pattern) {
        wdb.prepare('UPDATE registered_groups SET trigger_pattern = ? WHERE folder = ?').run(updates.trigger_pattern, folder);
      }
      if (updates.container_config !== undefined) {
        wdb.prepare('UPDATE registered_groups SET container_config = ? WHERE folder = ?').run(
          updates.container_config ? JSON.stringify(updates.container_config) : null, folder,
        );
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    } catch (e: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // API: get container name for shell exec
  if (req.method === 'GET' && /^\/api\/coworkers\/[^/]+\/container$/.test(url.pathname)) {
    if (!requireAuth(req, res)) return;
    const folder = safeDecode(url.pathname.replace('/api/coworkers/', '').replace('/container', ''));
    if (!folder) { res.writeHead(400); res.end('{"error":"invalid folder"}'); return; }
    const found = findRunningContainer(folder);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ running: !!found, container: found, execCommand: found ? `docker exec -it ${found} bash` : null }));
    return;
  }

  // API: execute command in container (dangerous — always requires DASHBOARD_SECRET)
  if (req.method === 'POST' && /^\/api\/coworkers\/[^/]+\/exec$/.test(url.pathname)) {
    if (!requireStrictAuth(req, res)) return;
    const folder = safeDecode(url.pathname.replace('/api/coworkers/', '').replace('/exec', ''));
    if (!folder) { res.writeHead(400); res.end('{"error":"invalid folder"}'); return; }
    const body = await readBody(req, res);
    if (body === null) return;
    try {
      const { command } = JSON.parse(body);
      if (!command || typeof command !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end('{"error":"command required"}');
        return;
      }
      // Find running container
      const found = findRunningContainer(folder);
      if (!found) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end('{"error":"no running container"}');
        return;
      }
      // Execute command (timeout 10s, max 64KB output)
      exec(`docker exec ${found} bash -c ${JSON.stringify(command)}`, { timeout: 10000, maxBuffer: 65536 }, (err, stdout, stderr) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          exitCode: err?.code || 0,
          stdout: stdout?.slice(0, 32768) || '',
          stderr: stderr?.slice(0, 8192) || '',
        }));
      });
    } catch (e: any) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // API: export coworker as JSON bundle
  if (req.method === 'GET' && /^\/api\/coworkers\/[^/]+\/export$/.test(url.pathname)) {
    if (!requireAuth(req, res)) return;
    const folder = safeDecode(url.pathname.replace('/api/coworkers/', '').replace('/export', ''));
    if (!folder) { res.writeHead(400); res.end('{"error":"invalid folder"}'); return; }
    const rdb = getHookEventsDb();
    if (!rdb) { res.writeHead(500); res.end('{"error":"db unavailable"}'); return; }

    const group = rdb.prepare('SELECT * FROM registered_groups WHERE folder = ?').get(folder) as any;
    if (!group) { res.writeHead(404); res.end('{"error":"coworker not found"}'); return; }

    // CLAUDE.md
    let claudeMd = '';
    const mdPath = join(GROUPS_DIR, folder, 'CLAUDE.md');
    try { claudeMd = readFileSync(mdPath, 'utf-8'); } catch { /* missing */ }

    // Walk group folder for files (skip logs, CLAUDE.md, binaries >1MB, .git)
    const files: Record<string, string> = {};
    const groupDir = join(GROUPS_DIR, folder);
    const walkDir = (dir: string, prefix: string) => {
      try {
        for (const entry of readdirSync(dir)) {
          if (entry.startsWith('.') || entry === 'logs' || entry === 'slang' || entry === 'worktrees') continue;
          const full = join(dir, entry);
          const rel = prefix ? `${prefix}/${entry}` : entry;
          const st = statSync(full);
          if (st.isDirectory()) { walkDir(full, rel); }
          else if (st.size < 1048576 && entry !== 'CLAUDE.md') {
            try { files[rel] = readFileSync(full, 'utf-8'); } catch { /* binary or unreadable */ }
          }
        }
      } catch { /* dir unreadable */ }
    };
    walkDir(groupDir, '');

    // Tasks
    const tasks = rdb.prepare(
      "SELECT prompt, script, schedule_type, schedule_value, context_mode, status FROM scheduled_tasks WHERE group_folder = ? AND status = 'active'"
    ).all(folder);

    // Messages (last 50)
    const messages = rdb.prepare(
      'SELECT sender_name, content, timestamp, is_bot_message FROM messages WHERE chat_jid = ? ORDER BY timestamp DESC LIMIT 50'
    ).all(group.jid);

    const bundle = {
      version: 1,
      exportedAt: new Date().toISOString(),
      coworker: {
        jid: group.jid,
        name: group.name,
        folder: group.folder,
        trigger: group.trigger_pattern,
        coworkerType: group.coworker_type || null,
        allowedMcpTools: group.allowed_mcp_tools ? JSON.parse(group.allowed_mcp_tools) : null,
        requiresTrigger: !!group.requires_trigger,
      },
      claudeMd,
      files,
      tasks,
      messages: (messages as any[]).reverse(),
    };

    const filename = `coworker-${folder}-${new Date().toISOString().split('T')[0]}.json`;
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.end(JSON.stringify(bundle, null, 2));
    return;
  }

  // API: import coworker from JSON bundle
  if (req.method === 'POST' && url.pathname === '/api/coworkers/import') {
    if (!requireAuth(req, res)) return;
    const body = await readBody(req, res);
    if (body === null) return;
    try {
      const data = JSON.parse(body);
      if (!data.coworker?.name || !data.coworker?.folder || !data.coworker?.trigger) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end('{"error":"invalid export bundle — missing coworker name/folder/trigger"}');
        return;
      }
      const wdb = getWriteDb();
      if (!wdb) { res.writeHead(500); res.end('{"error":"db unavailable"}'); return; }

      let folder = data.coworker.folder.replace(/[^a-zA-Z0-9_-]/g, '-');
      const jidBase = data.coworker.jid || `dashboard:${folder}`;
      let jid = jidBase;

      // Conflict check
      if (wdb.prepare('SELECT 1 FROM registered_groups WHERE folder = ?').get(folder)) {
        folder = folder + '-imported';
        jid = `dashboard:${folder}`;
      }

      // Register in DB
      const now = new Date().toISOString();
      wdb.prepare(
        'INSERT INTO registered_groups (jid, name, folder, trigger_pattern, added_at, requires_trigger, is_main, coworker_type, allowed_mcp_tools) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)'
      ).run(
        jid, data.coworker.name, folder, data.coworker.trigger, now,
        data.coworker.requiresTrigger ? 1 : 0,
        data.coworker.coworkerType || null,
        data.coworker.allowedMcpTools ? JSON.stringify(data.coworker.allowedMcpTools) : null,
      );

      // Ensure chats row
      wdb.prepare(
        "INSERT INTO chats (jid, name, last_message_time, channel, is_group) VALUES (?, ?, ?, 'dashboard', 1) ON CONFLICT(jid) DO NOTHING"
      ).run(jid, data.coworker.name, now);

      // Write CLAUDE.md
      const groupDir = join(GROUPS_DIR, folder);
      mkdirSync(join(groupDir, 'logs'), { recursive: true });
      if (data.claudeMd) writeFileSync(join(groupDir, 'CLAUDE.md'), data.claudeMd);

      // Write files
      let filesWritten = 0;
      for (const [relPath, content] of Object.entries(data.files || {})) {
        // Security: no traversal
        if (relPath.includes('..') || relPath.startsWith('/')) continue;
        const fullPath = join(groupDir, relPath);
        mkdirSync(join(fullPath, '..'), { recursive: true });
        writeFileSync(fullPath, content as string);
        filesWritten++;
      }

      // Reissue task IDs
      let tasksCreated = 0;
      for (const task of data.tasks || []) {
        if (task.status !== 'active') continue;
        const newId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        wdb.prepare(
          'INSERT INTO scheduled_tasks (id, group_folder, chat_jid, prompt, script, schedule_type, schedule_value, next_run, status, created_at, context_mode) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
        ).run(
          newId, folder, jid, task.prompt, task.script || null,
          task.schedule_type, task.schedule_value, now, 'active', now,
          task.context_mode || 'isolated',
        );
        tasksCreated++;
      }

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, folder, name: data.coworker.name, jid, tasksCreated, filesWritten }));
    } catch (e: any) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // API: spawn interactive container (resume session without sending a message)
  if (req.method === 'POST' && /^\/api\/coworkers\/[^/]+\/spawn-interactive$/.test(url.pathname)) {
    if (!requireAuth(req, res)) return;
    const folder = safeDecode(url.pathname.replace('/api/coworkers/', '').replace('/spawn-interactive', ''));
    if (!folder) { res.writeHead(400); res.end('{"error":"invalid folder"}'); return; }

    const found = findRunningContainer(folder);
    if (found) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'container already running', container: found }));
      return;
    }

    const controlDir = join(DATA_DIR, 'ipc', folder, 'control');
    mkdirSync(controlDir, { recursive: true });
    writeFileSync(
      join(controlDir, 'spawn-interactive.json'),
      JSON.stringify({ type: 'spawn_interactive', timestamp: new Date().toISOString() }),
    );

    res.writeHead(202, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, message: 'interactive spawn requested' }));
    return;
  }

  // API: delete coworker
  if (req.method === 'DELETE' && /^\/api\/coworkers\/[^/]+$/.test(url.pathname)) {
    if (!requireAuth(req, res)) return;
    const folder = safeDecode(url.pathname.replace('/api/coworkers/', ''));
    if (!folder) { res.writeHead(400); res.end('{"error":"invalid folder"}'); return; }
    const wdb = getWriteDb();
    if (!wdb) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end('{"error":"db unavailable"}');
      return;
    }
    const existing = wdb.prepare('SELECT * FROM registered_groups WHERE folder = ?').get(folder) as any;
    if (!existing) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end('{"error":"coworker not found"}');
      return;
    }
    // Don't allow deleting the main group
    if (existing.is_main) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end('{"error":"cannot delete the main group"}');
      return;
    }
    const jid = existing.jid;
    const deleteData = url.searchParams.has('deleteData');
    // Stop any running container for this group, then clean up
    const folderHyphenated = folder.replace(/_/g, '-');
    const doCleanup = () => {
      // Always unregister + clean DB rows (prevents orphaned entries in UI)
      // Order matters: delete children before parents (FK constraints)
      // task_run_logs references scheduled_tasks, so delete it first
      const taskIds = wdb.prepare('SELECT id FROM scheduled_tasks WHERE group_folder = ?').all(folder) as { id: string }[];
      for (const { id } of taskIds) {
        wdb.prepare('DELETE FROM task_run_logs WHERE task_id = ?').run(id);
      }
      wdb.prepare('DELETE FROM messages WHERE chat_jid = ?').run(jid);
      wdb.prepare('DELETE FROM scheduled_tasks WHERE group_folder = ?').run(folder);
      wdb.prepare('DELETE FROM sessions WHERE group_folder = ?').run(folder);
      wdb.prepare('DELETE FROM chats WHERE jid = ?').run(jid);
      wdb.prepare('DELETE FROM registered_groups WHERE folder = ?').run(folder);
      // Always clean session files (prevents stale session ID errors on re-creation)
      const sessionDir = join(PROJECT_ROOT, 'data', 'sessions', folder);
      try { rmSync(sessionDir, { recursive: true, force: true }); } catch { /* ok */ }
      // Only delete group folder/artifacts when explicitly requested
      if (deleteData) {
        const groupDir = join(GROUPS_DIR, folder);
        try {
          rmSync(groupDir, { recursive: true, force: true });
        } catch { /* best-effort cleanup */ }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, dataDeleted: deleteData }));
    };
    exec(
      `docker ps --filter name=nanoclaw-${folderHyphenated}- --format '{{.Names}}'`,
      (_err, stdout) => {
        const containers = (stdout || '').trim().split('\n').filter(Boolean);
        if (containers.length === 0) { doCleanup(); return; }
        exec(`docker stop ${containers.join(' ')}`, () => doCleanup());
      }
    );
    return;
  }

  // API: list files in a coworker's group folder (artifacts)
  if (req.method === 'GET' && /^\/api\/coworkers\/[^/]+\/files$/.test(url.pathname)) {
    if (!requireAuth(req, res)) return;
    const folder = safeDecode(url.pathname.replace('/api/coworkers/', '').replace('/files', ''));
    if (!folder) { res.writeHead(400); res.end('{"error":"invalid folder"}'); return; }
    const groupDir = join(GROUPS_DIR, folder);
    if (!isInsideDir(GROUPS_DIR, groupDir) && groupDir !== GROUPS_DIR) {
      res.writeHead(403); res.end('{"error":"forbidden"}'); return;
    }
    try {
      const files: { name: string; size: number; modified: string; isDir: boolean }[] = [];
      const entries = readdirSync(groupDir);
      for (const name of entries) {
        if (name.startsWith('.')) continue;
        try {
          const st = statSync(join(groupDir, name));
          files.push({
            name,
            size: st.size,
            modified: st.mtime.toISOString(),
            isDir: st.isDirectory(),
          });
        } catch { /* skip unreadable */ }
      }
      files.sort((a, b) => a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(files));
    } catch {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('[]');
    }
    return;
  }

  // API: browse files in subdirectory (recursive navigation)
  // GET /api/coworkers/:folder/browse?path=reports
  if (req.method === 'GET' && /^\/api\/coworkers\/[^/]+\/browse$/.test(url.pathname)) {
    if (!requireAuth(req, res)) return;
    const folder = safeDecode(url.pathname.replace('/api/coworkers/', '').replace('/browse', ''));
    const subpath = url.searchParams.get('path') || '';
    if (!folder) { res.writeHead(400); res.end('{"error":"invalid folder"}'); return; }
    const groupDir = join(GROUPS_DIR, folder);
    if (!isInsideDir(GROUPS_DIR, groupDir) && groupDir !== resolve(GROUPS_DIR)) {
      res.writeHead(403); res.end('{"error":"forbidden"}'); return;
    }
    const targetDir = join(groupDir, subpath);
    if (!isInsideDir(groupDir, targetDir) && targetDir !== groupDir) {
      res.writeHead(403); res.end('{"error":"forbidden"}'); return;
    }
    try {
      const entries = readdirSync(targetDir);
      const files: { name: string; path: string; size: number; modified: string; isDir: boolean }[] = [];
      for (const name of entries) {
        if (name.startsWith('.')) continue;
        try {
          const st = statSync(join(targetDir, name));
          files.push({
            name,
            path: subpath ? `${subpath}/${name}` : name,
            size: st.size,
            modified: st.mtime.toISOString(),
            isDir: st.isDirectory(),
          });
        } catch { /* skip */ }
      }
      files.sort((a, b) => a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(files));
    } catch {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('[]');
    }
    return;
  }

  // API: read file content inline (for work view)
  // GET /api/coworkers/:folder/read?path=reports/issue-10695.md
  if (req.method === 'GET' && /^\/api\/coworkers\/[^/]+\/read$/.test(url.pathname)) {
    if (!requireAuth(req, res)) return;
    const folder = safeDecode(url.pathname.replace('/api/coworkers/', '').replace('/read', ''));
    const filePath = url.searchParams.get('path') || '';
    if (!folder || !filePath) { res.writeHead(400); res.end('{"error":"missing path"}'); return; }
    const groupDir = join(GROUPS_DIR, folder);
    if (!isInsideDir(GROUPS_DIR, groupDir) && groupDir !== resolve(GROUPS_DIR)) {
      res.writeHead(403); res.end('{"error":"forbidden"}'); return;
    }
    const fullPath = join(groupDir, filePath);
    if (!isInsideDir(groupDir, fullPath)) {
      res.writeHead(403); res.end('{"error":"forbidden"}'); return;
    }
    try {
      const st = statSync(fullPath);
      if (st.isDirectory()) { res.writeHead(400); res.end('{"error":"is directory"}'); return; }
      if (st.size > 1048576) { res.writeHead(413); res.end('{"error":"file too large (>1MB)"}'); return; }
      const content = readFileSync(fullPath, 'utf-8');
      const ext = extname(filePath).slice(1);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ path: filePath, ext, size: st.size, content }));
    } catch {
      res.writeHead(404); res.end('{"error":"not found"}'); return;
    }
    return;
  }

  // API: download a file from coworker's group folder
  if (req.method === 'GET' && /^\/api\/coworkers\/[^/]+\/download\//.test(url.pathname)) {
    if (!requireAuth(req, res)) return;
    const parts = url.pathname.replace('/api/coworkers/', '').split('/download/');
    const folder = safeDecode(parts[0]);
    const filePath = safeDecode(parts.slice(1).join('/download/'));
    if (!folder || !filePath) { res.writeHead(400); res.end('bad request'); return; }
    const fullPath = join(GROUPS_DIR, folder, filePath);
    // Security: must be inside the group dir
    if (!isInsideDir(join(GROUPS_DIR, folder), fullPath)) {
      res.writeHead(403); res.end('forbidden'); return;
    }
    if (!existsSync(fullPath) || statSync(fullPath).isDirectory()) {
      res.writeHead(404); res.end('not found'); return;
    }
    const content = readFileSync(fullPath);
    const ext = filePath.split('.').pop() || '';
    const mimeTypes: Record<string, string> = { md: 'text/markdown', txt: 'text/plain', json: 'application/json', slang: 'text/plain', cpp: 'text/plain', h: 'text/plain', py: 'text/plain' };
    res.writeHead(200, {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${(filePath.split('/').pop() || 'file').replace(/["\r\n]/g, '_')}"`,
    });
    res.end(content);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/debug') {
    if (!requireAuth(req, res)) return;
    const mem = process.memoryUsage();
    const result: any = {
      pid: process.pid,
      uptime: process.uptime(),
      memory: {
        rss: mem.rss,
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        external: mem.external,
      },
      dbPath: DB_PATH,
      dbAvailable: !!db,
      rowCounts: {} as Record<string, number>,
      wsClients: wsClients.size,
      hookEventsBuffered: hookEvents.length,
    };
    if (db) {
      try {
        for (const table of ['messages', 'scheduled_tasks', 'task_run_logs', 'sessions', 'registered_groups', 'chats']) {
          result.rowCounts[table] = (db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as any)?.c || 0;
        }
      } catch { /* ignore */ }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  // API: infrastructure health — MCP proxy, auth, network, OneCLI
  if (req.method === 'GET' && url.pathname === '/api/infrastructure') {
    if (!requireAuth(req, res)) return;
    const checks: Record<string, any> = {};

    // MCP auth proxy reachable?
    // Read MCP port from .env or process env (dashboard runs as a separate process)
    let mcpPort = process.env.MCP_PROXY_PORT || '8808';
    try {
      const envContent = readFileSync(join(resolve('.'), '.env'), 'utf-8');
      const match = envContent.match(/^MCP_PROXY_PORT=(\d+)/m);
      if (match) mcpPort = match[1];
    } catch { /* use default */ }
    fetch(`http://172.17.0.1:${mcpPort}/tools`, { signal: AbortSignal.timeout(3000) })
      .catch(() => fetch(`http://127.0.0.1:${mcpPort}/tools`, { signal: AbortSignal.timeout(3000) }))
      .then((r) => r.json())
      .then((tools: Record<string, string[]>) => {
        const serverNames = Object.keys(tools);
        const toolCount = Object.values(tools).reduce((sum, t) => sum + t.length, 0);
        checks.mcpAuthProxy = { status: 'running', servers: serverNames, toolCount };
      })
      .catch(() => { checks.mcpAuthProxy = { status: 'unreachable' }; })
      .finally(() => {
        // OneCLI gateway reachable?
        const onecliUrl = process.env.ONECLI_URL || 'http://127.0.0.1:10254';
        fetch(`${onecliUrl}/api/health`, { signal: AbortSignal.timeout(3000) })
          .then((r) => { checks.onecli = { status: r.ok ? 'running' : 'error', statusCode: r.status }; })
          .catch(() => { checks.onecli = { status: 'unreachable' }; })
          .finally(() => {
            // Docker network
            try {
              const netInfo = execSync('docker network inspect nanoclaw-agents --format "{{.Options}}"', {
                stdio: 'pipe', encoding: 'utf-8', timeout: 5000,
              }).trim();
              checks.network = { status: 'active', name: 'nanoclaw-agents', options: netInfo };
            } catch {
              checks.network = { status: 'not_found', name: 'nanoclaw-agents' };
            }

            // Running containers
            try {
              const raw = execSync(
                'docker ps --filter name=nanoclaw- --format "{{.Names}}|{{.Status}}|{{.Networks}}"',
                { stdio: 'pipe', encoding: 'utf-8', timeout: 5000 },
              ).trim();
              const containers = raw ? raw.split('\n').filter(Boolean).map((line: string) => {
                const [name, status, networks] = line.split('|');
                return { name, status, networks };
              }) : [];
              checks.containers = { count: containers.length, list: containers };
            } catch {
              checks.containers = { count: 0, list: [] };
            }


            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(checks, null, 2));
          });
      });
    return;
  }

  // API: write CLAUDE.md for a group (admin panel)
  // Typed coworkers (coworkerType set) have their CLAUDE.md rebuilt from templates
  // on every container startup — edits would be silently overwritten. Block writes.
  if (req.method === 'PUT' && url.pathname.startsWith('/api/memory/')) {
    if (!requireAuth(req, res)) return;
    const folder = safeDecode(url.pathname.replace('/api/memory/', ''));
    if (folder === null) { res.writeHead(400); res.end('bad request'); return; }
    const mdPath = resolve(GROUPS_DIR, folder, 'CLAUDE.md');
    if (!isInsideDir(GROUPS_DIR, mdPath)) {
      res.writeHead(403);
      res.end('{"error":"forbidden"}');
      return;
    }
    // Block edits for typed coworkers — their CLAUDE.md is rebuilt from templates
    const rdb = db;
    if (rdb) {
      const row = rdb.prepare('SELECT coworker_type FROM registered_groups WHERE folder = ?').get(folder) as any;
      if (row?.coworker_type) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: `This coworker uses template "${row.coworker_type}" — its CLAUDE.md is rebuilt on every container startup. Edit the template on the host instead.`,
        }));
        return;
      }
    }
    const body = await readBody(req, res);
    if (body === null) return;
    try {
      writeFileSync(mdPath, body, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    } catch (e: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // API: delete a task
  if (req.method === 'DELETE' && /^\/api\/tasks\/(\d+)$/.test(url.pathname)) {
    if (!requireAuth(req, res)) return;
    const id = url.pathname.match(/\/api\/tasks\/(\d+)/)![1];
    const wdb = getWriteDb();
    if (wdb) {
      try {
        wdb.prepare('DELETE FROM task_run_logs WHERE task_id=?').run(id);
        wdb.prepare('DELETE FROM scheduled_tasks WHERE id=?').run(id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    } else {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end('{"error":"db unavailable"}');
    }
    return;
  }

  // API: get config values
  if (req.method === 'GET' && url.pathname === '/api/config') {
    if (!requireAuth(req, res)) return;
    const configKeys = [
      { key: 'ASSISTANT_NAME', env: 'ASSISTANT_NAME', description: 'Name of the assistant' },
      { key: 'CONTAINER_IMAGE', env: 'CONTAINER_IMAGE', description: 'Docker image for agent containers' },
      { key: 'CONTAINER_TIMEOUT', env: 'CONTAINER_TIMEOUT', description: 'Max container run time (ms)' },
      { key: 'MAX_CONCURRENT_CONTAINERS', env: 'MAX_CONCURRENT_CONTAINERS', description: 'Max parallel containers' },
      { key: 'IDLE_TIMEOUT', env: 'IDLE_TIMEOUT', description: 'Idle shutdown timeout (ms)' },
      { key: 'TIMEZONE', env: 'TZ', description: 'System timezone' },
      { key: 'DASHBOARD_PORT', env: 'DASHBOARD_PORT', description: 'Dashboard server port' },
      { key: 'ANTHROPIC_MODEL', env: 'ANTHROPIC_MODEL', description: 'Claude model identifier' },
      { key: 'LOG_LEVEL', env: 'LOG_LEVEL', description: 'Logging verbosity' },
    ];
    const result = configKeys.map((c) => ({
      ...c,
      value: process.env[c.env] || '',
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  // API: read/write root CLAUDE.md
  if (url.pathname === '/api/config/claude-md') {
    if (!requireAuth(req, res)) return;
    const mdPath = join(PROJECT_ROOT, 'CLAUDE.md');
    if (req.method === 'GET') {
      try {
        const content = readFileSync(mdPath, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(content);
      } catch {
        res.writeHead(404);
        res.end('not found');
      }
      return;
    }
    if (req.method === 'PUT') {
      if (!requireAuth(req, res)) return;
      const body = await readBody(req, res);
      if (body === null) return;
      try {
        writeFileSync(mdPath, body, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }
  }

  // API: list channels
  if (req.method === 'GET' && url.pathname === '/api/channels') {
    if (!requireAuth(req, res)) return;
    const channels: any[] = [];
    try {
      if (existsSync(CHANNELS_DIR)) {
        const exclude = new Set(['index.ts', 'registry.ts', 'registry.test.ts']);
        for (const file of readdirSync(CHANNELS_DIR)) {
          if (!file.endsWith('.ts') || exclude.has(file) || file.includes('.test.')) continue;
          const name = file.replace('.ts', '');
          // Determine prefix for JID matching
          const prefixMap: Record<string, string> = { telegram: 'tg:', whatsapp: 'wa:', discord: 'disc:', slack: 'slack:' };
          const prefix = prefixMap[name] || `${name}:`;
          const groups: any[] = [];
          if (db) {
            try {
              const rows = db.prepare('SELECT name, folder, jid FROM registered_groups WHERE jid LIKE ?').all(`${prefix}%`) as any[];
              for (const r of rows) groups.push({ name: r.name, folder: r.folder });
            } catch { /* ignore */ }
          }
          channels.push({ name, type: name, configured: groups.length > 0, groups });
        }
      }
    } catch { /* ignore */ }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(channels));
    return;
  }

  // API: get logs
  if (req.method === 'GET' && url.pathname === '/api/logs') {
    if (!requireAuth(req, res)) return;
    const source = url.searchParams.get('source') || 'app';
    const group = url.searchParams.get('group') || '';
    const search = url.searchParams.get('search') || '';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '500', 10), 2000);

    let logFile = '';
    if (source === 'app') {
      logFile = join(LOGS_DIR, 'nanoclaw.log');
    } else if (source === 'error') {
      logFile = join(LOGS_DIR, 'nanoclaw.error.log');
    } else if (source === 'container' && group) {
      // Find most recent container log for this group
      const groupLogDir = join(GROUPS_DIR, group, 'logs');
      // Prevent path traversal (e.g. group = "../../etc")
      if (!groupLogDir.startsWith(GROUPS_DIR + '/')) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid group name' }));
        return;
      }
      if (existsSync(groupLogDir)) {
        const logFiles = readdirSync(groupLogDir)
          .filter((f) => f.startsWith('container-') && f.endsWith('.log'))
          .sort()
          .reverse();
        if (logFiles.length > 0) logFile = join(groupLogDir, logFiles[0]);
      }
    }

    if (!logFile || !existsSync(logFile)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ lines: [], file: logFile || 'none' }));
      return;
    }

    try {
      let content = readFileSync(logFile, 'utf-8');
      // Strip ANSI codes
      content = content.replace(/\x1b\[[0-9;]*m/g, '');
      let lines = content.split('\n').filter((l) => l.trim());
      if (search) {
        const lowerSearch = search.toLowerCase();
        lines = lines.filter((l) => l.toLowerCase().includes(lowerSearch));
      }
      // Return last N lines
      lines = lines.slice(-limit);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ lines, file: logFile }));
    } catch {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ lines: [], file: logFile }));
    }
    return;
  }

  // API: get single skill content
  if (req.method === 'GET' && /^\/api\/skills\/[^/]+$/.test(url.pathname) && url.pathname !== '/api/skills') {
    if (!requireAuth(req, res)) return;
    const name = safeDecode(url.pathname.replace('/api/skills/', ''));
    if (name === null) { res.writeHead(400); res.end('bad request'); return; }
    const skillDir = resolve(SKILLS_DIR, name);
    if (!isInsideDir(SKILLS_DIR, skillDir)) {
      res.writeHead(403);
      res.end('{"error":"forbidden"}');
      return;
    }
    const skillMd = join(skillDir, 'SKILL.md');
    try {
      const content = readFileSync(skillMd, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
    return;
  }

  // API: create skill
  if (req.method === 'POST' && url.pathname === '/api/skills' && req.headers['content-type']?.includes('application/json')) {
    if (!requireAuth(req, res)) return;
    const body = await readBody(req, res);
    if (body === null) return;
    try {
      const { name, content } = JSON.parse(body);
      if (!name || !/^[a-z0-9-]+$/.test(name)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end('{"error":"Invalid skill name (use lowercase alphanumeric and hyphens)"}');
        return;
      }
      const skillDir = resolve(SKILLS_DIR, name);
      if (!isInsideDir(SKILLS_DIR, skillDir)) {
        res.writeHead(403);
        res.end('{"error":"forbidden"}');
        return;
      }
      if (existsSync(skillDir)) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end('{"error":"Skill already exists"}');
        return;
      }
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(join(skillDir, 'SKILL.md'), content || `# ${name}\n\nNew skill.\n`, 'utf-8');
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, name }));
    } catch (e: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // API: update skill
  if (req.method === 'PUT' && /^\/api\/skills\/[^/]+$/.test(url.pathname)) {
    if (!requireAuth(req, res)) return;
    const name = safeDecode(url.pathname.replace('/api/skills/', ''));
    if (name === null) { res.writeHead(400); res.end('bad request'); return; }
    const skillDir = resolve(SKILLS_DIR, name);
    if (!isInsideDir(SKILLS_DIR, skillDir)) {
      res.writeHead(403);
      res.end('{"error":"forbidden"}');
      return;
    }
    const body = await readBody(req, res);
    if (body === null) return;
    try {
      writeFileSync(join(skillDir, 'SKILL.md'), body, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    } catch (e: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // API: delete skill
  if (req.method === 'DELETE' && /^\/api\/skills\/[^/]+$/.test(url.pathname)) {
    if (!requireAuth(req, res)) return;
    const name = safeDecode(url.pathname.replace('/api/skills/', ''));
    if (name === null) { res.writeHead(400); res.end('bad request'); return; }
    if (url.searchParams.get('confirm') !== 'true') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end('{"error":"Add ?confirm=true to delete"}');
      return;
    }
    const skillDir = resolve(SKILLS_DIR, name);
    if (!isInsideDir(SKILLS_DIR, skillDir)) {
      res.writeHead(403);
      res.end('{"error":"forbidden"}');
      return;
    }
    try {
      rmSync(skillDir, { recursive: true });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    } catch (e: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // API: send chat message
  if (req.method === 'POST' && url.pathname === '/api/chat/send') {
    if (!requireAuth(req, res)) return;
    const body = await readBody(req, res);
    if (body === null) return;
    try {
      const { group, content } = JSON.parse(body);
      if (!group || !content) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end('{"error":"group and content required"}');
        return;
      }
      // Look up JID from registered_groups
      if (!db) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end('{"error":"db unavailable"}');
        return;
      }
      const row = db.prepare('SELECT jid FROM registered_groups WHERE folder = ?').get(group) as any;
      if (!row) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end('{"error":"group not found"}');
        return;
      }
      const wdb = getWriteDb();
      if (!wdb) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end('{"error":"db unavailable for write"}');
        return;
      }
      const timestamp = new Date().toISOString();
      const msgId = `dash-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      // Ensure chats row exists (FK: messages.chat_jid → chats.jid)
      wdb.prepare(
        `INSERT INTO chats (jid, name, last_message_time, channel, is_group) VALUES (?, ?, ?, 'dashboard', 1)
         ON CONFLICT(jid) DO UPDATE SET last_message_time = MAX(last_message_time, excluded.last_message_time)`,
      ).run(row.jid, group, timestamp);
      wdb.prepare(
        'INSERT INTO messages (id, chat_jid, sender, sender_name, content, timestamp, is_from_me, is_bot_message) VALUES (?, ?, ?, ?, ?, ?, 0, 0)',
      ).run(msgId, row.jid, 'web@dashboard', 'Dashboard', content, timestamp);
      lastMessageTsCache.set(group, timestamp);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, timestamp }));
    } catch (e: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // ── MCP server control (proxy to auth proxy on NanoClaw process) ────────
  if (req.method === 'POST' && url.pathname === '/api/mcp-control') {
    if (!requireAuth(req, res)) return;
    const body = await readBody(req, res);
    if (body === null) return;
    try {
      const { action, name } = JSON.parse(body);
      // Read MCP port from .env
      let mcpPort = '8808';
      try {
        const envContent = readFileSync(join(resolve('.'), '.env'), 'utf-8');
        const match = envContent.match(/^MCP_PROXY_PORT=(\d+)/m);
        if (match) mcpPort = match[1];
      } catch { /* use default */ }

      const endpoint = action === 'stop' ? 'stop' : 'restart';
      const proxyUrl = `http://172.17.0.1:${mcpPort}/servers/${endpoint}?name=${encodeURIComponent(name)}`;

      // Read management token: env var first, then runtime file written by mcp-auth-proxy
      let mcpToken = process.env.MCP_MANAGEMENT_TOKEN || '';
      if (!mcpToken) {
        try {
          mcpToken = readFileSync(join(process.env.HOME || '/home/ubuntu', '.config', 'nanoclaw', '.mcp-management-token'), 'utf-8').trim();
        } catch { /* token file not available */ }
      }
      const fetchHeaders: Record<string, string> = {};
      if (mcpToken) fetchHeaders['Authorization'] = `Bearer ${mcpToken}`;
      fetch(proxyUrl, { method: 'POST', headers: fetchHeaders, signal: AbortSignal.timeout(10000) })
        .then(r => r.json())
        .then(j => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(j));
        })
        .catch((e: Error) => {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'MCP proxy unreachable: ' + e.message }));
        });
    } catch (e: any) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // ── Remote MCP server management ────────────────────────────────────────

  // Static files
  const decodedPath = safeDecode(url.pathname);
  if (decodedPath === null) { res.writeHead(400); res.end('bad request'); return; }
  let filePath = decodedPath === '/' ? '/index.html' : decodedPath;
  filePath = resolve(PUBLIC_DIR, '.' + filePath);
  if (!isInsideDir(PUBLIC_DIR, filePath)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }

  try {
    const content = readFileSync(filePath);
    const ext = extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
}

/** Start the dashboard server (binds port, sets up WebSocket, timers). */
export function startServer(port = PORT, host = DASHBOARD_HOST): import('http').Server {
  // Load MCP tool inventory from proxy (non-blocking; will retry on next refresh if proxy isn't ready)
  refreshMcpTools();

  const server = createServer(handleRequest);

  server.on('upgrade', (req, socket, head) => {
    const key = req.headers['sec-websocket-key'];
    if (!key) {
      socket.destroy();
      return;
    }

    const acceptKey = computeAcceptKey(key);
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${acceptKey}\r\n` +
        '\r\n',
    );

    wsClients.add(socket);

    const state = JSON.stringify({ type: 'state', data: getState() });
    socket.write(createWsFrame(Buffer.from(state)));

    let buffer = head.length > 0 ? Buffer.from(head) : Buffer.alloc(0);
    socket.on('data', (data: Buffer) => {
      buffer = Buffer.concat([buffer, data]);
      while (true) {
        const frame = parseWsFrame(buffer);
        if (!frame) break;
        buffer = buffer.subarray(frame.consumed);
        if (frame.opcode === 0x8) {
          // Close: reply with close and terminate socket.
          try {
            socket.write(createWsFrame(frame.payload, 0x8));
          } finally {
            socket.end();
          }
          return;
        }
        if (frame.opcode === 0x9) {
          // Ping: keep browser connections alive by replying with pong.
          socket.write(createWsFrame(frame.payload, 0xA));
          continue;
        }
      }
    });

    socket.on('close', () => wsClients.delete(socket));
    socket.on('error', () => wsClients.delete(socket));
  });

  // Poll and broadcast state every 500ms
  const broadcastTimer = setInterval(() => {
    if (!db) db = openDb();
    broadcastState();
  }, 500);
  broadcastTimer.unref?.();

  // Expire stale hook state (>30s old)
  const expireTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, val] of liveHookState) {
      if (now - val.ts > 30000) liveHookState.delete(key);
    }
    for (const [group, subagents] of liveSubagentState) {
      for (const [agentId, subagent] of subagents) {
        const isExpiredLeaving = subagent.phase === 'leaving' && subagent.exitAt !== null && now > subagent.exitAt;
        const isExpiredActive = subagent.phase !== 'leaving' && now - subagent.lastActivity > SUBAGENT_STALE_MS;
        if (isExpiredLeaving || isExpiredActive) subagents.delete(agentId);
      }
      if (subagents.size === 0) liveSubagentState.delete(group);
    }
  }, 5000);
  expireTimer.unref?.();

  // Retention cleanup: delete hook_events older than HOOK_RETENTION_DAYS (default 7)
  const retentionDays = parseInt(process.env.HOOK_RETENTION_DAYS || '7', 10);
  const retentionTimer = setInterval(() => {
    const heDb = getHookEventsDb();
    if (heDb) {
      try {
        const cutoff = Date.now() - retentionDays * 86400000;
        heDb.prepare('DELETE FROM hook_events WHERE timestamp < ?').run(cutoff);
      } catch { /* non-fatal */ }
    }
  }, 3600000); // every hour
  retentionTimer.unref?.();

  server.on('close', () => {
    clearInterval(broadcastTimer);
    clearInterval(expireTimer);
    clearInterval(retentionTimer);
    for (const client of sseClients) {
      try {
        client.end();
      } catch {
        /* ignore */
      }
    }
    sseClients.clear();
  });

  server.listen(port, host, () => {
    console.log(`\n  NVIDIA Coworker Dashboard`);
    console.log(`  http://${host}:${port}\n`);
    console.log(`  Tab 1: Pixel Art Office (real-time)`);
    console.log(`  Tab 2: Timeline (all-time metrics)`);
    if (process.env.DASHBOARD_SECRET) console.log(`  Auth: Bearer token required for admin mutations`);
    console.log();
  });

  return server;
}

// Auto-start when run directly (not imported by tests)
if (!process.env.VITEST) {
  startServer();
}
