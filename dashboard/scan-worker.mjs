/**
 * NanoClaw dashboard — session-DB scan worker (dash-perf round 2)
 *
 * Owns the two heaviest fleet scans that used to run on the dashboard's event
 * loop:
 *   1. Message timestamps — the newest message per agent group (drives the
 *      unread badge + coworker-chat auto-refresh).
 *   2. Activity buckets — the 24h hourly inbound/outbound message histogram.
 *
 * Both are pure READ-ONLY passes over the per-session `inbound.db` / `outbound.db`
 * files. Running them here keeps ~6k stats/sec and (for activity) thousands of
 * SQLite opens off the main thread, so HTTP/SSE/WS/`drain` callbacks execute
 * promptly (the backpressure win). The main thread receives immutable cache
 * DELTAS only — it never opens a session DB for these.
 *
 * Efficiency is not from "a worker" alone but from:
 *   • a shared inventory (one enumeration feeds both scans),
 *   • per-file mtime gating (open a DB only when its file changed),
 *   • hot/cold cadence (recently-active files are checked every second; a file
 *     idle for a while is checked every ~30s, so years of idle sessions aren't
 *     statted every second),
 *   • per-file hourly activity buckets (an unchanged DB is never reopened just
 *     because the 24h window advanced), and
 *   • publishing only the groups/values that actually changed.
 *
 * Plain JS (not TS) on purpose: it's loaded via `new Worker(url)` and must run
 * without any type-stripping loader, and it imports only `better-sqlite3` +
 * node builtins. Written defensively — a corrupt/locked session DB is skipped,
 * never fatal. A fatal init failure (e.g. better-sqlite3 unavailable) surfaces
 * as the Worker 'error' event so the host falls back to its main-thread scans.
 */
import { parentPort, workerData } from 'node:worker_threads';
import { statSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';

const { dataDir, centralDbPath } = workerData;

const TICK_MS = 1000;
const HOT_INTERVAL_MS = 1000; // recheck an active file every second
const COLD_INTERVAL_MS = 30_000; // …a long-idle file only every 30s
const COLD_AFTER_MS = 60_000; // unchanged this long → treat as cold
const INVENTORY_MS = 5_000; // re-enumerate groups/sessions this often
const ACTIVITY_PUBLISH_MS = 10_000; // republish the activity histogram at most this often
const STATS_PUBLISH_MS = 15_000; // instrumentation heartbeat
const MAX_OPENS_PER_TICK = 400; // spread a cold scan across ticks; don't open 6k DBs at once
const WINDOW_HOURS = 24;
const ACTIVITY_LOOKBACK_MS = 26 * 3600 * 1000; // query a little past the window so buckets are complete

// Open the central DB read-only. A failure here is fatal → Worker 'error' →
// host falls back to its own main-thread scans.
const central = new Database(centralDbPath, { readonly: true });
central.pragma('busy_timeout = 2000');

const sessionsDir = join(dataDir, 'v2-sessions');

/** Per-file scan state. `hours` maps 'YYYY-MM-DDTHH' → message count in that hour. */
const files = new Map(); // dbPath -> { folder, direction, table, mtimeMs, ts, hours, nextCheckAt, lastChangedAt, missing }

let inventory = []; // [{ folder, inbound, outbound }]
let inventoryAt = 0;
let publishedMsgTs = new Map(); // folder -> ts last sent to the host
let publishedActivityJson = '';
let lastActivityPublish = 0;
let lastStatsPublish = 0;

// Instrumentation.
let statCalls = 0;
let dbOpens = 0;
let lastTickMs = 0;

function refreshInventory(now) {
  if (now - inventoryAt < INVENTORY_MS && inventory.length) return;
  inventoryAt = now;
  try {
    const groups = central.prepare('SELECT id, folder FROM agent_groups').all();
    const folderById = new Map();
    for (const g of groups) if (g.id && g.folder) folderById.set(g.id, g.folder);
    const sessions = central.prepare('SELECT id, agent_group_id FROM sessions').all();
    const next = [];
    const livePaths = new Set();
    for (const s of sessions) {
      const folder = folderById.get(s.agent_group_id);
      if (!folder || !s.id) continue;
      const base = join(sessionsDir, s.agent_group_id, s.id);
      const inbound = join(base, 'inbound.db');
      const outbound = join(base, 'outbound.db');
      livePaths.add(inbound);
      livePaths.add(outbound);
      next.push({ folder, inbound, outbound });
    }
    inventory = next;
    // Drop per-file state for sessions that no longer exist.
    for (const path of files.keys()) if (!livePaths.has(path)) files.delete(path);
  } catch {
    /* central DB transiently unreadable — keep the previous inventory */
  }
}

function hourKey(ts) {
  // ISO 'YYYY-MM-DDTHH:MM:...' → 'YYYY-MM-DDTHH'. Matches the host's slice(0,13).
  return typeof ts === 'string' && ts.length >= 13 ? ts.slice(0, 13) : null;
}

/**
 * Ensure a file's cached { ts, hours } is fresh, honoring the hot/cold gate.
 * Returns true when this call actually opened + reparsed the DB. Respects the
 * per-tick open budget: when exhausted, a changed file is left for the next tick.
 */
function refreshFile(path, direction, table, now, budget) {
  let st = files.get(path);
  if (st && now < st.nextCheckAt) return false; // gated — reuse cached values

  let mtimeMs;
  try {
    statCalls++;
    mtimeMs = statSync(path).mtimeMs; // throws if the file doesn't exist
  } catch {
    // Missing/unreadable → no contribution. Keep a light record so we don't
    // re-stat every tick (cold cadence).
    files.set(path, {
      direction,
      table,
      mtimeMs: -1,
      ts: null,
      hours: new Map(),
      nextCheckAt: now + COLD_INTERVAL_MS,
      lastChangedAt: st ? st.lastChangedAt : now,
      missing: true,
    });
    return false;
  }

  if (st && !st.missing && st.mtimeMs === mtimeMs) {
    // Unchanged: reuse cached ts/hours; slide to cold cadence once idle a while.
    const idleFor = now - st.lastChangedAt;
    st.nextCheckAt = now + (idleFor > COLD_AFTER_MS ? COLD_INTERVAL_MS : HOT_INTERVAL_MS);
    return false;
  }

  if (budget.opens >= MAX_OPENS_PER_TICK) {
    // Out of open budget this tick — recheck ASAP next tick without moving mtime.
    if (st) st.nextCheckAt = now; // eslint-disable-line no-param-reassign
    return false;
  }

  // Changed (or first sight): open once and re-derive both the latest ts and the
  // recent hourly buckets.
  budget.opens++;
  dbOpens++;
  let ts = null;
  const hours = new Map();
  let sdb = null;
  try {
    sdb = new Database(path, { readonly: true });
    sdb.pragma('busy_timeout = 1000');
    const latest = sdb.prepare(`SELECT timestamp FROM ${table} ORDER BY timestamp DESC LIMIT 1`).get();
    ts = latest && latest.timestamp ? latest.timestamp : null;
    const cutoff = new Date(now - ACTIVITY_LOOKBACK_MS).toISOString();
    const rows = sdb.prepare(`SELECT timestamp FROM ${table} WHERE timestamp > ?`).all(cutoff);
    for (const r of rows) {
      const k = hourKey(r.timestamp);
      if (k) hours.set(k, (hours.get(k) || 0) + 1);
    }
  } catch {
    // Corrupt/locked read: don't cache a bogus empty result over a good one —
    // retry next tick. If we have no prior state, record an empty cold entry.
    if (sdb) {
      try {
        sdb.close();
      } catch {
        /* ignore */
      }
    }
    if (st) {
      st.nextCheckAt = now + HOT_INTERVAL_MS;
      return false;
    }
    files.set(path, {
      direction,
      table,
      mtimeMs: -1,
      ts: null,
      hours: new Map(),
      nextCheckAt: now + HOT_INTERVAL_MS,
      lastChangedAt: now,
      missing: false,
    });
    return false;
  }
  try {
    sdb.close();
  } catch {
    /* ignore */
  }

  files.set(path, {
    direction,
    table,
    mtimeMs,
    ts,
    hours,
    nextCheckAt: now + HOT_INTERVAL_MS,
    lastChangedAt: now,
    missing: false,
  });
  return true;
}

function publishMsgTs() {
  // Per-folder max ts across its sessions' inbound+outbound files.
  const byFolder = new Map();
  for (const sess of inventory) {
    const inSt = files.get(sess.inbound);
    const outSt = files.get(sess.outbound);
    let maxTs = byFolder.get(sess.folder) || null;
    for (const st of [inSt, outSt]) {
      if (st && st.ts) {
        if (!maxTs || Date.parse(st.ts) > Date.parse(maxTs)) maxTs = st.ts;
      }
    }
    if (maxTs) byFolder.set(sess.folder, maxTs);
  }
  const changed = [];
  for (const [folder, ts] of byFolder) {
    if (publishedMsgTs.get(folder) !== ts) changed.push([folder, ts]);
  }
  const removed = [];
  for (const folder of publishedMsgTs.keys()) if (!byFolder.has(folder)) removed.push(folder);
  if (changed.length === 0 && removed.length === 0) return;
  publishedMsgTs = byFolder;
  parentPort.postMessage({ kind: 'msgTs', changed, removed });
}

function publishActivity(now) {
  if (now - lastActivityPublish < ACTIVITY_PUBLISH_MS) return;
  lastActivityPublish = now;
  // The 24 hour-keys currently in-window (newest → oldest), matching the host's
  // original bucketing.
  const buckets = [];
  const index = new Map();
  for (let i = 0; i < WINDOW_HOURS; i++) {
    const key = new Date(now - i * 3600000).toISOString().slice(0, 13);
    const b = { hour: key, inbound: 0, outbound: 0 };
    buckets.push(b);
    index.set(key, b);
  }
  for (const st of files.values()) {
    if (!st.hours || st.hours.size === 0) continue;
    const dir = st.direction; // 'inbound' | 'outbound'
    for (const [k, count] of st.hours) {
      const b = index.get(k);
      if (b) b[dir] += count;
    }
  }
  buckets.sort((a, b) => a.hour.localeCompare(b.hour));
  const json = JSON.stringify(buckets);
  if (json === publishedActivityJson) return;
  publishedActivityJson = json;
  parentPort.postMessage({ kind: 'activity', buckets });
}

function publishStats(now) {
  if (now - lastStatsPublish < STATS_PUBLISH_MS) return;
  lastStatsPublish = now;
  parentPort.postMessage({
    kind: 'stats',
    filesTracked: files.size,
    sessions: inventory.length,
    statCalls,
    dbOpens,
    lastTickMs,
  });
  statCalls = 0;
  dbOpens = 0;
}

function tick() {
  const start = Date.now();
  refreshInventory(start);
  const budget = { opens: 0 };
  for (const sess of inventory) {
    refreshFile(sess.inbound, 'inbound', 'messages_in', start, budget);
    refreshFile(sess.outbound, 'outbound', 'messages_out', start, budget);
  }
  publishMsgTs();
  publishActivity(start);
  lastTickMs = Date.now() - start;
  publishStats(start);
}

// Announce readiness only after the first tick that actually completes — the
// host hands off (stops its own scans) on `ready`, so we must not claim
// readiness on a tick that threw (e.g. the central DB was momentarily
// unreadable). A fatal failure to even open the central DB happens above, at
// module load, and surfaces as the Worker 'error' event → host falls back.
let readySent = false;
function runTick() {
  try {
    tick();
    if (!readySent) {
      readySent = true;
      parentPort.postMessage({ kind: 'ready' });
    }
  } catch (e) {
    // Never let one bad tick kill the worker; report the first fault for debug.
    if (!readySent) parentPort.postMessage({ kind: 'error', message: String((e && e.message) || e) });
  }
}
runTick(); // immediate first pass so the host's caches warm fast
const timer = setInterval(runTick, TICK_MS);
timer.unref?.();

parentPort.on('message', (msg) => {
  if (msg === 'stop') {
    clearInterval(timer);
    try {
      central.close();
    } catch {
      /* ignore */
    }
    parentPort.close();
  }
});
