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
 *     idle for a while is checked every ~5s on a per-path phase offset, so years
 *     of idle sessions aren't all statted on the same tick). The cold cadence
 *     bounds only the STAT — it is a UI-freshness budget, not an activity budget:
 *     a new message in a long-idle session must surface in the unread badge and
 *     the coworker-chat auto-refresh promptly, so the stat stays frequent while
 *     the (far more expensive) DB open still happens only on a real mtime change,
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
// Cold cadence for the STAT only (see the header): a long-idle file is statted
// every ~5s, phase-shifted per path so the fleet's checks spread across the
// interval instead of bunching on one tick. It is deliberately far below the
// activity-republish cadence — a message landing in a cold session must not be
// invisible for tens of seconds in the unread badge / chat auto-refresh.
const COLD_INTERVAL_MS = 5_000;
const COLD_AFTER_MS = 60_000; // unchanged this long → treat as cold
const INVENTORY_MS = 5_000; // re-enumerate groups/sessions this often
const ACTIVITY_PUBLISH_MS = 10_000; // republish the activity histogram at most this often
const STATS_PUBLISH_MS = 15_000; // instrumentation heartbeat
const MAX_OPENS_PER_TICK = 400; // spread a cold scan across ticks; don't open 6k DBs at once
const WINDOW_HOURS = 24;
const ACTIVITY_LOOKBACK_MS = 26 * 3600 * 1000; // query a little past the window so buckets are complete
// A single ENOENT does not tombstone a file that previously had data (a DB being
// replaced/renamed looks momentarily absent); this many consecutive ones does.
const MISSING_CONFIRMATIONS = 2;
// Backstop so a permanently-unreadable path can't leave the warm-up pending
// forever. It does NOT promote a partial cache to authoritative: on expiry the
// worker reports `fatal` and the host reverts to its own main-thread scans.
// Measured from the first SUCCESSFUL central-DB inventory.
const WARMUP_MAX_MS = 120_000;

// Open the central DB read-only. A failure here is fatal → Worker 'error' →
// host falls back to its own main-thread scans.
const central = new Database(centralDbPath, { readonly: true });
central.pragma('busy_timeout = 2000');

const sessionsDir = join(dataDir, 'v2-sessions');

/** Per-file scan state. `hours` maps 'YYYY-MM-DDTHH' → message count in that hour. */
const files = new Map(); // dbPath -> { folder, direction, table, mtimeMs, ts, hours, nextCheckAt, lastChangedAt, missing }

let inventory = []; // [{ folder, inbound, outbound }]
let inventoryAt = 0;
let inventoryOk = false; // a central-DB enumeration has actually succeeded
let publishedMsgTs = new Map(); // folder -> ts last sent to the host
let publishedActivityJson = '';
let lastActivityPublish = 0;
let lastStatsPublish = 0;

// ---- Warm-up gate ------------------------------------------------------
// The host STOPS its own (complete, correct) main-thread scans when it sees
// `ready`, so we must not declare readiness — or publish anything it would
// apply — until the very first pass has settled every inventory path. With a
// 400-open-per-tick budget and thousands of session DBs, an ungated first
// publish would ship the first 400 files' activity as the whole fleet's and
// clobber the main-thread cache with it.
// A path is "settled" only once a read SUCCEEDED or an absence was CONFIRMED —
// an errored stat/open leaves it unsettled, because caching an unverified empty
// result and counting it as done is exactly how a partial cache gets declared
// authoritative.
const attemptedPaths = new Set();
// The backstop clock starts at the first SUCCESSFUL inventory, not at worker
// construction: if the central DB is unreadable for the first three minutes,
// counting that time against the warm-up would hand off after classifying only
// the first per-tick slice of the fleet.
let inventoryOkAt = 0;
let warmedUp = false;
let warmupFailed = false;

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
    if (!inventoryOk) inventoryOkAt = now;
    inventoryOk = true;
    // Drop per-file state for sessions that no longer exist.
    for (const path of files.keys()) if (!livePaths.has(path)) files.delete(path);
    for (const path of attemptedPaths) if (!livePaths.has(path)) attemptedPaths.delete(path);
  } catch {
    // Central DB transiently unreadable — keep the previous inventory. If we
    // have never had one, `inventoryOk` stays false and the warm-up gate keeps
    // us silent: publishing "zero sessions, zero activity" and then claiming
    // `ready` would hand the host an empty fleet as the truth.
  }
}

/** Deterministic per-path phase within the cold interval, so ~1/COLD_INTERVAL of
 *  the fleet is statted per tick instead of the whole fleet on one tick. */
function pathPhase(path) {
  let h = 2166136261;
  for (let i = 0; i < path.length; i++) {
    h ^= path.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % COLD_INTERVAL_MS;
}

/** Next absolute cold-check time for `path`, aligned to its phase slot (so the
 *  effective period stays exactly COLD_INTERVAL_MS rather than drifting). */
function nextColdCheck(now, path) {
  const phase = pathPhase(path);
  return (Math.floor((now - phase) / COLD_INTERVAL_MS) + 1) * COLD_INTERVAL_MS + phase;
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

  // A stat has THREE outcomes, not two. Collapsing "errored" into "missing" was
  // a silent data-loss path: an EMFILE/EACCES blip would replace a good
  // { ts, hours } with { ts: null, hours: {} }, which drops the group's unread
  // timestamp AND subtracts that file's messages from the activity histogram —
  // and because the tombstone is written at the cold cadence, the false-empty
  // persists. Only a CONFIRMED absence may tombstone; an error preserves the
  // last good state and retries hot.
  let mtimeMs;
  try {
    statCalls++;
    mtimeMs = statSync(path).mtimeMs; // throws if the file doesn't exist
  } catch (e) {
    const code = e && e.code;
    const absent = code === 'ENOENT' || code === 'ENOTDIR';
    if (!absent) {
      if (st) {
        st.nextCheckAt = now + HOT_INTERVAL_MS; // keep prior ts/hours; retry hot
        return false;
      }
      // Nothing to preserve — record an empty entry but keep it hot so the first
      // successful stat lands immediately, and don't mark it `missing`.
      //
      // NOT added to `attemptedPaths`: an errored stat has told us nothing about
      // this file, and counting it as settled would let the warm-up gate declare
      // an unverified empty cache authoritative and hand off on it.
      files.set(path, {
        direction,
        table,
        mtimeMs: -1,
        ts: null,
        hours: new Map(),
        nextCheckAt: now + HOT_INTERVAL_MS,
        lastChangedAt: now,
        missing: false,
        missCount: 0,
      });
      return false;
    }
    // Confirmed absent. Tolerate a single ENOENT against known-good state.
    const misses = (st ? st.missCount || 0 : 0) + 1;
    if (st && !st.missing && misses < MISSING_CONFIRMATIONS) {
      st.missCount = misses;
      st.nextCheckAt = now + HOT_INTERVAL_MS;
      return false;
    }
    files.set(path, {
      direction,
      table,
      mtimeMs: -1,
      ts: null,
      hours: new Map(),
      nextCheckAt: nextColdCheck(now, path),
      lastChangedAt: st ? st.lastChangedAt : now,
      missing: true,
      missCount: misses,
    });
    attemptedPaths.add(path);
    return false;
  }

  // The stat SUCCEEDED, so the file is present right now: any earlier ENOENT is
  // no longer part of a CONSECUTIVE run. Reset before the branches below —
  // leaving it set let "ENOENT → present → (open-budget exhausted | DB read
  // failed) → ENOENT" reach MISSING_CONFIRMATIONS and tombstone a file whose
  // presence we had confirmed in between, dropping its unread timestamp and its
  // slice of the activity histogram.
  if (st) st.missCount = 0;

  if (st && !st.missing && st.mtimeMs === mtimeMs) {
    // Unchanged: reuse cached ts/hours; slide to cold cadence once idle a while.
    const idleFor = now - st.lastChangedAt;
    st.nextCheckAt = idleFor > COLD_AFTER_MS ? nextColdCheck(now, path) : now + HOT_INTERVAL_MS;
    attemptedPaths.add(path);
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
    // Not added to `attemptedPaths` — a failed read is not a settled cache
    // state, and the warm-up gate must not hand off on it.
    files.set(path, {
      direction,
      table,
      mtimeMs: -1,
      ts: null,
      hours: new Map(),
      nextCheckAt: now + HOT_INTERVAL_MS,
      lastChangedAt: now,
      missing: false,
      missCount: 0,
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
    missCount: 0,
  });
  attemptedPaths.add(path);
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

/** Number of inventory paths whose cache state has not settled yet. */
function unsettledPathCount() {
  let pending = 0;
  for (const sess of inventory) {
    if (!attemptedPaths.has(sess.inbound)) pending++;
    if (!attemptedPaths.has(sess.outbound)) pending++;
  }
  return pending;
}

/**
 * True once the initial pass has settled EVERY inventory path. Until then we
 * publish nothing and never claim `ready`.
 *
 * The backstop no longer promotes a partial cache to authoritative: if paths are
 * still unsettled WARMUP_MAX_MS after the first successful inventory, something
 * is durably unreadable, and handing the host a fleet snapshot that is missing
 * those files would silently drop their unread timestamps and their share of the
 * activity histogram. We report the failure instead and the host reverts to its
 * own (complete) main-thread scans.
 */
function warmupComplete(now) {
  if (warmedUp) return true;
  if (warmupFailed) return false;
  if (!inventoryOk) return false;
  const pending = unsettledPathCount();
  if (pending === 0) {
    warmedUp = true;
    return true;
  }
  if (now - inventoryOkAt <= WARMUP_MAX_MS) return false;
  warmupFailed = true;
  parentPort.postMessage({
    kind: 'fatal',
    message: `warm-up did not settle ${pending} of ${inventory.length * 2} session-DB paths within ${Math.round(
      WARMUP_MAX_MS / 1000,
    )}s`,
  });
  return false;
}

function tick() {
  const start = Date.now();
  refreshInventory(start);
  const budget = { opens: 0 };
  for (const sess of inventory) {
    refreshFile(sess.inbound, 'inbound', 'messages_in', start, budget);
    refreshFile(sess.outbound, 'outbound', 'messages_out', start, budget);
  }
  const warm = warmupComplete(start);
  if (warm) {
    // `ready` MUST precede the first data frame. MessagePort delivery is
    // strictly ordered, and the host ignores anything that arrives before the
    // handoff — so publishing first meant the host DISCARDED the initial
    // msgTs/activity frames while this side had already recorded them as
    // published and would never resend them. Every group's lastMessageTs (the
    // unread badge, the coworker-chat auto-refresh) then stayed empty until each
    // file happened to change again: indefinitely, for an idle fleet.
    if (!readySent) {
      readySent = true;
      parentPort.postMessage({ kind: 'ready' });
    }
    publishMsgTs();
    publishActivity(start);
  }
  lastTickMs = Date.now() - start;
  publishStats(start);
  return warm;
}

// Announce readiness only once WARM-UP has completed — the host hands off (stops
// its own scans) on `ready`, so we must not claim readiness on a tick that threw
// (e.g. the central DB was momentarily unreadable), on a tick whose inventory
// enumeration failed, or on a tick that has only classified the first slice of a
// large fleet (the per-tick open budget). `ready` is posted inside tick(),
// immediately BEFORE the first publish, so the host's handoff is complete by the
// time the first data frame reaches it. A fatal failure to even open the central
// DB happens above, at module load, and surfaces as the Worker 'error' event →
// host falls back.
let readySent = false;
function runTick() {
  try {
    tick();
  } catch (e) {
    // Never let one bad tick kill the worker; report the first fault for debug.
    if (!readySent) parentPort.postMessage({ kind: 'error', message: String((e && e.message) || e) });
  }
}
runTick(); // immediate first pass so the host's caches warm fast
const timer = setInterval(runTick, TICK_MS);
timer.unref?.();

parentPort.on('message', (msg) => {
  if (msg === 'republish') {
    // The host lost frames (its pre-handoff queue overflowed) and cannot patch
    // its caches from deltas alone. Forget what we believe it holds so the next
    // tick re-sends the FULL msgTs map and activity histogram.
    publishedMsgTs = new Map();
    publishedActivityJson = '';
    lastActivityPublish = 0;
    return;
  }
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
