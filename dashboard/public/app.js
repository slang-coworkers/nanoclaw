/**
 * NanoClaw Dashboard — Main Application
 *
 * Tab 1: Pixel Art Office — uses Pixel Agents PNG assets (MIT) with procedural fallback
 * Tab 2: Timeline / Audit — dev-mode timeline of all events + debug log
 */

const PixelSprites = window.PixelSprites;
if (!PixelSprites) {
  throw new Error('Pixel sprite engine failed to load');
}

let state = { coworkers: [], tasks: [], taskRunLogs: [], registeredGroups: [], hookEvents: [], timestamp: 0 };
// Revision of the last full snapshot/delta we applied. The live channel carries
// `state-delta` frames tagged { stateEpoch, baseRev, rev }; a delta whose baseRev
// doesn't match ours means we missed one, so we resync.
//
// `stateEpoch` identifies the SERVER PROCESS. Revisions are per-process counters
// that reset on restart, so rev alone is ambiguous across a restart: a client
// left at rev 1 by the old process would accept `{baseRev:1, rev:2}` from the
// new one and patch it onto a baseline the new process never had — anything
// deleted during the downtime would then be pinned on screen forever, because
// the new server's deltas can only ever remove rows its own baseline contained.
// Any epoch change forces a full resync.
let stateRev = 0;
let stateEpoch = null;
const nativeFetch = window.fetch.bind(window);
const dashboardAuth = {
  checked: false,
  required: false,
  authenticated: false,
  prompting: null,
};

function isApiRequest(input) {
  const url = typeof input === 'string' ? input : input.url;
  return url.startsWith('/api/') || url.startsWith(`${window.location.origin}/api/`);
}

function isAuthRequest(input) {
  const url = typeof input === 'string' ? input : input.url;
  return url.startsWith('/api/auth/') || url.startsWith(`${window.location.origin}/api/auth/`);
}

async function refreshDashboardAuthStatus() {
  try {
    const res = await nativeFetch('/api/auth/status', { cache: 'no-store' });
    if (!res.ok) return { required: false, authenticated: true };
    const status = await res.json();
    dashboardAuth.checked = true;
    dashboardAuth.required = !!status.required;
    dashboardAuth.authenticated = !!status.authenticated;
    return status;
  } catch {
    return { required: false, authenticated: true };
  }
}

async function promptForDashboardSecret() {
  if (dashboardAuth.prompting) return dashboardAuth.prompting;
  dashboardAuth.prompting = (async () => {
    const secret = window.prompt('Enter dashboard secret');
    if (!secret) return false;
    const res = await nativeFetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret }),
    });
    if (!res.ok) {
      let err = 'Invalid dashboard secret';
      try {
        const data = await res.json();
        err = data.error || err;
      } catch {
        /* ignore */
      }
      alert(err);
      dashboardAuth.authenticated = false;
      return false;
    }
    dashboardAuth.checked = true;
    dashboardAuth.authenticated = true;
    return true;
  })();
  try {
    return await dashboardAuth.prompting;
  } finally {
    dashboardAuth.prompting = null;
  }
}

async function ensureDashboardAuth(forcePrompt = false) {
  const status = forcePrompt || !dashboardAuth.checked ? await refreshDashboardAuthStatus() : dashboardAuth;
  if (!status.required) return true;
  if (status.authenticated) return true;
  const loggedIn = await promptForDashboardSecret();
  if (!loggedIn) return false;
  const refreshed = await refreshDashboardAuthStatus();
  return !!refreshed.authenticated;
}

window.fetch = async function (input, init) {
  if (!isApiRequest(input) || isAuthRequest(input)) {
    return nativeFetch(input, init);
  }
  let res = await nativeFetch(input, init);
  if (res.status !== 401) return res;
  const authed = await ensureDashboardAuth(true);
  if (!authed) return res;
  res = await nativeFetch(input, init);
  return res;
};

// Unread message tracking via localStorage
const readCursors = {
  KEY: 'nanoclaw-read-cursors',
  _cache: null,
  get() {
    if (!this._cache) {
      try {
        this._cache = JSON.parse(localStorage.getItem(this.KEY) || '{}');
      } catch {
        this._cache = {};
      }
    }
    return this._cache;
  },
  getFor(folder) {
    return this.get()[folder] || null;
  },
  markRead(folder, timestamp) {
    const c = this.get();
    c[folder] = timestamp;
    this._cache = c;
    localStorage.setItem(this.KEY, JSON.stringify(c));
  },
};

function hasUnread(folder) {
  const cw = (state.coworkers || []).find((c) => c.folder === folder);
  if (!cw || !cw.lastMessageTs) return false;
  const cursor = readCursors.getFor(folder);
  if (!cursor) return true;
  return cw.lastMessageTs > cursor;
}

// Per-session unread tracking. Cursor is the ms timestamp of the last time the
// user opened this session (via chat 💬 or timeline ≡, or by having it as the
// currently-active session). A session is unread if its last_active is newer
// than the cursor.
const sessionReadCursors = {
  KEY: 'nanoclaw-session-read-cursors',
  _cache: null,
  get() {
    if (!this._cache) {
      try {
        this._cache = JSON.parse(localStorage.getItem(this.KEY) || '{}');
      } catch {
        this._cache = {};
      }
    }
    return this._cache;
  },
  getFor(sid) {
    return this.get()[sid] || 0;
  },
  markRead(sid, ms) {
    const c = this.get();
    c[sid] = ms || Date.now();
    this._cache = c;
    try {
      localStorage.setItem(this.KEY, JSON.stringify(c));
    } catch {}
  },
};

function sessionLastActiveMs(sess) {
  if (!sess) return 0;
  if (sess.last_active) {
    const t = new Date(sess.last_active).getTime();
    if (Number.isFinite(t)) return t;
  }
  const subs = sess.sdk_subsessions;
  if (Array.isArray(subs) && subs.length) {
    const t = subs[0].last_ts || 0;
    if (Number.isFinite(t)) return t;
  }
  return 0;
}

function hasSessionUnread(sess) {
  const sid = sess?.nanoclaw_session_id;
  if (!sid) return false;
  const lastMs = sessionLastActiveMs(sess);
  if (!lastMs) return false;
  const cursor = sessionReadCursors.getFor(sid);
  return lastMs > cursor;
}

let selectedCoworker = null;
let frame = 0;
let liveSource = null;
let pollTimer = null;
let liveReconnectTimer = null;
let liveReconnectAttempt = 0;
let hiddenDisconnectTimer = null;
let lastHookEventId = 0;
// Resync barrier. A resync fetches a full snapshot over HTTP while the live
// delta stream keeps running, so the two race: without a barrier a delta that
// arrives mid-flight is either applied and then rewound by an older snapshot, or
// rejected and then lost forever (the snapshot's revision hides the gap). While
// the barrier is up, deltas are buffered and replayed against the snapshot's
// exact revision once it lands.
let resyncBarrier = false;
let resyncInFlight = null;
let bufferedDeltas = [];
let resyncRetryTimer = null;
let resyncAttempt = 0;
const MAX_BUFFERED_DELTAS = 200;
let hoveredDesk = -1;
let timelineFilter = null; // group folder filter for timeline
let cachedMessages = []; // messages fetched from /api/messages
let sessionFlowMode = false; // true when viewing a session flow
let sessionFlowData = null; // current session flow data
let cachedSessions = []; // sessions list from /api/hook-events/sessions
let timelineNoMoreEvents = false;
let timelineDisplayLimit = 200;
let timelineOlderEvents = []; // Events loaded via "Load older" — survive state polls
const hookEventDetails = new Map();
const LIVE_HOOK_EVENT_LIMIT = 500;

const Z = PixelSprites.ZOOM;
const OFFICE_TILE = PixelSprites.TILE;
const STATUS_CONFIG = {
  idle: ['#6B7280', 'IDLE'],
  active: ['#3B82F6', 'ACTIVE'],
  working: ['#10B981', 'WORKING'],
  thinking: ['#F59E0B', 'THINKING'],
  error: ['#EF4444', 'ERROR'],
};
const SUBAGENT_TYPE_COLORS = {
  worker: '#10B981',
  explorer: '#3B82F6',
  default: '#8B5CF6',
};

function getStatusConfig(status) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.idle;
}

function renderStatusBadge(status) {
  const [sColor, sLabel] = getStatusConfig(status);
  return `<span class="status-badge" style="background:${sColor}20;color:${sColor}">${sLabel}</span>`;
}

function updateDotHtml(isAutoUpdate, showLabel) {
  if (showLabel) {
    return isAutoUpdate
      ? '<span class="update-indicator auto" title="CLAUDE.md auto-refreshes from template on startup">auto-update</span>'
      : '<span class="update-indicator frozen" title="CLAUDE.md frozen at creation time">static</span>';
  }
  return isAutoUpdate
    ? '<span class="update-dot auto" title="Auto-update"></span>'
    : '<span class="update-dot frozen" title="Static"></span>';
}

function renderSubagentBadge(subagent) {
  if (subagent.phase === 'leaving') {
    return '<span class="status-badge" style="background:#64748b20;color:#94a3b8">EXITING</span>';
  }
  return renderStatusBadge(subagent.status);
}

function formatSubagentName(subagent) {
  const type = subagent.agentType && subagent.agentType !== 'default' ? subagent.agentType : 'child';
  const suffix = (subagent.agentId || '').slice(0, 8) || '?';
  return `${type}:${suffix}`;
}

function renderSubagentList(cw) {
  if (!cw.subagents || cw.subagents.length === 0) return 'None';
  return `<div class="subagent-list">${cw.subagents
    .map(
      (subagent) => `
    <div class="subagent-card">
      <div class="subagent-head">
        <span class="subagent-name">${esc(formatSubagentName(subagent))}</span>
        ${renderSubagentBadge(subagent)}
      </div>
      <div class="subagent-type">${esc(subagent.agentType || 'default')}</div>
      <div class="subagent-meta">${esc(subagent.phase === 'leaving' ? subagent.lastNotification || 'Leaving desk' : subagent.lastToolUse || subagent.lastNotification || 'Standing by')}</div>
    </div>
  `,
    )
    .join('')}</div>`;
}

function setLiveStatus(label, colorVar) {
  document.getElementById('ws-status').textContent = label;
  document.querySelector('.status-dot').style.background = colorVar;
}

// --- WebSocket ---
const TAB_HASH_MAP = { 'pixel-office': 'pixel-office', coworkers: 'cw', observability: 'timeline', admin: 'admin' };
const HASH_TAB_MAP = Object.fromEntries(Object.entries(TAB_HASH_MAP).map(([k, v]) => [v, k]));

function switchToTab(tabId, { syncHash = true } = {}) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach((t) => t.classList.remove('active'));
  document.querySelector(`[data-tab="${tabId}"]`)?.classList.add('active');
  document.getElementById(tabId)?.classList.add('active');
  if (syncHash && tabId !== 'coworkers') syncTabHash(tabId);
}

function syncTabHash(tabId) {
  const slug = TAB_HASH_MAP[tabId];
  if (!slug) return;
  let hash = `#/${slug}`;
  if (tabId === 'admin' && adminState.panel && adminState.panel !== 'overview') {
    hash += `/${adminState.panel}`;
  }
  if (location.hash !== hash) history.replaceState(null, '', hash);
}

function applyTabHash() {
  const hash = location.hash || '';
  if (hash.startsWith('#/cw')) return false;
  const m = /^#\/([^/]+)(?:\/(.+))?$/.exec(hash);
  if (!m) return false;
  const tabId = HASH_TAB_MAP[m[1]];
  if (!tabId) return false;
  switchToTab(tabId, { syncHash: false });
  if (tabId === 'admin' && m[2]) {
    const panel = m[2];
    const pill = document.querySelector(`.admin-pill[data-panel="admin-${panel}"]`);
    if (pill) pill.click();
  }
  return true;
}

// Issue funnel panel — reads the cached snapshot from /api/funnel (written by
// `scripts/funnel.ts --out reports/funnel.json`). The dashboard never recomputes
// the funnel; if no snapshot exists the endpoint 404s with a refresh hint.
// Loaded under Admin > Funnel; loadAdminPanel() guards first-load via
// adminState.loaded and the Refresh button clears that entry to force a reload.
// Kick off a server-side funnel recompute (~3 min, ~180 GitHub calls), poll for
// completion, then reload the panel from the freshly-written snapshot. The
// button shows progress and is disabled while the recompute runs.
async function triggerFunnelRefresh(btn) {
  const stamp = document.getElementById('funnel-stamp');
  const label = btn ? btn.textContent : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Refreshing…';
  }
  try {
    const res = await fetch('/api/funnel/refresh', { method: 'POST' });
    // 409 = a recompute (or the cron) is already running; just poll it.
    if (!res.ok && res.status !== 409) throw new Error('refresh failed');
  } catch {
    if (stamp) stamp.textContent = 'refresh failed to start';
    if (btn) {
      btn.disabled = false;
      btn.textContent = label;
    }
    return;
  }
  // Poll status until the run finishes (or we give up after ~8 min).
  const deadline = Date.now() + 8 * 60 * 1000;
  const poll = async () => {
    let st;
    try {
      st = await (await fetch('/api/funnel/status')).json();
    } catch {
      st = null;
    }
    if (st && !st.running) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = label;
      }
      if (st.lastError) {
        if (stamp) stamp.textContent = 'refresh failed — see logs/funnel-cron.log';
      } else {
        adminState.loaded.delete('funnel');
        loadFunnel();
      }
      return;
    }
    if (Date.now() > deadline) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = label;
      }
      if (stamp) stamp.textContent = 'refresh still running — reload shortly';
      return;
    }
    setTimeout(poll, 4000);
  };
  setTimeout(poll, 4000);
}

// Guards against CONCURRENT loadFunnel() runs duplicating the detail panels.
//
// loadFunnel clears #funnel-detail once, then appends a container per panel with
// an `await` before each one. Two overlapping calls therefore interleave: the
// second clears the pane the first is still filling, and both keep appending
// after their awaits resolve. Observed on prod as "KB doctor" twice and "Unit
// cost" three times in one view.
//
// Each run takes a ticket; after every await it checks whether a newer run has
// started and, if so, stops touching the DOM.
let funnelRenderSeq = 0;

async function loadFunnel() {
  const myGen = ++funnelRenderSeq;
  const stale = () => myGen !== funnelRenderSeq;
  const board = document.getElementById('funnel-board');
  const detail = document.getElementById('funnel-detail');
  const stamp = document.getElementById('funnel-stamp');
  if (board) board.innerHTML = 'Loading…';
  let snap;
  try {
    const res = await fetch('/api/funnel');
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      if (board)
        board.innerHTML = `<span style="color:var(--text-muted)">No funnel snapshot yet. ${esc(j.hint || '')}</span>`;
      if (detail) detail.innerHTML = '';
      return;
    }
    snap = await res.json();
    if (stale()) return;
  } catch (e) {
    if (board) board.innerHTML = 'Failed to load funnel.';
    return;
  }
  if (stamp) stamp.textContent = snap.generatedAt ? `snapshot: ${formatTime(snap.generatedAt)}` : '';
  const b = snap.board || {};
  // Shared cell padding so columns don't collapse into "prodlegototalconv".
  const TH = (label, left) =>
    `<th style="text-align:${left ? 'left' : 'right'};padding:2px 12px;border-bottom:1px solid var(--border)">${label}</th>`;
  const TD = (html, left, bold) =>
    `<td style="text-align:${left ? 'left' : 'right'};padding:2px 12px">${bold ? '<b>' + html + '</b>' : html}</td>`;
  const row = (label, cell, base) => {
    const c = cell || { prod: 0, lego: 0, total: 0 };
    const conv = base && base.total ? Math.round((c.total / base.total) * 100) + '%' : '';
    return `<tr>${TD(esc(label), true)}${TD(c.prod)}${TD(c.lego)}${TD(c.total, false, true)}<td style="text-align:right;padding:2px 12px;color:var(--text-muted)">${conv}</td></tr>`;
  };

  // ── Issue partition: the per-issue funnel (denominator = ALL filed issues) ──
  const ip = snap.issuePartition;
  const partHtml = ip && ip.counts ? funnelFlowHtml(ip, snap.rows || []) : '';

  // PR-approver (Verity) shadow-mode ledger — ALL decisions, not just the bot-
  // authored PRs that appear in the funnel spine. Appended below the partition.
  // reviewCycles rides inside the funnel snapshot, so it needs no extra fetch.
  if (board)
    board.innerHTML =
      partHtml +
      reviewCyclesHtml(snap.reviewCycles) +
      funnelApproverPanel(snap.approverDecisions || [], snap.approverLedger, snap.approverWeekly || []);

  // nv-slang-bot contribution table (separate snapshot: /api/bot-contributions).
  if (detail) {
    detail.innerHTML =
      '<div style="color:var(--text-muted);font-size:11px;margin-top:16px">Loading bot contributions…</div>';
    try {
      const r = await fetch('/api/bot-contributions');
      if (r.ok) {
        detail.innerHTML = botContributionsHtml(await r.json());
      } else {
        const j = await r.json().catch(() => ({}));
        detail.innerHTML = `<div style="color:var(--text-muted);font-size:11px;margin-top:16px">nv-slang-bot contributions: no snapshot yet. ${esc(j.hint || '')}</div>`;
      }
      const btn = detail.querySelector('[data-action="refresh-botc"]');
      if (btn) btn.addEventListener('click', () => triggerBotcRefresh(btn));
    } catch {
      detail.innerHTML = '';
    }

    // Regression quality is a genuinely INDEPENDENT snapshot with its own host
    // cron, so it gets its own try/catch and its own container. Nesting it in
    // the block above meant a bot-contributions network error or malformed body
    // jumped to that catch, skipped this fetch entirely and cleared the pane —
    // the two panels have no reason to fail together.
    if (stale()) return;
    const rqBox = document.createElement('div');
    detail.appendChild(rqBox);
    try {
      const rq = await fetch('/api/regression-quality');
      if (stale()) return;
      if (rq.ok) {
        rqBox.innerHTML = regressionQualityHtml(await rq.json());
      } else {
        const jq = await rq.json().catch(() => ({}));
        rqBox.innerHTML =
          '<div style="color:var(--text-muted);font-size:11px;margin-top:20px">Regression quality: no snapshot yet. ' +
          esc(jq.hint || '') +
          '</div>';
      }
    } catch (e) {
      rqBox.innerHTML =
        '<div style="color:var(--text-muted);font-size:11px;margin-top:20px">Regression quality: failed to load.</div>';
    }

    // KB health + doctor. Own container and own try/catch for the same reason
    // regression quality has them: an unrelated panel's network error must not
    // blank this one.
    //
    // This panel exists because the route did not. /api/kb-health has been
    // serving a validated `doctor` block since #1121/#1169 — fail-closed, no
    // false zeroes — and nothing rendered it, so the only way to read a drift
    // report was curl. A check nobody can see is a check nobody acts on.
    if (stale()) return;
    const kbBox = document.createElement('div');
    detail.appendChild(kbBox);
    try {
      const kb = await fetch('/api/kb-health');
      if (stale()) return;
      if (kb.ok) {
        kbBox.innerHTML = kbDoctorHtml(await kb.json());
      } else {
        kbBox.innerHTML =
          '<div style="color:var(--text-muted);font-size:11px;margin-top:20px">KB doctor: route unavailable.</div>';
      }
    } catch (e) {
      kbBox.innerHTML =
        '<div style="color:var(--text-muted);font-size:11px;margin-top:20px">KB doctor: failed to load.</div>';
    }

    // Unit cost. Own container + own try/catch, same reasoning as the two above.
    if (stale()) return;
    const ucBox = document.createElement('div');
    detail.appendChild(ucBox);
    try {
      const uc = await fetch('/api/unit-cost?weeks=4');
      if (stale()) return;
      if (uc.ok) {
        ucBox.innerHTML = unitCostHtml(await uc.json());
      } else {
        ucBox.innerHTML =
          '<div style="color:var(--text-muted);font-size:11px;margin-top:20px">Unit cost: route unavailable.</div>';
      }
    } catch (e) {
      ucBox.innerHTML =
        '<div style="color:var(--text-muted);font-size:11px;margin-top:20px">Unit cost: failed to load.</div>';
    }

    // Review rounds — human CHANGES_REQUESTED rounds per PR, bot vs human, by
    // merge week (/api/review-rounds, its own host cron). Own container + own
    // try/catch, same reasoning as the panels above: an unrelated network error
    // must not blank this one. Renders nothing when the snapshot is absent.
    if (stale()) return;
    const rrBox = document.createElement('div');
    detail.appendChild(rrBox);
    try {
      const rr = await fetch('/api/review-rounds');
      if (stale()) return;
      if (rr.ok) {
        rrBox.innerHTML = reviewRoundsHtml(await rr.json());
      } else {
        const jr = await rr.json().catch(() => ({}));
        rrBox.innerHTML =
          '<div style="color:var(--text-muted);font-size:11px;margin-top:20px">Review rounds: no snapshot yet. ' +
          esc(jr.hint || '') +
          '</div>';
      }
    } catch (e) {
      rrBox.innerHTML =
        '<div style="color:var(--text-muted);font-size:11px;margin-top:20px">Review rounds: failed to load.</div>';
    }
  }
}

// Unit cost — triager+fixer+reviewer spend per PR opened, by ISO week.
//
// THE RULE THIS PANEL KEEPS: a number is only ever shown when it is a real
// quotient. Three distinct states have to stay distinguishable, and collapsing
// any of them into "$0" would invent a saving that did not happen:
//
//   no data for that week   -> "no data"     (outside coverage / group absent)
//   spend but no PR opened  -> "no PR"       (real state; NOT free, NOT infinite)
//   a genuine quotient      -> "$N"
//
// The denominator is shown next to every bar for the same reason the other
// funnel panels show theirs: a cost-per-PR of $153 means something different
// over 40 PRs than over 2.
function unitCostHtml(uc) {
  if (!uc) return '';
  const money = (n) => '$' + Math.round(n).toLocaleString();
  const head =
    '<div style="margin-top:22px;font-size:12px;font-weight:600">Unit cost</div>' +
    '<div style="color:var(--text-muted);font-size:11px;margin-bottom:8px">' +
    'cost per PR opened, by week &middot; triager + fixer + reviewer &middot; prod</div>';

  if (uc.unavailable) {
    // Words, never a number. An unavailable metric that renders "$0" is worse
    // than one that renders nothing.
    return head + '<div style="color:var(--text-muted);font-size:11px">Unavailable — ' + esc(uc.unavailable) + '</div>';
  }
  const weeks = Array.isArray(uc.weeks) ? uc.weeks : [];
  if (weeks.length === 0) {
    return head + '<div style="color:var(--text-muted);font-size:11px">No weeks to show.</div>';
  }

  const priced = weeks.filter((w) => w.costPerPr != null);
  const max = priced.length ? Math.max(...priced.map((w) => w.costPerPr)) : 0;
  const bars = weeks
    .map((w) => {
      let label, width, dim;
      if (!w.hasCost) {
        label = 'no data';
        width = 0;
        dim = true;
      } else if (w.costPerPr == null) {
        label = 'no PR opened';
        width = 0;
        dim = true;
      } else {
        label = money(w.costPerPr);
        width = max > 0 ? Math.round((w.costPerPr / max) * 100) : 0;
        dim = false;
      }
      const denom = w.hasCost ? esc(String(w.prs)) + ' PR' + (w.prs === 1 ? '' : 's') : '&mdash;';
      return (
        '<div style="display:flex;align-items:center;gap:8px;margin:3px 0;font-size:11px">' +
        '<div style="width:82px;color:var(--text-muted)">' +
        esc(w.week) +
        '</div>' +
        '<div style="flex:1;background:var(--bg-alt,#22252a);height:14px;border-radius:3px;overflow:hidden">' +
        '<div style="width:' +
        width +
        '%;height:100%;background:' +
        (dim ? 'transparent' : 'var(--accent,#76b900)') +
        '"></div></div>' +
        '<div style="width:66px;text-align:right;' +
        (dim ? 'color:var(--text-muted)' : 'font-weight:600') +
        '">' +
        esc(label) +
        '</div>' +
        '<div style="width:56px;text-align:right;color:var(--text-muted)">' +
        denom +
        '</div>' +
        '</div>'
      );
    })
    .join('');

  // Trend only across weeks that actually have a quotient — comparing against a
  // "no data" week would manufacture a delta out of missing coverage.
  let trend = '';
  if (priced.length >= 2) {
    const first = priced[0].costPerPr;
    const last = priced[priced.length - 1].costPerPr;
    if (first > 0) {
      const pct = Math.round(((last - first) / first) * 100);
      trend =
        '<div style="font-size:11px;margin-top:6px;color:var(--text-muted)">' +
        (pct <= 0 ? '&minus;' : '+') +
        Math.abs(pct) +
        '% over ' +
        priced.length +
        ' priced week' +
        (priced.length === 1 ? '' : 's') +
        ' &middot; ' +
        money(first) +
        ' &rarr; ' +
        money(last) +
        '</div>';
    }
  }

  let gaps = '';
  if (Array.isArray(uc.groupsMissing) && uc.groupsMissing.length) {
    // Named, not silently omitted: a missing group means the numerator is
    // understated and the cost-per-PR reads better than it is.
    gaps =
      '<div style="font-size:11px;margin-top:4px;color:var(--warn,#d29922)">No cost data for: ' +
      esc(uc.groupsMissing.join(', ')) +
      ' — numerator is understated.</div>';
  }

  return head + bars + trend + gaps;
}

// KB doctor — the `doctor` block of /api/kb-health (scripts/kb-doctor.py writes
// data/shared/.kb-doctor.json; the route validates it, see dashboard/
// kb-doctor-artifact.ts).
//
// THE ONE RULE THIS PANEL EXISTS TO KEEP: unavailable is not zero, and unknown
// is not clean. The whole point of #1121/#1169 was that a missing or malformed
// artifact used to render as "0 drift" — indistinguishable from a healthy KB.
// So an absent report says so in words, and a run that could not evaluate some
// checks shows the unknown count next to the drift count rather than folding
// them together.
function kbDoctorHtml(kbh) {
  const d = kbh && kbh.doctor;
  if (!d) return '';

  if (!d.available) {
    // The route supplies a specific reason (missing file, bad schema, counts
    // that disagree with their arrays). Show it: "no report" and "a report we
    // could not trust" are different problems with different fixes.
    return (
      '<div style="margin-top:20px"><div style="font-weight:600;margin-bottom:4px">KB doctor</div>' +
      '<div style="color:var(--text-muted);font-size:11px">No usable drift report' +
      (d.reason ? ' — ' + esc(d.reason) : '') +
      '. Runs daily at 05:50; <code>python3 scripts/kb-doctor.py</code> to produce one now.</div></div>'
    );
  }

  const drift = Number(d.driftCount) || 0;
  const unknown = Number(d.unknownCount) || 0;
  const okColor = '#3fb950';
  const warn = 'var(--warn,#c90)';
  const bad = '#e5534b';

  // Age. `stale` is decided by the route (it knows the cadence); we render it.
  let freshness = '';
  if (d.stale) {
    freshness = ' · <b style="color:' + warn + '">stale</b>';
  } else if (typeof d.ageHours === 'number') {
    freshness = ' · ' + (d.ageHours < 1 ? 'just now' : Math.round(d.ageHours) + 'h ago');
  } else {
    freshness = ' · <span style="color:' + warn + '">age unknown</span>';
  }

  // An incomplete run cannot be read as a clean one.
  const incomplete = d.complete === false ? ' · <b style="color:' + warn + '">incomplete run</b>' : '';

  const pill = (label, n, color) =>
    '<span style="display:inline-block;padding:1px 7px;margin-right:6px;border-radius:9px;' +
    'background:var(--bg-alt,#2226);font-size:11px;color:' +
    color +
    '">' +
    esc(label) +
    ' ' +
    n +
    '</span>';

  const pills =
    pill('drift', drift, drift ? bad : okColor) +
    // Unknown gets its own pill on purpose — it is neither pass nor fail, and
    // hiding it inside "drift 0" is exactly the false clean this replaced.
    pill('unknown', unknown, unknown ? warn : 'var(--text-muted)');

  const items =
    Array.isArray(d.drift) && d.drift.length
      ? '<ul style="margin:6px 0 0 16px;padding:0;font-size:11px;color:var(--text-muted)">' +
        d.drift.map((x) => '<li style="margin-bottom:3px">' + esc(String(x)) + '</li>').join('') +
        '</ul>'
      : '';

  const unknowns =
    Array.isArray(d.unknown) && d.unknown.length
      ? '<ul style="margin:6px 0 0 16px;padding:0;font-size:11px;color:' +
        warn +
        '">' +
        d.unknown.map((x) => '<li style="margin-bottom:3px">' + esc(String(x)) + '</li>').join('') +
        '</ul>'
      : '';

  return (
    '<div style="margin-top:20px">' +
    '<div style="font-weight:600;margin-bottom:4px">KB doctor ' +
    '<span style="font-weight:400;color:var(--text-muted)">— ' +
    esc(d.status || 'unknown') +
    freshness +
    incomplete +
    '</span></div>' +
    pills +
    items +
    unknowns +
    '</div>'
  );
}

// PR-approver (Verity) shadow-mode decision ledger. Unlike the funnel row table
// — which is gated by pr_session_mappings and so only lists bot-authored PRs —
// this shows EVERY decision Verity recorded, including the human-authored PRs it
// reviewed in shadow mode. `decisions` is snap.approverDecisions (newest first,
// one row per PR). Counts by decision are shown as a header summary.
function funnelApproverPanel(decisions, ledger, weekly) {
  if (!Array.isArray(decisions)) decisions = [];
  // Approve = green, block = red, abstain = muted. Matches the funnel row cell
  // (funnelIssueTableHtml's approverColor); literal hex here since the palette
  // object is scoped to funnelFlowHtml.
  // ABSTAIN_INFRA retired (task #14): folded into ABSTAIN_POLICY + an infra
  // reason_code. Historical ABSTAIN_INFRA ledger rows still render — the row
  // cell below falls through to var(--text-muted) for any unmapped decision.
  const decisionColor = {
    WOULD_APPROVE: '#3fb950',
    BLOCK: '#e5534b',
    ABSTAIN_POLICY: 'var(--text-muted)',
  };
  // PR-state pill color (matches the funnel palette): merged=green, open=blue,
  // closed=grey.
  const stateColor = { merged: '#3fb950', open: '#1f6feb', closed: '#6e7681' };
  const by = {};
  for (const d of decisions) by[d.decision] = (by[d.decision] || 0) + 1;
  const order = ['WOULD_APPROVE', 'BLOCK', 'ABSTAIN_POLICY'];
  // Show all current decision states (zeros included) so the panel reads as a
  // stable scoreboard, not a list that hides empty states. Retired states
  // (ABSTAIN_INFRA) are omitted from the scoreboard but still render per-row.
  const summary = order
    .map((k) => `<span style="color:${decisionColor[k]}">${k} ${by[k] || 0}</span>`)
    .join('<span style="color:var(--border)"> · </span>');

  // PROVENANCE. Until migration 934 lands, record_decision was reachable by any
  // container with authorization living only in the tool's description text, so
  // these rows can include writes of unknown origin. Once 934 has run, the
  // producer filters to trusted provenance — and a filtered count and an
  // unfiltered count would otherwise render IDENTICALLY. Say which one this is.
  // Same principle as regression-quality's complete:false: never let a narrowed
  // or degraded population look like a clean one.
  const provenance =
    ledger && ledger.provenanceFiltered === true
      ? '<span style="color:var(--text-muted);font-weight:400"> · trusted only' +
        (Array.isArray(ledger.trustedProvenance) && ledger.trustedProvenance.length
          ? ' (' + ledger.trustedProvenance.map(esc).join(', ') + ')'
          : '') +
        '</span>'
      : ledger && ledger.provenanceFiltered === false
        ? '<span style="color:var(--warn,#c90);font-weight:400"> · UNFILTERED — includes rows of unknown origin</span>'
        : '<span style="color:var(--text-muted);font-weight:400"> · provenance unknown</span>';
  const rows = decisions
    .map((d) => {
      const repo = (d.repo || '').split('/').pop();
      const prUrl = `https://github.com/${d.repo}/pull/${d.pr}`;
      const prLink = `<a href="${esc(prUrl)}" target="_blank" rel="noopener" style="color:var(--accent)">${esc(repo)} #${d.pr}</a>`;
      // Author tag: bot = the bot's own PR (also in the funnel spine); human =
      // a contributor PR Verity reviewed in shadow mode. null when unfetched.
      const authorTag =
        d.authoredByBot === true
          ? '<span style="color:var(--text-muted);font-size:10px"> · bot</span>'
          : d.authoredByBot === false
            ? '<span style="color:var(--text-muted);font-size:10px"> · human</span>'
            : '';
      const decCell = `<span style="color:${decisionColor[d.decision] || 'var(--text-muted)'}">${esc(d.decision)}</span>`;
      const human = d.human ? `<span style="color:var(--text-muted)"> → ${esc(d.human)}</span>` : '';
      const st = d.prState || '';
      const draft = d.isDraft ? ' <span style="color:var(--text-muted);font-size:10px">(draft)</span>' : '';
      const stateCell = st
        ? `<span style="color:${stateColor[st] || 'var(--text-muted)'}">${esc(st)}</span>${draft}`
        : '<span style="color:var(--text-muted)">—</span>';
      return `<tr>
        <td style="padding:3px 10px 3px 0">${prLink}${authorTag}</td>
        <td style="padding:3px 10px">${decCell}${human}</td>
        <td style="padding:3px 10px">${stateCell}</td>
        <td style="padding:3px 10px;color:var(--text-muted);font-size:10px"><code>${esc(d.reason || '—')}</code></td>
        <td style="padding:3px 10px;color:var(--text-muted);font-size:10px">${esc(d.mode || '')}</td>
        <td style="text-align:right;padding:3px 10px;color:var(--text-muted);font-size:10px">${d.decidedAt ? formatTime(d.decidedAt) : ''}</td>
      </tr>`;
    })
    .join('');
  // Default-CLOSED dropdown: the 4-category scoreboard + count live in the
  // always-visible <summary>; the per-PR ledger is inside <details> and only
  // expands on click. Native <details> (no `open`) = collapsed by default, no
  // JS wiring — matches the existing collapsible pattern used elsewhere in the
  // funnel (e.g. the "All N actionable issues" details).
  const empty =
    decisions.length === 0
      ? '<div style="font-size:11px;color:var(--text-muted);margin:4px 0 0 18px">No approver decisions recorded yet.</div>'
      : `<table style="border-collapse:collapse;font-size:12px;width:100%;max-width:820px;margin-top:6px">
        <thead><tr style="color:var(--text-muted);font-size:10px;text-transform:uppercase">
          <th style="text-align:left;padding:3px 10px 3px 0">PR</th>
          <th style="text-align:left;padding:3px 10px">Decision → Human</th>
          <th style="text-align:left;padding:3px 10px">PR State</th>
          <th style="text-align:left;padding:3px 10px">Reason</th>
          <th style="text-align:left;padding:3px 10px">Mode</th>
          <th style="text-align:right;padding:3px 10px">Decided</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  return `<div style="margin-top:20px">
      ${funnelApproverWeeklySvg(weekly)}
      <details>
        <summary style="cursor:pointer;list-style:revert">
          <span style="display:inline-flex;align-items:baseline;gap:10px;flex-wrap:wrap">
            <span style="font-size:14px;font-weight:700">PR Approver — Verity <span style="font-weight:400;color:var(--text-muted);font-size:11px">(shadow mode)</span></span>
            <span style="font-size:11px">${summary}</span>
            <span style="font-size:10px;color:var(--text-muted)">${decisions.length} PRs decided${provenance}</span>
          </span>
        </summary>
        <div style="font-size:11px;color:var(--text-muted);margin:6px 0 4px">Every PR Verity decided — including human-authored PRs (not just the bot's own). Shadow decisions never post to GitHub.</div>
        ${empty}
      </details>
    </div>`;
}

// Week-over-week agreement trend for the Verity panel: is agreement rising, are
// abstains falling, and is the SAFETY-critical false-approve heading to zero —
// the three signals for taking Verity out of shadow mode. Reads snap.approverWeekly
// (produced by scripts/funnel.ts on nv-main; rides in the same funnel.json fetch).
// Returns '' when the field is absent (older snapshot) or empty, so the panel
// degrades gracefully. Style deliberately mirrors funnelWeeklyTrendSvg /
// funnelWeeklyConversionSvg (same W/H, count-left / %-right dual axis, rolling-
// point labels), so it reads as one family of charts.
function funnelApproverWeeklySvg(weekly) {
  if (!Array.isArray(weekly) || weekly.length === 0) return '';
  const W = 560,
    H = 156,
    padL = 30,
    padR = 34,
    padT = 12,
    padB = 30;
  const innerW = W - padL - padR,
    innerH = H - padT - padB;
  const n = weekly.length;
  const COL = {
    agreedApprove: '#3fb950', // green  — Verity approved, human agreed
    agreedBlock: '#39c5cf', // teal   — Verity blocked, human agreed
    falseApprove: '#f85149', // RED    — Verity approved, human wanted changes (the danger)
    falseBlock: '#d29922', // amber  — Verity blocked, human approved
    abstain: '#484f58', // grey   — Verity abstained
    agreeLine: '#56d364', // agreement % (want ↑)
    falseLine: '#f85149', // false-approve count (want → 0)
  };
  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);
  // Left axis = decision COUNTS; bars scale to the busiest week's total.
  const maxTotal = Math.max(1, ...weekly.map((w) => num(w.total)));
  const slot = innerW / n;
  const barW = Math.max(5, Math.min(30, slot * 0.62));
  const cx = (i) => padL + slot * (i + 0.5);
  const baseY = padT + innerH;
  const yCnt = (v) => padT + innerH - (num(v) / maxTotal) * innerH;
  const yPct = (v) => padT + innerH - (num(v) / 100) * innerH; // v in 0..100
  // Left count-axis grid (0 / mid / max) + right %-axis labels (0 / 50 / 100).
  const cntVals = [0, Math.round(maxTotal / 2), maxTotal];
  const grid = cntVals
    .map(
      (v) =>
        `<line x1="${padL}" y1="${yCnt(v).toFixed(1)}" x2="${W - padR}" y2="${yCnt(v).toFixed(1)}" stroke="var(--border)" stroke-width="1"/>` +
        `<text x="${padL - 5}" y="${(yCnt(v) + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="var(--text-muted)">${v}</text>`,
    )
    .join('');
  const pctAxis = [0, 50, 100]
    .map(
      (v) =>
        `<text x="${W - padR + 5}" y="${(yPct(v) + 3).toFixed(1)}" text-anchor="start" font-size="9" fill="${COL.agreeLine}">${v}%</text>`,
    )
    .join('');
  // Per-week stacked bar: agreed (green/teal) + false (red/amber) + abstain (grey),
  // stacked from the baseline up. The bar's full height is total decisions, so
  // any unfilled cap above the stack is the week's not-yet-verdicted PRs — the
  // fill fraction doubles as a coverage read.
  const bars = weekly
    .map((w, i) => {
      const x = (cx(i) - barW / 2).toFixed(1);
      const track = `<rect x="${x}" y="${yCnt(w.total).toFixed(1)}" width="${barW.toFixed(1)}" height="${(baseY - yCnt(w.total)).toFixed(1)}" fill="var(--bg-card)" stroke="var(--border)" stroke-width="0.5"/>`;
      const segs = [
        { n: num(w.agreedApprove), c: COL.agreedApprove, label: 'agreed-approve' },
        { n: num(w.agreedBlock), c: COL.agreedBlock, label: 'agreed-block' },
        { n: num(w.falseApprove), c: COL.falseApprove, label: 'FALSE-APPROVE' },
        { n: num(w.falseBlock), c: COL.falseBlock, label: 'false-block' },
        { n: num(w.abstain), c: COL.abstain, label: 'abstain' },
      ];
      let acc = 0;
      const rects = segs
        .filter((s) => s.n > 0)
        .map((s) => {
          const y0 = baseY - (acc / maxTotal) * innerH;
          const y1 = baseY - ((acc + s.n) / maxTotal) * innerH;
          acc += s.n;
          // The safety segment gets a bright outline so it never hides in a tall bar.
          const stroke = s.c === COL.falseApprove ? ' stroke="#ffdcd7" stroke-width="0.75"' : '';
          return `<rect x="${x}" y="${y1.toFixed(1)}" width="${barW.toFixed(1)}" height="${(y0 - y1).toFixed(1)}" fill="${s.c}"${stroke}><title>${esc(w.weekStart)} · ${s.label}: ${s.n}</title></rect>`;
        })
        .join('');
      return track + rects;
    })
    .join('');
  // Agreement % line (right axis, want ↑). Weeks with no human verdict have
  // agreementPct === null — break the line there rather than plotting a 0.
  const agreePts = weekly.map((w, i) => (w.agreementPct == null ? null : `${cx(i).toFixed(1)},${yPct(w.agreementPct).toFixed(1)}`));
  const agreeSegments = [];
  let run = [];
  for (const p of agreePts) {
    if (p) run.push(p);
    else {
      if (run.length) agreeSegments.push(run);
      run = [];
    }
  }
  if (run.length) agreeSegments.push(run);
  const agreeLines = agreeSegments
    .map((pts) => `<polyline points="${pts.join(' ')}" fill="none" stroke="${COL.agreeLine}" stroke-width="2"/>`)
    .join('');
  const agreeDots = weekly
    .map((w, i) =>
      w.agreementPct == null
        ? ''
        : `<circle cx="${cx(i).toFixed(1)}" cy="${yPct(w.agreementPct).toFixed(1)}" r="3" fill="${COL.agreeLine}"><title>${esc(w.weekStart)}: ${w.agreementPct}% agreement (${num(w.agreedApprove) + num(w.agreedBlock)}/${num(w.withHumanVerdict)})</title></circle>`,
    )
    .join('');
  const agreeLabels = weekly
    .map((w, i) => {
      if (w.agreementPct == null) return '';
      const anchor = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
      return `<text x="${cx(i).toFixed(1)}" y="${(yPct(w.agreementPct) - 7).toFixed(1)}" text-anchor="${anchor}" font-size="10" font-weight="700" fill="${COL.agreeLine}">${Math.round(w.agreementPct)}%</text>`;
    })
    .join('');
  // False-approve COUNT line (left/count axis, want → 0), highlighted red.
  const falsePts = weekly.map((w, i) => `${cx(i).toFixed(1)},${yCnt(w.falseApprove).toFixed(1)}`).join(' ');
  const falseLine = `<polyline points="${falsePts}" fill="none" stroke="${COL.falseLine}" stroke-width="1.5" stroke-dasharray="4 2"/>`;
  const falseDots = weekly
    .map(
      (w, i) =>
        `<circle cx="${cx(i).toFixed(1)}" cy="${yCnt(w.falseApprove).toFixed(1)}" r="${num(w.falseApprove) > 0 ? 3 : 2}" fill="${COL.falseLine}"><title>${esc(w.weekStart)}: ${num(w.falseApprove)} false-approve</title></circle>`,
    )
    .join('');
  const xlabels = weekly
    .map((w, i) =>
      i % Math.ceil(n / 6 || 1) === 0
        ? `<text x="${cx(i).toFixed(1)}" y="${H - 10}" text-anchor="middle" font-size="8" fill="var(--text-muted)">${esc((w.weekStart || '').slice(5))}</text>`
        : '',
    )
    .join('');
  // Trend hint: first→last agreement % over the weeks that have a verdict.
  const withPct = weekly.filter((w) => w.agreementPct != null);
  let trend = '→ n/a',
    trendColor = 'var(--text-muted)';
  if (withPct.length >= 2) {
    const delta = Math.round(withPct[withPct.length - 1].agreementPct - withPct[0].agreementPct);
    trend = delta > 0 ? `▲ +${delta}pp agreement` : delta < 0 ? `▼ ${delta}pp agreement` : '→ flat';
    trendColor = delta > 0 ? COL.agreeLine : delta < 0 ? '#f85149' : 'var(--text-muted)';
  }
  const totalFalse = weekly.reduce((a, w) => a + num(w.falseApprove), 0);
  return `<div style="margin:2px 0 10px">
      <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap">
        <span style="font-weight:600;font-size:13px">Weekly approver agreement</span>
        <span style="font-size:10px;color:var(--text-muted)">
          <span style="color:${COL.agreedApprove}">■</span> agreed-approve
          <span style="color:${COL.agreedBlock}">■</span> agreed-block
          <span style="color:${COL.falseApprove}">■</span> <b style="color:${COL.falseApprove}">false-approve</b>
          <span style="color:${COL.falseBlock}">■</span> false-block
          <span style="color:${COL.abstain}">■</span> abstain
          &nbsp;·&nbsp; <span style="color:${COL.agreeLine}">●</span> agreement % (right)
          &nbsp; <span style="color:${COL.falseLine}">╌</span> false-approve count
        </span>
        <span style="margin-left:auto;font-size:12px;color:${trendColor}">${trend}</span>
      </div>
      <svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;background:transparent">
        ${grid}${pctAxis}
        ${bars}
        ${falseLine}${falseDots}
        ${agreeLines}${agreeDots}${agreeLabels}
        ${xlabels}
      </svg>
      <div style="font-size:10px;color:var(--text-muted);margin-top:2px">Go-live signals: <b>agreement ↑</b> · <b>abstain ↓</b> · <b style="color:${COL.falseApprove}">false-approve → 0</b> (a false-approve is Verity waving through a PR a human wanted changed — the one error that must reach zero before Verity leaves shadow mode). ${totalFalse} false-approve${totalFalse === 1 ? '' : 's'} across the window.</div>
    </div>`;
}

// Human review cost by author class. Rides inside the funnel snapshot
// (snap.reviewCycles) — no extra fetch.
//
// THIS PANEL MUST SHOW ITS DENOMINATORS. meanRounds alone inverts the signal: a
// PR merged with no human review scores zero rounds, so a bot looks BETTER the
// less anyone checks its work. Coverage and unreviewed sit next to the headline
// for exactly that reason, and the two exclusions stay separate — notMerged is a
// deliberate scope choice, unclassified is a failed lookup, and conflating them
// would hide a degraded run behind a clean-looking number.
function reviewCyclesHtml(rc) {
  if (!rc || (!rc.bot && !rc.human)) return '';
  const cell = (c) => {
    if (!c) return '<td colspan="6" style="padding:2px 12px;color:var(--text-muted)">—</td>';
    // null (not 0) when nothing was reviewed: "no data", never "0 rounds".
    const nd = '<span style="color:var(--text-muted)">no data</span>';
    // Headline is the FEEDBACK-session round (CHANGES_REQUESTED or COMMENTED,
    // collapsed per reviewer). meanChangesRequested is kept beside it and will
    // sit near zero — in the census that was 5 CHANGES_REQUESTED against 1,178
    // COMMENTED, which is exactly why it cannot be the headline on its own.
    const mean =
      c.meanFeedbackRounds === null || c.meanFeedbackRounds === undefined ? nd : '<b>' + c.meanFeedbackRounds + '</b>';
    const meanCr =
      c.meanChangesRequested === null || c.meanChangesRequested === undefined ? nd : String(c.meanChangesRequested);
    const hasCov = c.coveragePct !== null && c.coveragePct !== undefined;
    const cov = hasCov ? c.coveragePct + '%' : '—';
    const warn = hasCov && c.coveragePct < 50 ? ';color:var(--warn,#c90)' : '';
    return (
      '<td style="text-align:right;padding:2px 12px">' +
      mean +
      '</td>' +
      '<td style="text-align:right;padding:2px 12px;color:var(--text-muted)">' +
      meanCr +
      '</td>' +
      '<td style="text-align:right;padding:2px 12px">' +
      (c.reviewedPrs || 0) +
      '</td>' +
      '<td style="text-align:right;padding:2px 12px' +
      warn +
      '">' +
      cov +
      '</td>' +
      '<td style="text-align:right;padding:2px 12px;color:var(--text-muted)">' +
      (c.unreviewedPrs || 0) +
      '</td>' +
      '<td style="text-align:right;padding:2px 12px' +
      (c.unknownPrs ? ';color:var(--warn,#c90)' : ';color:var(--text-muted)') +
      '">' +
      (c.unknownPrs || 0) +
      '</td>'
    );
  };
  const th = (l, r) =>
    '<th style="text-align:' +
    (r ? 'right' : 'left') +
    ';padding:2px 12px;border-bottom:1px solid var(--border)">' +
    l +
    '</th>';
  // The producer publishes its own definition; render it rather than hardcoding
  // a description that can drift away from the metric.
  const roundRule =
    rc.roundDefinition === 'feedback-session'
      ? 'A round is a human feedback session — CHANGES_REQUESTED or COMMENTED, collapsed per reviewer within ' +
        (rc.sessionGapMinutes || 30) +
        ' min. APPROVED makes you a reviewer but costs no round.'
      : 'Round definition unavailable from this snapshot.';
  const excl = [];
  if (rc.notMergedExcluded) excl.push(rc.notMergedExcluded + ' not merged (out of scope)');
  if (rc.unclassifiedPrs) excl.push('<b>' + rc.unclassifiedPrs + ' unclassified (lookup failed)</b>');
  return (
    '<div style="margin-top:16px">' +
    '<div style="font-weight:600;margin-bottom:4px">Human review cost ' +
    '<span style="font-weight:400;color:var(--text-muted)">— Verity-decided merged PRs</span></div>' +
    '<table style="border-collapse:collapse;font-size:10px">' +
    '<tr>' +
    th('author') +
    th('mean rounds', 1) +
    th('of which CR', 1) +
    th('reviewed', 1) +
    th('coverage', 1) +
    th('unreviewed', 1) +
    th('unknown', 1) +
    '</tr>' +
    '<tr><td style="padding:2px 12px">bot</td>' +
    cell(rc.bot) +
    '</tr>' +
    '<tr><td style="padding:2px 12px">human</td>' +
    cell(rc.human) +
    '</tr>' +
    '</table>' +
    '<div style="color:var(--text-muted);margin-top:4px;max-width:640px;line-height:1.45">' +
    roundRule +
    ' Mean is over <i>reviewed</i> PRs only; <b>unknown</b> are lookup failures excluded from coverage, ' +
    'so a high coverage beside a high unknown is not reassurance. Population is PRs the approver ' +
    'recorded, not every merged PR.' +
    (excl.length ? '<br>Excluded: ' + excl.join(' · ') : '') +
    '</div></div>'
  );
}

// Regression quality — /api/regression-quality (scripts/regression-quality.py).
//
// Attribution coverage is the load-bearing number and it is LOW: only issues
// citing a CAUSAL reference can be attributed, so the bot/human split is a
// FLOOR, not a total. Printing the split without the coverage overstates how
// much is actually known.
function regressionQualityHtml(rq) {
  if (!rq) return '';

  // Snapshot age. The route stamps snapshotMtime from the file mtime because the
  // producer writes no timestamp of its own; without this a cron that quietly
  // died still renders as current data.
  let freshness = '';
  if (rq.snapshotMtime) {
    const ageH = (Date.now() - new Date(rq.snapshotMtime).getTime()) / 3600000;
    const stale = ageH > 36; // a daily cron that missed more than one run
    const label = ageH < 1 ? 'just now' : ageH < 48 ? Math.round(ageH) + 'h ago' : Math.round(ageH / 24) + 'd ago';
    freshness = ' · snapshot ' + (stale ? '<b style="color:var(--warn,#c90)">' + label + ' (stale)</b>' : label);
  } else {
    freshness = ' · <span style="color:var(--warn,#c90)">age unknown</span>';
  }

  const title =
    '<div style="font-weight:600;margin-bottom:4px">Regression quality ' +
    '<span style="font-weight:400;color:var(--text-muted)">— ' +
    esc(rq.repo || '') +
    ' · label "' +
    esc(rq.label || 'regression') +
    '"' +
    freshness +
    '</span></div>';

  // COLLECTION FAILURE IS NOT A ZERO. Schema 2 fails closed: an incomplete run
  // emits NO metric keys at all and sets complete:false with a populated errors[].
  // Render the breakage — a number here would read as "quality improved" when in
  // fact nothing was measured, which is the defect this schema exists to stop.
  if (rq.complete === false) {
    const errs = (rq.errors || [])
      .slice(0, 4)
      .map((e) => esc(String(e)))
      .join('<br>');
    return (
      '<div style="margin-top:20px">' +
      title +
      '<div style="padding:4px 8px;border-left:3px solid var(--warn,#c90);color:var(--text-muted);max-width:640px;line-height:1.45">' +
      '<b>Collection incomplete — no metric published.</b> This is NOT zero regressions; the run failed and ' +
      'deliberately emitted no numbers.' +
      (errs ? '<br>' + errs : '') +
      '</div></div>'
    );
  }

  if (!rq.issues) return '';
  const attributed = rq.issues - (rq.unattributed || 0);
  const cov = Math.round((attributed / rq.issues) * 100);

  // Rates MUST come from the cohort keys. `filed_month` buckets by when the issue
  // was FILED, which is not the cohort the denominator uses — dividing one by the
  // other compares unrelated populations, and that mismatch was the finding.
  const cohortBot = rq.cohort_bot || {};
  const cohortHuman = rq.cohort_human || {};
  const cohortMixed = rq.cohort_mixed || {};
  const rateBot = rq.rate_bot_per_100 || {};
  const rateHuman = rq.rate_human_per_100 || {};
  const months = Array.from(
    new Set([...Object.keys(cohortBot), ...Object.keys(cohortHuman), ...Object.keys(cohortMixed)]),
  )
    .sort()
    .slice(-6);

  const th = (l, r) =>
    '<th style="text-align:' +
    (r ? 'right' : 'left') +
    ';padding:2px 10px;border-bottom:1px solid var(--border)">' +
    l +
    '</th>';
  const td = (v, r) => '<td style="text-align:' + (r ? 'right' : 'left') + ';padding:2px 10px">' + v + '</td>';
  const num = (v) => (v === null || v === undefined ? '—' : v);

  const rows = months
    .map(
      (m) =>
        '<tr>' +
        td(esc(m)) +
        td(num(cohortBot[m]), 1) +
        td(num(rateBot[m]), 1) +
        td(num(cohortHuman[m]), 1) +
        td(num(rateHuman[m]), 1) +
        td('<span style="color:var(--text-muted)">' + num(cohortMixed[m]) + '</span>', 1) +
        '</tr>',
    )
    .join('');

  const mixedTotal = Object.values(cohortMixed).reduce((a, b) => a + (b || 0), 0);

  return (
    '<div style="margin-top:20px">' +
    title +
    '<div style="margin-bottom:6px;padding:4px 8px;border-left:3px solid var(--warn,#c90);color:var(--text-muted);max-width:640px;line-height:1.45">' +
    '<b>Attribution coverage ' +
    cov +
    '%</b> (' +
    attributed +
    '/' +
    rq.issues +
    '). ' +
    'The rest cite no causal reference, so the split below is a <b>floor, not a total</b>.' +
    '</div>' +
    '<table style="border-collapse:collapse;font-size:10px">' +
    '<tr>' +
    th('culprit merge month') +
    th('bot-caused', 1) +
    th('per 100 bot PRs', 1) +
    th('human-caused', 1) +
    th('per 100 human PRs', 1) +
    th('mixed', 1) +
    '</tr>' +
    rows +
    '</table>' +
    '<div style="color:var(--text-muted);margin-top:4px;max-width:640px;line-height:1.45">' +
    "Cohorted by the <b>culprit PR's merge month</b>, so numerator and denominator describe the same " +
    'population. Rate, not count: bot merge volume rose sharply, so a raw count climbs even when quality ' +
    'is flat.' +
    (mixedTotal
      ? ' <b>' + mixedTotal + '</b> regression(s) had joint bot+human culprits and are excluded from both rates.'
      : '') +
    '</div></div>'
  );
}

// Table of nv-slang-bot's per-repo commits / additions / deletions, from the
// /api/bot-contributions snapshot. Shown under the issue funnel.
// Metric is MERGED PRs by the App bot (app/nv-slang-bot) since bc.since, plus
// real code volume (commits/additions/deletions summed from each merged PR's
// diff, and the first/last merge date as the active range). See
// scripts/bot-contributions.ts for why PRs, not stats/contributors commits
// (squash-merges collapse commit attribution → single digits).
function botContributionsHtml(bc) {
  if (!bc || !Array.isArray(bc.repos)) return '';
  const t = bc.totals || {};
  // Back-compat: pre-fix snapshots had only `commits`; new ones add mergedPRs/totalPRs.
  const merged = (o) => Number((o.mergedPRs != null ? o.mergedPRs : o.commits) || 0);
  const total = (o) => Number((o.totalPRs != null ? o.totalPRs : merged(o)) || 0);
  const num = (v) => Number(v || 0);
  const rows = bc.repos
    .map(
      (r) => `<tr>
        <td style="padding:3px 10px 3px 0"><code>${esc(r.repo)}</code></td>
        <td style="text-align:right;padding:3px 10px;font-weight:600">${fmtNum(merged(r))}</td>
        <td style="text-align:right;padding:3px 10px;color:var(--text-muted)">${fmtNum(total(r))}</td>
        <td style="text-align:right;padding:3px 10px">${fmtNum(num(r.commits))}</td>
        <td style="text-align:right;padding:3px 10px;color:#3fb950">+${fmtNum(num(r.additions))}</td>
        <td style="text-align:right;padding:3px 10px;color:#f85149">−${fmtNum(num(r.deletions))}</td>
        <td style="text-align:right;padding:3px 10px;color:var(--text-muted);font-size:10px">${r.firstWeek ? `${esc(r.firstWeek)} → ${esc(r.lastWeek)}` : r.error ? esc(r.error) : '—'}</td>
      </tr>`,
    )
    .join('');
  const since = bc.since ? ` since ${esc(bc.since)}` : '';
  return `<div style="margin-top:20px">
      <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:6px">
        <span style="font-size:14px;font-weight:700">nv-slang-bot contributions</span>
        <span style="font-size:10px;color:var(--text-muted)">merged PRs${since}${bc.generatedAt ? ` · snapshot: ${formatTime(bc.generatedAt)}` : ''}</span>
        <button data-action="refresh-botc" class="admin-action-btn" style="margin-left:auto;font-size:10px;padding:1px 8px">Refresh</button>
      </div>
      <table style="border-collapse:collapse;font-size:12px;width:100%;max-width:760px">
        <thead><tr style="color:var(--text-muted);font-size:10px;text-transform:uppercase">
          <th style="text-align:left;padding:3px 10px 3px 0">Repo</th>
          <th style="text-align:right;padding:3px 10px">Merged PRs</th>
          <th style="text-align:right;padding:3px 10px">Total PRs</th>
          <th style="text-align:right;padding:3px 10px">Commits</th>
          <th style="text-align:right;padding:3px 10px">Additions</th>
          <th style="text-align:right;padding:3px 10px">Deletions</th>
          <th style="text-align:right;padding:3px 10px">Active range</th>
        </tr></thead>
        <tbody>${rows}
          <tr style="border-top:2px solid var(--border);font-weight:700">
            <td style="padding:4px 10px 4px 0">Total</td>
            <td style="text-align:right;padding:4px 10px">${fmtNum(merged(t))}</td>
            <td style="text-align:right;padding:4px 10px;color:var(--text-muted)">${fmtNum(total(t))}</td>
            <td style="text-align:right;padding:4px 10px">${fmtNum(num(t.commits))}</td>
            <td style="text-align:right;padding:4px 10px;color:#3fb950">+${fmtNum(num(t.additions))}</td>
            <td style="text-align:right;padding:4px 10px;color:#f85149">−${fmtNum(num(t.deletions))}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>`;
}

// Kick off a bot-contributions recompute (a few GitHub calls, ~seconds), then
// re-load the funnel panel to pick up the fresh snapshot.
async function triggerBotcRefresh(btn) {
  const prev = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Refreshing…';
  try {
    await fetch('/api/bot-contributions/refresh', { method: 'POST' });
  } catch {
    /* ignore */
  }
  setTimeout(() => {
    if (adminState.panel === 'funnel') loadFunnel();
    else {
      btn.disabled = false;
      btn.textContent = prev;
    }
  }, 8000);
}

// Visual funnel for the issue partition — renders the mental model:
//   FILED → (drop not-our-problem) → ACTIONABLE → {never-engaged, triage-only,
//   resolved-elsewhere, BOT-PR} → BOT-PR splits into merged★/shipped/ready/closed.
// Big stat cards + proportional stacked bars so "where do 117 issues go" reads
// at a glance, no table-squinting. Returns an HTML string.
function funnelFlowHtml(ip, funnelRows) {
  const c = ip.counts;
  const bp = c.bot_pr || {};
  const wr = Math.round((ip.winRate || 0) * 100);
  const winColor = wr >= 15 ? '#3fb950' : wr >= 5 ? '#d29922' : '#f85149';
  const winStart = (ip.window?.start || '').slice(0, 10);

  // A stat card: big number + label + optional sub.
  const card = (n, label, color, sub) =>
    `<div style="flex:1;min-width:84px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:10px 12px">
       <div style="font-size:26px;font-weight:700;line-height:1;color:${color || 'var(--text)'}">${n}</div>
       <div style="font-size:11px;color:var(--text-muted);margin-top:3px">${esc(label)}</div>
       ${sub ? `<div style="font-size:10px;color:var(--text-muted);margin-top:1px">${esc(sub)}</div>` : ''}
     </div>`;

  // Pick black or white text for a #rrggbb background so the in-bar number is
  // readable on any segment color (and in any theme — these colors are fixed).
  const textOn = (hex) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return '#fff';
    const r = parseInt(m[1].slice(0, 2), 16),
      g = parseInt(m[1].slice(2, 4), 16),
      bl = parseInt(m[1].slice(4, 6), 16);
    // perceived luminance
    return 0.299 * r + 0.587 * g + 0.114 * bl > 150 ? '#0d1117' : '#ffffff';
  };
  // A proportional stacked bar from [{n,label,color}] segments over `total`.
  const stacked = (total, segs) => {
    if (!total) return '';
    const cells = segs
      .filter((s) => s.n > 0)
      .map((s) => {
        const pct = (s.n / total) * 100;
        return `<div title="${esc(s.label)}: ${s.n} (${Math.round(pct)}%)" style="width:${pct}%;background:${s.color};height:26px;display:flex;align-items:center;justify-content:center;overflow:hidden;color:${textOn(s.color)};font-size:11px;font-weight:700;white-space:nowrap">${pct >= 6 ? s.n : ''}</div>`;
      })
      .join('');
    return `<div style="display:flex;border-radius:6px;overflow:hidden;border:1px solid var(--border)">${cells}</div>`;
  };
  // A legend chip.
  const chip = (color, label, n) =>
    `<span style="display:inline-flex;align-items:center;gap:5px;margin-right:14px;font-size:11px">
       <span style="width:10px;height:10px;border-radius:2px;background:${color};display:inline-block"></span>
       ${esc(label)} <b>${n}</b></span>`;

  const C = {
    merged: '#3fb950',
    shipped: '#58a6ff',
    ready: '#79c0ff',
    open: '#1f6feb',
    closed: '#6e7681',
    triage: '#d29922',
    never: '#484f58',
    resolved: '#8b949e',
  };

  const actSegs = [
    { n: bp.merged, label: 'merged ★ WIN', color: C.merged },
    { n: bp.shipped_draft, label: 'shipped-draft', color: C.shipped },
    { n: bp.pr_ready, label: 'pr-ready', color: C.ready },
    { n: bp.pr_open, label: 'pr-open', color: C.open },
    { n: bp.pr_closed, label: 'pr-closed/superseded', color: C.closed },
    { n: c.triage_only, label: 'triage-only', color: C.triage },
    { n: c.resolved_elsewhere, label: 'resolved-elsewhere', color: C.resolved },
    { n: c.never_engaged, label: 'never-engaged', color: C.never },
  ];

  return `<div style="display:flex;align-items:baseline;gap:12px;margin-bottom:10px">
      <span style="font-size:15px;font-weight:700">Issue Funnel</span>
      <span style="font-size:11px;color:var(--text-muted)">${esc(winStart)} → now</span>
    </div>

    <!-- top-line flow: Filed → Actionable → Bot PR → Merged -->
    <div style="display:flex;gap:8px;align-items:stretch;margin-bottom:14px;flex-wrap:wrap">
      ${card(c.filed, 'Filed', null, 'all issues in window')}
      <div style="display:flex;align-items:center;color:var(--text-muted);font-size:20px">→</div>
      ${card(c.actionable, 'Actionable', null, `−${c.not_our_problem} not-a-bug`)}
      <div style="display:flex;align-items:center;color:var(--text-muted);font-size:20px">→</div>
      ${card(bp.total, 'Bot PR opened', C.shipped, `${Math.round((bp.total / (c.actionable || 1)) * 100)}% of actionable`)}
      <div style="display:flex;align-items:center;color:var(--text-muted);font-size:20px">→</div>
      ${card(bp.merged, 'Merged ★', C.merged, 'the WIN')}
      <div style="flex:1.3;min-width:120px;background:var(--bg-card);border:1px solid ${winColor};border-radius:8px;padding:10px 12px">
        <div style="font-size:26px;font-weight:700;line-height:1;color:${winColor}">${wr}%</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:3px">WIN-RATE</div>
        <div style="font-size:10px;color:var(--text-muted)">merged ÷ PRs authored (${bp.merged}/${bp.total})</div>
      </div>
    </div>

    <!-- where every actionable issue goes -->
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">Where the ${c.actionable} actionable issues went:</div>
    ${stacked(c.actionable, actSegs)}
    <table style="margin-top:10px;border-collapse:collapse;width:100%;font-size:10px">
      <tr><td style="padding:4px 8px 4px 0">${chip(C.merged, 'merged ★', bp.merged)}</td><td style="padding:4px 0;color:var(--text-muted)">Fix shipped to main — fully done</td></tr>
      <tr><td style="padding:4px 8px 4px 0">${chip(C.shipped, 'shipped-draft', bp.shipped_draft)}</td><td style="padding:4px 0;color:var(--text-muted)">Fix written &amp; CI passes, held as draft — needs human to review and promote</td></tr>
      <tr><td style="padding:4px 8px 4px 0">${chip(C.ready, 'pr-ready', bp.pr_ready)}</td><td style="padding:4px 0;color:var(--text-muted)">PR open &amp; CI passes, marked ready — waiting for maintainer to approve and merge</td></tr>
      ${bp.pr_open ? `<tr><td style="padding:4px 8px 4px 0">${chip(C.open, 'pr-open', bp.pr_open)}</td><td style="padding:4px 0;color:var(--text-muted)">PR open, CI still running or pending review</td></tr>` : ''}
      <tr><td style="padding:4px 8px 4px 0">${chip(C.closed, 'pr-closed/superseded', bp.pr_closed)}</td><td style="padding:4px 0;color:var(--text-muted)">Bot's fix wasn't good enough — PR closed without merging</td></tr>
      <tr><td style="padding:4px 8px 4px 0">${chip(C.triage, 'triage-only', c.triage_only)}</td><td style="padding:4px 0;color:var(--text-muted)">Bot analyzed the issue but didn't produce a PR</td></tr>
      <tr><td style="padding:4px 8px 4px 0">${chip(C.resolved, 'resolved-elsewhere', c.resolved_elsewhere)}</td><td style="padding:4px 0;color:var(--text-muted)">Human developers fixed the issue independently</td></tr>
      <tr><td style="padding:4px 8px 4px 0">${chip(C.never, 'never-engaged', c.never_engaged)}</td><td style="padding:4px 0;color:var(--text-muted)">Issue was not picked up by the bot</td></tr>
    </table>
    <div style="margin-top:16px">${funnelWeeklyTrendSvg(ip.weekly || [])}</div>
    <div style="margin-top:20px">${funnelWeeklyConversionSvg(ip.weekly || [])}</div>

    ${funnelIssueTableHtml(ip.issues || [], funnelRows || [], C)}`;
}

// Unified issue table: all actionable issues in one table with inst, issue, PR, state, CI, stage.
function funnelIssueTableHtml(issues, rows, statusColors) {
  if (!issues || issues.length === 0) return '';
  const actionable = issues.filter((i) => i.bucket !== 'not_our_problem');
  if (actionable.length === 0) return '';
  const rowByIssue = {};
  const rowByPr = {};
  for (const r of rows || []) {
    if (r.issue) rowByIssue[`${r.repo}#${r.issue}`] = r;
    if (r.pr) rowByPr[`${r.repo}#${r.pr}`] = r;
  }
  const bucketLabel = {
    bot_pr: '',
    triage_only: 'triage-only',
    never_engaged: 'never-engaged',
    resolved_elsewhere: 'resolved-elsewhere',
  };
  const bucketColor = {
    bot_pr: null,
    triage_only: statusColors.triage,
    never_engaged: statusColors.never,
    resolved_elsewhere: statusColors.resolved,
  };
  let html = `<details style="margin-top:14px"><summary style="cursor:pointer;font-size:12px;font-weight:700;color:var(--text)">All ${actionable.length} actionable issues</summary>`;
  // Verity (PR-approver) shadow-mode decision colors. Approve = green,
  // block = red, abstain = muted. Falls through to '' (blank cell) when no
  // approver ran for the PR.
  // ABSTAIN_INFRA retired (task #14). Unmapped decisions (incl. historical
  // ABSTAIN_INFRA rows) fall through to var(--text-muted) below.
  const approverColor = {
    WOULD_APPROVE: statusColors.merged,
    BLOCK: '#e5534b',
    ABSTAIN_POLICY: 'var(--text-muted)',
  };
  html += `<table class="admin-table" style="margin-top:4px;font-size:11px"><thead><tr><th>Inst</th><th>Issue</th><th>PR</th><th>State</th><th>CI</th><th>Stage</th><th>Note</th><th>Approver</th></tr></thead><tbody>`;
  for (const i of actionable) {
    const repo = (i.repo || '').split('/').pop();
    const r = rowByIssue[`${i.repo}#${i.number}`] || (i.prNumber ? rowByPr[`${i.repo}#${i.prNumber}`] : null);
    const inst = r ? r.instance : '';
    const issueLink = `<a href="${esc(i.url)}" target="_blank" rel="noopener" style="color:var(--accent)">#${i.number}</a>`;
    const stageVal = i.stage || (r ? r.stage : '') || bucketLabel[i.bucket] || i.bucket;
    const prNum = r ? r.pr : i.prNumber;
    const prUrl = r ? r.prUrl : i.prUrl;
    const prCell = prNum
      ? prUrl
        ? `<a href="${esc(prUrl)}" target="_blank" rel="noopener" style="color:var(--accent)">#${prNum}</a>`
        : `#${prNum}`
      : '';
    const stateCell = r
      ? r.prState || ''
      : i.bucket === 'bot_pr' && i.stage
        ? i.stage === 'merged'
          ? 'merged'
          : i.stage === 'pr-closed' || i.stage === 'superseded'
            ? 'closed'
            : 'open'
        : '';
    const ciCell = r ? r.ciBucket || '' : '';
    const noteCell = r ? r.note || '' : i.note || '';
    const color =
      bucketColor[i.bucket] ||
      (stageVal === 'merged'
        ? statusColors.merged
        : stageVal === 'shipped-draft'
          ? statusColors.shipped
          : stageVal === 'pr-ready'
            ? statusColors.ready
            : '');
    const style = color ? ` style="color:${color}"` : '';
    // Approver cell: Verity's decision, with the joined human outcome shown as
    // "DECISION → HUMAN" once the human review lands (accuracy at a glance).
    const appr = r ? r.approver : null;
    const apprText = appr ? (appr.human ? `${appr.decision} → ${appr.human}` : appr.decision) : '';
    const apprStyle =
      appr && approverColor[appr.decision]
        ? ` style="color:${approverColor[appr.decision]}"`
        : ' style="color:var(--text-muted)"';
    html += `<tr><td>${esc(inst)}</td><td>${esc(repo)} ${issueLink}</td><td>${prCell}</td><td>${esc(stateCell)}</td><td>${esc(ciCell)}</td><td${style}>${esc(stageVal)}</td><td style="color:var(--text-muted)">${esc(noteCell)}</td><td${apprStyle}>${esc(apprText)}</td></tr>`;
  }
  html += '</tbody></table></details>';
  return html;
}

// Review rounds — how many human CHANGES_REQUESTED rounds a PR drew before it
// merged, bot-authored vs human-authored, plotted over the merge weeks. Reads
// the /api/review-rounds snapshot (scripts/review-rounds.py). Two lines in the
// funnelWeeklyTrendSvg visual idiom: avg human-review rounds for bot PRs (amber)
// vs human PRs (blue). Degrades to '' when the snapshot is absent/empty; renders
// the breakage note when the producer failed closed (complete:false).
function reviewRoundsHtml(rr) {
  if (!rr) return '';

  let freshness = '';
  if (rr.generatedAt) {
    const ageH = (Date.now() - new Date(rr.generatedAt).getTime()) / 3600000;
    const stale = ageH > 36;
    const label = ageH < 1 ? 'just now' : ageH < 48 ? Math.round(ageH) + 'h ago' : Math.round(ageH / 24) + 'd ago';
    freshness = ' · snapshot ' + (stale ? '<b style="color:var(--warn,#c90)">' + label + ' (stale)</b>' : label);
  }
  const title =
    '<div style="font-weight:600;margin-bottom:4px">Human-review rounds per PR ' +
    '<span style="font-weight:400;color:var(--text-muted)">— bot vs human authored' +
    (rr.since ? ' · since ' + esc(rr.since) : '') +
    freshness +
    '</span></div>';

  // COLLECTION FAILURE IS NOT A ZERO. The producer fails closed: an incomplete
  // run emits no weekly metrics and sets complete:false with errors[]. Render the
  // breakage — a flat line here would read as "review got easier" when nothing
  // was measured.
  if (rr.complete === false) {
    const errs = (rr.errors || [])
      .slice(0, 4)
      .map((e) => esc(typeof e === 'string' ? e : (e && (e.what + ': ' + e.detail)) || String(e)))
      .join('<br>');
    return (
      '<div style="margin-top:20px">' +
      title +
      '<div style="padding:4px 8px;border-left:3px solid var(--warn,#c90);color:var(--text-muted);max-width:640px;line-height:1.45">' +
      '<b>Collection incomplete — no metric published.</b> This is NOT zero review rounds; the run failed and ' +
      'deliberately emitted no numbers.' +
      (errs ? '<br>' + errs : '') +
      '</div></div>'
    );
  }

  const weekly = Array.isArray(rr.weekly) ? rr.weekly : [];
  if (weekly.length === 0) return '';

  const svg = reviewRoundsTrendSvg(weekly);

  // Totals strip: overall bot vs human averages + clean-first-pass rates.
  const t = rr.totals || {};
  const bt = t.botAuthored || {};
  const ht = t.humanAuthored || {};
  const numOrDash = (v) => (v === null || v === undefined ? '—' : v);
  const totalsLine =
    bt.prs || ht.prs
      ? '<div style="color:var(--text-muted);margin-top:4px;max-width:640px;line-height:1.45">' +
        'Overall: <b style="color:#d29922">bot</b> ' +
        numOrDash(bt.avgRounds) +
        ' rounds/PR (clean-first-pass ' +
        numOrDash(bt.zeroRoundPct) +
        '%, ' +
        (bt.prs || 0) +
        ' PRs) vs <b style="color:#58a6ff">human</b> ' +
        numOrDash(ht.avgRounds) +
        ' rounds/PR (clean ' +
        numOrDash(ht.zeroRoundPct) +
        '%, ' +
        (ht.prs || 0) +
        ' PRs).</div>'
      : '';

  return (
    '<div style="margin-top:20px">' +
    title +
    svg +
    totalsLine +
    '<div style="color:var(--text-muted);margin-top:4px;max-width:640px;line-height:1.45">' +
    'A round = one <b>CHANGES_REQUESTED</b> review from a human (bot/CI reviewers and self-reviews excluded); ' +
    'fewer rounds = cleaner PRs; is the bot converging to — or below — human? MERGED PRs only, by merge week.' +
    '</div></div>'
  );
}

// Two-line weekly trend for review rounds, in the funnelWeeklyTrendSvg idiom:
// amber = avg rounds for bot-authored PRs, blue = human-authored. A week with no
// PRs in a class has a null average and is simply skipped (the line bridges the
// gap) rather than plotted as a spurious zero. Returns '' when nothing to plot.
function reviewRoundsTrendSvg(weekly) {
  if (!Array.isArray(weekly) || weekly.length === 0) return '';
  const W = 520,
    H = 140,
    padL = 30,
    padR = 10,
    padT = 16,
    padB = 26;
  const innerW = W - padL - padR,
    innerH = H - padT - padB;
  const n = weekly.length;
  const avg = (w, k) => {
    const c = w[k];
    return c && typeof c.avgRounds === 'number' ? c.avgRounds : null;
  };
  const observed = [];
  for (const w of weekly) {
    const b = avg(w, 'botAuthored');
    const h = avg(w, 'humanAuthored');
    if (b !== null) observed.push(b);
    if (h !== null) observed.push(h);
  }
  const maxY = Math.max(1, ...observed);
  const x = (i) => padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v) => padT + innerH - (v / maxY) * innerH;
  const gridVals = [0, maxY / 2, maxY];
  const grid = gridVals
    .map(
      (v) =>
        `<line x1="${padL}" y1="${y(v).toFixed(1)}" x2="${W - padR}" y2="${y(v).toFixed(1)}" stroke="var(--border)" stroke-width="1"/>` +
        `<text x="${padL - 5}" y="${(y(v) + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="var(--text-muted)">${v % 1 === 0 ? v : v.toFixed(1)}</text>`,
    )
    .join('');
  const series = (k, color) => {
    const pts = [];
    const dots = [];
    weekly.forEach((w, i) => {
      const v = avg(w, k);
      if (v === null) return;
      const c = w[k] || {};
      pts.push(`${x(i).toFixed(1)},${y(v).toFixed(1)}`);
      const zp = typeof c.zeroRoundPct === 'number' ? `, clean ${c.zeroRoundPct}%` : '';
      dots.push(
        `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="2.6" fill="${color}"><title>${esc(w.week)} — ${k === 'botAuthored' ? 'bot' : 'human'}: ${v} rounds/PR (${c.prs || 0} PRs${zp})</title></circle>`,
      );
    });
    const line = pts.length > 1 ? `<polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="2"/>` : '';
    return line + dots.join('');
  };
  const xlabels = weekly
    .map((w, i) =>
      i % Math.ceil(n / 6 || 1) === 0
        ? `<text x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="8" fill="var(--text-muted)">${esc(String(w.week).slice(5))}</text>`
        : '',
    )
    .join('');
  return `<div style="margin:6px 0 2px;display:flex;align-items:baseline;gap:10px">
      <span style="font-weight:600">Avg human-review rounds / merged PR</span>
      <span style="font-size:10px;color:var(--text-muted)"><span style="color:#d29922">●</span> bot &nbsp;<span style="color:#58a6ff">●</span> human</span>
    </div>
    <svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;background:transparent">
      ${grid}
      ${series('botAuthored', '#d29922')}
      ${series('humanAuthored', '#58a6ff')}
      ${xlabels}
    </svg>`;
}

// Inline-SVG line chart of the weekly WIN trend (issuePartition.weekly).
// Two series: per-week win-rate (faint dots) and the trailing-4wk rolling
// win-rate (solid line) so you can read "are we doing better or worse" at a
// glance. Returns '' when there's nothing to plot.
function funnelWeeklyTrendSvg(weekly) {
  if (!Array.isArray(weekly) || weekly.length === 0) return '';
  const W = 520,
    H = 130,
    padL = 34,
    padR = 10,
    padT = 14,
    padB = 24;
  const innerW = W - padL - padR,
    innerH = H - padT - padB;
  const n = weekly.length;
  // Y axis fixed 0..max(40%, observed) so small win-rates are still visible.
  const maxPct = Math.max(0.4, ...weekly.map((w) => Math.max(w.winRate || 0, w.rollingWinRate || 0)));
  const x = (i) => padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v) => padT + innerH - (v / maxPct) * innerH;
  const gridVals = [0, maxPct / 2, maxPct];
  const grid = gridVals
    .map(
      (v) =>
        `<line x1="${padL}" y1="${y(v).toFixed(1)}" x2="${W - padR}" y2="${y(v).toFixed(1)}" stroke="var(--border)" stroke-width="1"/>` +
        `<text x="${padL - 5}" y="${(y(v) + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="var(--text-muted)">${Math.round(v * 100)}%</text>`,
    )
    .join('');
  const rollPts = weekly.map((w, i) => `${x(i).toFixed(1)},${y(w.rollingWinRate || 0).toFixed(1)}`).join(' ');
  const rawDots = weekly
    .map(
      (w, i) =>
        `<circle cx="${x(i).toFixed(1)}" cy="${y(w.winRate || 0).toFixed(1)}" r="2.5" fill="#8b949e"><title>${esc(w.week)}: ${Math.round((w.winRate || 0) * 100)}% (${w.merged}/${w.actionable})</title></circle>`,
    )
    .join('');
  const rollDots = weekly
    .map(
      (w, i) =>
        `<circle cx="${x(i).toFixed(1)}" cy="${y(w.rollingWinRate || 0).toFixed(1)}" r="3" fill="#3fb950"><title>${esc(w.week)} rolling: ${Math.round((w.rollingWinRate || 0) * 100)}%</title></circle>`,
    )
    .join('');
  // Value labels on each rolling point (the win-rates are small, so the line
  // hugs the axis — the number must be spelled out). Placed just above each dot.
  const rollLabels = weekly
    .map((w, i) => {
      const pct = Math.round((w.rollingWinRate || 0) * 100);
      const anchor = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
      return `<text x="${x(i).toFixed(1)}" y="${(y(w.rollingWinRate || 0) - 7).toFixed(1)}" text-anchor="${anchor}" font-size="11" font-weight="700" fill="#3fb950">${pct}%</text>`;
    })
    .join('');
  const xlabels = weekly
    .map((w, i) =>
      i % Math.ceil(n / 6 || 1) === 0
        ? `<text x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="8" fill="var(--text-muted)">${esc(w.week.slice(5))}</text>`
        : '',
    )
    .join('');
  // Direction hint: last rolling vs first rolling.
  const first = weekly[0].rollingWinRate || 0,
    last = weekly[n - 1].rollingWinRate || 0;
  const delta = Math.round((last - first) * 100);
  const trend = delta > 0 ? `▲ +${delta}pp` : delta < 0 ? `▼ ${delta}pp` : '→ flat';
  const trendColor = delta > 0 ? '#3fb950' : delta < 0 ? '#f85149' : 'var(--text-muted)';
  return `<div style="margin:6px 0 2px;display:flex;align-items:baseline;gap:10px">
      <span style="font-weight:600">Weekly WIN trend</span>
      <span style="font-size:10px;color:var(--text-muted)">merged ÷ actionable &nbsp;● raw &nbsp;<span style="color:#3fb950">●</span> rolling 4wk</span>
      <span style="margin-left:auto;font-size:12px;color:${trendColor}">${trend}</span>
    </div>
    <svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;background:transparent">
      ${grid}
      <polyline points="${rollPts}" fill="none" stroke="#3fb950" stroke-width="2"/>
      ${rawDots}${rollDots}${rollLabels}${xlabels}
    </svg>`;
}

// Inline-SVG chart of the weekly FUNNEL trend (issuePartition.weekly), a
// distinct view from the WIN trend above. Here the conversion is measured
// end-to-end: merged PRs ÷ issues FILED that week (how many filed issues turn
// into a shipped fix), not merged ÷ PRs-authored. Two %-series on the left axis
// — per-week conversion (faint violet dots) and the trailing-4wk rolling
// conversion (solid violet line + labels) — plus PRs-created (botPr) as amber
// dots on a secondary right-hand count axis, so PR volume reads alongside the
// conversion rate. Deliberately violet/amber to stay visually separate from the
// green WIN trend. Returns '' when there's nothing to plot.
function funnelWeeklyConversionSvg(weekly) {
  if (!Array.isArray(weekly) || weekly.length === 0) return '';
  const W = 520,
    H = 130,
    padL = 34,
    padR = 30,
    padT = 14,
    padB = 24;
  const innerW = W - padL - padR,
    innerH = H - padT - padB;
  const n = weekly.length;
  // Per-week conversion = merged ÷ filed; trailing-4wk rolling = Σmerged ÷ Σfiled.
  const conv = (w) => ((w.filed || 0) > 0 ? (w.merged || 0) / w.filed : 0);
  const roll = weekly.map((_, i) => {
    let m = 0,
      f = 0;
    for (let j = Math.max(0, i - 3); j <= i; j++) {
      m += weekly[j].merged || 0;
      f += weekly[j].filed || 0;
    }
    return f > 0 ? m / f : 0;
  });
  const CONV_RAW = '#8957e5',
    CONV_ROLL = '#bc8cff',
    PR_DOT = '#f0883e';
  // Left axis: conversion %. Right axis: PRs-created count.
  const maxPct = Math.max(0.4, ...weekly.map((w, i) => Math.max(conv(w), roll[i])));
  const maxCnt = Math.max(1, ...weekly.map((w) => w.botPr || 0));
  const x = (i) => padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yPct = (v) => padT + innerH - (v / maxPct) * innerH;
  const yCnt = (v) => padT + innerH - (v / maxCnt) * innerH;
  const gridVals = [0, maxPct / 2, maxPct];
  const grid = gridVals
    .map(
      (v) =>
        `<line x1="${padL}" y1="${yPct(v).toFixed(1)}" x2="${W - padR}" y2="${yPct(v).toFixed(1)}" stroke="var(--border)" stroke-width="1"/>` +
        `<text x="${padL - 5}" y="${(yPct(v) + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="var(--text-muted)">${Math.round(v * 100)}%</text>`,
    )
    .join('');
  // Right-hand count axis labels (amber), at 0 / mid / max.
  const cntVals = [0, Math.round(maxCnt / 2), maxCnt];
  const rightAxis = cntVals
    .map(
      (v) =>
        `<text x="${W - padR + 5}" y="${(yCnt(v) + 3).toFixed(1)}" text-anchor="start" font-size="9" fill="${PR_DOT}">${v}</text>`,
    )
    .join('');
  const rollPts = weekly.map((w, i) => `${x(i).toFixed(1)},${yPct(roll[i]).toFixed(1)}`).join(' ');
  const rawDots = weekly
    .map(
      (w, i) =>
        `<circle cx="${x(i).toFixed(1)}" cy="${yPct(conv(w)).toFixed(1)}" r="2.5" fill="${CONV_RAW}"><title>${esc(w.week)}: ${Math.round(conv(w) * 100)}% merged/filed (${w.merged}/${w.filed})</title></circle>`,
    )
    .join('');
  const rollDots = weekly
    .map(
      (w, i) =>
        `<circle cx="${x(i).toFixed(1)}" cy="${yPct(roll[i]).toFixed(1)}" r="3" fill="${CONV_ROLL}"><title>${esc(w.week)} rolling 4wk: ${Math.round(roll[i] * 100)}% merged/filed</title></circle>`,
    )
    .join('');
  // PRs-created (botPr) as amber dots on the right-hand count axis.
  const prDots = weekly
    .map(
      (w, i) =>
        `<circle cx="${x(i).toFixed(1)}" cy="${yCnt(w.botPr || 0).toFixed(1)}" r="2.5" fill="${PR_DOT}" fill-opacity="0.9"><title>${esc(w.week)}: ${w.botPr || 0} PRs created</title></circle>`,
    )
    .join('');
  const prLine = weekly.map((w, i) => `${x(i).toFixed(1)},${yCnt(w.botPr || 0).toFixed(1)}`).join(' ');
  // Value labels on each rolling conversion point (rates are small — spell out).
  const rollLabels = weekly
    .map((w, i) => {
      const pct = Math.round(roll[i] * 100);
      const anchor = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
      return `<text x="${x(i).toFixed(1)}" y="${(yPct(roll[i]) - 7).toFixed(1)}" text-anchor="${anchor}" font-size="11" font-weight="700" fill="${CONV_ROLL}">${pct}%</text>`;
    })
    .join('');
  const xlabels = weekly
    .map((w, i) =>
      i % Math.ceil(n / 6 || 1) === 0
        ? `<text x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="8" fill="var(--text-muted)">${esc(w.week.slice(5))}</text>`
        : '',
    )
    .join('');
  // Direction hint: last rolling conversion vs first.
  const first = roll[0] || 0,
    last = roll[n - 1] || 0;
  const delta = Math.round((last - first) * 100);
  const trend = delta > 0 ? `▲ +${delta}pp` : delta < 0 ? `▼ ${delta}pp` : '→ flat';
  const trendColor = delta > 0 ? CONV_ROLL : delta < 0 ? '#f85149' : 'var(--text-muted)';
  return `<div style="margin:6px 0 2px;display:flex;align-items:baseline;gap:10px">
      <span style="font-weight:600">Weekly Funnel trend</span>
      <span style="font-size:10px;color:var(--text-muted)">merged ÷ filed &nbsp;<span style="color:${CONV_RAW}">●</span> raw &nbsp;<span style="color:${CONV_ROLL}">●</span> rolling 4wk &nbsp;<span style="color:${PR_DOT}">●</span> PRs created (right axis)</span>
      <span style="margin-left:auto;font-size:12px;color:${trendColor}">${trend}</span>
    </div>
    <svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;background:transparent">
      ${grid}${rightAxis}
      <polyline points="${prLine}" fill="none" stroke="${PR_DOT}" stroke-width="1" stroke-opacity="0.35" stroke-dasharray="3 3"/>
      <polyline points="${rollPts}" fill="none" stroke="${CONV_ROLL}" stroke-width="2"/>
      ${rawDots}${prDots}${rollDots}${rollLabels}${xlabels}
    </svg>`;
}

// Shared "Active Session" block — two-layer (nanoclaw session id + container_status +
// "last N ago") with a collapsible list of SDK sub-sessions. Returned as an HTML string
// WITHOUT the outer <div class="field"><label>Active Session</label>…</div> wrapper so
// callers can choose whether to wrap it (Coworkers detail uses the wrapper; Pixel Office
// inspector is injecting into an existing slot). Pass `wrapField: true` to include the
// field wrapper. Returns '' if there's no nanoclaw session AND no SDK fallback.
/**
 * Pick a CSS variable for an activity_status value emitted by
 * /api/hook-events/sessions. Matches the coworker-list sidebar dots.
 */
function statusDotColor(status) {
  switch (status) {
    case 'working':
      return 'var(--green)';
    case 'thinking':
      return 'var(--yellow)';
    case 'error':
      return 'var(--red)';
    case 'active':
      return '#3B82F6'; // blue
    case 'idle':
    default:
      return 'var(--text-muted)';
  }
}

function statusDotCanvasColor(status) {
  switch (status) {
    case 'working':
      return '#10B981';
    case 'thinking':
      return '#F59E0B';
    case 'error':
      return '#EF4444';
    case 'active':
      return '#3B82F6';
    case 'idle':
    default:
      return '#6B7280';
  }
}

/** Short one-line event summary for the per-session Recent Events block. */
function formatSessionEventLine(e) {
  const t = e.tool ? ` · ${esc(e.tool)}` : '';
  return `${esc(e.event || '')}${t}`;
}

function activeNanoSessionsForCoworker(cw, { includeHidden = false } = {}) {
  const agentGroupId = cw.agentGroupId || cw.agent_group_id || agentGroupIdForFolder(cw.folder);
  return (cachedSessions || []).filter((s) => {
    if (!s.nanoclaw_session_id) return false;
    // Hidden sessions are user-suppressed: they don't render in the right-panel
    // session list, so they shouldn't count toward summaries either (Pixel
    // Office "N sessions" badge, hasMultipleActiveSessions, mark-all-read,
    // etc.). Pass includeHidden:true when the caller needs to render the
    // "Hidden Sessions (N)" expander.
    if (!includeHidden && s.hidden_at) return false;
    if (agentGroupId && s.agent_group_id) return s.agent_group_id === agentGroupId;
    return s.group_folder === cw.folder;
  });
}

function isA2aSession(nanoSess) {
  if (nanoSess?.thread_id) return false;
  if (nanoSess?.a2a_peer) return true;
  if (typeof nanoSess?.messaging_group_id === 'string' && nanoSess.messaging_group_id.startsWith('mg-a2a-'))
    return true;
  return !nanoSess?.messaging_group_id;
}

// Stable per-coworker lane color in the swim-lane thread view. Hash the folder
// name to a hue so the same coworker keeps its color across renders.
function laneColor(folder) {
  let h = 0;
  const s = String(folder || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff;
  return `hsl(${h % 360}, 60%, 55%)`;
}

// A thread_id can map to multiple sessions (a GitHub issue/PR has a webhook
// session plus a2a-delegation sessions). The canonical one — what a /t/ deep
// link should open and what the host's findSessionByAgentThread collapses to —
// is the non-a2a (webhook) session, earliest-created, with id as a stable
// tie-break (mirrors src/db/sessions.ts findSessionByAgentThread). Returns the
// cachedSessions row, or null if none are loaded yet.
function resolveCanonicalSessionForThread(folder, threadId) {
  const matches = (cachedSessions || []).filter(
    (s) => s.group_folder === folder && s.thread_id === threadId && s.nanoclaw_session_id,
  );
  if (!matches.length) return null;
  matches.sort((a, b) => {
    const aA2a = isA2aSession(a) ? 1 : 0;
    const bA2a = isA2aSession(b) ? 1 : 0;
    if (aA2a !== bA2a) return aA2a - bA2a; // non-a2a (webhook) first
    const at = a.created_at || '';
    const bt = b.created_at || '';
    if (at !== bt) return at < bt ? -1 : 1; // earliest-created
    return String(a.nanoclaw_session_id) < String(b.nanoclaw_session_id) ? -1 : 1; // id tie-break
  });
  return matches[0];
}

function sessionSlugOnly(nanoSess) {
  // Bare 3-word slug (e.g. "tender-fell-rests"), no "main · " / "thread · "
  // kind prefix. Used in the one-line display format per user feedback.
  if (!nanoSess?.nanoclaw_session_id) return '';
  return typeof window.sessionSlug === 'function'
    ? window.sessionSlug(nanoSess.nanoclaw_session_id)
    : nanoSess.nanoclaw_session_id;
}

function sessionKindPrefix(nanoSess) {
  return nanoSess?.thread_id ? 'Thread' : 'Session';
}

function sessionDisplayTitle(nanoSess) {
  const title = nanoSess?.display_title || '';
  const peer = nanoSess?.a2a_peer;
  if (peer && title) return `${peer}: ${title}`;
  if (peer) return peer;
  return title;
}

function sessionKeyLabel(nanoSess) {
  return nanoSess?.session_key || '';
}

// Look up a nanoSess record from cachedSessions by NanoClaw session id.
// Returns null when cachedSessions hasn't loaded yet or no match is found —
// callers fall back to the bare slug label in that case.
function lookupNanoSessById(sessionId) {
  if (!sessionId) return null;
  for (const p of cachedSessions || []) {
    if (p.nanoclaw_session_id === sessionId) return p;
  }
  return null;
}

// Shared label used by the thread panel header, a2a inspector, and anywhere
// else that only has a (sessionId, threadId) pair. Renders as
// `kind · slug` when no display_title is set, or `kind · slug: title` when
// the session has either a manual rename or an auto heuristic title.
function sessionLabelWithTitle(sessionId, threadId) {
  const nanoSess = lookupNanoSessById(sessionId);
  return sessionDisplayTitle(nanoSess) || String(sessionId || '').slice(0, 16);
}

/**
 * Render session chip as the single-line format the operator asked for:
 *     Session- tender-fell-rests: Fix PR#124
 *     Thread- silver-river-drifts: Review nv-main merge
 *
 * Falls back to just the slug when no display_title is set yet (newly
 * created sessions, sessions from pre-titler installs). The raw
 * sess-xxx id stays in the `title=` attribute for log-grep.
 */
function sessionTitleHtml(nanoSess, { compact = false } = {}) {
  if (!nanoSess?.nanoclaw_session_id) return '';
  const title = sessionDisplayTitle(nanoSess);
  const label = title || String(nanoSess?.nanoclaw_session_id || '').slice(0, 16);
  const color = compact ? 'var(--text-dim)' : 'var(--text)';
  const size = compact ? '' : 'font-size:10px;';
  return `<span style="${size}color:${color};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0${compact ? ';flex:1' : ''}" title="${escAttr(nanoSess.nanoclaw_session_id)}">${esc(label)}</span>`;
}

function renderActiveSessionBlock(cw, { wrapField = true } = {}) {
  const groupEvents = (state.hookEvents || []).filter((e) => hookEventBelongsToCoworker(e, cw));
  const nanoSessions = activeNanoSessionsForCoworker(cw, { includeHidden: true })
    .slice()
    .sort((a, b) => {
      // Pinned sessions go first (pinned_at desc — newest pin on top within the group),
      // then unpinned sorted by last-active desc. Hidden state does NOT change sort —
      // hidden rows are filtered out downstream, not reordered here.
      const aPin = a.pinned_at ? 1 : 0;
      const bPin = b.pinned_at ? 1 : 0;
      if (aPin !== bPin) return bPin - aPin;
      if (aPin && bPin) return new Date(b.pinned_at).getTime() - new Date(a.pinned_at).getTime();
      const aMs = a.last_active ? new Date(a.last_active).getTime() : (a.sdk_subsessions?.[0]?.last_ts ?? 0);
      const bMs = b.last_active ? new Date(b.last_active).getTime() : (b.sdk_subsessions?.[0]?.last_ts ?? 0);
      return bMs - aMs;
    });
  let inner = '';
  if (nanoSessions.length > 0) {
    const sessionMeta = (nanoSess) => {
      const lastMs = nanoSess.last_active
        ? new Date(nanoSess.last_active).getTime()
        : (nanoSess.sdk_subsessions?.[0]?.last_ts ?? 0);
      const humanSess = sessionDisplayTitle(nanoSess);
      const status = nanoSess.activity_status || (nanoSess.container_status === 'running' ? 'active' : 'idle');
      return {
        lastMs,
        ago: lastMs ? timeAgo(lastMs) : '',
        cs: nanoSess.container_status || 'unknown',
        humanSess,
        status,
        subCount: (nanoSess.sdk_subsessions || []).length,
      };
    };
    const allMetas = nanoSessions.map((nanoSess) => ({ nanoSess, ...sessionMeta(nanoSess) }));
    // Visible = not hidden. Hidden sessions go to the "Show hidden (N)" expander below.
    // The Current Target never picks a hidden session — it's always drawn from visible.
    const metas = allMetas.filter((m) => !m.nanoSess.hidden_at);
    const hiddenMetas = allMetas.filter((m) => m.nanoSess.hidden_at);
    if (metas.length === 0) {
      // All sessions hidden — fall through with the target pointing at the first hidden row
      // so the UI still renders something rather than erroring.
      metas.push(...hiddenMetas);
    }
    const target = metas.find((m) => m.cs === 'running') || metas[0];
    const runningCount = allMetas.filter((m) => m.cs === 'running').length;
    const latestMs = Math.max(...allMetas.map((m) => m.lastMs || 0), 0);
    const summaryStatus = runningCount > 0 ? `${runningCount} running` : 'all stopped';
    const otherSessions = metas.filter((m) => m.nanoSess.nanoclaw_session_id !== target.nanoSess.nanoclaw_session_id);
    const hasAnyUnread = allMetas.some((m) => hasSessionUnread(m.nanoSess));
    const markAllBtn = hasAnyUnread
      ? ` · <a href="#" class="cw-mark-all-read" style="color:#3b82f6;text-decoration:none;font-size:9px" data-folder="${escAttr(cw.folder)}">mark all read</a>`
      : '';
    const summary = `<div style="font-size:9px;color:var(--text-muted);margin-bottom:5px">
      ${metas.length} session${metas.length === 1 ? '' : 's'} · ${esc(summaryStatus)}${latestMs ? ' · last ' + esc(timeAgo(latestMs)) : ''}${markAllBtn}
    </div>`;
    const tagid = escAttr(target.nanoSess.agent_group_id || '');
    const tsid = escAttr(target.nanoSess.nanoclaw_session_id);
    const ttid = escAttr(target.nanoSess.thread_id || '');
    const tgrp = escAttr(cw.folder);
    const actionBtns = (sid, agid, tid, currentTitle, sess) => {
      const isPinned = !!(sess && sess.pinned_at);
      const isHidden = !!(sess && sess.hidden_at);
      return `<button class="session-icon-btn${isPinned ? ' active' : ''}" title="${isPinned ? 'Unpin session' : 'Pin session to top'}"
        data-pin-session="${sid}" data-pin-on="${isPinned ? '0' : '1'}">📌</button><button class="session-icon-btn" title="Rename this session"
        data-rename-session="${sid}" data-rename-current="${escAttr(currentTitle || '')}">✎</button><button class="session-icon-btn" title="Open in Timeline"
        data-view-nanoclaw-session="${sid}" data-view-nanoclaw-agid="${agid}" data-view-session-group="${tgrp}">≡</button>${
          tid
            ? `<button class="session-icon-btn" title="Open chat view"
        data-view-chat-session="${sid}" data-view-chat-thread="${tid}" data-view-chat-group="${tgrp}">💬</button>`
            : isA2aSession(sess)
              ? `<button class="session-icon-btn" title="Open a2a session"
        data-view-chat-session="${sid}" data-view-session-direct="${sid}" data-view-chat-group="${tgrp}">💬</button>`
              : `<button class="session-icon-btn" title="Main session — already shown in chat" disabled style="opacity:0.35;cursor:not-allowed">💬</button>`
        }<button class="session-icon-btn${isHidden ? ' active' : ''}" title="${isHidden ? 'Unhide session' : 'Hide session'}"
        data-hide-session="${sid}" data-hide-on="${isHidden ? '0' : '1'}">${isHidden ? '↺' : '−'}</button>`;
    };
    const lookupLastMessage = (threadId) => {
      // cwState.messages is loaded for the currently selected coworker. Find the
      // most recent message (any direction) whose thread_id matches. Main-session
      // rows use thread_id = null.
      const msgs = cwState?.messages || [];
      const wantThread = threadId || null;
      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i];
        const mt = m.thread_id || null;
        if (mt === wantThread) {
          const raw = (m.displayContent || m.content || '').toString();
          const cleaned = raw.replace(/\s+/g, ' ').trim();
          return cleaned.length > 100 ? cleaned.slice(0, 100) + '…' : cleaned;
        }
      }
      return '';
    };
    const sessionRow = (sess, status, cs, ago, agid, sid, tid, outer) => {
      const currentTitle = sessionDisplayTitle(sess);
      const primaryName = currentTitle || String(sess.nanoclaw_session_id || '').slice(0, 16);
      const lastMsg = lookupLastMessage(sess.thread_id);
      const previewBits = [lastMsg || null].filter(Boolean);
      const dotSize = outer ? '6px' : '5px';
      const dotColor = outer ? statusDotColor(status) : statusDotCanvasColor(status);
      const titleStyle = outer
        ? 'font-size:10px;color:var(--text);font-weight:600'
        : 'font-size:9px;color:var(--text-dim)';
      const metaStyle = 'font-size:9px;color:var(--text-muted);margin-top:2px';
      const previewStyle =
        'font-size:9px;color:var(--text-dim);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      const evCount = sess.event_count_total || 0;
      const subCount = (sess.sdk_subsessions || []).length;
      const metaParts = [
        cs,
        ago ? 'last ' + ago : '',
        evCount ? `${evCount} ev` : '',
        subCount ? `${subCount} sub` : '',
      ].filter(Boolean);
      const unread = hasSessionUnread(sess);
      const unreadBadge = unread
        ? `<span class="session-unread-dot" title="Unread activity since you last opened this session"></span>`
        : '';
      const isA2a = !!sess.a2a_peer;
      const a2aBadge = isA2a
        ? '<span style="font-size:7px;background:#7c3aed;color:#fff;padding:1px 4px;border-radius:3px;flex-shrink:0;letter-spacing:.03em">a2a</span>'
        : '';
      return `<div style="display:flex;align-items:center;gap:6px;flex-wrap:nowrap;min-width:0">
        <span style="display:inline-block;width:${dotSize};height:${dotSize};border-radius:50%;background:${dotColor};flex-shrink:0" title="${escAttr(status)}"></span>
        ${a2aBadge}
        <span style="${titleStyle};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1${tid || isA2aSession(sess) ? ';cursor:pointer;text-decoration:underline dotted;text-underline-offset:2px' : ''}" title="${escAttr(sess.nanoclaw_session_id)}"${tid ? ` data-view-chat-session="${sid}" data-view-chat-thread="${tid}" data-view-chat-group="${escAttr(tgrp)}"` : isA2aSession(sess) ? ` data-view-chat-session="${sid}" data-view-session-direct="${sid}" data-view-chat-group="${escAttr(tgrp)}"` : ''}>${esc(primaryName)}</span>
        <span style="display:flex;gap:2px;flex-shrink:0">${actionBtns(sid, agid, tid, primaryName, sess)}</span>
      </div>
      ${previewBits.length ? `<div style="${previewStyle}" title="${escAttr(previewBits.join(' · '))}">${esc(previewBits.join(' · '))}</div>` : ''}
      <div style="${metaStyle}">${esc(metaParts.join(' · '))}${unreadBadge}</div>`;
    };
    // No auto-mark-read on right-panel render. Marking a session as read should
    // only happen when the user explicitly opens its thread/chat (via the 💬
    // button or thread-stub click) — that way the per-session badge reflects
    // actual user attention, not just dashboard navigation. The "mark all read"
    // button below clears state explicitly when wanted.
    const targetHtml = `<div style="padding:5px 6px;border:1px solid var(--border);border-radius:4px;background:rgba(255,255,255,0.03);margin-bottom:5px">
      ${sessionRow(target.nanoSess, target.status, target.cs, target.ago, tagid, tsid, ttid, true)}
    </div>`;
    const renderRow = (m, dim = false) => {
      const mAgid = escAttr(m.nanoSess.agent_group_id || '');
      const mSid = escAttr(m.nanoSess.nanoclaw_session_id);
      const mTid = escAttr(m.nanoSess.thread_id || '');
      const haystack = escAttr(`${sessionSlugOnly(m.nanoSess)} ${sessionDisplayTitle(m.nanoSess)}`.toLowerCase());
      const bg = dim ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.02)';
      const opacity = dim ? ';opacity:0.7' : '';
      return `<div class="other-session-row" data-haystack="${haystack}" style="padding:4px 6px;border:1px solid var(--border);border-radius:4px;background:${bg}${opacity}">
        ${sessionRow(m.nanoSess, m.status, m.cs, m.ago, mAgid, mSid, mTid, false)}
      </div>`;
    };
    const needsSearch = otherSessions.length > 8;
    const othersHtml =
      otherSessions.length === 0
        ? ''
        : `<div style="display:flex;align-items:center;gap:6px;margin:5px 0 3px">
        <div style="font-size:8px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.04em;flex:1">Other Sessions (${otherSessions.length})</div>
        ${needsSearch ? `<input type="text" id="cw-other-session-search" placeholder="filter…" style="font-size:9px;padding:1px 4px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;width:80px">` : ''}
      </div>
      <div id="cw-other-session-list" style="display:flex;flex-direction:column;gap:3px;margin-bottom:5px;max-height:280px;overflow-y:auto">
        ${otherSessions.map((m) => renderRow(m)).join('')}
      </div>`;
    const hiddenHtml =
      hiddenMetas.length === 0
        ? ''
        : `<details style="margin-top:4px">
        <summary style="font-size:8px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.04em;cursor:pointer;padding:2px 0">
          ⌄ Hidden Sessions (${hiddenMetas.length})
        </summary>
        <div style="display:flex;flex-direction:column;gap:3px;margin-top:3px;max-height:240px;overflow-y:auto">
          ${hiddenMetas.map((m) => renderRow(m, true)).join('')}
        </div>
      </details>`;
    inner = `<div class="value" style="display:flex;flex-direction:column;gap:0">${summary}${targetHtml}${othersHtml}${hiddenHtml}</div>`;
  } else {
    // Fallback: fall back to the last-seen SDK session if cachedSessions hasn't loaded yet.
    const sessionEvent = groupEvents.filter((e) => e.session_id).slice(-1)[0];
    const activeSession = sessionEvent?.session_id || null;
    if (!activeSession) return '';
    inner = `<div class="value" style="display:flex;align-items:center;gap:6px">
        <span style="font-size:9px;color:var(--text-dim)">${esc(activeSession.slice(0, 12))}</span>
        <button class="admin-action-btn" style="font-size:8px;padding:1px 6px" data-view-session="${escAttr(activeSession)}" data-view-session-group="${escAttr(cw.folder)}">View Session</button>
      </div>`;
  }
  return wrapField ? `<div class="field"><label>Sessions</label>${inner}</div>` : inner;
}

function agentGroupIdForFolder(folder) {
  const group = (state.registeredGroups || []).find((g) => g.folder === folder);
  return group?.id || null;
}

// Resolve an agent-group id (ag-…) to its friendly coworker name, searching every
// place the client keeps group identity. Falls back to the raw id when unknown.
function agNameById(agId) {
  if (!agId) return agId;
  const pools = [adminState.groups || [], state.registeredGroups || []];
  for (const pool of pools) {
    const hit = pool.find((g) => g.id === agId);
    if (hit) return hit.name || hit.folder || agId;
  }
  const cw = (state.coworkers || []).find((c) => (c.agentGroupId || c.agent_group_id) === agId);
  return cw ? cw.name || cw.folder : agId;
}

// Human label for a messaging group. a2a groups are auto-created with no name and
// a platform_id of `agent:<from-ag>:<to-ag>` — render that as "From → To (a2a)"
// instead of the opaque id. Non-a2a groups use their name or platform_id as-is.
function messagingGroupLabel(g) {
  if (g && g.name) return g.name;
  const pid = g && g.platform_id ? String(g.platform_id) : '';
  const m = /^agent:(ag-[^:]+):(ag-[^:]+)$/.exec(pid);
  if (m) {
    const from = agNameById(m[1]);
    const to = agNameById(m[2]);
    return from === to ? `${from} ⟳ self (a2a)` : `${from} → ${to} (a2a)`;
  }
  return pid || '(unnamed)';
}

function hookEventBelongsToCoworker(event, cw) {
  const agentGroupId = cw.agentGroupId || cw.agent_group_id || agentGroupIdForFolder(cw.folder);
  if (agentGroupId && event.agent_group_id) return event.agent_group_id === agentGroupId;
  return event.group === cw.folder;
}

function renderDetailHooks(cw) {
  const groupEvents = state.hookEvents.filter((e) => hookEventBelongsToCoworker(e, cw));

  // Build pre-tool map for durations
  const preTimes = new Map();
  for (const e of groupEvents) {
    if (e.event === 'PreToolUse' && e.tool_use_id) preTimes.set(e.tool_use_id, e.timestamp);
  }

  // Show last 5 tool calls with durations.
  //
  // Recent Events is a folder-level rollup only. The per-session breakdown
  // (sess-… / "thread · <slug>" / container status / sub-sessions) lives in
  // its own "Session" panel (#detail-session, populated at :1410 + :458),
  // so don't inline the session block here — previously that produced a
  // visible duplicate of each thread/main entry in the detail panel.
  const recentTools = groupEvents
    .filter((e) => e.event === 'PostToolUse' || e.event === 'PostToolUseFailure')
    .slice(-5);
  let html = '';

  if (recentTools.length === 0 && groupEvents.length === 0) return html;
  // Newest-first: take the last 5 chronologically, then reverse so the top entry is most recent.
  const display = groupEvents
    .filter((e) => e.event !== 'PreToolUse')
    .slice(-5)
    .reverse();
  html += display
    .map((e) => {
      const dur =
        (e.event === 'PostToolUse' || e.event === 'PostToolUseFailure') && e.tool_use_id && preTimes.has(e.tool_use_id)
          ? ` <span style="color:var(--text-muted)">${formatDuration(e.timestamp - preTimes.get(e.tool_use_id))}</span>`
          : '';
      return `<button class="hook-entry hook-entry-link" data-event-group="${escAttr(cw.folder)}" data-event-time="${String(e.timestamp)}">
      <span class="ts">${formatTime(e.timestamp)}</span> <span class="tool-name">${esc(e.tool || e.event)}</span>${dur}
    </button>`;
    })
    .join('');
  return html;
}

function currentViewedNanoSession(folder) {
  const threadId = cwState.thread?.parentId || null;
  const sessions = (cachedSessions || []).filter((s) => s.group_folder === folder && s.nanoclaw_session_id);
  if (threadId) return sessions.find((s) => s.thread_id === threadId) || null;
  return sessions.find((s) => s.thread_id == null) || null;
}

function renderCurrentSessionEvents(folder) {
  const nanoSess = currentViewedNanoSession(folder);
  if (!nanoSess) return '<span style="color:var(--text-dim)">No active session resolved for this view.</span>';
  // One-line format: `Session- tender-fell-rests: Fix PR#124` (or
  // `Thread- …: …` for a thread session). Falls back to just the slug
  // when no display_title has landed yet.
  const kind = sessionKindPrefix(nanoSess);
  const title = sessionDisplayTitle(nanoSess);
  const label = `${kind}- ${title || String(nanoSess?.nanoclaw_session_id || '').slice(0, 16)}`;
  const events = nanoSess.recent_events || [];
  if (events.length === 0) return '';
  const eventHtml = events
    .slice(0, 5)
    .map(
      (
        e,
      ) => `<button class="hook-entry hook-entry-link" data-event-group="${escAttr(folder)}" data-event-time="${String(e.timestamp)}">
        <span class="ts">${formatTime(e.timestamp)}</span> <span class="tool-name">${formatSessionEventLine(e)}</span>
      </button>`,
    )
    .join('');
  return `<div style="margin-top:6px">${eventHtml}</div>`;
}

function hasMultipleActiveSessions(cw) {
  return activeNanoSessionsForCoworker(cw).length > 1;
}

function hidePixelOfficeContext() {
  const ctxField = document.getElementById('detail-context-field');
  if (ctxField) ctxField.style.display = 'none';
}

function focusTimelineEntry(group, timestamp) {
  const entries = Array.from(document.querySelectorAll('#timeline-list .tl-entry'));
  const match = entries.find(
    (el) =>
      el.dataset.eventGroup === group && el.dataset.eventType === 'hook' && el.dataset.eventTime === String(timestamp),
  );
  if (!match) return;

  const expandBtn = match.querySelector('.tl-expand-btn');
  if (expandBtn && expandBtn.textContent !== '[-]') {
    expandBtn.click();
  }

  match.classList.add('tl-entry-focus');
  match.scrollIntoView({ block: 'center', behavior: 'smooth' });
  setTimeout(() => match.classList.remove('tl-entry-focus'), 1600);
}

function openTimelineForEvent(group, timestamp) {
  switchToTab('observability');
  setTimelineFilter(group);
  updateTimeline();
  requestAnimationFrame(() => focusTimelineEntry(group, timestamp));
}

function updateDetailHooks(cw) {
  const hooksEl = document.getElementById('detail-hooks');
  if (!hooksEl) return;
  hooksEl.innerHTML = `<div style="font-size:0.625rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Coworker Activity</div>${renderDetailHooks(cw) || '<span style="color:var(--text-dim)">None</span>'}`;
}

function applyState(nextState) {
  // A full snapshot (/api/state, resync, initial live frame) carries the current
  // server identity + revision; adopt both so subsequent deltas can be
  // continuity-checked. Deltas route through applyDeltaPatch(), which puts the
  // new revision INTO the patch — so `state.stateRev` is never stale and a
  // caller that spreads `...state` back through applyState() (applyHookEvent)
  // cannot roll the live revision backwards.
  if (typeof nextState.stateEpoch === 'string') stateEpoch = nextState.stateEpoch;
  if (typeof nextState.stateRev === 'number') stateRev = nextState.stateRev;
  const nextHookEvents = Object.prototype.hasOwnProperty.call(nextState, 'hookEvents')
    ? nextState.hookEvents
    : state.hookEvents;
  state = { ...state, ...nextState, hookEvents: nextHookEvents || [] };
  updateTimeline();
  // Live-update coworkers tab sidebar
  if (typeof scheduleCwRefresh === 'function') scheduleCwRefresh();
  // WS-driven chat refresh: when the selected coworker's lastMessageTs
  // advances, pull the main feed (and any open thread) immediately. The 3s
  // poll remains as a fallback. State shape tolerates either .coworkers
  // or .registeredGroups carrying the timestamp.
  if (cwState && cwState.selected) {
    const cw = (state.coworkers || []).find((c) => c.folder === cwState.selected);
    const ts = cw?.lastMessageTs || cw?.lastActivity || null;
    if (ts && ts !== cwState.lastMainMessageTs) {
      cwState.lastMainMessageTs = ts;
      if (typeof fetchCwMessages === 'function') fetchCwMessages();
      if (cwState.thread && typeof fetchCwThread === 'function') {
        fetchCwThread(cwState.thread.parentId);
      }
    }
  }
  // Live-update detail panel if open
  if (selectedCoworker) {
    const updated = state.coworkers.find((c) => c.folder === selectedCoworker.folder);
    if (updated) {
      updateDetailHooks(updated);
      document.getElementById('detail-tool').textContent = updated.lastToolUse || '-';
      const statusEl = document.getElementById('detail-status');
      if (statusEl) statusEl.innerHTML = renderStatusBadge(updated.status);
      document.getElementById('detail-activity').textContent = updated.lastActivity
        ? timeAgo(updated.lastActivity)
        : 'Never';
      const subagentsEl = document.getElementById('detail-subagents');
      if (subagentsEl) subagentsEl.innerHTML = renderSubagentList(updated);
      // Keep #detail-session (Pixel Office inspector) live — `last N ago` + container status
      // drift with state; re-render the shared block so a new task-fire sub-session appears
      // without waiting for a reselect.
      const detailSessEl = document.getElementById('detail-session');
      if (detailSessEl) {
        const blk = renderActiveSessionBlock(updated, { wrapField: false });
        if (blk) {
          const openDetailIds = new Set();
          detailSessEl.querySelectorAll('details').forEach((d, i) => {
            if (d.open) openDetailIds.add(i);
          });
          detailSessEl.innerHTML = blk;
          if (openDetailIds.size > 0) {
            detailSessEl.querySelectorAll('details').forEach((d, i) => {
              if (openDetailIds.has(i)) d.open = true;
            });
          }
        }
      }
      hidePixelOfficeContext();
    }
  }
}

// Merge one keyed collection from a delta. Returns null when the result can't be
// trusted (see below), which the caller turns into a resync.
//
// The delta carries the server's FULL key order alongside the upserts/removes.
// A key-merge alone reproduces the server's *contents* but keeps the CLIENT's
// Map insertion order, which silently diverges the moment the server reorders
// without changing any item ([A,B] → [A,C,B] ships only an upsert for C and
// yields [A,B,C] here). Index-positional UI — the pixel office assigns desks by
// array index — then renders a different office than a full snapshot would, at a
// revision the client considers perfectly in sync.
function mergeKeyedDelta(current, change, keyOf) {
  const map = new Map((current || []).map((item) => [keyOf(item), item]));
  for (const item of change.upsert || []) map.set(keyOf(item), item);
  for (const key of change.remove || []) map.delete(String(key));
  if (!Array.isArray(change.order)) return Array.from(map.values());
  const ordered = [];
  for (const key of change.order) {
    const item = map.get(String(key));
    if (item !== undefined) ordered.push(item);
  }
  // Server order and our merged set must describe exactly the same membership.
  if (ordered.length !== map.size || ordered.length !== change.order.length) return null;
  return ordered;
}

// Apply an incremental state-delta from the live channel. Only the changed keyed
// objects (coworkers/registered-groups upsert+remove), the key order, and scalar
// fields travel. Returns false if the patch can't be applied cleanly.
function applyDeltaPatch(delta) {
  const patch = {};
  if (delta.coworkers) {
    const merged = mergeKeyedDelta(state.coworkers, delta.coworkers, (c) => String(c.folder));
    if (merged === null) return false;
    patch.coworkers = merged;
  }
  if (delta.registeredGroups) {
    const merged = mergeKeyedDelta(state.registeredGroups, delta.registeredGroups, (g) => String(g.id));
    if (merged === null) return false;
    patch.registeredGroups = merged;
  }
  if (delta.fields && typeof delta.fields === 'object') Object.assign(patch, delta.fields);
  // Revision travels WITH the state (never as a side variable only): applyState
  // merges it into `state`, so a later applyState({ ...state, ... }) can't carry
  // a stale revision and roll the live one backwards.
  patch.stateRev = delta.rev;
  if (typeof delta.stateEpoch === 'string') patch.stateEpoch = delta.stateEpoch;
  applyState(patch);
  return true;
}

function bufferDelta(delta) {
  if (bufferedDeltas.length >= MAX_BUFFERED_DELTAS) bufferedDeltas.shift();
  bufferedDeltas.push(delta);
}

// Replay deltas that arrived while a resync was in flight, against the revision
// the snapshot actually established. Anything at or below it is already
// included; anything that doesn't chain means we still have a hole → resync.
function drainBufferedDeltas() {
  if (!bufferedDeltas.length) return;
  const pending = bufferedDeltas.slice().sort((a, b) => a.rev - b.rev);
  bufferedDeltas = [];
  let gap = false;
  for (const delta of pending) {
    if (typeof delta.stateEpoch === 'string' && delta.stateEpoch !== stateEpoch) {
      gap = true;
      continue;
    }
    if (delta.rev <= stateRev) continue;
    if (delta.baseRev !== stateRev || !applyDeltaPatch(delta)) {
      gap = true;
      break;
    }
  }
  if (gap) void resyncLiveData();
}

function clearResyncRetry() {
  if (resyncRetryTimer) {
    clearTimeout(resyncRetryTimer);
    resyncRetryTimer = null;
  }
}

function scheduleResyncRetry() {
  if (resyncRetryTimer) return;
  const delay = Math.min(30000, 1000 * 2 ** Math.min(resyncAttempt, 5));
  resyncAttempt += 1;
  resyncRetryTimer = setTimeout(() => {
    resyncRetryTimer = null;
    void resyncLiveData();
  }, delay);
}

function finishResync() {
  resyncBarrier = false;
  resyncAttempt = 0;
  resyncInFlight = null;
  clearResyncRetry();
  drainBufferedDeltas();
}

// Adopt a full snapshot from ANY source (HTTP /api/state or an in-stream
// `state` frame) and lift the barrier. A delayed response that would rewind us —
// same server instance, older revision than we already hold — is discarded
// rather than applied.
function adoptSnapshot(data) {
  if (!data || typeof data !== 'object') {
    finishResync();
    return;
  }
  const epoch = typeof data.stateEpoch === 'string' ? data.stateEpoch : null;
  const rev = typeof data.stateRev === 'number' ? data.stateRev : null;
  if (epoch !== null && epoch === stateEpoch && rev !== null && rev < stateRev) {
    finishResync();
    return;
  }
  applyState(data);
  finishResync();
}

function applyStateDelta(delta) {
  if (!delta || typeof delta.baseRev !== 'number' || typeof delta.rev !== 'number') {
    void resyncLiveData();
    return;
  }
  if (resyncBarrier) {
    bufferDelta(delta);
    return;
  }
  // Epoch first: after a server restart the revision numbers alone will happily
  // "chain" onto a baseline from the previous process.
  const epochMismatch = typeof delta.stateEpoch === 'string' && delta.stateEpoch !== stateEpoch;
  if (epochMismatch || delta.baseRev !== stateRev || !applyDeltaPatch(delta)) {
    bufferDelta(delta);
    void resyncLiveData();
  }
}

function hookEventKey(event) {
  return event.id ? `id:${event.id}` : `${event.timestamp}|${event.group}|${event.event}|${event.tool_use_id || ''}`;
}

function mergeHookEvents(events) {
  const merged = new Map((state.hookEvents || []).map((event) => [hookEventKey(event), event]));
  for (const event of events || []) {
    merged.set(hookEventKey(event), event);
    lastHookEventId = Math.max(lastHookEventId, Number(event.id) || 0);
  }
  return Array.from(merged.values())
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-LIVE_HOOK_EVENT_LIMIT);
}

function applyHookEvent(event, coworkerPatch) {
  const nextCoworkers = (state.coworkers || []).map((coworker) =>
    coworker.folder === coworkerPatch?.folder ? { ...coworker, ...coworkerPatch } : coworker,
  );
  applyState({
    ...state,
    coworkers: nextCoworkers,
    hookEvents: mergeHookEvents([event]),
    lastHookEventId: Math.max(lastHookEventId, Number(event.id) || 0),
  });
}

async function loadRecentHookEvents() {
  try {
    const res = await fetch('/api/hook-events?limit=200', { cache: 'no-store' });
    if (!res.ok) return false;
    const events = await res.json();
    applyState({ ...state, hookEvents: mergeHookEvents(events) });
    return true;
  } catch {
    return false;
  }
}

async function pollState() {
  try {
    const res = await fetch('/api/state', { cache: 'no-store' });
    if (!res.ok) return false;
    adoptSnapshot(await res.json());
    return true;
  } catch {
    return false;
  }
}

function startPolling() {
  if (pollTimer) return;
  setLiveStatus('Polling Fallback', 'var(--yellow)');
  // Route through resyncLiveData() so a poll coalesces with any resync already
  // in flight: two concurrent /api/state responses can land out of order, and
  // the older one would overwrite the newer.
  void resyncLiveData();
  pollTimer = setInterval(async () => {
    const stateOk = await resyncLiveData();
    if (!stateOk) {
      setLiveStatus('Reconnecting...', 'var(--yellow)');
    }
  }, 10000);
}

function stopPolling() {
  if (!pollTimer) return;
  clearInterval(pollTimer);
  pollTimer = null;
}

function scheduleLiveReconnect() {
  if (liveReconnectTimer || document.hidden) return;
  const baseDelay = Math.min(30000, 1000 * 2 ** Math.min(liveReconnectAttempt, 5));
  const delay = baseDelay + Math.floor(Math.random() * 1000);
  liveReconnectAttempt += 1;
  liveReconnectTimer = setTimeout(() => {
    liveReconnectTimer = null;
    connectLiveUpdates();
  }, delay);
}

// Raise the barrier, fetch a full snapshot, and (on success, via
// adoptSnapshot → finishResync) replay whatever arrived meanwhile. Single
// in-flight request: concurrent triggers share one fetch, so an older response
// can never overwrite a newer one. A FAILED resync leaves the barrier up and
// retries with bounded backoff — silently giving up would strand the client at a
// revision the server has already moved past, and no further delta could ever
// chain onto it.
function resyncLiveData() {
  if (resyncInFlight) return resyncInFlight;
  resyncBarrier = true;
  clearResyncRetry();
  const attempt = Promise.all([pollState(), loadRecentHookEvents()])
    .then(([stateOk]) => {
      if (!stateOk) {
        // finishResync() didn't run (no snapshot adopted) — clear the in-flight
        // slot ourselves and retry; the barrier stays up until one succeeds.
        if (resyncInFlight === attempt) resyncInFlight = null;
        scheduleResyncRetry();
      }
      return stateOk;
    })
    .catch(() => {
      if (resyncInFlight === attempt) resyncInFlight = null;
      scheduleResyncRetry();
      return false;
    });
  resyncInFlight = attempt;
  return attempt;
}

function connectLiveUpdates() {
  if (!('EventSource' in window)) {
    startPolling();
    return;
  }
  if (document.hidden) return;
  if (liveReconnectTimer) {
    clearTimeout(liveReconnectTimer);
    liveReconnectTimer = null;
  }
  if (liveSource) liveSource.close();
  // No `snapshot=0`: every connection (and every reconnection) starts from a
  // full snapshot delivered ON THIS STREAM. Resuming from whatever state the
  // page happened to hold is only sound if the revision space is continuous
  // across the gap — it isn't when the server restarted, and an in-stream
  // snapshot is ordered against the deltas by construction (an HTTP one is not).
  const source = new EventSource(`/api/events?after=${encodeURIComponent(lastHookEventId)}`);
  liveSource = source;
  source.onopen = () => {
    if (liveSource !== source) return;
    liveReconnectAttempt = 0;
    stopPolling();
    setLiveStatus('Connected', 'var(--green)');
  };
  source.onmessage = (e) => {
    if (liveSource !== source) return;
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'state') {
        adoptSnapshot(msg.data);
      } else if (msg.type === 'state-delta') {
        applyStateDelta(msg);
      } else if (msg.type === 'hook-event') {
        applyHookEvent(msg.data, msg.coworker);
      } else if (msg.type === 'resync') {
        void resyncLiveData();
      }
    } catch {}
  };
  source.onerror = () => {
    if (liveSource !== source) return;
    source.close();
    liveSource = null;
    setLiveStatus('Reconnecting...', 'var(--yellow)');
    scheduleLiveReconnect();
  };
}

// --- Tab switching ---
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    switchToTab(tab.dataset.tab);
  });
});

// ===================================================================
// TAB 1: PIXEL ART OFFICE (Tile-based with pixel-agents assets)
// ===================================================================

const canvas = document.getElementById('office-canvas');
const ctx = canvas.getContext('2d');
const officeRoot = document.getElementById('pixel-office');
const detailPanel = document.getElementById('detail-panel');

const TW = PixelSprites.TILE * Z; // 48px per tile at zoom 3

// --- Layout data (loaded from JSON) ---
let layoutData = null;
fetch('assets/default-layout-1.json')
  .then((r) => r.json())
  .then((d) => {
    layoutData = d;
  })
  .catch(() => {});

const FIRST_VIS_ROW = 10;

// Layout furniture type → PixelSprites key
const FURN_MAP = {
  TABLE_FRONT: 'tableFront',
  COFFEE_TABLE: 'coffeeTable',
  SOFA_FRONT: 'sofa',
  SOFA_BACK: 'sofaBack',
  SOFA_SIDE: 'sofaSide',
  HANGING_PLANT: 'hangingPlant',
  DOUBLE_BOOKSHELF: 'doubleBookshelf',
  SMALL_PAINTING: 'smallPainting',
  SMALL_PAINTING_2: 'smallPainting2',
  LARGE_PAINTING: 'largePainting',
  CLOCK: 'clock',
  PLANT: 'plant',
  PLANT_2: 'plant2',
  LARGE_PLANT: 'largePlant',
  COFFEE: 'coffee',
  BOOKSHELF: 'bookshelf',
  CACTUS: 'cactus',
  WHITEBOARD: 'whiteboard',
  POT: 'pot',
  BIN: 'bin',
  WOODEN_BENCH: 'woodenBench',
  CUSHIONED_BENCH: 'cushionedBench',
  WOODEN_CHAIR_SIDE: 'woodenChairSide',
  DESK_FRONT: 'desk',
  PC_FRONT_OFF: 'pcOff',
  PC_SIDE: 'pcSide',
  PC_BACK: 'pcBack',
  SMALL_TABLE_FRONT: 'smallTable',
  SMALL_TABLE_SIDE: 'smallTableSide',
};

// Desk slot positions in tile grid coordinates
// stationType: 'desk' = full desk+PC+chair drawn; 'kitchen'/'lounge' = character placed at position only (layout furniture already present)
const DESK_SLOTS = [
  // Left room — 4 front-facing desks
  { col: 2, row: 12, stationType: 'desk' },
  { col: 6, row: 12, stationType: 'desk' },
  { col: 2, row: 16, stationType: 'desk' },
  { col: 6, row: 16, stationType: 'desk' },
  // Kitchen — character stands in front of the table (pushed forward so not hidden behind it)
  { col: 13, row: 14, stationType: 'kitchen', facing: 'front' },
  // Lounge — characters stand in front of the sofas (pushed forward to avoid z-order overlap)
  { col: 13, row: 18, stationType: 'lounge', facing: 'right' },
  { col: 16, row: 18, stationType: 'lounge', facing: 'left' },
];

// Types that should be skipped from layout furniture (animated PCs are handled per-coworker)
const SKIP_LAYOUT_TYPES = new Set(['PC_FRONT_ON_1', 'PC_FRONT_ON_2', 'PC_FRONT_ON_3']);

// --- Canvas sizing ---
let needsResize = true;

function resizeCanvas() {
  const parent = canvas.parentElement;
  if (!parent) return false;
  const rect = parent.getBoundingClientRect();
  const bar = parent.querySelector('.office-bar');
  const barH = bar?.getBoundingClientRect().height || 28;
  const sideW = detailPanel.classList.contains('visible') ? detailPanel.getBoundingClientRect().width || 0 : 0;
  const w = Math.floor(rect.width - sideW);
  const h = Math.floor(rect.height - barH);
  if (w < 64 || h < 64) return false;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  canvas.style.marginRight = `${sideW}px`;
  return true;
}

function setDetailPanelOpen(isOpen) {
  detailPanel.classList.toggle('visible', isOpen);
  officeRoot.classList.toggle('detail-open', isOpen);
  needsResize = true;
}

// --- Character animation state ---
const charAnims = new Map();
function getCharAnim(key) {
  if (!charAnims.has(key)) {
    charAnims.set(key, {
      phase: 'walk', // 'walk' | 'sit'
      x: 0,
      y: 0,
      startX: 0,
      startY: 0,
      targetX: 0,
      targetY: 0,
      progress: 0,
      facing: 'front',
      inited: false,
      lastStatus: 'idle',
      startCueUntil: 0,
    });
  }
  return charAnims.get(key);
}

function lerp(a, b, t) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

// --- Desk assignment ---
let officeShowAll = false;

function isCoworkerActive(cw) {
  if (cw.status === 'working' || cw.status === 'active' || cw.status === 'thinking') return true;
  if (cw.lastActivity) {
    const ago = Date.now() - new Date(cw.lastActivity).getTime();
    if (ago < 24 * 60 * 60 * 1000) return true;
  }
  return false;
}

function getDeskAssignments() {
  const maxSlots = state.maxConcurrentContainers || DESK_SLOTS.length;
  const activeSlots = DESK_SLOTS.slice(0, Math.max(maxSlots, DESK_SLOTS.length));
  const coworkers = officeShowAll ? state.coworkers : state.coworkers.filter(isCoworkerActive);
  return coworkers.map((cw, i) => {
    const slot = activeSlots[i % activeSlots.length];
    const stationType = slot.stationType || 'desk';
    const facing = slot.facing || (stationType === 'desk' ? 'back' : 'front');
    return {
      cw,
      index: state.coworkers.indexOf(cw),
      stationType,
      dCol: slot.col,
      dRow: slot.row,
      seatCol: slot.col + (stationType === 'desk' ? 1 : 0),
      seatRow: slot.row + (stationType === 'desk' ? 2 : 0),
      facing,
    };
  });
}

// --- Coordinate helpers ---
function tileXY(col, row, ox, oy) {
  return { x: ox + col * TW, y: oy + (row - FIRST_VIS_ROW) * TW };
}

// Tile type → solid fill color (matching pixel-agents screenshot)
const TILE_COLORS = {
  0: '#2a3548', // wall — dark navy
  1: '#8b9aaa', // main room floor — cool gray
  7: '#9a7a55', // left room floor — warm brown wood
  9: '#6e8899', // lounge floor — muted blue-gray
};
function tileColor(tileType) {
  return TILE_COLORS[tileType] || '#7a6a55';
}

function isDrawable(img) {
  return img && (img.naturalWidth > 0 || img.width > 0);
}

function roundedRectPath(context, x, y, width, height, radius) {
  if (typeof context.roundRect === 'function') {
    context.roundRect(x, y, width, height, radius);
    return;
  }
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.arcTo(x + width, y, x + width, y + r, r);
  context.lineTo(x + width, y + height - r);
  context.arcTo(x + width, y + height, x + width - r, y + height, r);
  context.lineTo(x + r, y + height);
  context.arcTo(x, y + height, x, y + height - r, r);
  context.lineTo(x, y + r);
  context.arcTo(x, y, x + r, y, r);
}

// --- Subagent helpers ---
function mapSubagentColor(agentType) {
  return SUBAGENT_TYPE_COLORS[agentType] || SUBAGENT_TYPE_COLORS.default;
}

function cueColor(name) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || '#10b981';
}
function getActorCue(notification, anim) {
  const n = (notification || '').toLowerCase();
  if (!n) {
    if (anim?.startCueUntil && Date.now() < anim.startCueUntil) {
      return { label: '[x]', color: cueColor('--status-working'), text: 'Started' };
    }
    return null;
  }
  if (/(approval|permission|confirm|allow this|allow access|accept)/.test(n)) {
    return { label: '?', color: cueColor('--status-thinking'), text: 'Approval needed' };
  }
  if (/(waiting|input required|awaiting|need input|paused)/.test(n)) {
    return { label: '...', color: cueColor('--status-active'), text: 'Waiting' };
  }
  if (/(blocked|failed|error|denied)/.test(n)) {
    return { label: '!', color: cueColor('--status-error'), text: 'Blocked' };
  }
  return null;
}

// --- Tile rendering ---
function renderTiles(ox, oy) {
  ctx.fillStyle = '#2d3a4a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!layoutData) return;

  const { tiles, tileColors, cols, rows } = layoutData;
  ctx.imageSmoothingEnabled = false;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const t = tiles[idx];
      if (t === 255) continue;
      const px = ox + c * TW;
      const py = oy + (r - FIRST_VIS_ROW) * TW;
      if (px + TW < 0 || px > canvas.width || py + TW < 0 || py > canvas.height) continue;

      // Try colorized floor tile (pixel-agents style HSL colorization)
      const hsbc = tileColors?.[idx];
      const colorized = hsbc ? PixelSprites.colorizeTile(t, hsbc) : null;
      if (colorized) {
        ctx.drawImage(colorized, px, py, TW, TW);
      } else {
        ctx.fillStyle = tileColor(t);
        ctx.fillRect(px, py, TW, TW);
      }
    }
  }
}

// --- Collect Z-sorted drawables ---
function collectDrawables(assignments, ox, oy) {
  const drawables = [];

  // Static furniture from layout (decorative items — skip desks/PCs, we place those per-coworker)
  if (layoutData?.furniture) {
    for (const item of layoutData.furniture) {
      const baseType = item.type
        .replace(':left', '')
        .replace(/_FRONT_OFF$/, '')
        .replace(/_FRONT$/, '')
        .replace(/_SIDE$/, '')
        .replace(/_BACK$/, '');
      if (SKIP_LAYOUT_TYPES.has(item.type) || SKIP_LAYOUT_TYPES.has(baseType)) continue;
      const key = FURN_MAP[item.type.replace(':left', '')] || FURN_MAP[baseType];
      if (!key) continue;
      const sprite = PixelSprites.getFurniture(key);
      const info = PixelSprites.getFurnitureInfo(key);
      if (!isDrawable(sprite) || !info) continue;
      const pos = tileXY(item.col, item.row, ox, oy);
      const w = info.w * Z,
        h = info.h * Z;
      const mirrored = item.type.endsWith(':left');
      const isWhiteboard = item.type === 'WHITEBOARD';
      const isClock = item.type === 'CLOCK';
      drawables.push({
        zY: pos.y + h,
        draw() {
          ctx.imageSmoothingEnabled = false;
          if (mirrored) {
            ctx.save();
            ctx.translate(pos.x + w, pos.y);
            ctx.scale(-1, 1);
            ctx.drawImage(sprite, 0, 0, w, h);
            ctx.restore();
          } else {
            ctx.drawImage(sprite, pos.x, pos.y, w, h);
          }
          // Render "NVIDIA" pixel art text on whiteboards
          if (isWhiteboard) drawSlangText(pos.x, pos.y, w, h);
          // Render live time on clock
          if (isClock) drawClockTime(pos.x, pos.y, w, h);
        },
      });
    }
  }

  // Per-coworker desk stations + characters
  for (const a of assignments) {
    addDeskDrawables(drawables, a, ox, oy);
  }

  return drawables;
}

function addDeskDrawables(drawables, a, ox, oy) {
  const { cw, dCol, dRow, seatCol, seatRow, facing, stationType } = a;
  const isActive = cw.status === 'active' || cw.status === 'working' || cw.status === 'thinking';

  if (!stationType || stationType === 'desk') {
    // Desk
    const deskSprite = PixelSprites.getFurniture('desk');
    if (isDrawable(deskSprite)) {
      const dp = tileXY(dCol, dRow, ox, oy);
      const dw = 48 * Z,
        dh = 32 * Z;
      drawables.push({
        zY: dp.y + dh,
        draw() {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(deskSprite, dp.x, dp.y, dw, dh);
        },
      });
    }

    // PC on desk
    const pcSprite = isActive ? PixelSprites.getPcFrame(frame) : PixelSprites.getFurniture('pcOff');
    if (isDrawable(pcSprite)) {
      const pp = tileXY(dCol + 1, dRow, ox, oy);
      const pw = 16 * Z,
        ph = 32 * Z;
      drawables.push({
        zY: pp.y + ph + 1,
        draw() {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(pcSprite, pp.x, pp.y, pw, ph);
        },
      });
    }

    // Coffee mug on desk
    const coffeeSprite = PixelSprites.getFurniture('coffee');
    if (isDrawable(coffeeSprite)) {
      const cp = tileXY(dCol + 2, dRow + 1, ox, oy);
      drawables.push({
        zY: cp.y + 16 * Z + 2,
        draw() {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(coffeeSprite, cp.x, cp.y, 16 * Z, 16 * Z);
        },
      });
    }

    // Chair below desk
    const chairSprite = PixelSprites.getFurniture('chair');
    if (isDrawable(chairSprite)) {
      const chp = tileXY(seatCol, seatRow, ox, oy);
      drawables.push({
        zY: chp.y + 16 * Z - 1,
        draw() {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(chairSprite, chp.x, chp.y, 16 * Z, 16 * Z);
        },
      });
    }
  }
  // Kitchen/lounge: no desk/PC/chair — layout furniture already provides the set pieces

  // Parent character
  addCharacterDrawable(drawables, cw, a, ox, oy, false, null);

  // Subagents
  const subs = cw.subagents || [];
  for (let si = 0; si < subs.length; si++) {
    addCharacterDrawable(drawables, cw, a, ox, oy, true, { sub: subs[si], index: si });
  }
}

function addCharacterDrawable(drawables, cw, assignment, ox, oy, isSub, subInfo) {
  const { dCol, dRow, seatCol, seatRow, facing, index: cwIndex } = assignment;
  const key = isSub ? `${cw.folder}:sub:${subInfo.sub.agentId}` : cw.folder;
  const anim = getCharAnim(key);

  // Determine target position
  let tgtCol, tgtRow, tgtFacing;
  if (isSub) {
    // Subagents stand beside the desk
    const si = subInfo.index;
    const side = si % 2 === 0 ? 'left' : 'right';
    tgtCol = side === 'left' ? dCol - 0.5 : dCol + 3.5;
    tgtRow = dRow + 1.5 + Math.floor(si / 2) * 1.5;
    tgtFacing = side === 'left' ? 'right' : 'left';
  } else {
    tgtCol = seatCol;
    tgtRow = seatRow;
    tgtFacing = facing;
  }

  const tgtPos = tileXY(tgtCol, tgtRow, ox, oy);
  const sittingOffset = isSub ? 0 : 6 * Z; // sit down into chair

  // Initialize animation on first frame
  if (!anim.inited) {
    const entry = tileXY(5, 21, ox, oy);
    anim.startX = entry.x;
    anim.startY = entry.y;
    anim.targetX = tgtPos.x;
    anim.targetY = tgtPos.y + sittingOffset;
    anim.x = entry.x;
    anim.y = entry.y;
    anim.phase = 'walk';
    anim.progress = 0;
    anim.inited = true;
  }

  // Track status changes for cue
  const status = isSub ? subInfo.sub.status || 'idle' : cw.status;
  if (anim.lastStatus !== status) {
    if (status !== 'idle') anim.startCueUntil = Date.now() + 1800;
    anim.lastStatus = status;
  }

  // Update animation — L-shaped path: walk horizontally first, then vertically
  if (anim.phase === 'walk') {
    anim.progress += 0.025;
    if (anim.progress >= 1) {
      anim.phase = 'sit';
      anim.x = anim.targetX;
      anim.y = anim.targetY;
      anim.facing = tgtFacing;
    } else {
      // Phase 1 (0-0.4): walk horizontally to target column
      // Phase 2 (0.4-1): walk vertically to target row
      if (anim.progress < 0.4) {
        const t = anim.progress / 0.4;
        anim.x = lerp(anim.startX, anim.targetX, t);
        anim.y = anim.startY;
        const dx = anim.targetX - anim.x;
        anim.facing = Math.abs(dx) > 1 ? (dx < 0 ? 'left' : 'right') : 'front';
      } else {
        const t = (anim.progress - 0.4) / 0.6;
        anim.x = anim.targetX;
        anim.y = lerp(anim.startY, anim.targetY, t);
        anim.facing = anim.targetY < anim.startY ? 'back' : 'front';
      }
    }
  } else {
    // Snap to current target (desk may have shifted)
    anim.targetX = tgtPos.x;
    anim.targetY = tgtPos.y + sittingOffset;
    anim.x = anim.targetX;
    anim.y = anim.targetY;
    anim.facing = tgtFacing;
  }

  // Handle exiting subagents
  if (isSub && subInfo.sub.phase === 'leaving') {
    const exit = tileXY(5, 21, ox, oy);
    anim.targetX = exit.x;
    anim.targetY = exit.y;
    if (anim.phase === 'sit') {
      anim.phase = 'walk';
      anim.startX = anim.x;
      anim.startY = anim.y;
      anim.progress = 0;
    }
  }

  // Determine sprite state
  let charStatus;
  if (anim.phase === 'walk') {
    charStatus = 'walking';
  } else if (isSub) {
    charStatus =
      status === 'working' ? 'working' : status === 'thinking' ? 'thinking' : status === 'active' ? 'idle' : 'idle';
  } else {
    charStatus =
      status === 'working'
        ? 'working'
        : status === 'thinking'
          ? 'thinking'
          : status === 'active'
            ? 'working'
            : 'sitting';
  }

  const animRate = charStatus === 'walking' ? 4 : charStatus === 'working' || charStatus === 'thinking' ? 8 : 0;
  let charIdx;
  if (isSub && subInfo?.sub?.agentId) {
    // Deterministic hash of agentId → consistent random character per subagent
    const id = String(subInfo.sub.agentId);
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
    charIdx = h % 6;
  } else {
    charIdx = PixelSprites.TYPE_CHAR_INDEX[cw.type] ?? 0;
  }
  const animFrames = PixelSprites.ANIM_FRAMES[charStatus] || PixelSprites.ANIM_FRAMES.idle;
  const frameNum = animRate > 0 ? Math.floor(frame / animRate) % animFrames.length : 0;
  const dir = anim.facing;
  const spriteFrame = PixelSprites.getCharFrame(charIdx, charStatus, dir, frameNum);

  const charW = PixelSprites.CHAR_FRAME_W * Z;
  const charH = PixelSprites.CHAR_FRAME_H * Z;
  const drawX = Math.round(anim.x);
  const drawY = Math.round(anim.y - charH + TW);
  const charZY = Math.round(anim.y) + TW;
  const notification = isSub ? subInfo.sub.lastNotification || '' : cw.lastNotification || '';
  const cue = getActorCue(notification, anim);
  const speech = isSub
    ? subInfo.sub.lastToolUse || subInfo.sub.lastNotification || ''
    : cw.lastToolUse || cw.currentTask || '';
  const isWorking = status === 'active' || status === 'working' || status === 'thinking';

  drawables.push({
    zY: charZY,
    cwIndex: cwIndex,
    isSub,
    draw() {
      if (!spriteFrame) return;
      ctx.imageSmoothingEnabled = false;
      ctx.save();
      if (dir === 'left') {
        ctx.translate(drawX + charW, drawY);
        ctx.scale(-1, 1);
        ctx.drawImage(spriteFrame, 0, 0, charW, charH);
      } else {
        ctx.drawImage(spriteFrame, drawX, drawY, charW, charH);
      }
      ctx.restore();

      // Subagent type badge
      if (isSub) {
        const badgeColor = mapSubagentColor(subInfo.sub.agentType);
        ctx.fillStyle = '#0f172aEE';
        ctx.fillRect(drawX + 6, drawY - 8, 30, 10);
        ctx.strokeStyle = badgeColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(drawX + 6, drawY - 8, 30, 10);
        ctx.fillStyle = badgeColor;
        ctx.font = '8px "Courier New", monospace';
        ctx.fillText((subInfo.sub.agentType || 'agent').slice(0, 5).toUpperCase(), drawX + 9, drawY);
      }

      // Cue bubble
      if (cue) {
        drawCueBubble(drawX, drawY, cue);
      }
    },
    // Overlay info for post-draw pass
    overlayX: drawX,
    overlayY: drawY,
    speech: isWorking ? speech : '',
    speechColor: isSub ? mapSubagentColor(subInfo.sub?.agentType) : cw.color || '#475569',
  });
}

// --- Drawing helpers ---

function drawClockTime(bx, by, bw, bh) {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const timeStr = `${hh}:${mm}`;
  const fontSize = Math.max(8, Math.round(Z * 4));
  ctx.font = `bold ${fontSize}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Clock face is in the lower visible portion of the sprite (sprite may start above canvas)
  const visibleTop = Math.max(by, 0);
  const visibleBottom = by + bh;
  if (visibleBottom <= 0) return;
  const cx = bx + bw / 2;
  // Draw at 60% down from visible top (center of clock face area)
  const cy = visibleTop + (visibleBottom - visibleTop) * 0.4;
  // Background for readability
  const tw = ctx.measureText(timeStr).width;
  ctx.fillStyle = 'rgba(240,240,220,0.85)';
  ctx.fillRect(cx - tw / 2 - 1, cy - fontSize / 2 - 1, tw + 2, fontSize + 2);
  ctx.fillStyle = '#1a1a2e';
  ctx.fillText(timeStr, cx, cy);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

// 5×5 pixel art font for "NVIDIA" — each letter is a 5-row bitmap
const NVIDIA_FONT = {
  N: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001],
  V: [0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
  I: [0b11111, 0b00100, 0b00100, 0b00100, 0b11111],
  D: [0b11110, 0b10001, 0b10001, 0b10001, 0b11110],
  A: [0b01110, 0b10001, 0b11111, 0b10001, 0b10001],
};

function drawSlangText(bx, by, bw, bh) {
  const letters = ['N', 'V', 'I', 'D', 'I', 'A'];
  const px = Math.max(2, Math.round(Z * 0.9)); // scale with zoom
  const gap = px;
  const lw = 5;
  const lh = 5;
  const totalW = letters.length * (lw * px + gap) - gap;
  const totalH = lh * px;

  // Center horizontally; draw at the VISIBLE (lower) portion of the sprite
  // Whiteboard is at row 9 — part may be above canvas (by < 0), so clamp
  const bottomEdge = by + bh;
  const startX = bx + Math.round((bw - totalW) / 2);
  // Position text near center of visible area
  const visibleTop = Math.max(by, 0);
  const startY = visibleTop + Math.round((bottomEdge - visibleTop - totalH) / 2);
  if (startY + totalH <= 0 || startY >= canvas.height) return; // fully off-screen

  // Draw background rectangle for contrast
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillRect(startX - px, startY - px, totalW + px * 2, totalH + px * 2);

  for (let li = 0; li < letters.length; li++) {
    const bits = NVIDIA_FONT[letters[li]];
    const lx = startX + li * (lw * px + gap);
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        if (bits[row] & (1 << (4 - col))) {
          ctx.fillStyle = '#76B900';
          ctx.fillRect(lx + col * px, startY + row * px, px, px);
        }
      }
    }
  }
}

function drawCueBubble(x, y, cue) {
  const width = cue.label.length > 1 ? 26 : 18;
  const height = 14;
  const bx = x + 8,
    by = y - 18;
  ctx.fillStyle = '#0f172aEE';
  ctx.strokeStyle = cue.color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  roundedRectPath(ctx, bx, by, width, height, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = cue.color;
  ctx.font = '9px "Courier New", monospace';
  ctx.fillText(cue.label, bx + 5, by + 10);
}

function drawSpeechBubble(x, y, text, color) {
  if (!text) return;
  const maxLen = 28;
  const display = text.length > maxLen ? text.slice(0, maxLen - 2) + '..' : text;
  ctx.font = '9px "Courier New", monospace';
  const w = ctx.measureText(display).width + 10;
  const h = 16;
  const bx = x - w / 2 + 24;
  const by = y - 8;
  ctx.fillStyle = '#0f172aCC';
  ctx.strokeStyle = color || '#475569';
  ctx.lineWidth = 1;
  ctx.beginPath();
  roundedRectPath(ctx, bx, by, w, h, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#0f172aCC';
  ctx.beginPath();
  ctx.moveTo(bx + w / 2 - 3, by + h);
  ctx.lineTo(bx + w / 2, by + h + 4);
  ctx.lineTo(bx + w / 2 + 3, by + h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#E2E8F0';
  ctx.fillText(display, bx + 5, by + 11);
}

function drawNameplate(assignment, ox, oy, isHovered) {
  const { cw, dCol, dRow } = assignment;
  const pos = tileXY(dCol, dRow + 3, ox, oy);
  const plateW = 3 * TW;
  const plateY = pos.y;

  const childCount = (cw.subagents || []).length;
  const extra = childCount > 0 ? ` +${childCount}` : '';
  const baseName = cw.name + extra;
  const name = baseName.length > 18 ? baseName.slice(0, 16) + '..' : baseName;

  const dotColors = { idle: '#6B7280', active: '#3B82F6', working: '#10B981', thinking: '#F59E0B', error: '#EF4444' };
  const dotColor = dotColors[cw.status] || '#6B7280';

  // Status-colored background for at-a-glance visibility. One actor represents
  // one agent-group; multiple NanoClaw sessions are summarized as chips instead
  // of pretending a single context bar describes every thread/task container.
  const nanoSessions = activeNanoSessionsForCoworker(cw);
  const sessionCount = nanoSessions.length;
  const showSessionSummary = sessionCount > 1;
  const hasCtxBar = cw.contextUsagePercent != null && !showSessionSummary;
  const plateH = showSessionSummary || hasCtxBar ? 24 : 18;
  const bgColors = { active: '#3B82F630', working: '#10B98130', thinking: '#F59E0B30', error: '#EF444430' };
  const baseBg = bgColors[cw.status] || '#0f172aCC';
  ctx.fillStyle = isHovered ? '#0f172aEE' : baseBg;
  ctx.fillRect(pos.x - 4, plateY - 2, plateW + 8, plateH);
  if (isHovered) {
    ctx.strokeStyle = (cw.color || '#475569') + '80';
    ctx.lineWidth = 1;
    ctx.strokeRect(pos.x - 4, plateY - 2, plateW + 8, plateH);
  }

  ctx.fillStyle = dotColor;
  ctx.beginPath();
  ctx.arc(pos.x + 4, plateY + 6, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = isHovered ? '#E2E8F0' : '#c8d4e0';
  ctx.font = '10px "Courier New", monospace';
  ctx.fillText(name, pos.x + 12, plateY + 9);

  // Unread badge — blue dot after name
  if (hasUnread(cw.folder)) {
    const nameW = ctx.measureText(name).width;
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(pos.x + 12 + nameW + 6, plateY + 6, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  if (showSessionSummary) {
    const y = plateY + 17;
    const visible = nanoSessions.slice(0, 3);
    for (let i = 0; i < visible.length; i++) {
      const sess = visible[i];
      const status = sess.activity_status || (sess.container_status === 'running' ? 'active' : 'idle');
      ctx.fillStyle = statusDotCanvasColor(status);
      ctx.beginPath();
      ctx.arc(pos.x + 4 + i * 8, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#94A3B8';
    ctx.font = '8px "Courier New", monospace';
    ctx.fillText(`${sessionCount} sessions`, pos.x + 4 + visible.length * 8 + 3, y + 3);
  } else if (hasCtxBar) {
    // Mini context gauge bar below name only when there is exactly one active
    // session (or no resolved session yet). With multiple sessions this was
    // misleading because context is currently derived from the latest shared JSONL.
    const barY = plateY + 14;
    const barW = plateW;
    const pct = Math.min(cw.contextUsagePercent, 100);
    const fillW = (barW * pct) / 100;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(pos.x, barY, barW, 2);
    ctx.fillStyle = pct > 85 ? '#EF4444AA' : pct > 60 ? '#F59E0BAA' : '#10B981AA';
    ctx.fillRect(pos.x, barY, fillW, 2);
  }
}

// --- Hover/click hit testing ---
function getDeskHitRect(assignment, ox, oy) {
  const pos = tileXY(assignment.dCol, assignment.dRow, ox, oy);
  return {
    x: pos.x - 8,
    y: pos.y - 8,
    w: 3 * TW + 16,
    h: 4 * TW + 16,
  };
}

// --- Main draw ---
function drawOffice() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const assignments = getDeskAssignments();

  // Center the map in the viewport, scaling down to fit if needed
  const mapCols = layoutData?.cols || 21;
  const mapVisRows = layoutData ? layoutData.rows - FIRST_VIS_ROW : 12;
  const mapW = mapCols * TW;
  const mapH = mapVisRows * TW;
  const scale = Math.min(canvas.width / mapW, canvas.height / mapH, 1);
  const effW = canvas.width / scale;
  const effH = canvas.height / scale;
  const ox = Math.round((effW - mapW) / 2);
  const oy = Math.round((effH - mapH) / 2);
  ctx.save();
  ctx.scale(scale, scale);

  // 1. Tile grid
  renderTiles(ox, oy);

  // 2. Collect drawables (furniture + characters)
  const drawables = collectDrawables(assignments, ox, oy);

  // 3. Sort by zY (back-to-front)
  drawables.sort((a, b) => a.zY - b.zY);

  // 4. Draw all
  for (const d of drawables) d.draw();

  // 5. Overlays: nameplates, speech bubbles, hover highlights
  for (let i = 0; i < assignments.length; i++) {
    const a = assignments[i];
    const isHovered = hoveredDesk === i;
    const isSelected = selectedCoworker && selectedCoworker.folder === a.cw.folder;

    drawNameplate(a, ox, oy, isHovered);

    // Hover/selection outline on desk area
    if (isHovered || isSelected) {
      const hr = getDeskHitRect(a, ox, oy);
      ctx.strokeStyle = (a.cw.color || '#3B82F6') + (isHovered ? '50' : '80');
      ctx.lineWidth = 2;
      ctx.strokeRect(hr.x, hr.y, hr.w, hr.h);
    }
  }

  // Speech bubbles (draw on top of everything)
  const speechDrawables = drawables.filter((d) => d.speech && !d.isSub);
  // Prefer subagent speech if available
  const subSpeakers = drawables.filter((d) => d.speech && d.isSub);
  for (const d of subSpeakers) {
    drawSpeechBubble(d.overlayX, d.overlayY - 6, d.speech, d.speechColor);
  }
  for (const d of speechDrawables) {
    // Skip parent speech if a subagent is already speaking for this desk
    if (!subSpeakers.some((s) => s.cwIndex === d.cwIndex)) {
      drawSpeechBubble(d.overlayX, d.overlayY - 6, d.speech, d.speechColor);
    }
  }

  // Empty state
  if (state.coworkers.length === 0) {
    ctx.fillStyle = '#94A3B8';
    ctx.font = '14px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('No coworkers online', canvas.width / 2, canvas.height / 2 - 8);
    ctx.font = '11px "Courier New", monospace';
    ctx.fillStyle = '#64748B';
    ctx.fillText('Create one from the Coworkers tab', canvas.width / 2, canvas.height / 2 + 12);
    ctx.textAlign = 'left';
  }

  ctx.restore();

  // Store assignments for mouse hit testing
  _lastAssignments = assignments;
  _lastOx = ox;
  _lastOy = oy;
  _lastScale = scale;
}

let _lastAssignments = [];
let _lastOx = 0,
  _lastOy = 0,
  _lastScale = 1;

// --- Canvas tooltip ---
const canvasTooltip = document.createElement('div');
canvasTooltip.style.cssText =
  'position:absolute;display:none;pointer-events:none;background:var(--tooltip-bg);border:1px solid var(--tooltip-border);border-radius:4px;padding:5px 8px;font-size:10px;color:var(--text);font-family:"Courier New",monospace;white-space:nowrap;z-index:100;line-height:1.5';
canvas.parentElement.style.position = 'relative';
canvas.parentElement.appendChild(canvasTooltip);

// --- Legend toggle ---
document.getElementById('legend-toggle')?.addEventListener('click', () => {
  const legend = document.getElementById('office-legend');
  if (legend) legend.style.display = legend.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('office-show-all')?.addEventListener('click', () => {
  officeShowAll = !officeShowAll;
  const btn = document.getElementById('office-show-all');
  if (btn) {
    btn.textContent = officeShowAll ? 'Active only' : 'Show all';
    btn.style.color = officeShowAll ? 'var(--accent)' : 'var(--text-dim)';
  }
});

// --- Theme toggle ---
(function () {
  const themeBtn = document.getElementById('theme-toggle');
  function setTheme(t) {
    if (t === 'light') document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.removeAttribute('data-theme');
    if (themeBtn) themeBtn.textContent = t === 'light' ? '☀️' : '🌙';
    try {
      localStorage.setItem('nanoclaw-theme', t);
    } catch (e) {}
    document.dispatchEvent(new CustomEvent('theme-change', { detail: t }));
  }
  const initial = (function () {
    try {
      return localStorage.getItem('nanoclaw-theme') || 'dark';
    } catch (e) {
      return 'dark';
    }
  })();
  setTheme(initial);
  themeBtn?.addEventListener('click', () => {
    setTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light');
  });
})();

// --- Mouse ---
//
// drawOffice() applies `ctx.scale(scale, scale)` and then draws with
// `ox, oy` as the in-world translation, so `getDeskHitRect()` returns
// rects in **world coordinates** (unscaled space centered by ox/oy).
// Mouse events arrive in CSS pixel space. Convert before comparing —
// otherwise actors are clickable at ghost positions that drift farther
// from the visible desks as the canvas scales down.
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const cssMx = e.clientX - rect.left;
  const cssMy = e.clientY - rect.top;
  const scale = _lastScale || 1;
  const mx = cssMx / scale;
  const my = cssMy / scale;
  hoveredDesk = -1;
  for (let i = 0; i < _lastAssignments.length; i++) {
    const hr = getDeskHitRect(_lastAssignments[i], _lastOx, _lastOy);
    if (mx >= hr.x && mx <= hr.x + hr.w && my >= hr.y && my <= hr.y + hr.h) {
      hoveredDesk = i;
      break;
    }
  }
  canvas.style.cursor = hoveredDesk >= 0 ? 'pointer' : 'default';

  // Update tooltip (positioned in CSS pixel space, not world space).
  if (hoveredDesk >= 0) {
    const cw = _lastAssignments[hoveredDesk]?.cw || state.coworkers[hoveredDesk];
    const [statusColor, statusLabel] = getStatusConfig(cw.status);
    const activity = cw.lastActivity ? timeAgo(cw.lastActivity) : 'no activity';
    const tool = cw.lastToolUse ? `Tool: ${cw.lastToolUse}` : '';
    const subs = (cw.subagents || []).length;
    const subsLine = subs > 0 ? `\nSubagents: ${subs}` : '';
    canvasTooltip.innerHTML =
      `<strong>${esc(cw.name)}</strong> <span style="color:${statusColor}">${statusLabel}</span>\n${activity}${tool ? '\n' + tool : ''}${subsLine}`.replace(
        /\n/g,
        '<br>',
      );
    canvasTooltip.style.display = 'block';
    canvasTooltip.style.left = cssMx + 16 + 'px';
    canvasTooltip.style.top = cssMy + 16 + 'px';
    // Keep tooltip inside canvas bounds
    const ttRect = canvasTooltip.getBoundingClientRect();
    const parentRect = canvas.parentElement.getBoundingClientRect();
    if (ttRect.right > parentRect.right) canvasTooltip.style.left = cssMx - ttRect.width - 8 + 'px';
    if (ttRect.bottom > parentRect.bottom) canvasTooltip.style.top = cssMy - ttRect.height - 8 + 'px';
  } else {
    canvasTooltip.style.display = 'none';
  }
});

canvas.addEventListener('mouseleave', () => {
  canvasTooltip.style.display = 'none';
});

canvas.addEventListener('click', () => {
  if (hoveredDesk >= 0) {
    selectedCoworker = _lastAssignments[hoveredDesk]?.cw || state.coworkers[hoveredDesk];
    showDetailPanel(selectedCoworker);
  } else {
    selectedCoworker = null;
    setDetailPanelOpen(false);
  }
});

document.getElementById('detail-close').addEventListener('click', () => {
  selectedCoworker = null;
  setDetailPanelOpen(false);
});

// --- Detail panel ---
async function showDetailPanel(cw) {
  setDetailPanelOpen(true);
  document.getElementById('detail-name').textContent = cw.name;
  document.getElementById('detail-status').innerHTML = renderStatusBadge(cw.status);
  document.getElementById('detail-activity').textContent = cw.lastActivity ? timeAgo(cw.lastActivity) : 'Never';
  document.getElementById('detail-tool').textContent = cw.lastToolUse || '-';
  document.getElementById('detail-subagents').innerHTML = renderSubagentList(cw);

  // Tasks for this coworker
  const tasksEl = document.getElementById('detail-tasks-list');
  const cwTasks = (state.tasks || []).filter((t) => t.group_folder === cw.folder);
  if (cwTasks.length === 0) {
    tasksEl.textContent = 'None';
  } else {
    tasksEl.innerHTML = cwTasks
      .map((t) => {
        const label = t.prompt ? t.prompt.split('\n')[0].substring(0, 40) : '';
        const badge = t.status === 'active' ? '🟢' : t.status === 'paused' ? '⏸️' : '⚪';
        const sched = t.schedule_type === 'cron' ? t.schedule_value : t.schedule_type;
        const shortId = t.id.replace('task-', '').substring(0, 10);
        return `<div title="${esc(t.prompt?.substring(0, 200) || '')}" style="margin-bottom:2px">${badge} <span style="color:var(--accent)">${esc(shortId)}</span> <span style="color:var(--text-muted)">${esc(sched)}</span> ${esc(label)}</div>`;
      })
      .join('');
    tasksEl.style.cursor = 'pointer';
    tasksEl.title = 'Click to view in Admin > Tasks';
    tasksEl.onclick = () => {
      document.querySelector('[data-tab="admin"]')?.click();
      setTimeout(() => document.querySelector('[data-panel="admin-tasks"]')?.click(), 300);
    };
  }

  hidePixelOfficeContext();

  // Active Session block — uses the same helper as the Coworkers detail panel so the
  // two surfaces can't diverge. Leads with the nanoclaw `sess-…` id + container_status +
  // "last N ago", with SDK sub-sessions nested below (each drillable). The [View] button
  // routes through enterNanoclawSessionFlow(...) — identical to the Coworkers tab's path.
  const sessionEl = document.getElementById('detail-session');
  const activeBlock = renderActiveSessionBlock(cw, { wrapField: false });
  if (activeBlock) {
    sessionEl.innerHTML = activeBlock;
  } else {
    sessionEl.textContent = '-';
  }

  const memEl = document.getElementById('detail-memory');
  memEl.innerHTML = '<span style="color:var(--text-muted)">Loading...</span>';
  try {
    const res = await fetch(`/api/memory/${cw.folder}`);
    if (res.ok) {
      memEl.innerHTML = renderMarkdown(await res.text());
    } else {
      memEl.textContent = '(no CLAUDE.md)';
    }
  } catch {
    memEl.textContent = '(error)';
  }

  const memToggle = document.getElementById('memory-toggle');
  if (memToggle) {
    memToggle.textContent = memEl.classList.contains('expanded') ? 'Collapse' : 'Expand';
    memToggle.onclick = () => {
      memEl.classList.toggle('expanded');
      memToggle.textContent = memEl.classList.contains('expanded') ? 'Collapse' : 'Expand';
    };
  }

  const timelineBtn = document.getElementById('detail-view-timeline');
  if (timelineBtn) {
    timelineBtn.onclick = () => {
      setTimelineFilter(cw.folder);
      switchToTab('observability');
    };
  }

  const coworkerBtn = document.getElementById('detail-view-coworker');
  if (coworkerBtn) {
    coworkerBtn.onclick = () => {
      document.querySelector('[data-tab="coworkers"]')?.click();
      setTimeout(() => selectCoworker(cw.folder), 300);
    };
  }

  const hooksEl = document.getElementById('detail-hooks');
  hooksEl.innerHTML = renderDetailHooks(cw);
}

// Reuse the richer md() renderer (defined below esc/escAttr) for all markdown
function renderMarkdown(text) {
  return md(text);
}

// Timeline filter management
function setTimelineFilter(group) {
  timelineFilter = group || null;
  timelineNoMoreEvents = false;
  timelineDisplayLimit = 200;
  timelineOlderEvents = [];
  const filterBar = document.getElementById('timeline-filter-bar');
  if (filterBar) {
    if (timelineFilter) {
      filterBar.style.display = 'flex';
      filterBar.querySelector('.filter-group').textContent = timelineFilter;
    } else {
      filterBar.style.display = 'none';
    }
  }
  updateTimeline();
}

function clearTimelineFilter() {
  setTimelineFilter(null);
  const coworkerSel = document.getElementById('coworker-select');
  if (coworkerSel && coworkerSel.value) {
    coworkerSel.value = '';
    updateSessionSelector();
  }
}

// --- Status bar ---
function updateStatusBar() {
  const c = { active: 0, working: 0, thinking: 0, idle: 0, error: 0 };
  for (const cw of state.coworkers) c[cw.status] = (c[cw.status] || 0) + 1;
  const total = state.coworkers.length;
  document.getElementById('stat-working').textContent = c.working + c.active;
  document.getElementById('stat-thinking').textContent = c.thinking;
  document.getElementById('stat-idle').textContent = c.idle;
  document.getElementById('stat-error').textContent = c.error;
  document.getElementById('stat-time').textContent = new Date().toLocaleTimeString();
  const headerMap = {
    'hdr-actors-total': total,
    'hdr-actors-working': c.working + c.active,
    'hdr-actors-thinking': c.thinking,
    'hdr-actors-idle': c.idle,
    'hdr-actors-error': c.error,
  };
  for (const [id, value] of Object.entries(headerMap)) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
  }
}

// --- Animation loop ---
function tick() {
  frame++;
  if (needsResize) {
    needsResize = !resizeCanvas();
  }
  drawOffice();
  updateStatusBar();
  if (selectedCoworker) {
    const u = state.coworkers.find((c) => c.folder === selectedCoworker.folder);
    if (u) selectedCoworker = u;
  }
}

function animate() {
  needsResize = true;
  tick();
  requestAnimationFrame(animate);
}

// ===================================================================
// TAB 2: TIMELINE / AUDIT LOG (debug mode, event history)
// ===================================================================

// Fetch messages periodically for timeline integration
async function fetchMessages() {
  try {
    const res = await fetch('/api/messages', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      cachedMessages = data.messages || data;
    }
  } catch {
    /* ignore */
  }
}
// Fetch messages every 5s
setInterval(fetchMessages, 5000);
fetchMessages();

// Delegated handler for "Load older events" — survives timeline rebuilds
let timelineLoadingMore = false;
// Handled on mousedown (NOT click): the timeline updates rebuild the
// button DOM via container.innerHTML on every state-applied tick, and a
// rebuild between the user's mousedown and mouseup destroys the button so
// `click` never fires. The mousedown branch closes that race; the click
// branch below keeps touch + keyboard parity (timelineLoadingMore guard
// dedupes against a same-gesture mousedown that already fired the fetch).
const handleTimelineLoadMore = async (e) => {
  const btn = e.target.closest('.tl-load-more');
  if (!btn || btn.disabled || timelineLoadingMore) return;
  e.preventDefault();
  btn.classList.remove('lm-flash');
  void btn.offsetWidth;
  btn.classList.add('lm-flash');
  const container = document.getElementById('timeline-list');
  const entries = container.querySelectorAll('.tl-entry');
  const lastEntry = entries[entries.length - 1];
  const oldest = lastEntry?.dataset?.eventTime;
  if (!oldest) return;
  btn.textContent = 'Loading...';
  btn.disabled = true;
  timelineLoadingMore = true;
  try {
    const params = new URLSearchParams({ before: oldest, limit: '500' });
    if (timelineFilter) params.set('group', timelineFilter);
    const res = await fetch(`/api/hook-events/history?${params}`);
    const rows = await res.json();
    if (rows.length === 0) {
      timelineNoMoreEvents = true;
      btn.textContent = 'No older events';
      return;
    }
    for (const row of rows) {
      timelineOlderEvents.push({
        id: row.id,
        group: row.group,
        agent_group_id: row.agent_group_id,
        event: row.event,
        tool: row.tool || undefined,
        tool_use_id: row.tool_use_id || undefined,
        message: row.message || undefined,
        session_id: row.session_id || undefined,
        agent_id: row.agent_id || undefined,
        agent_type: row.agent_type || undefined,
        extra: row.extra || undefined,
        has_details: !!row.has_details,
        timestamp: row.timestamp,
      });
    }
    timelineDisplayLimit += rows.length;
    // Preserve scroll position across DOM rebuild
    const scrollParent = container.closest('.panel-body') || container.parentElement;
    const scrollTop = scrollParent ? scrollParent.scrollTop : 0;
    const scrollHeight = scrollParent ? scrollParent.scrollHeight : 0;
    updateTimeline();
    // Restore: new content was appended at bottom, so keep scroll at same position
    if (scrollParent) {
      const newScrollHeight = scrollParent.scrollHeight;
      scrollParent.scrollTop = scrollTop + (newScrollHeight - scrollHeight);
    }
  } catch {
    btn.textContent = 'Error loading';
  } finally {
    timelineLoadingMore = false;
  }
};
document.getElementById('timeline-list')?.addEventListener('mousedown', handleTimelineLoadMore);
document.getElementById('timeline-list')?.addEventListener('click', handleTimelineLoadMore);

function updateTimeline() {
  // Don't overwrite when viewing a session flow
  if (sessionFlowMode) return;
  // Skip rebuilds while a "Load older events" fetch is in flight — the rebuild
  // destroys the button mid-click and reverts its "Loading…" state.
  if (timelineLoadingMore) return;

  document.getElementById('obs-total-coworkers').textContent = state.coworkers.length;
  document.getElementById('obs-total-tasks').textContent = state.tasks.length;
  document.getElementById('obs-total-runs').textContent = state.taskRunLogs.length;

  const successes = state.taskRunLogs.filter((l) => l.status === 'success').length;
  const total = state.taskRunLogs.length;
  document.getElementById('obs-success-rate').textContent =
    total > 0 ? Math.round((successes / total) * 100) + '%' : '-';

  const durations = state.taskRunLogs.filter((l) => l.duration_ms).map((l) => l.duration_ms);
  const avg = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  document.getElementById('obs-avg-duration').textContent = avg > 0 ? formatDuration(avg) : '-';

  // Merge events: tasks, hooks, and messages
  const timeline = [];
  for (const log of state.taskRunLogs) {
    const task = state.tasks.find((t) => t.id === log.task_id);
    timeline.push({
      time: new Date(log.run_at).getTime(),
      type: 'task-run',
      group: task?.group_folder || '?',
      iconColor: log.status === 'success' ? 'var(--green)' : log.status === 'error' ? 'var(--red)' : 'var(--yellow)',
      title: `Task ${log.status}`,
      detail: `${formatDuration(log.duration_ms)} — ${(log.result || log.error || '').slice(0, 100)}`,
      prompt: task?.prompt || '',
      badge: 'TASK',
      badgeClass: 'tl-type-task-run',
    });
  }
  // Merge live hook events with loaded-older events (deduplicate by timestamp+group+event)
  const seenHookKeys = new Set();
  const allHookEvents = [];
  for (const ev of state.hookEvents) {
    const key = hookEventKey(ev);
    seenHookKeys.add(key);
    allHookEvents.push(ev);
  }
  for (const ev of timelineOlderEvents) {
    const key = hookEventKey(ev);
    if (!seenHookKeys.has(key)) allHookEvents.push(ev);
  }

  // Build a map of PreToolUse timestamps by tool_use_id for duration calculation
  const preToolTimes = new Map();
  for (const ev of allHookEvents) {
    if (ev.event === 'PreToolUse' && ev.tool_use_id) {
      preToolTimes.set(ev.tool_use_id, ev.timestamp);
    }
  }

  for (const ev of allHookEvents) {
    // Skip PreToolUse from timeline display (used for pairing only)
    if (ev.event === 'PreToolUse') continue;

    // Color-code by event type
    let iconColor = 'var(--yellow)';
    let badge = 'HOOK';
    let badgeClass = 'tl-type-hook';
    let duration = null;
    if (ev.event === 'PostToolUseFailure') {
      iconColor = 'var(--yellow)';
      badge = 'WARN';
      badgeClass = 'tl-type-warning';
    } else if (ev.event === 'SubagentStart' || ev.event === 'SubagentStop') {
      iconColor = 'var(--purple)';
      badge = 'AGENT';
      badgeClass = 'tl-type-subagent';
    } else if (ev.event === 'SessionStart') {
      iconColor = 'var(--green)';
      badge = 'SESSION';
      badgeClass = 'tl-type-session';
    } else if (ev.event === 'UserPromptSubmit') {
      iconColor = '#06b6d4';
      badge = 'PROMPT';
      badgeClass = 'tl-type-prompt';
    } else if (ev.event === 'PreCompact') {
      iconColor = '#f97316';
      badge = 'COMPACT';
      badgeClass = 'tl-type-compact';
    } else if (ev.event === 'Stop' || ev.event === 'SessionEnd') {
      iconColor = 'var(--text-muted)';
      badge = 'STOP';
      badgeClass = 'tl-type-stop';
    }

    // Compute duration for PostToolUse by pairing with PreToolUse
    if ((ev.event === 'PostToolUse' || ev.event === 'PostToolUseFailure') && ev.tool_use_id) {
      const preTs = preToolTimes.get(ev.tool_use_id);
      if (preTs) duration = ev.timestamp - preTs;
    }

    // Some hook events (InstructionsLoaded, ConfigChange, FileChanged,
    // CwdChanged, …) carry their payload in `extra` rather than `message`.
    // When `message` is empty, fall back to a compact rendering of the
    // most useful `extra` fields so the row isn't a blank header. Without
    // this, the timeline shows e.g. 6 consecutive blank "InstructionsLoaded"
    // rows on every container respawn — historically frustrating to debug.
    let detail = ev.message || '';
    if (!detail && ev.extra && typeof ev.extra === 'object') {
      const x = ev.extra;
      if (ev.event === 'InstructionsLoaded' && x.file_path) {
        // file_path + load_reason is the load-trace info worth surfacing.
        detail = x.load_reason ? `${x.file_path} (${x.load_reason})` : x.file_path;
      } else if (ev.event === 'CwdChanged' && (x.from || x.to)) {
        detail = `${x.from || '?'} → ${x.to || '?'}`;
      } else if (ev.event === 'FileChanged' && x.path) {
        detail = `${x.action || 'changed'}: ${x.path}`;
      } else {
        // Generic fallback: stringify a few interesting top-level keys
        // (cap to avoid dumping nested objects). Better than blank.
        const parts = [];
        for (const k of Object.keys(x).slice(0, 4)) {
          const v = x[k];
          if (v == null) continue;
          if (typeof v === 'object') continue;
          parts.push(`${k}=${String(v).slice(0, 60)}`);
        }
        if (parts.length) detail = parts.join(' · ');
      }
    }

    timeline.push({
      time: ev.timestamp,
      type: 'hook',
      group: ev.group || '?',
      iconColor,
      title: ev.tool || ev.event || 'event',
      detail,
      prompt: '',
      badge,
      badgeClass,
      toolInput: ev.tool_input || '',
      toolResponse: ev.tool_response || '',
      hookEventId: ev.id || null,
      hasDetails: !!ev.has_details,
      duration,
      sessionId: ev.session_id || '',
    });
  }

  // Add messages from SQLite
  for (const msg of cachedMessages) {
    timeline.push({
      time: new Date(msg.timestamp).getTime(),
      type: 'message',
      group: msg.group_folder || '?',
      iconColor: msg.direction === 'incoming' ? 'var(--accent)' : 'var(--green)',
      title: msg.direction === 'incoming' ? 'Message In' : 'Reply',
      detail: (msg.body || '').slice(0, 200),
      prompt: '',
      badge: 'MSG',
      badgeClass: 'tl-type-message',
    });
  }

  timeline.sort((a, b) => b.time - a.time);

  // Apply filter
  const filtered = timelineFilter ? timeline.filter((ev) => ev.group === timelineFilter) : timeline;

  const container = document.getElementById('timeline-list');

  // Snapshot expanded IDs before rebuild
  const expandedIds = new Set();
  container.querySelectorAll('.tl-expand-content[style*="block"]').forEach((el) => {
    expandedIds.add(el.id);
  });

  // Build session_id -> { nanoclaw_session_id, group_folder, container_status, last_active, shape }
  // from cachedSessions so we can emit two-tier separators (major = nanoclaw session change,
  // minor = SDK sub-session change within the same nanoclaw session).
  const sessionLookup = new Map();
  for (const p of cachedSessions || []) {
    for (const s of p.sdk_subsessions || []) {
      sessionLookup.set(s.session_id, {
        nanoclaw_session_id: p.nanoclaw_session_id || null,
        agent_group_id: p.agent_group_id || null,
        group_folder: p.group_folder,
        container_status: p.container_status || null,
        last_active: p.last_active || null,
        shape: s.shape || 'session',
        first_ts: s.first_ts,
        last_ts: s.last_ts,
      });
    }
  }

  const displayItems = filtered.slice(0, timelineDisplayLimit);
  let prevNano = undefined; // sentinel distinct from null (null = "no nanoclaw session")
  let prevSdk = undefined;
  let prevGroup = undefined;
  const htmlParts = [];
  for (let idx = 0; idx < displayItems.length; idx++) {
    const ev = displayItems[idx];
    const sdk = ev.sessionId || null;
    const meta = sdk ? sessionLookup.get(sdk) : null;
    const nano = meta?.nanoclaw_session_id ?? null;
    const group = ev.group || '?';
    // A separator is valid only when we have a known session boundary — skip for non-hook
    // rows (messages, task-runs) which don't carry session_id. We still track their group
    // so switching coworkers mid-stream re-emits the major separator on the next hook row.
    if (sdk) {
      const groupChanged = prevGroup !== undefined && prevGroup !== group;
      const nanoChanged = prevNano !== undefined && prevNano !== nano;
      const sdkChanged = prevSdk !== undefined && prevSdk !== sdk;
      if (groupChanged || nanoChanged) {
        // MAJOR: coworker · <sess-id> · container: <status> · last-active Xm ago
        // `nano` already begins with "sess-" (it's the full nanoclaw session id), so do NOT
        // prepend another "sess-" — that was producing "sess-sess-17773…". Emit the id as-is,
        // truncated for compactness.
        const cs = meta?.container_status || 'unknown';
        const agoLabel = meta?.last_active ? timeAgo(new Date(meta.last_active).getTime()) : '';
        const sessLabel = nano ? String(nano).slice(0, 18) : '(no nanoclaw session)';
        htmlParts.push(`<div class="tl-sep tl-sep-major" style="display:flex;align-items:center;gap:8px;margin:10px 0 4px 0;padding:4px 8px;border-top:1px solid var(--border);color:var(--text-muted);font-size:10px;font-family:'Courier New',monospace">
          <span style="color:${getGroupColor(group)};font-weight:bold">${esc(group)}</span>
          <span>·</span>
          <span style="font-family:monospace">${esc(sessLabel)}</span>
          <span>·</span>
          <span>container: ${esc(cs)}</span>${agoLabel ? `<span>·</span><span>last-active ${esc(agoLabel)}</span>` : ''}
        </div>`);
      }
      if (groupChanged || nanoChanged || sdkChanged) {
        // MINOR: └ <sdk-uuid-12> · <shape> · <start>-<end>
        const shape = meta?.shape || 'session';
        const start = meta?.first_ts ? formatTimeFull(meta.first_ts) : '';
        const end = meta?.last_ts ? formatTimeFull(meta.last_ts) : '';
        const range = start && end ? `${start}–${end}` : start || end || '';
        htmlParts.push(`<div class="tl-sep tl-sep-minor" style="display:flex;align-items:center;gap:6px;margin:2px 0 2px 16px;padding:2px 6px;border-top:1px dotted var(--border);color:var(--text-dim);font-size:9px;font-family:'Courier New',monospace">
          <span>└</span>
          <span style="font-family:monospace">${esc(String(sdk).slice(0, 12))}</span>
          <span>·</span>
          <span>${esc(shape)}</span>${range ? `<span>·</span><span>${esc(range)}</span>` : ''}
        </div>`);
      }
      prevNano = nano;
      prevSdk = sdk;
    }
    prevGroup = group;
    const gc = getGroupColor(group);
    const loadedDetails = ev.hookEventId ? hookEventDetails.get(String(ev.hookEventId)) : null;
    const toolInput = loadedDetails?.tool_input || ev.toolInput || '';
    const toolResponse = loadedDetails?.tool_response || ev.toolResponse || '';
    const hasExpand = ev.hasDetails || toolInput || toolResponse;
    const expandId = ev.hookEventId ? `tl-expand-hook-${ev.hookEventId}` : `tl-expand-${idx}`;
    htmlParts.push(`<div class="tl-entry" data-event-group="${escAttr(group)}" data-event-time="${String(ev.time)}" data-event-type="${escAttr(ev.type)}">
      <div class="tl-time">${formatTimeFull(ev.time)}</div>
      <div class="tl-line"><div class="tl-dot" style="background:${ev.iconColor}"></div><div class="tl-connector"></div></div>
      <div class="tl-content">
        <div class="tl-header">
          <span class="tl-group tl-group-link" style="color:${gc}" data-group="${escAttr(group)}">${esc(group)}</span>
          <span class="tl-type ${ev.badgeClass || 'tl-type-hook'}">${ev.badge || 'HOOK'}</span>
          <span class="tl-title">${esc(ev.title)}</span>
          ${ev.duration != null ? `<span class="tl-duration">${formatDuration(ev.duration)}</span>` : ''}
          ${ev.sessionId ? `<span class="tl-session-link" data-session-id="${escAttr(ev.sessionId)}" data-session-group="${escAttr(group)}">${ev.sessionId.slice(0, 8)}</span>` : ''}
          ${hasExpand ? `<button class="tl-expand-btn" data-target="${expandId}"${ev.hookEventId ? ` data-hook-event-id="${ev.hookEventId}"` : ''}>[+]</button>` : ''}
        </div>
        ${ev.prompt ? `<div class="tl-prompt">${esc(ev.prompt.slice(0, 120))}</div>` : ''}
        <div class="tl-detail">${esc(ev.detail)}</div>
        ${
          hasExpand
            ? `<div class="tl-expand-content" id="${expandId}" style="display:none">
          ${
            loadedDetails
              ? renderHookEventDetails(loadedDetails)
              : `${toolInput ? `<div class="tl-code-block"><label>Tool Input</label><pre>${esc(toolInput)}</pre></div>` : ''}
          ${toolResponse ? `<div class="tl-code-block"><label>Tool Response</label><pre>${esc(toolResponse)}</pre></div>` : ''}
          ${!toolInput && !toolResponse && ev.hookEventId ? '<div class="tl-code-block"><span>Expand to load details</span></div>' : ''}`
          }
        </div>`
            : ''
        }
      </div>
    </div>`);
  }
  container.innerHTML = htmlParts.join('');

  if (filtered.length === 0) {
    container.innerHTML = '<div class="tl-empty">No events yet. Spawn a coworker or schedule a task.</div>';
  }

  // "Load More" button — rendered as HTML, handler via delegation
  if (filtered.length > 0) {
    container.insertAdjacentHTML(
      'beforeend',
      timelineNoMoreEvents
        ? '<button class="tl-load-more" disabled style="display:block;margin:12px auto;padding:6px 16px;background:var(--bg-card);border:1px solid var(--border);color:var(--text-dim);cursor:not-allowed;font-family:var(--font);font-size:10px;border-radius:4px;opacity:0.7;">No older events</button>'
        : '<button class="tl-load-more" style="display:block;margin:12px auto;padding:6px 16px;background:var(--bg-card);border:1px solid var(--border);color:var(--text-dim);cursor:pointer;font-family:var(--font);font-size:10px;border-radius:4px;">Load older events</button>',
    );
  }

  // Restore expanded state after rebuild
  for (const id of expandedIds) {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = 'block';
      const btn = container.querySelector(`[data-target="${id}"]`);
      if (btn) btn.textContent = '[-]';
    }
  }

  drawSparkline();
}

function drawSparkline() {
  const tc = document.getElementById('sparkline-canvas');
  if (!tc?.parentElement?.clientWidth) return;
  tc.width = tc.parentElement.clientWidth - 4;
  tc.height = 48;
  const tctx = tc.getContext('2d');
  tctx.clearRect(0, 0, tc.width, tc.height);
  if (state.taskRunLogs.length === 0) return;

  const now = Date.now(),
    hours = 24,
    bucketMs = 3600000;
  const buckets = new Array(hours).fill(0),
    errBuckets = new Array(hours).fill(0);
  for (const log of state.taskRunLogs) {
    const bucket = hours - 1 - Math.floor((now - new Date(log.run_at).getTime()) / bucketMs);
    if (bucket >= 0 && bucket < hours) {
      buckets[bucket]++;
      if (log.status === 'error') errBuckets[bucket]++;
    }
  }
  const max = Math.max(...buckets, 1);
  const barW = Math.max(2, (tc.width - 4) / hours - 1);
  for (let i = 0; i < hours; i++) {
    const x = 2 + i * (barW + 1);
    tctx.fillStyle = '#3B82F660';
    tctx.fillRect(x, tc.height - 4 - (buckets[i] / max) * 40, barW, (buckets[i] / max) * 40);
    if (errBuckets[i] > 0) {
      tctx.fillStyle = '#EF444480';
      tctx.fillRect(x, tc.height - 4 - (errBuckets[i] / max) * 40, barW, (errBuckets[i] / max) * 40);
    }
  }
  tctx.fillStyle = '#64748B';
  tctx.font = '8px "Courier New", monospace';
  tctx.fillText('24h', 2, 8);
  tctx.fillText('now', tc.width - 18, 8);
}

function getGroupColor(f) {
  const c = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
  let h = 0;
  for (let i = 0; i < f.length; i++) h = (h * 31 + f.charCodeAt(i)) & 0xffff;
  return c[h % c.length];
}

// --- Helpers ---
function timeAgo(v) {
  const d = Date.now() - (typeof v === 'number' ? v : new Date(v).getTime());
  if (d < 60000) return 'just now';
  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
  return `${Math.floor(d / 86400000)}d ago`;
}
// Resolve the TZ the operator configured at NanoClaw setup (TZ in .env).
// The server injects it as <meta name="nanoclaw-tz">; if missing or invalid
// we fall back to the browser's local TZ so the dashboard still works.
const NANOCLAW_TZ = (() => {
  try {
    const tz = document.querySelector('meta[name="nanoclaw-tz"]')?.getAttribute('content') || '';
    if (!tz) return undefined;
    new Intl.DateTimeFormat(undefined, { timeZone: tz });
    return tz;
  } catch {
    return undefined;
  }
})();
function _tzSameDay(d, now) {
  const opts = { year: 'numeric', month: '2-digit', day: '2-digit' };
  if (NANOCLAW_TZ) opts.timeZone = NANOCLAW_TZ;
  const fmt = new Intl.DateTimeFormat('en-CA', opts);
  return fmt.format(d) === fmt.format(now);
}
function formatTime(v) {
  const d = new Date(typeof v === 'number' ? v : v);
  const now = new Date();
  const timeOpts = { hour: '2-digit', minute: '2-digit', second: '2-digit' };
  const dateOpts = { month: 'short', day: 'numeric' };
  if (NANOCLAW_TZ) {
    timeOpts.timeZone = NANOCLAW_TZ;
    dateOpts.timeZone = NANOCLAW_TZ;
  }
  const time = d.toLocaleTimeString([], timeOpts);
  if (_tzSameDay(d, now)) return time;
  return `${d.toLocaleDateString([], dateOpts)} ${time}`;
}
function formatTimeFull(ms) {
  const d = new Date(ms);
  const now = new Date();
  const timeOpts = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
  if (NANOCLAW_TZ) timeOpts.timeZone = NANOCLAW_TZ;
  const time = new Intl.DateTimeFormat('en-GB', timeOpts).format(d);
  if (_tzSameDay(d, now)) return time;
  const dateOpts = { month: 'short', day: 'numeric' };
  if (NANOCLAW_TZ) dateOpts.timeZone = NANOCLAW_TZ;
  return `${d.toLocaleDateString([], dateOpts)} ${time}`;
}
function formatDuration(ms) {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}
function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
/** Lightweight markdown → HTML for chat bubbles. Handles the subset agents actually use. */
function md(s) {
  let h = esc(s);
  // Fenced code blocks: ```...```
  h = h.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) => `<pre><code>${code.replace(/\n$/, '')}</code></pre>`);
  // Inline code: `...`
  h = h.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  // Headings: ## ...
  h = h.replace(/^#{1,4}\s+(.+)$/gm, (_m, t) => `<strong>${t}</strong>`);
  // Horizontal rules: --- or ***
  h = h.replace(/^[-*]{3,}\s*$/gm, '<hr>');
  // Bold: **text** or *text* (single asterisk = WhatsApp bold)
  h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/(?<!\w)\*([^*\n]+)\*(?!\w)/g, '<strong>$1</strong>');
  // Italic: _text_
  h = h.replace(/(?<!\w)_([^_\n]+)_(?!\w)/g, '<em>$1</em>');
  // Links: [text](url). Exclude `"` from the URL (like the bare-URL pattern
  // below) so a crafted href can't break out of the attribute — md() escapes
  // <>& via esc() but not quotes, and webhook envelopes route attacker-
  // controlled GitHub markdown through here.
  h = h.replace(/\[([^\]]+)\]\((https?:\/\/[^)"]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  // Bare URLs
  h = h.replace(/(?<!")(?<!=)(https?:\/\/[^\s<)"]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  // Tables: detect | header | ... | pattern and convert
  h = h.replace(/((?:^\|.+\|[ \t]*\n)+)/gm, (block) => {
    const rows = block
      .trim()
      .split('\n')
      .filter((r) => r.trim());
    // Skip separator rows (|---|---|)
    const dataRows = rows.filter((r) => !/^\|[\s\-:|]+\|$/.test(r));
    if (dataRows.length === 0) return block;
    const parseRow = (r) =>
      r
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim());
    let t = '<table>';
    dataRows.forEach((r, i) => {
      const cells = parseRow(r);
      const tag = i === 0 ? 'th' : 'td';
      t += '<tr>' + cells.map((c) => `<${tag}>${c}</${tag}>`).join('') + '</tr>';
    });
    return t + '</table>';
  });
  // List items: lines starting with - or • (preserve indent)
  h = h.replace(/^(\s*)[•\-]\s+(.+)$/gm, '$1<li>$2</li>');
  // Wrap consecutive <li> in <ul>
  h = h.replace(/((?:<li>.*<\/li>\s*)+)/g, '<ul>$1</ul>');
  // Paragraphs: double newline
  h = h.replace(/\n{2,}/g, '</p><p>');
  // Single newlines → <br> (but not inside <pre>)
  h = h.replace(/(?<!<\/pre>)\n/g, '<br>');
  return `<p>${h}</p>`;
}
/**
 * Webhook envelopes (github.issue_opened, github.pr_mention) land in messages_in
 * as raw JSON. Rendering them through md() shows curly braces, escaped quotes,
 * and \n literals. This helper detects the shape and re-renders as Markdown:
 * a header line + the body as fenced markdown.
 *
 * Returns null if `s` is not a recognized webhook envelope — caller should
 * fall back to plain md().
 */
function tryRenderWebhookEnvelope(s) {
  if (typeof s !== 'string') return null;
  const t = s.trimStart();
  if (!t.startsWith('{') || !t.includes('"event":"github.')) return null;
  let p;
  try {
    p = JSON.parse(t);
  } catch {
    return null;
  }
  if (!p || typeof p !== 'object') return null;
  if (p.event === 'github.issue_opened') {
    const repo = p.repo || '';
    const num = p.issue_number ?? '';
    const title = p.title || '';
    const author = p.author || '';
    const url = p.issue_url || '';
    const labels = Array.isArray(p.labels) && p.labels.length ? p.labels.join(', ') : '';
    const body = p.body || '';
    const header =
      `**🐛 Issue opened — [${repo} #${num}](${url})**\n\n` +
      `**Title:** ${title}\n\n` +
      (author ? `**Author:** @${author}\n\n` : '') +
      (labels ? `**Labels:** ${labels}\n\n` : '') +
      `---\n\n`;
    return md(header + body);
  }
  if (p.event === 'github.pr_mention') {
    const repo = p.repo || '';
    const num = p.issue_number ?? '';
    const url = p.comment_url || '';
    const commenter = p.commenter || '';
    const body = p.body || '';
    const header =
      `**💬 ${p.is_pr ? 'PR' : 'Issue'} mention — [${repo} #${num}](${url})**\n\n` +
      (commenter ? `**From:** @${commenter}\n\n` : '') +
      `---\n\n`;
    return md(header + body);
  }
  return null;
}
function escAttr(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderMessageAttachmentsHtml(attachments) {
  if (!Array.isArray(attachments) || attachments.length === 0) return '';
  const items = attachments
    .map((attachment) => {
      if (!attachment || !attachment.url || !attachment.name) return '';
      if (attachment.isImage) {
        return `<a href="${escAttr(attachment.url)}" target="_blank" rel="noopener" style="display:inline-flex;flex-direction:column;gap:4px;text-decoration:none;color:inherit">
        <img src="${escAttr(attachment.url)}" alt="${escAttr(attachment.name)}" style="max-width:220px;max-height:160px;border-radius:8px;border:1px solid rgba(255,255,255,0.12);background:#111;object-fit:cover" />
        <span style="font-size:10px;color:#9ca3af">${esc(attachment.name)}</span>
      </a>`;
      }
      return `<a href="${escAttr(attachment.url)}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid rgba(255,255,255,0.14);border-radius:8px;text-decoration:none;color:inherit;background:rgba(255,255,255,0.03)">
      <span style="font-size:14px">📎</span>
      <span style="font-size:11px">${esc(attachment.name)}</span>
    </a>`;
    })
    .filter(Boolean);
  if (items.length === 0) return '';
  return `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">${items.join('')}</div>`;
}

function renderMessageMetaSuffix(m) {
  const parts = [];
  if (m.edited) parts.push('<span style="font-size:7px;color:#9ca3af;font-style:italic">edited</span>');
  if (Array.isArray(m.reactions) && m.reactions.length > 0) {
    parts.push(`<span style="font-size:10px">${esc(m.reactions.join(' '))}</span>`);
  }
  return parts.length > 0 ? ` ${parts.join(' ')}` : '';
}

// ===================================================================
// SESSION FLOW VIEW
// ===================================================================

// cachedSessions now holds the nested shape from /api/hook-events/sessions:
//   [{ nanoclaw_session_id, group_folder, agent_group_id, container_status,
//      last_active, created_at, event_count_total,
//      sdk_subsessions: [{ session_id, first_ts, last_ts, event_count, shape }] }]
// Nanoclaw session is the primary identity; SDK UUIDs are sub-sessions under it.
async function fetchSessions() {
  try {
    const res = await fetch('/api/hook-events/sessions');
    if (res.ok) cachedSessions = await res.json();
  } catch {
    /* ignore */
  }
  updateSessionSelector();
}

// Two-tier Timeline picker: #coworker-select narrows the scope, then #session-select only
// lists sessions belonging to that coworker. "All coworkers" shows every session flat (no
// optgroups — the coworker picker is doing the grouping now).
function updateSessionSelector() {
  const coworkerSel = document.getElementById('coworker-select');
  const sessionSel = document.getElementById('session-select');
  if (!sessionSel) return;

  const byCoworker = new Map();
  for (const p of cachedSessions) {
    const arr = byCoworker.get(p.group_folder) || [];
    arr.push(p);
    byCoworker.set(p.group_folder, arr);
  }

  // --- Repopulate the coworker dropdown, preserving selection. ---
  if (coworkerSel) {
    const prevCoworker = coworkerSel.value;
    let cwHtml = '<option value="">All coworkers</option>';
    // Sort coworkers by their latest activity DESC so the most recently active is at top.
    const coworkerEntries = Array.from(byCoworker.entries()).map(([folder, parents]) => {
      const latestMs = Math.max(
        ...parents.map((p) => {
          if (p.last_active) return new Date(p.last_active).getTime();
          return p.sdk_subsessions?.[0]?.last_ts ?? 0;
        }),
        0,
      );
      return { folder, parents, latestMs };
    });
    coworkerEntries.sort((a, b) => b.latestMs - a.latestMs);
    for (const { folder, latestMs } of coworkerEntries) {
      const label = latestMs ? `${folder} · last ${timeAgo(latestMs)}` : folder;
      cwHtml += `<option value="${escAttr(folder)}">${esc(label)}</option>`;
    }
    coworkerSel.innerHTML = cwHtml;
    // Restore prior selection only if that coworker still exists.
    if (prevCoworker && byCoworker.has(prevCoworker)) coworkerSel.value = prevCoworker;
  }

  // --- Repopulate the session dropdown, filtered to the selected coworker. ---
  const selectedCoworker = coworkerSel ? coworkerSel.value : '';
  const prevSession = sessionSel.value;
  const parentsToShow = selectedCoworker ? byCoworker.get(selectedCoworker) || [] : cachedSessions;

  const allEventsLabel = selectedCoworker
    ? `Timeline view (all ${selectedCoworker} events)`
    : 'Timeline view (all events)';
  let html = `<option value="">${esc(allEventsLabel)}</option>`;
  for (const p of parentsToShow) {
    const parentLastMs = p.last_active ? new Date(p.last_active).getTime() : (p.sdk_subsessions[0]?.last_ts ?? 0);
    const parentTs = parentLastMs ? formatTimeFull(parentLastMs) : '';
    const parentAgo = parentLastMs ? timeAgo(parentLastMs) : '';
    // When "All coworkers" is selected, prefix the option with the folder so rows are
    // distinguishable; when a specific coworker is selected, the prefix is redundant.
    const prefix = selectedCoworker ? '' : `${p.group_folder} · `;
    // Session label — "main · <slug>" / "thread · <slug>" via the shared
    // sessionLabel() helper. Raw sess-xxx id surfaces as the option's
    // title= attribute so operators can still copy it for log grepping.
    const humanLabel = p.nanoclaw_session_id ? sessionDisplayTitle(p) : '';
    const keyLabel = p.nanoclaw_session_id ? sessionKeyLabel(p) : '';
    const parentLabel = p.nanoclaw_session_id
      ? `${prefix}${humanLabel}${keyLabel && keyLabel !== humanLabel ? ` · key: ${keyLabel}` : ''} · ${parentTs} (${parentAgo}) · ${p.event_count_total} ev`
      : `${prefix}(no active nanoclaw session)`;
    const parentTitle = p.nanoclaw_session_id ? p.nanoclaw_session_id : '';
    const parentVal = p.nanoclaw_session_id ? `nano:${p.agent_group_id}:${p.nanoclaw_session_id}` : '';
    if (parentVal) {
      html += `<option value="${escAttr(parentVal)}" data-group="${escAttr(p.group_folder)}" data-kind="nanoclaw" title="${escAttr(parentTitle)}">${esc(parentLabel)}</option>`;
    }
    for (const s of p.sdk_subsessions || []) {
      if (!s.user_prompt_count && !s.activity_count) continue;
      // ALWAYS use last_ts (not first_ts — that was the old bug: ghost sessions showed their
      // start time and looked "recently active" even though they died immediately).
      const ts = formatTimeFull(s.last_ts);
      const ago = timeAgo(s.last_ts);
      const shape = s.shape ? ` [${s.shape}]` : '';
      const label = `  └ ${ts} (${ago}) · ${s.event_count} ev${shape} · ${s.session_id.slice(0, 12)}`;
      html += `<option value="${escAttr(s.session_id)}" data-group="${escAttr(p.group_folder)}" data-kind="sdk">${esc(label)}</option>`;
    }
  }
  sessionSel.innerHTML = html;
  // Restore prior session selection only if it's still a valid option under the new filter.
  if (prevSession && sessionSel.querySelector(`option[value="${CSS.escape(prevSession)}"]`)) {
    sessionSel.value = prevSession;
  }
}

// Coworker picker change → refilter the session dropdown AND the Timeline events list.
// Without the setTimelineFilter call, the session dropdown narrows but the main Timeline
// still shows events from every coworker — which is what the user sees as the bug.
document.getElementById('coworker-select')?.addEventListener('change', () => {
  updateSessionSelector();
  const coworker = document.getElementById('coworker-select')?.value || '';
  const sessionSel = document.getElementById('session-select');
  if (sessionSel && !sessionSel.value) exitSessionFlow();
  if (coworker) setTimelineFilter(coworker);
  else clearTimelineFilter();
});

// Fetch sessions periodically
setInterval(fetchSessions, 10000);
fetchSessions();

document.getElementById('session-select')?.addEventListener('change', (e) => {
  const value = e.target.value;
  if (!value) {
    exitSessionFlow();
    return;
  }
  const opt = e.target.selectedOptions[0];
  const group = opt?.dataset?.group || '';
  const kind = opt?.dataset?.kind || 'sdk';
  if (kind === 'nanoclaw' && value.startsWith('nano:')) {
    // "nano:<agent_group_id>:<nanoclaw_session_id>" — aggregated view
    const rest = value.slice('nano:'.length);
    const colonIdx = rest.indexOf(':');
    const agentGroupId = colonIdx >= 0 ? rest.slice(0, colonIdx) : '';
    const nanoclawSessionId = colonIdx >= 0 ? rest.slice(colonIdx + 1) : '';
    enterNanoclawSessionFlow(group, agentGroupId, nanoclawSessionId);
    return;
  }
  enterSessionFlow(group, value);
});

document.getElementById('session-back-btn')?.addEventListener('click', () => {
  exitSessionFlow();
});

async function enterSessionFlow(group, sessionId) {
  sessionFlowMode = true;
  timelineNoMoreEvents = false;
  timelineDisplayLimit = 200;
  timelineOlderEvents = [];
  document.getElementById('session-back-btn').style.display = 'inline-block';
  document.getElementById('timeline-filter-bar').style.display = 'none';
  const container = document.getElementById('timeline-list');
  container.innerHTML = '<div class="tl-empty">Loading session flow...</div>';

  try {
    const params = new URLSearchParams({ session_id: sessionId });
    if (group) params.set('group', group);
    const res = await fetch(`/api/hook-events/session-flow?${params}`);
    if (!res.ok) throw new Error('fetch failed');
    sessionFlowData = await res.json();
    renderSessionFlow(sessionFlowData.entries);
  } catch {
    container.innerHTML = '<div class="tl-empty">Failed to load session flow.</div>';
  }
}

// Aggregated nanoclaw-session view — renders every hook event under the nanoclaw session
// (i.e. across all SDK sub-sessions that ran since sessions.created_at) in one flow.
async function enterNanoclawSessionFlow(group, agentGroupId, nanoclawSessionId) {
  sessionFlowMode = true;
  timelineNoMoreEvents = false;
  timelineDisplayLimit = 200;
  timelineOlderEvents = [];
  document.getElementById('session-back-btn').style.display = 'inline-block';
  document.getElementById('timeline-filter-bar').style.display = 'none';
  const container = document.getElementById('timeline-list');
  container.innerHTML = '<div class="tl-empty">Loading nanoclaw session flow...</div>';

  try {
    const params = new URLSearchParams({
      agent_group_id: agentGroupId,
      nanoclaw_session_id: nanoclawSessionId,
    });
    const res = await fetch(`/api/hook-events/nanoclaw-session-flow?${params}`);
    if (!res.ok) throw new Error('fetch failed');
    sessionFlowData = await res.json();
    renderSessionFlow(sessionFlowData.entries);
  } catch {
    container.innerHTML = '<div class="tl-empty">Failed to load nanoclaw session flow.</div>';
  }
}

function exitSessionFlow() {
  sessionFlowMode = false;
  sessionFlowData = null;
  timelineNoMoreEvents = false;
  timelineDisplayLimit = 200;
  timelineOlderEvents = [];
  document.getElementById('session-back-btn').style.display = 'none';
  document.getElementById('session-select').value = '';
  updateTimeline();
}

function renderSessionFlow(entries) {
  const container = document.getElementById('timeline-list');
  if (!entries || entries.length === 0) {
    container.innerHTML = '<div class="tl-empty">No events in this session.</div>';
    return;
  }
  // Newest-first: the API returns entries chronologically (start → end) for flow-reading,
  // but the rest of the dashboard puts latest at top, so we reverse before rendering. The
  // SESSION START marker naturally ends up at the bottom, which reads as "scroll down to
  // see where the session began" — consistent with Recent Events and Timeline default view.
  // Subagent children inside an entry are left in their natural parent→child tree order.
  const ordered = [...entries].reverse();
  // Separators (SDK sub-session boundary) still fire on adjacency; direction doesn't matter.
  const parts = [];
  let prevSdk = undefined;
  for (let i = 0; i < ordered.length; i++) {
    const e = ordered[i];
    const sdk = e.session_id || null;
    if (sdk && prevSdk !== undefined && prevSdk !== sdk) {
      const meta = (cachedSessions || []).flatMap((p) => p.sdk_subsessions || []).find((s) => s.session_id === sdk);
      const shape = meta?.shape || 'session';
      const start = meta?.first_ts ? formatTimeFull(meta.first_ts) : '';
      const end = meta?.last_ts ? formatTimeFull(meta.last_ts) : '';
      const range = start && end ? `${start}–${end}` : start || end || '';
      parts.push(`<div class="tl-sep tl-sep-minor" style="display:flex;align-items:center;gap:6px;margin:6px 0 2px 12px;padding:2px 6px;border-top:1px dotted var(--border);color:var(--text-dim);font-size:9px;font-family:'Courier New',monospace">
        <span>└</span>
        <span style="font-family:monospace">${esc(String(sdk).slice(0, 12))}</span>
        <span>·</span>
        <span>${esc(shape)}</span>${range ? `<span>·</span><span>${esc(range)}</span>` : ''}
      </div>`);
    }
    if (sdk) prevSdk = sdk;
    parts.push(renderFlowEntry(e, i, 0));
  }
  container.innerHTML = parts.join('');
}

function renderFlowEntry(entry, idx, depth) {
  const prefix = `flow-${depth}-${idx}`;
  if (entry.type === 'session_start') {
    const source = entry.extra?.source || 'new';
    return `<div class="flow-session-marker">
      <span class="flow-label">SESSION START</span>
      <span>${esc(source)}</span>
      <span style="color:var(--text-muted);font-size:9px">${formatTimeFull(entry.timestamp)}</span>
    </div>`;
  }
  if (entry.type === 'session_end') {
    const toolCount = entry.extra?.tool_count || '';
    const filesMod = entry.extra?.files_modified || '';
    const stats = [toolCount ? `${toolCount} tool calls` : '', filesMod ? `${filesMod} files modified` : '']
      .filter(Boolean)
      .join(' | ');
    return `<div class="flow-session-marker end">
      <span class="flow-label">STOP</span>
      <span style="color:var(--text-muted)">${stats || 'session ended'}</span>
      <span style="color:var(--text-muted);font-size:9px">${formatTimeFull(entry.timestamp)}</span>
    </div>`;
  }
  if (entry.type === 'user_prompt') {
    return `<div class="flow-user-prompt">
      <span class="flow-label">PROMPT</span>
      <div class="flow-text">${esc(entry.message || '')}</div>
      <span style="color:var(--text-muted);font-size:9px;flex-shrink:0">${formatTimeFull(entry.timestamp)}</span>
    </div>`;
  }
  if (entry.type === 'tool_call') {
    const durStr = entry.duration != null ? formatDuration(entry.duration) : '';
    const inputPreview = (entry.tool_input || '').slice(0, 100);
    const outputPreview = (entry.tool_response || '').slice(0, 100);
    const hasInput = !!entry.tool_input;
    const hasOutput = !!entry.tool_response;
    return `<div class="flow-tool-call ${entry.failed ? 'failed' : ''}">
      <div class="flow-tool-header">
        <span style="color:var(--text-muted);font-size:9px">${formatTimeFull(entry.timestamp)}</span>
        <span class="flow-tool-name">${esc(entry.tool || '?')}</span>
        ${durStr ? `<span class="flow-duration">${durStr}</span>` : ''}
        ${entry.failed ? '<span style="color:var(--red);font-size:9px">FAILED</span>' : ''}
      </div>
      ${
        hasInput
          ? `<div class="flow-tool-io">
        <label>Input:</label>
        <span class="flow-preview">${esc(inputPreview)}</span>
        ${entry.tool_input.length > 100 ? `<button class="flow-expand-btn" data-target="${prefix}-in">[+]</button>` : ''}
        <pre class="flow-expanded-content" id="${prefix}-in">${esc(entry.tool_input)}</pre>
      </div>`
          : ''
      }
      ${
        hasOutput
          ? `<div class="flow-tool-io">
        <label>Output:</label>
        <span class="flow-preview">${esc(outputPreview)}</span>
        ${entry.tool_response.length > 100 ? `<button class="flow-expand-btn" data-target="${prefix}-out">[+]</button>` : ''}
        <pre class="flow-expanded-content" id="${prefix}-out">${esc(entry.tool_response)}</pre>
      </div>`
          : ''
      }
    </div>`;
  }
  if (entry.type === 'subagent_block') {
    const durStr = entry.duration != null ? formatDuration(entry.duration) : '';
    const children = (entry.children || []).map((c, ci) => renderFlowEntry(c, ci, depth + 1)).join('');
    return `<div class="flow-subagent-block">
      <div class="flow-subagent-header">
        <span class="flow-label">SUBAGENT</span>
        <span>${esc(entry.agent_id || '?')}</span>
        <span style="color:var(--text-muted);font-size:9px">${esc(entry.agent_type || '')}</span>
        ${durStr ? `<span class="flow-duration">${durStr}</span>` : ''}
      </div>
      ${children}
    </div>`;
  }
  if (entry.type === 'compact') {
    return `<div class="flow-compact">
      <span class="flow-label">COMPACT</span>
      <span>Context compacted</span>
      <span style="color:var(--text-muted);font-size:9px">${formatTimeFull(entry.timestamp)}</span>
    </div>`;
  }
  if (entry.type === 'notification') {
    return `<div class="flow-notification">
      <span style="color:var(--text-muted);font-size:9px">${formatTimeFull(entry.timestamp)}</span>
      ${esc(entry.message || '')}
    </div>`;
  }
  return '';
}

// Open session flow from a session_id link
function openSessionFlowById(group, sessionId) {
  // Session-flow renders into the Observability tab's #timeline-list. When the
  // link is clicked from another tab (e.g. Admin → Messages) we must switch
  // there first, otherwise the click looks dead.
  switchToTab('observability');
  const sel = document.getElementById('session-select');
  // Try to select the option, or just enter flow directly
  for (const opt of sel.options) {
    if (opt.value === sessionId) {
      sel.value = sessionId;
      break;
    }
  }
  enterSessionFlow(group, sessionId);
}

function renderHookEventDetails(details) {
  const blocks = [];
  if (details?.message) {
    blocks.push(`<div class="tl-code-block"><label>Message</label><pre>${esc(details.message)}</pre></div>`);
  }
  if (details?.tool_input) {
    blocks.push(`<div class="tl-code-block"><label>Tool Input</label><pre>${esc(details.tool_input)}</pre></div>`);
  }
  if (details?.tool_response) {
    blocks.push(
      `<div class="tl-code-block"><label>Tool Response</label><pre>${esc(details.tool_response)}</pre></div>`,
    );
  }
  if (details?.extra) {
    blocks.push(
      `<div class="tl-code-block"><label>Extra</label><pre>${esc(JSON.stringify(details.extra, null, 2))}</pre></div>`,
    );
  }
  return blocks.join('') || '<div class="tl-code-block"><span>No additional details</span></div>';
}

// --- Event delegation for timeline interactions ---
document.addEventListener('click', async (e) => {
  // Expand/collapse toggle for tool_input/tool_response
  const expandBtn = e.target.closest('.tl-expand-btn');
  if (expandBtn) {
    const targetId = expandBtn.dataset.target;
    const target = document.getElementById(targetId);
    if (target) {
      const isVisible = target.style.display !== 'none';
      const hookEventId = expandBtn.dataset.hookEventId;
      if (!isVisible && hookEventId && !hookEventDetails.has(hookEventId)) {
        target.innerHTML = '<div class="tl-code-block"><span>Loading details…</span></div>';
        try {
          const res = await fetch(`/api/hook-events/${encodeURIComponent(hookEventId)}`, { cache: 'no-store' });
          if (!res.ok) throw new Error('detail fetch failed');
          const details = await res.json();
          hookEventDetails.set(hookEventId, details);
          target.innerHTML = renderHookEventDetails(details);
        } catch {
          target.innerHTML = '<div class="tl-code-block"><span>Failed to load details</span></div>';
          return;
        }
      }
      target.style.display = isVisible ? 'none' : 'block';
      expandBtn.textContent = isVisible ? '[+]' : '[-]';
    }
    return;
  }

  // Click group name in timeline to filter
  const groupLink = e.target.closest('.tl-group-link');
  if (groupLink) {
    const group = groupLink.dataset.group;
    if (group) setTimelineFilter(group);
    return;
  }

  // Click "View" button on a nanoclaw session in the detail panel — aggregated view
  // across all SDK sub-sessions under this nanoclaw session.
  const viewNanoBtn = e.target.closest('[data-view-nanoclaw-session]');
  if (viewNanoBtn) {
    const sid = viewNanoBtn.dataset.viewNanoclawSession;
    const agid = viewNanoBtn.dataset.viewNanoclawAgid;
    const grp = viewNanoBtn.dataset.viewSessionGroup;
    if (sid) {
      sessionReadCursors.markRead(sid);
      const tools = document.getElementById('cw-detail-tools');
      if (tools) tools._lastHtml = null;
    }
    if (sid && agid) {
      switchToTab('observability');
      // Reflect the selection in both dropdowns. The session option only exists in
      // session-select once coworker-select narrows to that coworker, so set coworker
      // first and repopulate before setting session.
      const coworkerSel = document.getElementById('coworker-select');
      if (coworkerSel && grp) {
        coworkerSel.value = grp;
        updateSessionSelector();
      }
      const sel = document.getElementById('session-select');
      if (sel) {
        const parentVal = `nano:${agid}:${sid}`;
        for (const opt of sel.options) {
          if (opt.value === parentVal) {
            sel.value = parentVal;
            break;
          }
        }
      }
      enterNanoclawSessionFlow(grp, agid, sid);
    }
    return;
  }

  // Click rename (✎) button — prompt for a new title and POST it. title_source is set
  // to 'manual' server-side so the heuristic titler won't overwrite it.
  // Helper: optimistic toggle + server round-trip. Flips the .active class
  // immediately so the user sees feedback (accent border). On failure reverts.
  const toggleSessionState = (btn, sid, on, endpoint) => {
    btn.classList.toggle('active', on);
    btn.dataset[endpoint === 'pinned' ? 'pinOn' : 'hideOn'] = on ? '0' : '1';
    // Brief flash to ACK the click even when active state doesn't change visually.
    const prevBg = btn.style.background;
    btn.style.background = on ? 'var(--green)' : 'var(--bg-hover)';
    btn.style.color = '#fff';
    setTimeout(() => {
      btn.style.background = prevBg;
      btn.style.color = '';
    }, 300);
    fetch(`/api/sessions/${encodeURIComponent(sid)}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ on }),
    })
      .then((r) => {
        if (!r.ok) {
          // Revert on failure
          btn.classList.toggle('active', !on);
          btn.style.borderColor = 'var(--red)';
          setTimeout(() => {
            btn.style.borderColor = '';
          }, 600);
          return;
        }
        if (typeof fetchSessions === 'function') fetchSessions();
        const tools = document.getElementById('cw-detail-tools');
        if (tools) tools._lastHtml = null;
      })
      .catch(() => {
        btn.classList.toggle('active', !on);
        btn.style.borderColor = 'var(--red)';
        setTimeout(() => {
          btn.style.borderColor = '';
        }, 600);
      });
  };

  // "Mark all read" link in sessions summary
  const markAllRead = e.target.closest('.cw-mark-all-read');
  if (markAllRead) {
    e.preventDefault();
    e.stopPropagation();
    const folder = markAllRead.dataset.folder;
    const sessions = activeNanoSessionsForCoworker({ folder });
    const now = Date.now();
    for (const s of sessions) {
      if (s.nanoclaw_session_id) sessionReadCursors.markRead(s.nanoclaw_session_id, now);
    }
    // Advance the folder-level cursor too — without this, the left-panel
    // coworker badge stays lit even after every session has been marked read.
    // Use cw.lastMessageTs (server-aggregated max across all sessions) so the
    // cursor matches the latest activity the user has acknowledged.
    const cw = (state.coworkers || []).find((c) => c.folder === folder);
    if (cw?.lastMessageTs) readCursors.markRead(folder, cw.lastMessageTs);
    if (typeof renderCwSidebar === 'function') renderCwSidebar();
    if (typeof updateCwDetail === 'function') updateCwDetail();
    return;
  }

  // Click pin/unpin (📌) button — POST {on: true|false} to /api/sessions/<sid>/pinned.
  const pinBtn = e.target.closest('[data-pin-session]');
  if (pinBtn) {
    e.stopPropagation();
    const sid = pinBtn.dataset.pinSession;
    const on = pinBtn.dataset.pinOn === '1';
    if (sid) toggleSessionState(pinBtn, sid, on, 'pinned');
    return;
  }

  // Click hide/unhide (− / ↺) button — POST {on: true|false} to /api/sessions/<sid>/hidden.
  const hideBtn = e.target.closest('[data-hide-session]');
  if (hideBtn) {
    e.stopPropagation();
    const sid = hideBtn.dataset.hideSession;
    const on = hideBtn.dataset.hideOn === '1';
    if (sid) toggleSessionState(hideBtn, sid, on, 'hidden');
    return;
  }

  const renameBtn = e.target.closest('[data-rename-session]');
  if (renameBtn) {
    const sid = renameBtn.dataset.renameSession;
    if (!sid) return;
    const current = renameBtn.dataset.renameCurrent || '';
    const next = prompt('Rename session:', current);
    if (next && next.trim()) {
      fetch(`/api/sessions/${encodeURIComponent(sid)}/title`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: next.trim() }),
      })
        .then((r) => {
          if (!r.ok) return r.json().then((j) => alert('Rename failed: ' + (j.error || r.statusText)));
          // Force a refresh of the sessions cache on next tick
          if (typeof fetchSessions === 'function') fetchSessions();
          const tools = document.getElementById('cw-detail-tools');
          if (tools) tools._lastHtml = null;
        })
        .catch((e) => alert('Rename failed: ' + e.message));
    }
    return;
  }

  // Swim-lane toggle in the thread header: switch the open thread between the
  // single-session view and the shared cross-coworker swim-lane.
  const laneOnBtn = e.target.closest('[data-thread-lane-on]');
  if (laneOnBtn) {
    const tid = laneOnBtn.dataset.threadLaneOn;
    if (tid) openThread(tid, { lane: true });
    return;
  }
  const laneOffBtn = e.target.closest('[data-thread-lane-off]');
  if (laneOffBtn) {
    const tid = laneOffBtn.dataset.threadLaneOff;
    // Back to the canonical single session for this thread.
    const canonical = resolveCanonicalSessionForThread(cwState.selected, tid);
    if (canonical) openThread(canonical.nanoclaw_session_id, { sessionDirect: true, threadId: tid });
    else openThread(tid);
    return;
  }

  // Click "Chat" button in Other Sessions — opens the Coworkers chat for that coworker,
  // and if the session has a thread_id, opens its thread panel (Slack-style). Main-session
  // clicks fall through to the root chat view and scroll it into view.
  const viewChatBtn = e.target.closest('[data-view-chat-session]');
  if (viewChatBtn) {
    const grp = viewChatBtn.dataset.viewChatGroup;
    const tid = viewChatBtn.dataset.viewChatThread || '';
    const sid = viewChatBtn.dataset.viewChatSession || '';
    if (sid) {
      sessionReadCursors.markRead(sid);
      const tools = document.getElementById('cw-detail-tools');
      if (tools) tools._lastHtml = null;
    }
    const sessionDirect = viewChatBtn.dataset.viewSessionDirect || '';
    if (grp) {
      switchToTab('coworkers');
      if (cwState.selected !== grp) selectCoworker(grp);
      if (sessionDirect) {
        setTimeout(() => openThread(sessionDirect, { sessionDirect: true }), 400);
      } else if (tid && sid) {
        // Open the SPECIFIC clicked session, not every session sharing this
        // thread_id. A GitHub issue/PR thread can have multiple coworker
        // sessions (webhook + a2a delegations); re-broadening by thread_id
        // interleaves them into one mixed transcript. The tile already knows
        // exactly which session it represents (sid) — honor it. threadId is
        // carried through for the header label and URL deep-link.
        setTimeout(() => openThread(sid, { sessionDirect: true, threadId: tid }), 400);
      } else if (tid) {
        // Legacy tile with no session id — fall back to the thread-union view.
        setTimeout(() => openThread(tid), 400);
      } else {
        closeThread({ silent: true });
        // Visual feedback so the click registers as "I did something" even when the
        // target is already the active view — briefly flash the chat container and
        // scroll to bottom.
        setTimeout(() => {
          const chatEl = document.getElementById('cw-chat-messages');
          if (chatEl) {
            chatEl.scrollTop = chatEl.scrollHeight;
            chatEl.style.transition = 'background 0.3s';
            chatEl.style.background = 'rgba(59,130,246,0.08)';
            setTimeout(() => {
              chatEl.style.background = '';
            }, 400);
          }
        }, 200);
      }
    }
    return;
  }

  // Click "View Session" button in detail panel (single SDK sub-session drilldown — legacy path)
  const viewSessionBtn = e.target.closest('[data-view-session]');
  if (viewSessionBtn) {
    const sid = viewSessionBtn.dataset.viewSession;
    const grp = viewSessionBtn.dataset.viewSessionGroup;
    if (sid) {
      switchToTab('observability');
      openSessionFlowById(grp, sid);
    }
    return;
  }

  // Click recent hook in detail panel to open matching timeline entry
  const detailHookLink = e.target.closest('.hook-entry-link');
  if (detailHookLink) {
    const group = detailHookLink.dataset.eventGroup;
    const timestamp = parseInt(detailHookLink.dataset.eventTime || '', 10);
    if (group && Number.isFinite(timestamp)) {
      openTimelineForEvent(group, timestamp);
    }
    return;
  }

  // Click session_id link in timeline to open session flow
  const sessionLink = e.target.closest('.tl-session-link');
  if (sessionLink) {
    const sid = sessionLink.dataset.sessionId;
    const grp = sessionLink.dataset.sessionGroup;
    if (sid) openSessionFlowById(grp, sid);
    return;
  }

  // Click "→ <recipient> [open]" dispatch badge: resolve recipient session
  // via /api/dispatch-targets and open it. Single-pane navigation for v1
  // (full split-view-tile UX is the next iteration).
  const dispatchBadge = e.target.closest('.cw-dispatch-badge');
  if (dispatchBadge && !dispatchBadge.classList.contains('pending')) {
    const fromSess = dispatchBadge.dataset.dispatchFromSession || '';
    const tid = dispatchBadge.dataset.dispatchThread || '';
    if (!fromSess || !tid) return;
    dispatchBadge.classList.add('pending');
    dispatchBadge.textContent = '→ resolving…';
    fetch(`/api/dispatch-targets?fromSessionId=${encodeURIComponent(fromSess)}&threadId=${encodeURIComponent(tid)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => {
        const targets = data?.targets || [];
        if (!targets.length) {
          dispatchBadge.textContent = `→ ${dispatchBadge.dataset.dispatchTo} [pending]`;
          dispatchBadge.title =
            'Recipient session has not been minted yet — try again after the dispatch is processed.';
          return;
        }
        const t = targets[0]; // v1 takes first; v2 will render a chooser if multiple
        // Switch to the recipient group + open its session in the chat view.
        if (t.recipientGroupFolder && cwState.selected !== t.recipientGroupFolder) {
          // selectCoworker is the canonical group-switch entry point
          if (typeof selectCoworker === 'function') selectCoworker(t.recipientGroupFolder);
        }
        if (typeof openSessionFlowById === 'function') {
          setTimeout(() => openSessionFlowById(t.recipientGroupFolder, t.recipientSessionId), 100);
        }
      })
      .catch((err) => {
        dispatchBadge.textContent = `→ ${dispatchBadge.dataset.dispatchTo} [err]`;
        dispatchBadge.title = String(err);
        dispatchBadge.classList.remove('pending');
      });
    return;
  }

  // Flow view expand/collapse
  const flowExpand = e.target.closest('.flow-expand-btn');
  if (flowExpand) {
    const targetId = flowExpand.dataset.target;
    const target = document.getElementById(targetId);
    if (target) {
      const isVisible = target.style.display !== 'none';
      target.style.display = isVisible ? 'none' : 'block';
      flowExpand.textContent = isVisible ? '[+]' : '[-]';
    }
    return;
  }

  // Clear filter button
  if (e.target.closest('.filter-clear-btn')) {
    clearTimelineFilter();
    return;
  }
});

// ===================================================================
// TAB 3: ADMIN PANEL
// ===================================================================

const adminState = {
  panel: 'overview',
  messages: [],
  messagesHasMore: false,
  tasks: [],
  sessions: [],
  skills: [],
  groups: [],
  debug: null,
  overview: null,
  loaded: new Set(),
  logs: [],
  channels: [],
  config: null,
};

// --- Admin pill navigation ---
document.querySelectorAll('.admin-pill').forEach((pill) => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.admin-pill').forEach((p) => p.classList.remove('active'));
    document.querySelectorAll('.admin-panel').forEach((p) => p.classList.remove('active'));
    pill.classList.add('active');
    const panelId = pill.dataset.panel;
    document.getElementById(panelId).classList.add('active');
    const name = panelId.replace('admin-', '');
    adminState.panel = name;
    syncTabHash('admin');
    // Signal visibility for expensive operations (ccusage refresh).
    // Cost is shown on Overview, not Infra — gate on Overview being open.
    fetch(`/api/admin-infra-visible?visible=${name === 'overview'}`);
    if (!adminState.loaded.has(name)) loadAdminPanel(name);
  });
});

function loadAdminPanel(name) {
  const loaders = {
    overview: loadAdminOverview,
    messages: loadAdminMessages,
    tasks: loadAdminTasks,
    sessions: loadAdminSessions,
    skills: loadAdminSkills,
    groups: loadAdminGroups,
    debug: loadAdminDebug,
    logs: loadAdminLogs,
    channels: loadAdminChannels,
    config: loadAdminConfig,
    infra: loadAdminInfra,
    funnel: loadFunnel,
  };
  if (loaders[name]) loaders[name]();
}

// --- Overview ---
// Overview is the combined landing panel: summary stat cards on top, then the formerly-
// separate Metrics sections (Token Usage, 24h Activity, Users, Channels) inline below.
// Loading the Overview panel fires all of them in parallel.
async function loadAdminOverview() {
  // Cold-start: Overview is the default landing tab, but the tab-switch
  // handler hasn't fired yet. Ping visibility so ccusage refresh starts
  // and the cost panel populates within ~30s instead of staying $0.
  fetch(`/api/admin-infra-visible?visible=true`);
  const el = document.getElementById('overview-summary');
  try {
    const res = await fetch('/api/overview');
    if (!res.ok) throw new Error('fetch failed');
    adminState.overview = await res.json();
    adminState.loaded.add('overview');
    renderAdminOverview();
  } catch {
    if (el) el.innerHTML = '<div class="admin-empty">Failed to load overview</div>';
  }
  loadAllMetrics();
}

function renderAdminOverview() {
  const d = adminState.overview;
  if (!d) return;
  const el = document.getElementById('overview-summary');
  if (!el) return;
  const uptimeStr = formatDuration(d.uptime * 1000);
  el.innerHTML = `
    <div class="admin-stat-grid">
      <div class="admin-stat-card"><div class="num">${uptimeStr}</div><div class="label">Uptime</div></div>
      <div class="admin-stat-card"><div class="num">${d.groups.total}</div><div class="label">Groups</div></div>
      <div class="admin-stat-card"><div class="num">${d.tasks.active}</div><div class="label">Active Tasks</div></div>
      <div class="admin-stat-card"><div class="num">${d.tasks.paused}</div><div class="label">Paused Tasks</div></div>
      <div class="admin-stat-card"><div class="num">${d.messages.total}</div><div class="label">Messages</div></div>
      <div class="admin-stat-card"><div class="num">${d.sessions}</div><div class="label">Sessions</div></div>
    </div>`;
}

// --- Messages ---
async function loadAdminMessages(append) {
  const el = document.getElementById('admin-messages-content');
  if (!append) el.innerHTML = '<div class="admin-loading">Loading...</div>';
  try {
    let url = '/api/messages?limit=100&allSessions=1&includeSystem=1';
    if (append && adminState.messages.length > 0) {
      const last = adminState.messages[adminState.messages.length - 1];
      url += '&before=' + encodeURIComponent(last.timestamp);
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error('fetch failed');
    const data = await res.json();
    if (append) {
      adminState.messages = adminState.messages.concat(data.messages);
    } else {
      adminState.messages = data.messages;
    }
    adminState.messagesHasMore = data.hasMore;
    adminState.loaded.add('messages');
    renderAdminMessages();
  } catch {
    if (!append) el.innerHTML = '<div class="admin-empty">Failed to load messages</div>';
  }
}

function renderAdminMessages() {
  const el = document.getElementById('admin-messages-content');
  if (adminState.messages.length === 0) {
    el.innerHTML = '<div class="admin-empty">No messages found</div>';
    return;
  }
  let html = `<table class="admin-table">
    <tr><th>Time</th><th>Coworker</th><th>Session</th><th>Dir</th><th>Sender</th><th>Content</th></tr>`;
  for (const m of adminState.messages) {
    const dir = m.direction === 'incoming' ? 'IN' : 'OUT';
    const dirClass = m.direction === 'incoming' ? 'color:var(--accent)' : 'color:var(--green)';
    const coworker = m.group_name || m.group_folder || '-';
    const sessShort = m.session_id ? m.session_id.replace(/^sess-\d+-/, '') : '-';
    let sender = '';
    if (m.direction === 'incoming') {
      sender = m.senderCoworkerName || m.displaySender || m.sender_name || '';
      if (!sender) {
        try {
          const p = JSON.parse(m.content || '{}');
          sender = p.sender || p.senderId || '';
        } catch {}
      }
    } else {
      sender = coworker;
      if (m.recipientCoworkerName) sender += ' → ' + m.recipientCoworkerName;
    }
    const attachmentLabel =
      Array.isArray(m.attachments) && m.attachments.length > 0
        ? ` [${m.attachments.length} attachment${m.attachments.length === 1 ? '' : 's'}]`
        : '';
    const reactionLabel = Array.isArray(m.reactions) && m.reactions.length > 0 ? ` ${m.reactions.join(' ')}` : '';
    const editedLabel = m.edited ? ' (edited)' : '';
    const content = `${m.displayContent || m.body || m.content || ''}${attachmentLabel}${editedLabel}${reactionLabel}`;
    const time = m.timestamp;
    html += `<tr>
      <td style="white-space:nowrap">${esc(formatTime(time))}</td>
      <td style="white-space:nowrap">${esc(coworker)}</td>
      <td style="white-space:nowrap;font-size:0.65rem;color:var(--text-muted)" title="${escAttr(m.session_id || '')}">${
        m.session_id
          ? `<a class="tl-session-link" data-session-id="${escAttr(m.session_id)}" data-session-group="${escAttr(m.group_folder || '')}" style="cursor:pointer">${esc(sessShort)}</a>`
          : esc(sessShort)
      }</td>
      <td style="${dirClass};font-weight:600">${dir}</td>
      <td style="white-space:nowrap;max-width:120px;overflow:hidden;text-overflow:ellipsis">${esc(sender)}</td>
      <td style="max-width:350px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escAttr(content.slice(0, 500))}">${esc(content.slice(0, 200))}</td>
    </tr>`;
  }
  html += '</table>';
  if (adminState.messagesHasMore) {
    html += '<button class="admin-load-more" id="admin-messages-more">Load older messages</button>';
  }
  el.innerHTML = html;
}

// --- Tasks ---
async function loadAdminTasks() {
  const el = document.getElementById('admin-tasks-content');
  el.innerHTML = '<div class="admin-loading">Loading...</div>';
  try {
    const res = await fetch('/api/tasks');
    if (!res.ok) throw new Error('fetch failed');
    adminState.tasks = await res.json();
    adminState.loaded.add('tasks');
    renderAdminTasks();
  } catch {
    el.innerHTML = '<div class="admin-empty">Failed to load tasks</div>';
  }
}

function renderAdminTasks() {
  const el = document.getElementById('admin-tasks-content');
  if (adminState.tasks.length === 0) {
    el.innerHTML = '<div class="admin-empty">No scheduled tasks</div>';
    return;
  }
  let html = `<table class="admin-table">
    <tr><th>ID</th><th>Group</th><th>Prompt</th><th>Schedule</th><th>Status</th><th>Last Run</th><th>Actions</th></tr>`;
  for (const t of adminState.tasks) {
    const statusClass = t.status === 'active' ? 'active' : 'paused';
    const pauseResumeBtn =
      t.status === 'active'
        ? `<button class="admin-action-btn" data-action="pause-task" data-id="${t.id}">Pause</button>`
        : `<button class="admin-action-btn success" data-action="resume-task" data-id="${t.id}">Resume</button>`;
    const actionBtn =
      pauseResumeBtn +
      `<button class="admin-action-btn danger" data-action="delete-task" data-id="${t.id}">Delete</button>`;
    html += `<tr>
      <td>${t.id}</td>
      <td>${esc(t.group_folder)}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(t.prompt)}">${esc((t.prompt || '').slice(0, 80))}</td>
      <td>${esc(t.schedule_type || '')} ${esc(t.schedule_value || '')}</td>
      <td><span class="admin-chip ${statusClass}">${t.status}</span></td>
      <td>${t.last_run ? formatTime(t.last_run) : '-'}</td>
      <td>${actionBtn}</td>
    </tr>`;
    // Show recent run logs inline
    if (t.recentLogs && t.recentLogs.length > 0) {
      html += `<tr><td colspan="7" style="padding:2px 10px 8px 30px;background:var(--bg)">
        <span style="font-size:8px;color:var(--text-muted);text-transform:uppercase">Recent Runs</span>
        ${t.recentLogs
          .map((l) => {
            const c = l.status === 'success' ? 'var(--green)' : l.status === 'error' ? 'var(--red)' : 'var(--yellow)';
            return `<div style="font-size:9px;color:var(--text-dim);padding:1px 0">
            <span style="color:${c}">${l.status}</span> ${formatTime(l.run_at)} — ${formatDuration(l.duration_ms)}
            ${l.error ? ` <span style="color:var(--red)">${esc(l.error.slice(0, 80))}</span>` : ''}
          </div>`;
          })
          .join('')}
      </td></tr>`;
    }
  }
  html += '</table>';
  el.innerHTML = html;
}

// --- Sessions ---
// Sessions tab view state: cost period window + sort. Cost is summed per
// session from transcripts server-side (see /api/sessions); default view is
// ranked by cost over 30d so the fat tail (few sessions, most spend) is on top.
const sessionsView = { period: '30d', sort: 'cost', unavailable: null };

async function loadAdminSessions() {
  const el = document.getElementById('admin-sessions-content');
  el.innerHTML = '<div class="admin-loading">Loading...</div>';
  try {
    const res = await fetch(`/api/sessions?period=${sessionsView.period}&sort=${sessionsView.sort}`);
    if (!res.ok) throw new Error('fetch failed');
    const data = await res.json();
    adminState.sessions = data.sessions || [];
    sessionsView.unavailable = data.costUnavailable ?? null;
    sessionsView.transcriptsBase = data.transcriptsBase || '';
    adminState.loaded.add('sessions');
    renderAdminSessions();
  } catch {
    el.innerHTML = '<div class="admin-empty">Failed to load sessions</div>';
  }
}

// Per-session cost-cap pill + escalation override buttons. Mirrors the Cost
// column's pill styling. Status → color: ok green, warn amber, escalated red,
// stopped grey. A daily-window cap (immortal orchestrator's per-DAY visibility
// bound) renders "/day" after the cap and keeps the ∞ marker. When
// status==='escalated' the row offers override buttons: Continue + Stop for a
// NON-immortal per-run cap, but Continue ONLY (no Stop) for an immortal one —
// immortal runs by design; the DM/pill is the bound, not a kill switch. Buttons
// POST the human decision to the cost-override endpoint (which the dashboard
// proxies to the host ingress). Shared contract with the runner: s.costStatus /
// s.costSpent / s.costCap / s.costImmortal / s.costWindow.
function renderCostCapCell(s) {
  const status = s.costStatus;
  if (!status) return '<span style="color:#64748B">—</span>';
  const colors = {
    ok: '#10B981',
    warn: '#F59E0B',
    escalated: '#EF4444',
    stopped: '#94A3B8',
  };
  const color = colors[status] || '#94A3B8';
  const spent = typeof s.costSpent === 'number' ? fmtUsd(s.costSpent) : '?';
  const cap = typeof s.costCap === 'number' ? fmtUsd(s.costCap) : '?';
  const perDay = s.costWindow === 'daily' ? ' /day' : '';
  const immortalMark = s.costImmortal
    ? '<span title="immortal (orchestrator/admin) — never stopped" style="color:var(--text-muted)"> ∞</span>'
    : '';
  let cell =
    `<span style="border:1px solid ${color};border-radius:4px;padding:1px 6px;white-space:nowrap">` +
    `<b style="color:${color}">${spent}</b><span style="color:var(--text-muted)"> / ${cap}${perDay}</span>` +
    `<span style="color:${color};font-size:9px"> ${esc(status)}</span>${immortalMark}</span>`;
  // Continue is offered on BOTH 'escalated' and 'stopped' rows so a stop is
  // always reversible from the UI (cost_override 'continue' clears the stop and
  // re-arms). Stop is offered only on an escalated non-immortal row (immortal is
  // never halted; a 'stopped' row is already halted).
  if ((status === 'escalated' || status === 'stopped') && s.session_id) {
    const sid = escAttr(s.session_id);
    let btns = `<button class="admin-action-btn success" data-action="cost-override" data-session-id="${sid}" data-decision="continue">Continue</button>`;
    if (!s.costImmortal && status === 'escalated') {
      btns += `<button class="admin-action-btn danger" data-action="cost-override" data-session-id="${sid}" data-decision="stop">Stop</button>`;
    }
    cell += `<span style="display:inline-flex;gap:4px;margin-left:6px">` + btns + `</span>`;
  }
  return cell;
}

function renderAdminSessions() {
  const el = document.getElementById('admin-sessions-content');
  const p = sessionsView.period;
  const costUnavailable = sessionsView.unavailable != null;
  const periodBtn = (val, label) =>
    `<button class="admin-action-btn${p === val ? ' success' : ''}" data-sessions-period="${val}">${label}</button>`;
  const sortBtn = (val, label) =>
    `<button class="admin-action-btn${sessionsView.sort === val ? ' success' : ''}" data-sessions-sort="${val}">${label}</button>`;
  const controls =
    `<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap">` +
    `<span style="color:var(--text-muted);font-size:10px">Cost window:</span>` +
    periodBtn('1d', 'Today') +
    periodBtn('7d', '7d') +
    periodBtn('30d', '30d') +
    `<span style="color:var(--text-muted);font-size:10px;margin-left:8px">Sort:</span>` +
    sortBtn('cost', 'Cost') +
    sortBtn('recent', 'Recent') +
    (costUnavailable
      ? `<span title="${escAttr(String(sessionsView.unavailable))}" style="color:#94A3B8;font-size:10px;margin-left:8px">cost: ccusage unavailable</span>`
      : '') +
    `</div>`;

  if (adminState.sessions.length === 0) {
    el.innerHTML = controls + '<div class="admin-empty">No sessions</div>';
    return;
  }
  let rows = adminState.sessions;
  if (sessionsView.sort === 'recent') {
    rows = [...rows].sort((a, b) => String(b.last_active || '').localeCompare(String(a.last_active || '')));
  }
  const totalCost = rows.reduce((s, r) => s + (r.cost || 0), 0);
  // Cost distribution across sessions with priced activity in the window. The
  // tail is heavy (a few sessions dominate spend), so percentiles say more than
  // the mean: p50 = the typical session, p90/p99/max = where the cost concentrates.
  const pricedCosts = rows
    .map((r) => r.cost || 0)
    .filter((c) => c > 0)
    .sort((a, b) => a - b);
  const pctl = (arr, q) => (arr.length ? arr[Math.min(arr.length - 1, Math.floor((q / 100) * (arr.length - 1)))] : 0);
  const distPills =
    costUnavailable || pricedCosts.length === 0
      ? ''
      : `<div style="display:flex;gap:6px;align-items:center;margin-bottom:8px;flex-wrap:wrap;font-size:10px">` +
        `<span style="color:var(--text-muted)">Cost per session (${pricedCosts.length} priced):</span>` +
        [
          ['p50', 50],
          ['p75', 75],
          ['p90', 90],
          ['p99', 99],
          ['max', 100],
        ]
          .map(
            ([lbl, q]) =>
              `<span style="border:1px solid var(--border);border-radius:4px;padding:1px 6px"><span style="color:var(--text-muted)">${lbl}</span> <b style="color:#10B981">${fmtUsd(pctl(pricedCosts, q))}</b></span>`,
          )
          .join('') +
        `</div>`;
  let html =
    controls +
    `<div style="color:var(--text-muted);font-size:10px;margin-bottom:6px">${rows.length} sessions · ${costUnavailable ? 'n/a' : fmtUsd(totalCost)} over ${p}</div>` +
    distPills +
    `<table class="admin-table">
    <tr><th>#</th><th>Coworker</th><th>Session ID</th><th style="text-align:right">Cost (${p})</th><th>Cost cap</th><th style="text-align:right">Tokens</th><th>Last active</th><th>Actions</th></tr>`;
  let i = 0;
  for (const s of rows) {
    i++;
    const sid = s.session_id || '';
    const grp = s.group_folder || '';
    const nanoSess = sid ? lookupNanoSessById(sid) : null;
    const tid = nanoSess?.thread_id || '';
    const direct = nanoSess && isA2aSession(nanoSess) ? sid : '';
    let sidCell = esc(sid || '-');
    if (sid && grp) {
      const attrs =
        `data-view-chat-session="${escAttr(sid)}" data-view-chat-group="${escAttr(grp)}"` +
        (tid ? ` data-view-chat-thread="${escAttr(tid)}"` : '') +
        (direct ? ` data-view-session-direct="${escAttr(direct)}"` : '');
      const dest = tid ? 'thread panel' : direct ? 'a2a panel' : 'main chat';
      sidCell = `<span style="cursor:pointer;text-decoration:underline dotted;text-underline-offset:2px" title="Open in Coworkers (${dest})" ${attrs}>${esc(sid)}</span>`;
    }
    const costCell = costUnavailable
      ? '<span style="color:#94A3B8">n/a</span>'
      : `<span style="color:#10B981">${fmtUsd(s.cost || 0)}</span>${s.costUnpriced ? '<span title="includes usage from a model without a known price" style="color:#F59E0B"> *</span>' : ''}`;
    const costCapCell = renderCostCapCell(s);
    html += `<tr>
      <td style="color:var(--text-muted)">${i}</td>
      <td>${esc(s.group_name || s.group_folder || '-')}</td>
      <td style="font-size:9px;color:var(--text-muted)">${sidCell}</td>
      <td style="text-align:right">${costCell}</td>
      <td>${costCapCell}</td>
      <td style="text-align:right;color:var(--text-muted)">${fmtNum(s.costTokens || 0)}</td>
      <td style="font-size:9px;color:var(--text-muted)">${esc(s.last_active || '-')}</td>
      <td>${
        sessionsView.transcriptsBase && sid && grp
          ? `<a class="admin-action-btn" href="${escAttr(sessionsView.transcriptsBase)}/${encodeURIComponent(grp)}/${encodeURIComponent(sid)}/index.html" target="_blank" rel="noopener" title="Open rendered transcript">transcript</a> `
          : ''
      }${
        s.traceUrl
          ? `<a class="admin-action-btn" href="${escAttr(s.traceUrl)}" target="_blank" rel="noopener" title="Open session-precise claude-trace">trace</a> `
          : ''
      }<button class="admin-action-btn danger" data-action="delete-session" data-folder="${esc(s.group_folder)}">Delete</button></td>
    </tr>`;
  }
  html += '</table>';
  el.innerHTML = html;
}

// --- Skills ---
async function loadAdminSkills() {
  const el = document.getElementById('admin-skills-content');
  el.innerHTML = '<div class="admin-loading">Loading...</div>';
  try {
    const res = await fetch('/api/skills');
    if (!res.ok) throw new Error('fetch failed');
    adminState.skills = await res.json();
    adminState.loaded.add('skills');
    renderAdminSkills();
  } catch {
    el.innerHTML = '<div class="admin-empty">Failed to load skills</div>';
  }
}

function renderAdminSkills() {
  const el = document.getElementById('admin-skills-content');
  let html = `<div style="margin-bottom:10px"><button class="admin-action-btn success" data-action="new-skill">+ New Skill</button></div>`;
  if (adminState.skills.length === 0) {
    html += '<div class="admin-empty">No skills found in container/skills/</div>';
    el.innerHTML = html;
    return;
  }
  html += `<table class="admin-table">
    <tr><th>Skill</th><th>Description</th><th>Files</th><th>Status</th><th>Actions</th></tr>`;
  for (const s of adminState.skills) {
    const chipClass = s.enabled ? 'enabled' : 'disabled';
    const chipText = s.enabled ? 'Enabled' : 'Disabled';
    const btnClass = s.enabled ? 'danger' : 'success';
    const btnText = s.enabled ? 'Disable' : 'Enable';
    html += `<tr>
      <td><strong>${esc(s.title || s.name)}</strong><br><span style="color:var(--text-muted)">${esc(s.name)}</span></td>
      <td class="md-content" style="max-width:250px">${md(s.description || '-')}</td>
      <td style="font-size:9px;color:var(--text-muted)">${(s.files || []).map(esc).join(', ')}</td>
      <td><span class="admin-chip ${chipClass}">${chipText}</span></td>
      <td>
        <button class="admin-action-btn ${btnClass}" data-action="toggle-skill" data-name="${esc(s.name)}">${btnText}</button>
        <button class="admin-action-btn" data-action="preview-skill" data-name="${esc(s.name)}">Preview</button>
        <button class="admin-action-btn" data-action="edit-skill" data-name="${esc(s.name)}">Edit</button>
        <button class="admin-action-btn danger" data-action="delete-skill" data-name="${esc(s.name)}">Delete</button>
      </td>
    </tr>`;
  }
  html += '</table>';
  // Skill editor (hidden by default, shown on edit/new)
  html += `<div id="skill-editor" style="display:none;margin-top:12px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <h4 id="skill-editor-title" style="font-size:11px;margin:0">Edit Skill</h4>
      <button class="admin-action-btn" id="skill-toggle-preview" style="font-size:9px;padding:2px 8px">Preview</button>
    </div>
    <input id="skill-editor-name" type="text" placeholder="skill-name" style="display:none;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;padding:4px 8px;font-family:var(--font);font-size:10px;width:200px;margin-bottom:6px">
    <div id="skill-editor-preview" class="md-content md-preview" style="display:none;max-height:400px;overflow-y:auto;margin-bottom:8px"></div>
    <textarea id="skill-editor-content" class="admin-editor" style="min-height:200px" placeholder="# Skill Name\n\nSkill description and instructions..."></textarea>
    <div style="display:flex;gap:6px;margin-top:4px">
      <button class="admin-save-btn" data-action="save-skill">Save</button>
      <button class="admin-action-btn" data-action="cancel-skill-edit">Cancel</button>
    </div>
  </div>`;
  el.innerHTML = html;

  // Skill editor preview toggle
  document.getElementById('skill-toggle-preview')?.addEventListener('click', () => {
    const preview = document.getElementById('skill-editor-preview');
    const textarea = document.getElementById('skill-editor-content');
    const btn = document.getElementById('skill-toggle-preview');
    if (preview.style.display === 'none') {
      preview.innerHTML = md(textarea.value);
      preview.style.display = 'block';
      textarea.style.display = 'none';
      btn.textContent = 'Edit';
    } else {
      preview.style.display = 'none';
      textarea.style.display = 'block';
      btn.textContent = 'Preview';
    }
  });
}

// --- Groups ---
// Skip a silent refresh while the user is mid-interaction so we don't wipe an open
// CLAUDE.md editor/preview or a focused textarea.
function groupsInteracting() {
  const el = document.getElementById('admin-groups-content');
  if (!el) return false;
  const a = document.activeElement;
  if (a && el.contains(a) && a.tagName === 'TEXTAREA') return true;
  return !!el.querySelector('details[open]');
}

// Keep the Groups tab (and its session counts) live — it otherwise loads once and
// freezes. Silent re-fetch every 20s while the tab is open and idle.
setInterval(() => {
  if (adminState.panel === 'groups' && adminState.loaded.has('groups') && !groupsInteracting()) {
    loadAdminGroups(true);
  }
}, 20000);

async function loadAdminGroups(silent) {
  const el = document.getElementById('admin-groups-content');
  if (!silent) el.innerHTML = '<div class="admin-loading">Loading...</div>';
  try {
    const res = await fetch('/api/groups/detail');
    if (!res.ok) throw new Error('fetch failed');
    adminState.groups = await res.json();
    adminState.loaded.add('groups');
    renderAdminGroups();
  } catch {
    if (!silent) el.innerHTML = '<div class="admin-empty">Failed to load groups</div>';
  }
}

function renderGroupDestinations(destinations) {
  if (!destinations || destinations.length === 0) return '';
  const peers = destinations.filter((d) => d.target_type === 'agent');
  const channels = destinations.filter((d) => d.target_type === 'channel');
  if (peers.length === 0 && channels.length === 0) return '';
  let html = '<div style="margin-top:4px;font-size:10px;color:var(--text-dim)">';
  if (peers.length > 0) {
    const peerTags = peers
      .map((d) => {
        const name = esc(d.display || d.local_name);
        return `<span class="admin-chip" style="background:#3B82F620;color:#3B82F6;font-size:9px" title="Peer agent: ${esc(d.local_name)}">&#x2194; ${name}</span>`;
      })
      .join(' ');
    html += `<span>Peers: </span>${peerTags} `;
  }
  if (channels.length > 0) {
    const chTags = channels
      .map((d) => {
        // a2a conduits get the resolved "From → To (a2a)" label + a distinct tint
        // so they read as routing plumbing, not real chat channels.
        const name = esc(d.display || d.local_name);
        const tint = d.isA2a ? 'background:#8957e520;color:#bc8cff' : 'background:#10B98120;color:#10B981';
        return `<span class="admin-chip" style="${tint};font-size:9px" title="Channel: ${esc(d.local_name)}">&#x25CB; ${name}</span>`;
      })
      .join(' ');
    html += `<span>Channels: </span>${chTags}`;
  }
  html += '</div>';
  return html;
}

function renderAdminGroups() {
  const el = document.getElementById('admin-groups-content');
  if (adminState.groups.length === 0) {
    el.innerHTML = '<div class="admin-empty">No registered groups</div>';
    return;
  }
  let html = '';
  for (const g of adminState.groups) {
    const containerChip = g.containerRunning
      ? '<span class="admin-chip running">Running</span>'
      : '<span class="admin-chip stopped">Stopped</span>';
    const mainBadge = g.is_main ? ' <span class="admin-chip active">Main</span>' : '';
    const matchedCw = (state.coworkers || []).find((c) => c.folder === g.folder);
    const isAutoUpdate = matchedCw ? matchedCw.isAutoUpdate : false;
    const updateChip = isAutoUpdate
      ? '<span class="admin-chip auto-update">auto-update</span>'
      : '<span class="admin-chip static">static</span>';
    // Flag groups with no recent session activity (helps spot stale/duplicate
    // groups — e.g. a legacy "Slang Fixer" superseded by an active namesake).
    const lastMs = g.lastActive ? Date.parse(g.lastActive) : 0;
    const staleDays = lastMs ? Math.floor((Date.now() - lastMs) / 86400000) : null;
    const staleBadge =
      staleDays != null && staleDays >= 14
        ? ` <span class="admin-chip" style="background:#6e768130;color:#8b949e" title="No session activity in ${staleDays} days">stale ${staleDays}d</span>`
        : '';
    const a2aSuffix = g.sessionCountA2a
      ? ` <span style="color:var(--text-muted)">(${g.sessionCountReal} real / ${g.sessionCountA2a} a2a)</span>`
      : '';
    html += `<div class="admin-group-card">
      <h4>${esc(g.name || g.folder)}${mainBadge} ${containerChip} ${updateChip}${staleBadge}</h4>
      <div class="admin-group-meta">
        <span>Folder: <strong>${esc(g.folder)}</strong></span>
        <span title="Lifetime nanoclaw sessions (real = webhook/dashboard; a2a = coworker-to-coworker delegation, usually the majority). Not the SDK transcript count.">Sessions: ${g.sessionCount || 0}${a2aSuffix}</span>
        <span title="engage mode: ${esc(g.engageMode || 'always')} — 'always' = responds to everything in its own channel; 'pattern' = engages only when @mentioned in the shared Orchestrator channel">Mention: ${g.mentionHandle ? esc(g.mentionHandle) : '<span style="color:var(--text-muted)">default</span>'}${g.engageMode === 'pattern' ? ' <span style="color:var(--text-muted);font-size:9px">(gated)</span>' : ''}</span>
        <span>Last active: ${g.lastActive ? formatTime(g.lastActive) : '—'}</span>
      </div>
      ${renderGroupDestinations(g.destinations || [])}
      <details>
        <summary style="cursor:pointer;font-size:10px;color:var(--text-dim)">CLAUDE.md Preview / Editor</summary>
        <div class="md-content md-preview" style="max-height:200px;overflow-y:auto;margin:6px 0">${g.memory ? md(g.memory) : '<span style="color:var(--text-muted)">(no CLAUDE.md)</span>'}</div>
        <details style="margin-top:4px" data-raw-editor="1">
          <summary style="cursor:pointer;font-size:9px;color:var(--text-muted)">Edit raw markdown</summary>
          <textarea class="admin-editor" data-folder="${esc(g.folder)}" data-raw="1">${esc(g.rawMemory || '')}</textarea>
          <button class="admin-save-btn" data-action="save-memory" data-folder="${esc(g.folder)}">Save</button>
        </details>
      </details>
    </div>`;
  }
  el.innerHTML = html;
}

// --- Debug ---
async function loadAdminDebug() {
  const el = document.getElementById('admin-debug-content');
  el.innerHTML = '<div class="admin-loading">Loading...</div>';
  try {
    const res = await fetch('/api/debug');
    if (!res.ok) throw new Error('fetch failed');
    adminState.debug = await res.json();
    adminState.loaded.add('debug');
    renderAdminDebug();
  } catch {
    el.innerHTML = '<div class="admin-empty">Failed to load debug info</div>';
  }
}

function renderAdminDebug() {
  const d = adminState.debug;
  if (!d) return;
  const el = document.getElementById('admin-debug-content');
  const fmtBytes = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : (b / 1024).toFixed(0) + ' KB');
  el.innerHTML = `
    <div class="admin-stat-grid">
      <div class="admin-stat-card"><div class="num">${d.pid}</div><div class="label">PID</div></div>
      <div class="admin-stat-card"><div class="num">${formatDuration(d.uptime * 1000)}</div><div class="label">Uptime</div></div>
      <div class="admin-stat-card"><div class="num">${fmtBytes(d.memory.rss)}</div><div class="label">RSS</div></div>
      <div class="admin-stat-card"><div class="num">${fmtBytes(d.memory.heapUsed)}</div><div class="label">Heap Used</div></div>
      <div class="admin-stat-card"><div class="num">${d.wsClients}</div><div class="label">WS Clients</div></div>
      <div class="admin-stat-card"><div class="num">${d.hookEventsBuffered}</div><div class="label">Hook Events</div></div>
    </div>
    <h4 style="font-size:11px;margin:10px 0 6px">Database Row Counts</h4>
    <table class="admin-table">
      <tr><th>Table</th><th>Rows</th></tr>
      ${Object.entries(d.rowCounts || {})
        .map(([t, c]) => `<tr><td>${esc(t)}</td><td>${c}</td></tr>`)
        .join('')}
    </table>
    <h4 style="font-size:11px;margin:10px 0 6px">Memory Details</h4>
    <div class="admin-code">${JSON.stringify(d.memory, null, 2)}</div>
    <h4 style="font-size:11px;margin:10px 0 6px">DB Path</h4>
    <div class="admin-code">${esc(d.dbPath)} (${d.dbAvailable ? 'available' : 'unavailable'})</div>`;
}

// --- Admin event delegation ---
document.getElementById('admin')?.addEventListener('click', async (e) => {
  const summary = e.target.closest('details[data-raw-editor] > summary');
  if (summary) {
    const details = summary.parentElement;
    const textarea = details?.querySelector('.admin-editor[data-raw="1"]');
    const folder = textarea?.getAttribute('data-folder');
    if (textarea && folder && !textarea.getAttribute('data-loaded')) {
      textarea.setAttribute('data-loaded', '1');
      try {
        const res = await fetch(`/api/memory/${encodeURIComponent(folder)}?raw=1`);
        if (res.ok) textarea.value = await res.text();
      } catch {
        /* ignore */
      }
    }
  }
  // Sessions tab cost-window / sort toggles — re-fetch with the new params.
  const sPeriod = e.target.closest('[data-sessions-period]');
  if (sPeriod) {
    sessionsView.period = sPeriod.dataset.sessionsPeriod;
    loadAdminSessions();
    return;
  }
  const sSort = e.target.closest('[data-sessions-sort]');
  if (sSort) {
    sessionsView.sort = sSort.dataset.sessionsSort;
    loadAdminSessions();
    return;
  }
  const btn = e.target.closest('[data-action]');
  if (!btn) {
    // Load more messages
    if (e.target.id === 'admin-messages-more') {
      loadAdminMessages(true);
      return;
    }
    // Refresh buttons
    const refreshBtn = e.target.closest('.admin-refresh-btn');
    if (refreshBtn) {
      const name = refreshBtn.dataset.load;
      // The funnel snapshot is a cached file (~180 GitHub calls to rebuild), so
      // a plain reload only re-reads the cache. Trigger a real recompute, then
      // reload once it finishes. Other panels reload from their live source.
      if (name === 'funnel') {
        triggerFunnelRefresh(refreshBtn);
        return;
      }
      adminState.loaded.delete(name);
      loadAdminPanel(name);
    }
    return;
  }

  const action = btn.dataset.action;

  if (action === 'pause-task') {
    const id = btn.dataset.id;
    btn.disabled = true;
    try {
      await fetch(`/api/tasks/${id}/pause`, { method: 'POST' });
      adminState.loaded.delete('tasks');
      loadAdminTasks();
    } catch {
      btn.disabled = false;
    }
    return;
  }

  if (action === 'resume-task') {
    const id = btn.dataset.id;
    btn.disabled = true;
    try {
      await fetch(`/api/tasks/${id}/resume`, { method: 'POST' });
      adminState.loaded.delete('tasks');
      loadAdminTasks();
    } catch {
      btn.disabled = false;
    }
    return;
  }

  if (action === 'delete-session') {
    const folder = btn.dataset.folder;
    if (!confirm(`Delete all sessions for "${folder}"?`)) return;
    btn.disabled = true;
    try {
      await fetch(`/api/sessions/${encodeURIComponent(folder)}`, { method: 'DELETE' });
      adminState.loaded.delete('sessions');
      loadAdminSessions();
    } catch {
      btn.disabled = false;
    }
    return;
  }

  if (action === 'cost-override') {
    const sessionId = btn.dataset.sessionId;
    const decision = btn.dataset.decision;
    if (!sessionId || (decision !== 'continue' && decision !== 'stop')) return;
    const verb = decision === 'stop' ? 'Stop (quiesce)' : 'Continue (raise cap)';
    if (!confirm(`${verb} session "${sessionId}"?`)) return;
    btn.disabled = true;
    try {
      const res = await fetch('/api/cost-override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, decision }),
      });
      if (!res.ok) {
        let msg = 'Cost override failed';
        try {
          const j = await res.json();
          msg = j.error || msg;
        } catch {
          /* non-JSON */
        }
        alert(msg);
        btn.disabled = false;
        return;
      }
      adminState.loaded.delete('sessions');
      loadAdminSessions();
    } catch {
      btn.disabled = false;
    }
    return;
  }

  if (action === 'toggle-skill') {
    const name = btn.dataset.name;
    btn.disabled = true;
    try {
      await fetch(`/api/skills/${encodeURIComponent(name)}/toggle`, { method: 'POST' });
      adminState.loaded.delete('skills');
      loadAdminSkills();
    } catch {
      btn.disabled = false;
    }
    return;
  }

  if (action === 'save-memory') {
    const folder = btn.dataset.folder;
    const textarea = document.querySelector(`.admin-editor[data-folder="${folder}"]`);
    if (!textarea) return;
    const raw = textarea.getAttribute('data-raw') === '1';
    btn.disabled = true;
    btn.textContent = 'Saving...';
    try {
      const url = raw ? `/api/memory/${encodeURIComponent(folder)}?raw=1` : `/api/memory/${encodeURIComponent(folder)}`;
      await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'text/plain' },
        body: textarea.value,
      });
      btn.textContent = 'Saved!';
      setTimeout(() => {
        btn.textContent = 'Save';
        btn.disabled = false;
      }, 1500);
    } catch {
      btn.textContent = 'Error';
      setTimeout(() => {
        btn.textContent = 'Save';
        btn.disabled = false;
      }, 1500);
    }
    return;
  }

  // Task delete
  if (action === 'delete-task') {
    const id = btn.dataset.id;
    if (!confirm(`Delete task #${id} and all its run logs?`)) return;
    btn.disabled = true;
    try {
      await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      adminState.loaded.delete('tasks');
      loadAdminTasks();
    } catch {
      btn.disabled = false;
    }
    return;
  }

  // Skill CRUD actions
  if (action === 'new-skill') {
    const editor = document.getElementById('skill-editor');
    const nameInput = document.getElementById('skill-editor-name');
    const contentInput = document.getElementById('skill-editor-content');
    const title = document.getElementById('skill-editor-title');
    editor.style.display = 'block';
    nameInput.style.display = 'block';
    nameInput.value = '';
    contentInput.value = '# New Skill\n\nSkill description and instructions.\n';
    title.textContent = 'Create New Skill';
    editor.dataset.mode = 'create';
    editor.scrollIntoView({ behavior: 'smooth' });
    return;
  }

  if (action === 'preview-skill') {
    const name = btn.dataset.name;
    btn.disabled = true;
    try {
      const res = await fetch(`/api/skills/${encodeURIComponent(name)}`);
      const content = res.ok ? await res.text() : '';
      const editor = document.getElementById('skill-editor');
      const preview = document.getElementById('skill-editor-preview');
      const contentInput = document.getElementById('skill-editor-content');
      const toggleBtn = document.getElementById('skill-toggle-preview');
      const title = document.getElementById('skill-editor-title');
      const nameInput = document.getElementById('skill-editor-name');
      editor.style.display = 'block';
      nameInput.style.display = 'none';
      contentInput.value = content;
      contentInput.style.display = 'none';
      preview.innerHTML = md(content);
      preview.style.display = 'block';
      toggleBtn.textContent = 'Edit';
      title.textContent = `Preview: ${name}`;
      editor.dataset.mode = 'edit';
      editor.dataset.skillName = name;
      editor.scrollIntoView({ behavior: 'smooth' });
    } catch {
      /* ignore */
    }
    btn.disabled = false;
    return;
  }

  if (action === 'edit-skill') {
    const name = btn.dataset.name;
    btn.disabled = true;
    try {
      const res = await fetch(`/api/skills/${encodeURIComponent(name)}`);
      const content = res.ok ? await res.text() : '';
      const editor = document.getElementById('skill-editor');
      const nameInput = document.getElementById('skill-editor-name');
      const contentInput = document.getElementById('skill-editor-content');
      const preview = document.getElementById('skill-editor-preview');
      const toggleBtn = document.getElementById('skill-toggle-preview');
      const title = document.getElementById('skill-editor-title');
      editor.style.display = 'block';
      nameInput.style.display = 'none';
      contentInput.value = content;
      contentInput.style.display = 'block';
      preview.style.display = 'none';
      toggleBtn.textContent = 'Preview';
      title.textContent = `Edit: ${name}`;
      editor.dataset.mode = 'edit';
      editor.dataset.skillName = name;
      editor.scrollIntoView({ behavior: 'smooth' });
    } catch {
      /* ignore */
    }
    btn.disabled = false;
    return;
  }

  if (action === 'delete-skill') {
    const name = btn.dataset.name;
    if (!confirm(`Delete skill "${name}" permanently?`)) return;
    btn.disabled = true;
    try {
      await fetch(`/api/skills/${encodeURIComponent(name)}?confirm=true`, { method: 'DELETE' });
      adminState.loaded.delete('skills');
      loadAdminSkills();
    } catch {
      btn.disabled = false;
    }
    return;
  }

  if (action === 'save-skill') {
    const editor = document.getElementById('skill-editor');
    const mode = editor.dataset.mode;
    const contentInput = document.getElementById('skill-editor-content');
    btn.disabled = true;
    btn.textContent = 'Saving...';
    try {
      if (mode === 'create') {
        const nameInput = document.getElementById('skill-editor-name');
        const name = nameInput.value.trim();
        if (!name || !/^[a-z0-9-]+$/.test(name)) {
          alert('Invalid name: use lowercase letters, numbers, and hyphens only');
          btn.disabled = false;
          btn.textContent = 'Save';
          return;
        }
        await fetch('/api/skills', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, content: contentInput.value }),
        });
      } else {
        const name = editor.dataset.skillName;
        await fetch(`/api/skills/${encodeURIComponent(name)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'text/plain' },
          body: contentInput.value,
        });
      }
      editor.style.display = 'none';
      btn.textContent = 'Save';
      btn.disabled = false;
      adminState.loaded.delete('skills');
      loadAdminSkills();
    } catch {
      btn.textContent = 'Error';
      setTimeout(() => {
        btn.textContent = 'Save';
        btn.disabled = false;
      }, 1500);
    }
    return;
  }

  if (action === 'cancel-skill-edit') {
    document.getElementById('skill-editor').style.display = 'none';
    return;
  }

  // Config CLAUDE.md save
  if (action === 'save-config-md') {
    const content = document.getElementById('config-md-editor')?.value || '';
    btn.disabled = true;
    btn.textContent = 'Saving...';
    try {
      await fetch('/api/config/claude-md', {
        method: 'PUT',
        headers: { 'Content-Type': 'text/plain' },
        body: content,
      });
      btn.textContent = 'Saved!';
      setTimeout(() => {
        btn.textContent = 'Save';
        btn.disabled = false;
      }, 1500);
    } catch {
      btn.textContent = 'Error';
      setTimeout(() => {
        btn.textContent = 'Save';
        btn.disabled = false;
      }, 1500);
    }
    return;
  }
});

// ===================================================================

/**
 * URL query suffix carrying the currently-viewed NanoClaw session's
 * thread_id. Shell-exec endpoints consume this to pick the right
 * container when a coworker has multiple concurrent sessions (root +
 * Slack-style threads). Empty string when no thread panel is open —
 * resolves to the root session server-side.
 */
function currentShellThreadQuery() {
  const tid = cwState.thread?.parentId;
  return tid ? `?thread_id=${encodeURIComponent(tid)}` : '';
}

// ===================================================================
// COWORKERS TAB
// ===================================================================

const cwState = {
  selected: null, // currently selected coworker folder
  messages: [], // main-view messages (thread_id IS NULL). Alias for .main.messages; kept as a top-level field so existing readers don't break.
  messagesHasMore: false, // server-reported flag: more rows exist below the loaded window — drives "Load older" button
  threadSummaries: {}, // { [parentMessageId]: { replyCount, lastReplyTs } } — main view only
  polling: null, // main-view polling interval
  loadingOlder: false, // re-entrancy guard for the "Load older" click — pagination requests can race with the 3s poll
  thread: null, // { parentId, parentSnapshot, messages: [], polling, hasMore, loadingOlder } when a thread panel is open; null otherwise
  a2aInspector: null, // { recipientAgGroupId, senderThreadId, recipientName, session, messages } — Option C read-only peek
  types: null, // coworker-types.json cache
  approvalCountByFolder: {}, // { folder: count } for sidebar dot
  lastMainMessageTs: null, // tracks last-seen state.lastMessageTs for WS-driven refresh dedupe
};

function getCwCoworkers() {
  // Combine state.coworkers (from WebSocket) with state.registeredGroups
  const validTypes = cwState.types && cwState.types !== 'loading' ? Object.keys(cwState.types) : [];
  const coworkers = [];
  const seen = new Set();
  // Registered groups with dashboard:* JIDs are coworkers
  for (const g of state.registeredGroups || []) {
    const folder = g.folder;
    seen.add(folder);
    // Find matching coworker from state for live status
    const live = (state.coworkers || []).find((c) => c.folder === folder);
    coworkers.push({
      folder,
      name: g.name || folder,
      jid: g.jid,
      trigger: g.trigger_pattern,
      isMain: g.is_admin === 1 || g.is_main === 1,
      status: live?.status || 'idle',
      lastActivity: live?.lastActivity || live?.hookTimestamp || null,
      hookTimestamp: live?.hookTimestamp || null,
      type: (() => {
        const raw = (live?.type && live.type !== 'unknown' ? live.type : null) || g.coworker_type;
        if (!raw) return g.is_main === 1 ? 'main' : 'static';
        if (validTypes.length > 0 && !validTypes.includes(raw)) return 'static';
        return raw;
      })(),
      routing: g.routing || 'direct',
      sidebarGroup: g.sidebar_group || null,
      taskCount: live?.taskCount || 0,
      isAutoUpdate: live?.isAutoUpdate || false,
      allowedMcpTools: live?.allowedMcpTools || (g.allowed_mcp_tools ? JSON.parse(g.allowed_mcp_tools) : []),
      disallowedMcpTools: live?.disallowedMcpTools || [],
      overlays: live?.overlays || (g.overlays ? JSON.parse(g.overlays) : []),
    });
  }
  return coworkers;
}

function renderCwSidebar() {
  const list = document.getElementById('cw-list');
  if (!list) return;
  // Lazy-fetch /api/types for validation. On error or empty response, leave
  // cwState.types null so the next call retries — caching {} silently
  // breaks downstream consumers (Create Coworker dropdown saw empty Type +
  // Overlays after a transient fetch failure on first page load).
  if (!cwState.types) {
    cwState.types = 'loading'; // sentinel to prevent duplicate fetches
    fetch('/api/types')
      .then((r) => (r.ok ? r.json() : null))
      .then((t) => {
        cwState.types = t && Object.keys(t).length > 0 ? t : null;
        renderCwSidebar(); // re-render with valid types
      })
      .catch(() => {
        cwState.types = null; // retry on next render
      });
  }
  const coworkers = getCwCoworkers();
  if (coworkers.length === 0) {
    list.innerHTML = '<div class="cw-empty">No coworkers yet. Click "+ New" to create one.</div>';
    return;
  }
  const statusPriority = { working: 0, active: 1, thinking: 2, error: 3, idle: 4 };
  // Within a group: main first, then status, then most-recent activity, then name.
  const intraSort = (a, b) => {
    if (a.isMain && !b.isMain) return -1;
    if (!a.isMain && b.isMain) return 1;
    const sa = statusPriority[a.status] ?? 5;
    const sb = statusPriority[b.status] ?? 5;
    if (sa !== sb) return sa - sb;
    const ta = a.lastActivity || '';
    const tb = b.lastActivity || '';
    if (ta !== tb) return tb.localeCompare(ta);
    return a.name.localeCompare(b.name);
  };
  // Bucket coworkers by sidebar group. NULL/'prod' -> the shared "prod" group.
  const buckets = new Map();
  for (const cw of coworkers) {
    const gkey = cw.sidebarGroup && cw.sidebarGroup !== 'prod' ? cw.sidebarGroup : 'prod';
    if (!buckets.has(gkey)) buckets.set(gkey, []);
    buckets.get(gkey).push(cw);
  }
  // Stable group order: prod pinned first, then user groups by label.
  const orderedGroups = [...buckets.keys()].sort((a, b) => {
    if (a === 'prod') return -1;
    if (b === 'prod') return 1;
    return cwGroupLabel(a).localeCompare(cwGroupLabel(b));
  });
  const collapsedGroups = loadCollapsedGroups();
  list.innerHTML = orderedGroups
    .map((gkey) => {
      const groupItems = buckets.get(gkey).sort(intraSort);
      const isCollapsed = collapsedGroups.has(gkey);
      const caret = isCollapsed ? '▸' : '▾';
      const groupHeader = `<div class="cw-group-header${isCollapsed ? ' collapsed' : ''}" data-group="${esc(gkey)}"><span class="cw-group-caret">${caret}</span><span class="cw-group-label">${esc(cwGroupLabel(gkey))}</span><span class="cw-group-count">${groupItems.length}</span></div>`;
      const itemsHtml = isCollapsed
        ? ''
        : groupItems
            .map((cw) => {
              const selected = cwState.selected === cw.folder ? ' selected' : '';
              const label = cw.isMain ? `${cw.name} (main)` : cw.name;
              const meta = cw.lastActivity ? timeAgo(cw.lastActivity) : '';
              const updateDot = updateDotHtml(cw.isAutoUpdate);
              const unread = hasUnread(cw.folder);
              const approvalCount = cwState.approvalCountByFolder[cw.folder] || 0;
              const statusTitle =
                { idle: 'Idle', active: 'Active', working: 'Working', thinking: 'Thinking', error: 'Error' }[
                  cw.status
                ] || cw.status;
              return `<div class="cw-item${selected}" data-folder="${esc(cw.folder)}">
      <div class="cw-dot ${cw.status}" title="${statusTitle}"></div>
      <div class="cw-item-info">
        <div class="cw-item-name">${esc(label)}${updateDot}</div>
        ${cw.type ? `<div class="cw-item-type">${esc(cw.type)}</div>` : ''}
        ${meta ? `<div class="cw-item-meta">${esc(meta)}</div>` : ''}
      </div>
      ${approvalCount > 0 ? `<div class="cw-approval-dot" title="Pending approval \u2014 ${approvalCount} action${approvalCount > 1 ? 's' : ''} waiting for admin review"></div>` : ''}
      ${unread ? '<div class="cw-unread-badge" title="Unread messages">\u25CF</div>' : ''}
    </div>`;
            })
            .join('');
      return `<div class="cw-group" data-group="${esc(gkey)}">${groupHeader}${itemsHtml}</div>`;
    })
    .join('');
  // Click handlers — use onclick for Playwright/agent-browser compatibility
  list.querySelectorAll('.cw-item').forEach((el) => {
    el.onclick = () => selectCoworker(el.dataset.folder);
  });
  list.querySelectorAll('.cw-group-header').forEach((el) => {
    el.onclick = () => {
      toggleGroupCollapsed(el.dataset.group);
      renderCwSidebar();
    };
  });
}

// Sidebar group label: the shared group is "prod"; a user-id group strips the
// channel prefix (e.g. "dashboard:user1" -> "user1") for a readable header.
function cwGroupLabel(key) {
  if (!key || key === 'prod') return 'prod';
  const i = key.indexOf(':');
  return i >= 0 ? key.slice(i + 1) : key;
}

// Collapsed sidebar groups persist client-side (honors the issue's
// cookie/localStorage suggestion for user-controlled, stable sidebar state).
function loadCollapsedGroups() {
  try {
    return new Set(JSON.parse(localStorage.getItem('cwCollapsedGroups') || '[]'));
  } catch {
    return new Set();
  }
}
function toggleGroupCollapsed(key) {
  const s = loadCollapsedGroups();
  if (s.has(key)) s.delete(key);
  else s.add(key);
  try {
    localStorage.setItem('cwCollapsedGroups', JSON.stringify([...s]));
  } catch {
    /* localStorage unavailable - collapse is best-effort */
  }
}

function selectCoworker(folder) {
  cwState.selected = folder;
  cwState.messages = [];
  cwState.messagesHasMore = false;
  cwState.loadingOlder = false;
  cwState.threadSummaries = {};
  cwState.lastMainMessageTs = null;
  // Drop the cached overlay catalog so the editor refetches with the new
  // ?coworker= filter — otherwise the first coworker's per-coworker view
  // would stick around forever for every subsequent selection.
  cwState.availableOverlays = null;
  if (cwState.polling) {
    clearInterval(cwState.polling);
    cwState.polling = null;
  }
  // Any open thread belongs to the previous coworker — close it.
  closeThread({ silent: true });
  // Push URL state for shareable / reload-safe navigation.
  syncCwUrl();
  renderCwSidebar();
  if (folder) {
    document.getElementById('cw-chat-input-area').style.display = 'flex';
    document.getElementById('cw-detail').style.display = 'block';
    document.getElementById('cw-view-toggle').style.display = 'flex';
    // Update input placeholder based on main vs coworker
    const cwInput = document.getElementById('cw-chat-input');
    const cw = getCwCoworkers().find((c) => c.folder === folder);
    // Always reset disabled state first, then apply per-type overrides
    if (cwInput) {
      cwInput.disabled = false;
      cwInput.title = '';
    }
    const sendBtn = document.getElementById('cw-chat-send');
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.title = '';
    }

    if (cwInput && cw?.isMain) {
      cwInput.placeholder =
        'Message main \u2014 @Coworker routes directly (main skipped), plain text = main orchestrates';
      cwInput.title =
        '@Coworker = routed directly to that coworker, main never sees it\nPlain text = main picks it up and can read coworker files + send_message to coordinate';
    } else if (cwInput && cw?.routing === 'internal') {
      cwInput.placeholder = `Internal agent — message via @${cw.folder} from Orchestrator`;
      cwInput.disabled = true;
      const sendBtn = document.getElementById('cw-chat-send');
      if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.title = `Internal agent — message via @${cw.folder} from Orchestrator`;
      }
    } else if (cwInput) {
      cwInput.placeholder = 'Type a message...';
      cwInput.title = '';
      cwInput.disabled = false;
      const sendBtn = document.getElementById('cw-chat-send');
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.title = '';
      }
    }
    // Reset to chat view
    document.getElementById('cw-chat-messages').style.display = '';
    document.getElementById('cw-shell-view').style.display = 'none';
    document.getElementById('cw-work-view').style.display = 'none';
    document.querySelectorAll('.cw-toggle-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === 'chat'));
    fetchCwMessages();
    cwState.polling = setInterval(fetchCwMessages, 3000);
    updateCwDetail();
    updateCwHeader();
    // Update shell button state (don't auto-spawn — message send handles that via the message loop)
    fetch(`/api/coworkers/${encodeURIComponent(folder)}/container${currentShellThreadQuery()}`)
      .then((r) => r.json())
      .then((d) => {
        const shellBtn = document.querySelector('[data-view=shell]');
        if (shellBtn) {
          shellBtn.style.opacity = d.running ? '1' : '0.4';
          shellBtn.title = d.running ? 'Container running' : 'Send a message to start container';
        }
      })
      .catch(() => {});
  } else {
    document.getElementById('cw-chat-input-area').style.display = 'none';
    document.getElementById('cw-detail').style.display = 'none';
    document.getElementById('cw-view-toggle').style.display = 'none';
    document.getElementById('cw-shell-view').style.display = 'none';
    document.getElementById('cw-work-view').style.display = 'none';
    document.getElementById('cw-chat-messages').innerHTML =
      '<div class="cw-empty">Select a coworker from the sidebar to start chatting.</div>';
  }
}

function updateCwHeader() {
  const cw = getCwCoworkers().find((c) => c.folder === cwState.selected);
  if (!cw) return;
  document.getElementById('cw-chat-name').textContent = cw.name;
  const badge = document.getElementById('cw-chat-status');
  badge.textContent = cw.status;
  badge.style.background =
    cw.status === 'working'
      ? 'var(--green)'
      : cw.status === 'active'
        ? '#3B82F6'
        : cw.status === 'thinking'
          ? 'var(--yellow)'
          : cw.status === 'error'
            ? 'var(--red)'
            : 'var(--text-muted)';
  badge.style.color = '#fff';
}

async function fetchCwMessages(append = false) {
  if (!cwState.selected) return;
  if (append && cwState.loadingOlder) return; // re-entrancy guard
  // Capture selection at fetch start so a late-arriving response doesn't
  // mutate state for a different coworker the user has since switched to.
  const selectedAtStart = cwState.selected;
  try {
    if (append) cwState.loadingOlder = true;
    // Polling-refresh limit covers the currently-loaded row count (capped at
    // the server's 500 ceiling). This makes the polling window inclusive of
    // every paginated row, so:
    //   - server-side deletes of older rows are detected via incomingById
    //     (resolves S1: no zombies in the [0, 500] range);
    //   - rows backfilled below the previously-loaded floor surface as
    //     either incoming rows OR data.hasMore=true on the next poll
    //     (resolves S2: "Load older" can re-arm without coworker reselect).
    // Append (paginate-older) keeps the original 100 — that's the page size,
    // not a window cover.
    const fetchLimit = append ? 100 : Math.min(500, Math.max(100, cwState.messages.length));
    let url = `/api/messages?group=${encodeURIComponent(selectedAtStart)}&limit=${fetchLimit}`;
    if (append && cwState.messages.length > 0) {
      // cwState.messages is chronological (oldest first after reverse below);
      // page backwards from the oldest currently-loaded timestamp.
      const oldest = cwState.messages[0]?.timestamp;
      if (oldest) url += '&before=' + encodeURIComponent(oldest);
    }
    const res = await fetch(url);
    if (!res.ok) return;
    if (cwState.selected !== selectedAtStart) return; // user switched mid-fetch
    const data = await res.json();
    // Re-check after the parse-await: the user could have switched coworkers
    // while res.json() was streaming. Without this guard, stale polling data
    // for the previous coworker would clobber the new selection's state.
    if (cwState.selected !== selectedAtStart) return;
    // Server returns newest-first; reverse to chronological (oldest-first).
    const incoming = (data.messages || []).slice().reverse();
    if (append) {
      // Prepend older rows; dedup by id so a concurrent poll-refresh racing
      // a paginate doesn't double-render any row.
      const seen = new Set(cwState.messages.map((m) => m.id).filter(Boolean));
      const fresh = incoming.filter((m) => !m.id || !seen.has(m.id));
      cwState.messages = fresh.concat(cwState.messages);
      // Floor reached when the server reports no more rows OR when every row
      // it returned was already on the client (dedup ate them all).
      cwState.messagesHasMore = !!data.hasMore && fresh.length > 0;
    } else {
      // Polling refresh. The bumped fetchLimit above pulls every loaded row
      // (up to the 500 cap) into incoming, so the response is authoritative
      // for the [0, fetchLimit] range whenever data.hasMore=false.
      // - Authoritative (!data.hasMore): cwState becomes incoming verbatim.
      //   Any retained row absent from incomingById is treated as deleted,
      //   not "older than the window" — that closes S1 (no zombie rows).
      // - Partial (data.hasMore=true): the response covers only part of the
      //   server's row set, so we retain rows older than incomingOldestTs.
      //   This commonly fires when loaded count > 500 (server cap), but it
      //   also fires transiently when a row gets backfilled below the
      //   current floor — once that backfilled row is paginated in, the
      //   next poll's incomingOldestTs covers it and the branch quiesces.
      //   In the deep-pagination >500 case S1 zombies remain a trade-off,
      //   same as the original PR.
      const incomingById = new Map(incoming.map((m) => [m.id, m]).filter(([id]) => id));
      const incomingOldestTs = incoming[0]?.timestamp || '';
      const olderRetained = data.hasMore
        ? cwState.messages.filter((m) => {
            if (!m.id) return false; // id-less rows are recreated on each render
            if (incomingById.has(m.id)) return false; // server has fresher copy
            return !incomingOldestTs || (m.timestamp && m.timestamp < incomingOldestTs);
          })
        : [];
      cwState.messages = olderRetained.concat(incoming);
      // When the response is authoritative the load-more button is owned by
      // data.hasMore directly. When partial (loaded > 500 + rows below), the
      // load-more flow owns it; polling defers.
      if (olderRetained.length === 0) {
        cwState.messagesHasMore = !!data.hasMore;
      }
    }
    cwState.threadSummaries = data.threadSummaries || {};
    try {
      const ar = await fetch(`/api/approvals?group=${encodeURIComponent(selectedAtStart)}`);
      // Parse into a local first; only commit to the visible state if the
      // user hasn't switched coworkers while ar.json() was streaming.
      const approvals = ar.ok ? await ar.json() : [];
      if (cwState.selected === selectedAtStart) {
        cwState.pendingApprovals = approvals;
        cwState.approvalCountByFolder[selectedAtStart] = (approvals || []).length;
      }
    } catch {
      if (cwState.selected === selectedAtStart) {
        cwState.pendingApprovals = [];
        cwState.approvalCountByFolder[selectedAtStart] = 0;
      }
    }
    // Critique-gate summary for the strip above the queue. Throttled to once a
    // minute: this poll runs every 3s and the summary is a cross-instance
    // GROUP BY that does not change on that timescale.
    if (!cwState._escFetchedAt || Date.now() - cwState._escFetchedAt > 60_000) {
      cwState._escFetchedAt = Date.now();
      try {
        const er = await fetch('/api/approvals/escalations?days=14');
        cwState.escalationSummary = er.ok ? await er.json() : null;
      } catch {
        cwState.escalationSummary = null;
      }
    }
    // No auto-mark-read on coworker click. The folder-level cursor only advances
    // when the user explicitly clicks "mark all read" (or via per-session opens
    // that aggregate up). Otherwise clicking a coworker would silently mark
    // unread activity in side a2a sessions as seen, even though the user only
    // glanced at the main chat.
  } catch {
    /* ignore */
  } finally {
    // Clear the re-entrancy guard BEFORE rendering so the "Load older" button
    // exits its disabled "Loading…" state in the same tick. Failure paths
    // (`!res.ok` early-return, network catch) also reach here, so the UI
    // never gets stuck waiting for the next 3 s poll to clear it. Both the
    // clear and the render are gated on selectedAtStart so a stale append
    // response can't poison a different coworker's in-flight pagination.
    if (cwState.selected === selectedAtStart) {
      if (append) cwState.loadingOlder = false;
      renderCwMessages();
    }
  }
}

// Agent-authored reason text is unbounded — agents routinely write several
// paragraphs, and the card rendered every character, turning the approval
// queue into a wall of prose. Clamp with an inline expander.
//
// Expansion is tracked in cwState, NOT in the DOM: fetchCwMessages polls every
// 3s and re-runs renderApprovalItem for every card, so DOM-only state (a
// toggled style, a removed link) is wiped almost immediately after the click.
const REASON_CLAMP = 300;
function isReasonExpanded(id) {
  return !!(cwState.expandedReasons && cwState.expandedReasons.has(id));
}
function clampedReason(text, id) {
  const t = String(text || '');
  if (t.length <= REASON_CLAMP) return esc(t);
  if (isReasonExpanded(id)) {
    return `${esc(t)} <a href="#" class="reason-less" data-rid="${escAttr(id)}" style="font-size:9px">show less</a>`;
  }
  return `${esc(t.slice(0, REASON_CLAMP))}… <a href="#" class="reason-more" data-rid="${escAttr(id)}" style="font-size:9px">show more</a>`;
}

// Escalation provenance: how this got to a human at all. There is deliberately
// no "opens in N minutes" countdown — the gate no longer opens on a timer, so
// the useful context is what was already tried, not how long until it gives up.
function critiqueProvenance(item) {
  const bits = [];
  if (item.escalationClass === 'failed') {
    bits.push('critique ran and returned <b>must-fix</b>');
  } else if (item.selfHealAttempts) {
    bits.push(`agent asked <b>${item.selfHealAttempts}×</b> to run the critique, did not`);
  }
  if (item.denials) bits.push(`${item.denials} gate denials`);
  bits.push('gate is <b>held shut</b> until you decide');
  return `<div style="font-size:9px;color:#8b949e;margin-top:5px">${bits.join(' · ')}</div>`;
}

// One line of critique-gate context above the pending queue.
//
// Deliberately not a panel. The queue itself can't answer "is the gate
// working": /api/approvals returns only status='pending' rows and the response
// handler DELETES a row on decision, so there is no history in it — and since
// the self-heal change most escalations never become a card at all (17 of the
// first 18 were stale/missing, which now resolve with no human). The one
// number worth surfacing is enforcement releases, which are invisible
// everywhere else: a container-side fail-open never creates a card.
function renderEscalationStrip() {
  const s = cwState.escalationSummary;
  if (!s || !Array.isArray(s.totals) || s.totals.length === 0) return '';
  const by = Object.fromEntries(s.totals.map((t) => [t.event, t.n]));
  const parts = [];
  if (by.self_healed) parts.push(`${by.self_healed} self-healed`);
  if (by.carded) parts.push(`${by.carded} needed a human`);
  const released = Number(s.released) || 0;
  parts.push(
    released
      ? `<b style="color:#f85149">${released} enforcement release${released === 1 ? '' : 's'}</b>`
      : 'no enforcement releases',
  );
  return `<div style="font-size:9px;color:#8b949e;margin:0 0 6px 2px">critique gate · last ${esc(String(s.days))}d: ${parts.join(' · ')}</div>`;
}

function renderApprovalItem(item) {
  const coworkerHeader = item.coworkerName
    ? `<div style="font-size:9px;color:#10b981;font-weight:600;margin-bottom:4px">@${esc(item.coworkerName)}</div>`
    : '';
  // Clamp for the generic branches too, not just critique-gate cards: the
  // wall-of-text problem is not specific to one action — agents write
  // multi-paragraph reasons on rebuild/cli_command/install cards as well, and
  // those pushed the Approve/Reject buttons off screen. The toggle anchor is
  // appended after md() (see the return), because md() begins `let h = esc(s)`
  // and would render raw HTML embedded in the markdown string as literal text.
  const genericReasonText = String(item.reason || '');
  const genericNeedsClamp = genericReasonText.length > REASON_CLAMP;
  const genericExpanded = isReasonExpanded(item.approvalId);
  const shownGenericReason =
    genericNeedsClamp && !genericExpanded ? genericReasonText.slice(0, REASON_CLAMP) + '…' : genericReasonText;
  const safeReason = item.reason ? `\n\n*Reason:* ${esc(shownGenericReason)}` : '';
  const genericReasonToggle = genericNeedsClamp
    ? `<div style="margin-top:4px"><a href="#" class="${genericExpanded ? 'reason-less' : 'reason-more'}" data-rid="${escAttr(item.approvalId)}" style="font-size:9px">${genericExpanded ? 'show less' : 'show more'}</a></div>`
    : '';
  let desc;
  if (item.action === 'critique_gate_bypass') {
    // Critique-gate cards used to fall through to the generic branch below,
    // rendering as a bare title ("Critique gate stuck — bypass requested") —
    // no PR, no session, nothing to decide on. Everything needed to act is in
    // the payload; this branch surfaces it and links both ends.
    // Both links are built as raw anchors rather than going through md():
    // md() only linkifies http(s) URLs, so a markdown link to the hash route
    // below would render as literal "[session](...)" text.
    const prLink = item.prUrl
      ? `<a href="${escAttr(item.prUrl)}" target="_blank" rel="noopener">${esc(item.repo || '')}#${esc(item.prNumber)}</a>`
      : esc(item.repo || 'no PR mapped');
    // The coworkers router is hash-based: #/cw/<folder>/s/<sessionId>.
    const sessionLink =
      item.sessionId && item.coworkerFolder
        ? ` · <a href="#/cw/${encodeURIComponent(item.coworkerFolder)}/s/${encodeURIComponent(item.sessionId)}">session</a>`
        : item.sessionId
          ? ` · <code>${esc(item.sessionId)}</code>`
          : '';
    const surface = item.hit ? ` · blocked: ${esc(item.hit)}` : '';
    const reasonHtml = item.reason
      ? `<div style="margin-top:6px;font-size:10px"><b>Unmet:</b> ${clampedReason(item.reason, item.approvalId)}</div>`
      : '';
    return `<div class="cw-msg assistant">
    <div class="cw-msg-bubble" style="border-left:3px solid #f59e0b;padding-left:8px">
      ${coworkerHeader}
      <div style="font-weight:600">${esc(item.title || 'Critique gate')}</div>
      <div style="margin-top:4px;font-size:10px">${prLink}${sessionLink}${surface}</div>
      ${reasonHtml}
      ${critiqueProvenance(item)}
      <div style="margin-top:8px">
        <button class="approval-btn" data-qid="${esc(item.approvalId)}" data-decision="Approve" style="background:#238636;color:#fff;border:none;border-radius:3px;padding:4px 14px;margin-right:6px;cursor:pointer;font-size:10px">Approve once</button>
        <button class="approval-btn" data-qid="${esc(item.approvalId)}" data-decision="Reject" style="background:#da3633;color:#fff;border:none;border-radius:3px;padding:4px 14px;cursor:pointer;font-size:10px">Reject</button>
      </div>
    </div>
    <div class="cw-msg-time">${formatTime(item.createdAt)} <span style="font-size:7px;color:#f59e0b;font-style:italic">critique gate</span></div>
  </div>`;
  }
  if (item.action === 'stop_runaway_session') {
    // A runaway's whole harm is spend, so lead with the two facts the approver
    // needs: how much it has cost, and a door into the session. Both fall back
    // gracefully — cost is null on cost-disabled groups, and the session link
    // degrades to copyable text when the folder/id isn't resolvable.
    const cost =
      typeof item.spentUsd === 'number' && typeof item.capUsd === 'number'
        ? `<div style="margin-top:4px;font-size:13px;font-weight:700;color:#f85149">$${item.spentUsd.toFixed(2)} of $${item.capUsd.toFixed(2)}</div>`
        : '';
    // The coworkers router is hash-based: #/cw/<folder>/s/<sessionId>. Built as
    // a raw anchor (md() only linkifies http(s), so a markdown link to the hash
    // route would render as literal text).
    const sessionLink =
      item.sessionId && item.coworkerFolder
        ? `<a href="#/cw/${encodeURIComponent(item.coworkerFolder)}/s/${encodeURIComponent(item.sessionId)}">session ${esc(String(item.sessionId).slice(0, 16))}</a>`
        : item.sessionId
          ? `<code>${esc(item.sessionId)}</code>`
          : '';
    const detail = item.question
      ? `<div style="margin-top:6px;font-size:10px;color:#8b949e">${clampedReason(item.question, item.approvalId)}</div>`
      : '';
    return `<div class="cw-msg assistant">
    <div class="cw-msg-bubble" style="border-left:3px solid #f85149;padding-left:8px">
      ${coworkerHeader}
      <div style="font-weight:600">${esc(item.title || 'Possible runaway session')}</div>
      ${cost}
      ${sessionLink ? `<div style="margin-top:4px;font-size:10px">${sessionLink}</div>` : ''}
      ${detail}
      <div style="margin-top:8px">
        <button class="approval-btn" data-qid="${esc(item.approvalId)}" data-decision="Approve" style="background:#238636;color:#fff;border:none;border-radius:3px;padding:4px 14px;margin-right:6px;cursor:pointer;font-size:10px">Stop session</button>
        <button class="approval-btn" data-qid="${esc(item.approvalId)}" data-decision="Reject" style="background:#da3633;color:#fff;border:none;border-radius:3px;padding:4px 14px;cursor:pointer;font-size:10px">Keep running</button>
      </div>
    </div>
    <div class="cw-msg-time">${formatTime(item.createdAt)} <span style="font-size:7px;color:#f85149;font-style:italic">runaway</span></div>
  </div>`;
  }
  if (item.action === 'install_packages') {
    desc = `**Install packages:** ${(item.packages || []).map((p) => esc(p)).join(', ')}${safeReason}`;
  } else if (item.action === 'request_rebuild') {
    desc = `**Rebuild container**${safeReason}`;
  } else if (item.action === 'add_mcp_server') {
    desc = `**Add MCP server**${item.mcpServer ? `: \`${esc(item.mcpServer)}\`` : ''}${safeReason}`;
  } else if (item.action === 'onecli_credential') {
    const endpoint =
      item.method && item.host ? `\n\n\`${esc(item.method)} ${esc(item.host)}${esc(item.path || '')}\`` : '';
    desc = `**Credentials request**${endpoint}`;
  } else if (item.action === 'cli_command') {
    // Show the actual command and, when resolved server-side, a plain-English
    // description of what it acts on — otherwise the card is just "cli_command".
    const cmd = item.commandLine ? `\n\n\`${esc(item.commandLine)}\`` : '';
    const target = item.targetLabel ? `\n\n${esc(item.targetLabel)}` : '';
    desc = `**CLI command**${cmd}${target}${safeReason}`;
  } else {
    // Fall back to the human title (e.g. "CLI: wirings-delete") rather than the
    // raw action slug so unknown/future action types still degrade gracefully.
    desc = `**${esc(item.title || item.action)}**${safeReason}`;
  }
  const controls = `<div style="margin-top:8px">
        <button class="approval-btn" data-qid="${esc(item.approvalId)}" data-decision="Approve" style="background:#238636;color:#fff;border:none;border-radius:3px;padding:4px 14px;margin-right:6px;cursor:pointer;font-size:10px">Approve</button>
        <button class="approval-btn" data-qid="${esc(item.approvalId)}" data-decision="Reject" style="background:#da3633;color:#fff;border:none;border-radius:3px;padding:4px 14px;cursor:pointer;font-size:10px">Reject</button>
      </div>`;
  return `<div class="cw-msg assistant">
    <div class="cw-msg-bubble" style="border-left:3px solid #f59e0b;padding-left:8px">
      ${coworkerHeader}
      ${md(desc)}${genericReasonToggle}
      ${controls}
    </div>
    <div class="cw-msg-time">${formatTime(item.createdAt)} <span style="font-size:7px;color:#f59e0b;font-style:italic">approval</span></div>
  </div>`;
}

function renderCardBubble(
  m,
  { cls, monogram, authorName, time, kindLabel, coworkerLabel, threadStubHtml, isOutgoing },
) {
  const titleHtml = m.cardTitle
    ? `<div style="font-weight:600;font-size:0.8125rem;margin-bottom:4px">${esc(m.cardTitle)}</div>`
    : '';
  const descHtml = m.cardDescription
    ? `<div style="color:var(--text-muted);font-size:0.75rem;margin-bottom:6px">${md(m.cardDescription)}</div>`
    : '';
  const childrenHtml = (m.cardChildren || [])
    .filter((c) => c.type === 'text' && c.text)
    .map((c) => `<div style="margin-top:6px">${md(c.text)}</div>`)
    .join('');
  const answered = m.id && cwState._answeredCards && cwState._answeredCards[m.id];
  const inactive = isOutgoing || answered;
  const actionsHtml = answered
    ? `<div style="margin-top:4px;font-size:9px;color:#8b5cf6">(selected: ${esc(answered)})</div>`
    : isOutgoing
      ? (m.cardActions || []).length > 0
        ? `<div style="margin-top:4px;font-size:9px;color:var(--text-dim)">(awaiting response)</div>`
        : ''
      : (m.cardActions || []).length > 0
        ? `<div style="margin-top:8px">${(m.cardActions || [])
            .map(
              (a) =>
                `<button class="card-action-btn" data-action="${escAttr(a.value)}" data-label="${escAttr(a.label)}" style="background:#7c3aed;color:#fff;border:none;border-radius:3px;padding:4px 14px;margin-right:6px;margin-top:4px;cursor:pointer;font-size:10px">${esc(a.label)}</button>`,
            )
            .join('')}</div>`
        : '';
  return `<div class="cw-msg ${cls}" data-msg-id="${m.id ? esc(m.id) : ''}">
    <div class="cw-msg-avatar">${monogram}</div>
    <div class="cw-msg-header">
      <span class="cw-msg-author">${authorName}</span>
      <span class="cw-msg-time">${time}${kindLabel || ''}${coworkerLabel || ''}</span>
    </div>
    <div class="cw-msg-bubble" style="border-left:3px solid ${inactive ? '#555' : '#8b5cf6'};padding-left:8px${inactive ? ';opacity:0.7' : ''}">
      ${titleHtml}${descHtml}${childrenHtml}${actionsHtml}
    </div>
    ${threadStubHtml || ''}
  </div>`;
}

// Copy `text` to the clipboard, flashing the button label on success/failure.
// navigator.clipboard needs a secure context (https/localhost) + permission;
// fall back to a hidden-textarea execCommand copy otherwise. Shared by the main
// feed (renderCwMessages) and the thread panel (renderCwThread).
async function copyToClipboardWithFlash(btn, text, restLabel, okLabel) {
  const flash = (label) => {
    btn.textContent = label;
    setTimeout(() => {
      btn.textContent = restLabel;
    }, 1200);
  };
  try {
    await navigator.clipboard.writeText(text);
    flash(okLabel);
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      flash(okLabel);
    } catch {
      flash('✗ Failed');
    }
  }
}

// Build a shareable permalink to a message id off the current coworker/thread
// selection (mirrors syncCwUrl). msgId has no slashes, so the load-time parser
// can strip the /m/<id> anchor without colliding with slash-bearing thread ids.
function buildCwMessagePermalink(msgId) {
  let base = '';
  if (cwState.selected) {
    base = `#/cw/${encodeURIComponent(cwState.selected)}`;
    if (cwState.thread?.sessionDirect) base += `/s/${encodeURIComponent(cwState.thread.parentId)}`;
    else if (cwState.thread) base += `/t/${encodeURIComponent(cwState.thread.parentId)}`;
  }
  return `${location.origin}${location.pathname}${base}/m/${encodeURIComponent(msgId)}`;
}

// Shared click handler for the Copy / Link hover toolbar buttons. Returns true
// if it handled the event (caller should stop), false otherwise. Used by both
// the main feed and thread-panel click delegates.
function handleCwMsgActionClick(e) {
  const copyBtn = e.target.closest('.cw-copy-btn');
  if (copyBtn) {
    copyToClipboardWithFlash(copyBtn, copyBtn.dataset.copyText || '', '⧉ Copy', '✓ Copied');
    return true;
  }
  const linkBtn = e.target.closest('.cw-link-btn');
  if (linkBtn) {
    copyToClipboardWithFlash(linkBtn, buildCwMessagePermalink(linkBtn.dataset.msgId || ''), '🔗 Link', '✓ Link copied');
    return true;
  }
  return false;
}

function renderCwMessages() {
  const el = document.getElementById('cw-chat-messages');
  if (!el) return;
  // Skip rebuilds while a "Load older messages" fetch is in flight — the rebuild
  // destroys the button mid-click and the click is silently dropped.
  if (cwState.loadingOlder) return;
  const wasAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  const approvalHtml = (cwState.pendingApprovals || []).map(renderApprovalItem).join('');
  // Hide scheduled-task fires (kind='task', e.g. the recurring /supervise-issues
  // tick) and other system rows by default — they repeat on every cron tick and
  // crowd the feed. The "⚙ system" toggle in the header brings them back.
  const systemHidden = (cwState.messages || []).filter((m) => m.kind === 'task' || m.kind === 'system').length;
  const messageHtml = cwState.messages
    .filter((m) => cwState.showSystem || !(m.kind === 'task' || m.kind === 'system'))
    .map((m) => {
      const isOutgoing = m.direction === 'outgoing';
      // Agent-to-agent styling: inbound from another coworker gets its own class
      // with a green left-border bubble, mirroring the approval/question/credential
      // card pattern so the operator can tell at a glance "this didn't come from me".
      const isFromCoworker = !isOutgoing && m.senderKind === 'coworker';
      const isToCoworker = isOutgoing && m.recipientKind === 'coworker';
      const cls = isFromCoworker ? 'coworker' : isOutgoing ? 'assistant' : isToCoworker ? 'user to-coworker' : 'user';
      const time = m.timestamp ? formatTime(m.timestamp) : '';
      const text = m.displayContent || m.content || '';
      const attachmentsHtml = renderMessageAttachmentsHtml(m.attachments);
      const metaSuffix = renderMessageMetaSuffix(m);
      const isSystem = m.kind === 'task' || m.kind === 'system';
      const kindLabel =
        m.kind && m.kind !== 'chat'
          ? ` <span style="font-size:7px;color:#999;font-style:italic">${esc(m.kind)}</span>`
          : '';
      // Option C a2a inspector affordance: for "from @reviewer" bubbles the
      // sender's platform_id IS reviewer's agent_group_id, so the button
      // passes enough for the inspector to resolve reviewer's session
      // keyed on (reviewer_ag, a2a_mg, sender_thread). sender_thread is
      // taken from the current view (thread.parentId if a thread is open,
      // empty for root view).
      const a2aSourceThread = m.a2aSourceThread || m.parsedContent?._a2a_source_thread || '';
      const a2aInspectorBtn =
        isFromCoworker && m.senderCoworkerName && m.platform_id
          ? ` <button class="cw-a2a-open-btn" title="Open ${esc(m.senderCoworkerName)}'s session for this thread (read-only)" data-recipient-ag="${escAttr(m.platform_id)}" data-recipient-name="${escAttr(m.senderCoworkerName)}" data-source-thread="${escAttr(a2aSourceThread)}" style="background:transparent;border:none;color:#d97706;cursor:pointer;font-size:8px;padding:0;margin-left:4px">&#x2197; open ${esc(m.senderCoworkerName)}'s session</button>`
          : '';
      const coworkerLabel =
        isFromCoworker && m.senderCoworkerName
          ? ` <span style="font-size:7px;color:#10b981;font-style:italic">from @${esc(m.senderCoworkerName)}</span>${a2aInspectorBtn}`
          : isToCoworker && m.recipientCoworkerName
            ? ` <span style="font-size:7px;color:#10b981;font-style:italic">→ @${esc(m.recipientCoworkerName)}</span>`
            : '';
      const systemStyle = isSystem
        ? ' style="opacity:0.5;font-size:9px;border-left:2px solid #555;padding-left:6px"'
        : '';

      // NOTE on "direction": the dashboard API tags rows with
      //   direction='outgoing' ← came from messages_out.db (agent's reply)
      //   direction='incoming' ← came from messages_in.db (sent TO the agent)
      // So isOutgoing=true is the AGENT speaking; !isOutgoing is the user
      // (or another coworker via a2a). Author/monogram follow from that.
      const authorName = isOutgoing
        ? isToCoworker && m.recipientCoworkerName
          ? `${esc(cwState.selected || 'agent')} → @${esc(m.recipientCoworkerName)}`
          : esc(cwState.selected || 'agent')
        : isFromCoworker && m.senderCoworkerName
          ? `@${esc(m.senderCoworkerName)}`
          : 'You';
      const monogramSource = isOutgoing
        ? cwState.selected || 'A'
        : isFromCoworker && m.senderCoworkerName
          ? m.senderCoworkerName
          : 'You';
      const monogram = esc((monogramSource || 'A').trim().charAt(0).toUpperCase() || 'A');

      // Reply-count stub: dashboard threads key summaries by parent message id,
      // while a2a sibling/self-loop threads key by their explicit thread_id.
      const threadSummaryKey =
        (m.id && cwState.threadSummaries && cwState.threadSummaries[m.id] ? m.id : null) ||
        m.a2aSourceThread ||
        m.parsedContent?._a2a_source_thread ||
        (m.thread_id && cwState.threadSummaries && cwState.threadSummaries[m.thread_id] ? m.thread_id : null);
      const summary = threadSummaryKey && cwState.threadSummaries ? cwState.threadSummaries[threadSummaryKey] : null;
      const threadUnread = (() => {
        if (!summary?.sessionId || !summary.lastReplyTs) return 0;
        const cursor = sessionReadCursors.getFor(summary.sessionId);
        const lastMs = new Date(summary.lastReplyTs).getTime();
        return Number.isFinite(lastMs) && lastMs > cursor ? 1 : 0;
      })();
      const unreadBadge = threadUnread
        ? ` <span style="background:#3b82f6;color:#fff;font-size:8px;padding:1px 5px;border-radius:8px;margin-left:4px">new</span>`
        : '';
      const threadStubHtml = summary
        ? `<div class="cw-thread-stub" data-parent-id="${escAttr(threadSummaryKey)}" title="Open thread"><span class="cw-thread-stub-count">${summary.replyCount} repl${summary.replyCount === 1 ? 'y' : 'ies'}</span>${summary.lastReplyTs ? ` <span class="cw-thread-stub-time">· ${formatTime(summary.lastReplyTs)}</span>` : ''}${unreadBadge}</div>`
        : '';

      // Hard-hide host↔container machine traffic: cli_request and any other
      // bare system-action outbound (update_task, append_learning,
      // create_agent, schedule_task, request_restart, …) plus the cli_response
      // reply. These are JSON action envelopes the agent emits to drive the
      // host — not human-readable chat — and they flood the orchestrator feed
      // (e.g. a supervise tick emits dozens of cli_request + update_task +
      // append_learning rows). A genuine chat message carries a "text" field;
      // an action envelope is `{"action":"…"}` (or `{"type":"cli_response"…}`)
      // with no text. Hide those; keep everything with real text.
      const isCliResponse = !isOutgoing && /^\s*\{\s*"type"\s*:\s*"cli_response"/.test(text);
      const isActionEnvelope = isOutgoing && /^\s*\{\s*"action"\s*:\s*"[a-z_]+"/.test(text) && !/"text"\s*:/.test(text);
      if (isActionEnvelope || isCliResponse) return '';
      if (m.isRelay) {
        const relayLabel = m.recipientCoworkerName
          ? `${authorName} → @${esc(m.recipientCoworkerName)}`
          : `${authorName} · system action`;
        const preview = (text || '').replace(/\s+/g, ' ').trim();
        const short = preview.length > 80 ? preview.slice(0, 80) + '…' : preview;
        const expanded = cwState._expandedRelays && cwState._expandedRelays.has(m.id);
        return `<div class="cw-msg relay${expanded ? '' : ' collapsed'}" data-relay-id="${esc(m.id)}"><div class="cw-msg-avatar" style="opacity:0.4">${monogram}</div>
        <div class="cw-msg-header" onclick="var el=this.parentElement;el.classList.toggle('collapsed');var ev=new CustomEvent('relay-toggle',{detail:{id:el.dataset.relayId,open:!el.classList.contains('collapsed')}});document.dispatchEvent(ev)" style="cursor:pointer"><span class="cw-msg-author" style="opacity:0.5">${relayLabel}</span><span class="cw-msg-time">${time}</span><span style="font-size:8px;color:var(--text-dim);margin-left:6px">▸ toggle</span></div>
        <div class="cw-msg-bubble relay-preview" style="font-size:10px;color:var(--text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(short)}</div>
        <div class="cw-msg-bubble relay-full" style="display:none;opacity:0.7">${esc(text)}</div></div>`;
      }

      // Overlay event: critique-gate REFUSED a delivery marker. Server-
      // side dispatchResultText (poll-loop.ts) replaces the original
      // [Fix Report]/[Resolution]/etc. body with this exact prefix when
      // the gate fires. Yellow border + collapsed-by-default so the
      // operator immediately sees an enforcement event happened at the
      // routing layer (not just an agent reply). Same toggle machinery
      // as the relay path. Future overlay-events (buddy CONCERN injects,
      // etc.) can match additional prefixes here.
      const isOverlayEvent = isOutgoing && /^\[critique-gate\] REFUSED/.test(text);
      if (isOverlayEvent) {
        const expanded = cwState._expandedRelays && cwState._expandedRelays.has(m.id);
        const headerLabel = `⚠ critique-gate refused ${m.recipientCoworkerName ? '→ @' + esc(m.recipientCoworkerName) : ''}`;
        return `<div class="cw-msg overlay-event${expanded ? '' : ' collapsed'}" data-relay-id="${esc(m.id)}">
        <div class="cw-msg-avatar" style="background:rgba(250,204,21,0.15);color:#ca8a04">⚠</div>
        <div class="cw-msg-header" onclick="var el=this.parentElement;el.classList.toggle('collapsed');var ev=new CustomEvent('relay-toggle',{detail:{id:el.dataset.relayId,open:!el.classList.contains('collapsed')}});document.dispatchEvent(ev)" style="cursor:pointer"><span class="cw-msg-author">${headerLabel}</span><span class="cw-msg-time">${time}</span><span style="font-size:8px;color:var(--text-dim);margin-left:6px">▸ toggle</span></div>
        <div class="cw-msg-bubble relay-preview" style="font-size:10px;color:var(--text-dim);font-style:italic">delivery marker without /codex-critique — click to expand</div>
        <div class="cw-msg-bubble relay-full" style="display:none">${md(text)}</div></div>`;
      }

      if (m.cardType === 'card') {
        return renderCardBubble(m, {
          cls,
          monogram,
          authorName,
          time,
          kindLabel,
          coworkerLabel,
          threadStubHtml,
          isOutgoing,
        });
      }

      // Ask question card — render with option buttons if still pending
      if (m.cardType === 'ask_question' && m.questionId && m.options && m.options.length > 0) {
        const questionText = m.displayContent || m.content || '';
        if (m.isPending) {
          const btns = m.options
            .map((opt) => {
              const label = typeof opt === 'string' ? opt : opt.label || opt.value || String(opt);
              const value = typeof opt === 'string' ? opt : opt.value || opt.label || String(opt);
              return `<button class="question-btn" data-qid="${esc(m.questionId)}" data-option="${esc(value)}" style="background:#3B82F6;color:#fff;border:none;border-radius:3px;padding:4px 14px;margin-right:6px;margin-top:4px;cursor:pointer;font-size:10px">${esc(label)}</button>`;
            })
            .join('');
          return `<div class="cw-msg assistant">
          <div class="cw-msg-bubble" style="border-left:3px solid #3B82F6;padding-left:8px">
            ${md(questionText)}
            <div style="margin-top:8px">${btns}</div>
          </div>
          <div class="cw-msg-time">${time} <span style="font-size:7px;color:#3B82F6;font-style:italic">question</span></div>
        </div>`;
        }
        return `<div class="cw-msg assistant">
        <div class="cw-msg-bubble" style="border-left:3px solid #555;padding-left:8px;opacity:0.7">
          ${md(questionText)}
          <div style="margin-top:4px;font-size:9px;color:#666">(answered)</div>
        </div>
        <div class="cw-msg-time">${time} <span style="font-size:7px;color:#555;font-style:italic">question</span></div>
      </div>`;
      }

      // Messages from another coworker are markdown-authored just like assistant replies,
      // so render as markdown rather than escaped plain text.
      const renderAsMd = isOutgoing || isFromCoworker;
      const bubbleBody = `${text ? (renderAsMd ? md(text) : esc(text)) : ''}${attachmentsHtml}`;

      // Slack-style row: monogram avatar + header (name · time) + body.
      // Hover action toolbar — only offer "Reply in thread" when we have a
      // persisted message id (not optimistic) and it's not an approval/
      // credential/question card (those have their own buttons).
      const canReply = !!m.id && !m.optimistic;
      // Copy-to-clipboard (#632): offered on any message with text, beside Reply.
      const copyBtnHtml = text
        ? `<button class="cw-msg-action-btn cw-copy-btn" data-copy-text="${escAttr(text)}" title="Copy message">⧉ Copy</button>`
        : '';
      // Shareable permalink to this message (#/cw/<folder>[/t|s/<parent>]/m/<id>).
      const linkBtnHtml = m.id
        ? `<button class="cw-msg-action-btn cw-link-btn" data-msg-id="${esc(m.id)}" title="Copy link to this message">🔗 Link</button>`
        : '';
      const replyBtnHtml = canReply
        ? `<button class="cw-msg-action-btn cw-reply-btn" data-parent-id="${esc(m.id)}" title="Reply in thread">↳ Reply</button>`
        : '';
      const actionsHtml =
        copyBtnHtml || linkBtnHtml || replyBtnHtml
          ? `<div class="cw-msg-actions">${copyBtnHtml}${linkBtnHtml}${replyBtnHtml}</div>`
          : '';
      return `<div class="cw-msg ${cls}" data-msg-id="${esc(m.id || '')}"${systemStyle}>
      <div class="cw-msg-avatar">${monogram}</div>
      ${actionsHtml}
      <div class="cw-msg-header"><span class="cw-msg-author">${authorName}</span><span class="cw-msg-time">${time}${kindLabel}${coworkerLabel}${metaSuffix}</span></div>
      <div class="cw-msg-bubble">${bubbleBody || '<span style="color:#9ca3af">(empty message)</span>'}</div>
      ${threadStubHtml}
    </div>`;
    })
    .join('');
  // System-row toggle: shown whenever there are hidden task/system rows (or
  // they're currently visible), so the operator can flip them on/off. Click is
  // handled by the delegate below.
  const systemToggleHtml =
    systemHidden > 0 || cwState.showSystem
      ? `<div style="text-align:center;padding:4px"><button id="cw-system-toggle" class="admin-load-more" style="font-size:9px;opacity:0.7">${cwState.showSystem ? `⚙ hide system (${systemHidden})` : `⚙ show system (${systemHidden})`}</button></div>`
      : '';
  if (!approvalHtml && !messageHtml) {
    el.innerHTML = systemToggleHtml || '<div class="cw-empty">No messages yet. Send a message to start.</div>';
    return;
  }
  const approvalCount = (cwState.pendingApprovals || []).length;
  const bannerHtml =
    approvalCount > 0
      ? `<div class="approval-banner"><div class="approval-banner-label">⚠ Pending Actions (${approvalCount})</div>${renderEscalationStrip()}${approvalHtml}</div>`
      : '';
  // "Load older" button at the top — only when the server says more rows
  // exist below the loaded window AND we have at least one row to anchor a
  // `before=<oldest_ts>` cursor against.
  const loadMoreHtml =
    cwState.messagesHasMore && cwState.messages.length > 0
      ? `<button class="admin-load-more" id="cw-messages-more"${cwState.loadingOlder ? ' disabled' : ''}>${cwState.loadingOlder ? 'Loading…' : 'Load older messages'}</button>`
      : '';
  el.innerHTML = loadMoreHtml + systemToggleHtml + messageHtml + bannerHtml;

  if (!cwState._inflightApprovals) cwState._inflightApprovals = new Set();
  // Approval ids whose clamped reason the user expanded. Kept in state, not the
  // DOM, so the 3s poll's innerHTML rebuild below doesn't collapse it again.
  if (!cwState.expandedReasons) cwState.expandedReasons = new Set();
  // Event delegation: attach once on the stable parent, survives innerHTML rebuilds
  if (!el._approvalDelegateAttached) {
    el._approvalDelegateAttached = true;

    // Load-more pagination — handled on mousedown (NOT click) because the
    // 3 s polling loop calls `el.innerHTML = ...` and rebuilds the button
    // node on every tick. If a poll lands between the user's mousedown and
    // mouseup, the original button DOM node is gone, so the browser never
    // fires `click` (mousedown/mouseup must hit the same element). Acting on
    // mousedown sidesteps that contract entirely.
    const handleLoadMore = async (e) => {
      const loadMoreBtn = e.target.closest('#cw-messages-more');
      if (!loadMoreBtn) return;
      if (cwState.loadingOlder) return;
      e.preventDefault();
      // Visible feedback: flash the button blue so the operator can confirm
      // each press registered, even mid-rebuild. Removed before the fetch
      // resolves so the next render's button starts clean.
      loadMoreBtn.classList.remove('lm-flash');
      void loadMoreBtn.offsetWidth; // force reflow so re-adding restarts the animation
      loadMoreBtn.classList.add('lm-flash');
      const firstRow = el.querySelector('.cw-msg');
      const anchorId = firstRow?.dataset.msgId || null;
      const anchorOffset = firstRow ? firstRow.getBoundingClientRect().top - el.getBoundingClientRect().top : 0;
      await fetchCwMessages(true);
      if (anchorId) {
        const restored = el.querySelector(`.cw-msg[data-msg-id="${CSS.escape(anchorId)}"]`);
        if (restored) {
          const newOffset = restored.getBoundingClientRect().top - el.getBoundingClientRect().top;
          el.scrollTop += newOffset - anchorOffset;
        }
      }
    };
    el.addEventListener('mousedown', handleLoadMore);
    // Touch + keyboard parity: tapping on mobile and Enter/Space focus-then-press
    // both arrive as `click` (no preceding mousedown), so keep a click branch
    // for those paths. The cwState.loadingOlder guard above dedupes against
    // a same-gesture mousedown that already fired the fetch.
    el.addEventListener('click', handleLoadMore);

    el.addEventListener('click', async (e) => {
      // The load-more branch is handled by handleLoadMore above (mousedown +
      // click). Skip it here to avoid double-firing.
      if (e.target.closest('#cw-messages-more')) return;
      // ── System-row toggle (hide/show scheduled-task + system messages) ──
      if (e.target.closest('#cw-system-toggle')) {
        cwState.showSystem = !cwState.showSystem;
        renderCwMessages();
        return;
      }
      // ── Copy message (#632) / shareable permalink (#635) ──
      if (handleCwMsgActionClick(e)) return;
      // ── Reply-in-thread hover button or reply-count stub ──
      const replyBtn = e.target.closest('.cw-reply-btn, .cw-thread-stub');
      if (replyBtn) {
        const parentId = replyBtn.dataset.parentId;
        if (parentId) {
          const ts = cwState.threadSummaries && cwState.threadSummaries[parentId];
          if (ts?.sessionId) sessionReadCursors.markRead(ts.sessionId);
          openThread(parentId);
        }
        return;
      }
      // ── a2a read-only inspector (Option C) ──
      const a2aBtn = e.target.closest('.cw-a2a-open-btn');
      if (a2aBtn) {
        const recipientAg = a2aBtn.dataset.recipientAg;
        const recipientName = a2aBtn.dataset.recipientName || 'coworker';
        if (recipientAg) {
          // Use only the explicit data attribute. Older fallback to parentId
          // was wrong — parentId is a MESSAGE id (msg-...), not a thread id;
          // it never matches a2a_session_sources.source_thread_id.
          // Empty string is fine — the server's null/empty branch finds the
          // most recent a2a session for this recipient.
          const senderThreadId = a2aBtn.dataset.sourceThread || '';
          openA2aInspector({ recipientAgGroupId: recipientAg, senderThreadId, recipientName });
        }
        return;
      }
      // ── "show more" / "show less" on a clamped approval reason ──
      // Toggle state lives in cwState so the 3s message poll's re-render keeps
      // the reason open; mutating the DOM here would be undone within seconds.
      const reasonToggle = e.target.closest('.reason-more, .reason-less');
      if (reasonToggle) {
        e.preventDefault();
        const rid = reasonToggle.dataset.rid;
        if (!cwState.expandedReasons) cwState.expandedReasons = new Set();
        if (reasonToggle.classList.contains('reason-less')) cwState.expandedReasons.delete(rid);
        else cwState.expandedReasons.add(rid);
        renderCwMessages();
        return;
      }
      // ── Approval buttons ──
      const approvalBtn = e.target.closest('.approval-btn');
      if (approvalBtn) {
        const qid = approvalBtn.dataset.qid;
        const decision = approvalBtn.dataset.decision;
        if (!qid || !decision) return;
        if (cwState._inflightApprovals.has(qid)) return;
        cwState._inflightApprovals.add(qid);
        const card = approvalBtn.closest('.cw-msg');
        const allBtns = card ? card.querySelectorAll('.approval-btn') : [approvalBtn];
        allBtns.forEach((b) => {
          b.disabled = true;
        });
        approvalBtn.textContent = 'Submitting…';
        try {
          const res = await fetch('/api/approvals/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ approvalId: qid, decision }),
          });
          if (res.ok) {
            const btnRow = approvalBtn.closest('div');
            if (btnRow) {
              const color = decision === 'Approve' ? '#238636' : '#da3633';
              const label = decision === 'Approve' ? 'Approved' : 'Rejected';
              btnRow.innerHTML = `<span style="font-size:10px;color:${color};font-weight:600">${label}</span>`;
            }
          } else {
            const errData = await res.json().catch(() => ({}));
            approvalBtn.textContent = errData.error || 'Error';
            allBtns.forEach((b) => {
              b.disabled = false;
            });
          }
        } catch {
          approvalBtn.textContent = 'Error';
          allBtns.forEach((b) => {
            b.disabled = false;
          });
        } finally {
          setTimeout(() => {
            cwState._inflightApprovals.delete(qid);
            fetchCwMessages();
          }, 1000);
        }
        return;
      }

      // ── Question option buttons ──
      const questionBtn = e.target.closest('.question-btn');
      if (questionBtn) {
        const qid = questionBtn.dataset.qid;
        const option = questionBtn.dataset.option;
        if (!qid || !option) return;
        if (cwState._inflightApprovals.has(qid)) return;
        cwState._inflightApprovals.add(qid);
        const card = questionBtn.closest('.cw-msg');
        const allBtns = card ? card.querySelectorAll('.question-btn') : [questionBtn];
        allBtns.forEach((b) => {
          b.disabled = true;
        });
        questionBtn.textContent = 'Submitting…';
        try {
          const res = await fetch('/api/questions/respond', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questionId: qid, selectedOption: option }),
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            questionBtn.textContent = errData.error || 'Error';
            allBtns.forEach((b) => {
              b.disabled = false;
            });
          }
        } catch {
          questionBtn.textContent = 'Error';
          allBtns.forEach((b) => {
            b.disabled = false;
          });
        } finally {
          setTimeout(() => {
            cwState._inflightApprovals.delete(qid);
            fetchCwMessages();
          }, 1000);
        }
        return;
      }
    });
  }
  const recentHooks = (state.hookEvents || []).filter(
    (e) => e.group === cwState.selected && Date.now() - e.timestamp < 10000,
  );
  if (recentHooks.length > 0) {
    el.innerHTML +=
      '<div class="cw-msg assistant"><div class="cw-msg-bubble" style="opacity:0.5"><span class="chat-typing"><span></span><span></span><span></span></span></div></div>';
  }
  if (wasAtBottom) el.scrollTop = el.scrollHeight;
}

/**
 * Ensure a container is running for the selected coworker.
 * If not running, requests an interactive spawn (resumes existing session
 * without triggering a query) and waits for it to come up.
 * Returns true if container is running, false if spawn failed.
 */
async function ensureContainerRunning(folder) {
  try {
    const res = await fetch(`/api/coworkers/${encodeURIComponent(folder)}/container${currentShellThreadQuery()}`);
    const data = await res.json();
    if (data.running) return true;

    // Request interactive spawn
    const spawnRes = await fetch(`/api/coworkers/${encodeURIComponent(folder)}/spawn-interactive`, { method: 'POST' });
    if (!spawnRes.ok) return false;

    // Poll until container appears (max 15s)
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const check = await fetch(`/api/coworkers/${encodeURIComponent(folder)}/container${currentShellThreadQuery()}`);
      const status = await check.json();
      if (status.running) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Shared send helper. `threadId` is the Slack-style thread id (= parent
 * message id). null/undefined routes to the root session.
 */
async function sendMessage({ group, content, threadId = null, parentMessage = null, optimisticBucket }) {
  // direction='incoming': user messages land in messages_in.db when
  // persisted, so the optimistic row needs to match that for both the
  // author renderer (shows "You" on !isOutgoing) and the dedupe matcher
  // below to identify its server twin when it arrives.
  const optimistic = {
    id: null,
    optimistic: true,
    content,
    direction: 'incoming',
    sender: 'web@dashboard',
    sender_name: 'Dashboard',
    is_from_me: 0,
    is_bot_message: 0,
    timestamp: new Date().toISOString(),
    thread_id: threadId,
  };
  optimisticBucket.push(optimistic);
  if (threadId) renderCwThread();
  else renderCwMessages();
  try {
    const body = { group, content };
    if (threadId) body.thread_id = threadId;
    // parent_message seeds the new per-thread session with the message the
    // user replied to, so the agent has the conversation's immediate context.
    // Only sent on the first reply in a thread — on subsequent replies the
    // session already exists and its inbound.db has history.
    if (parentMessage) body.parent_message = parentMessage;
    const res = await fetch('/api/chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const idx = optimisticBucket.indexOf(optimistic);
      if (idx >= 0) optimisticBucket.splice(idx, 1);
      if (threadId) renderCwThread();
      else renderCwMessages();
      let err = 'Failed to send message';
      try {
        err = (await res.json()).error || err;
      } catch {
        /* ignore */
      }
      alert(err);
      return false;
    }
    if (threadId) fetchCwThread(threadId);
    else fetchCwMessages();
    return true;
  } catch (e) {
    const idx = optimisticBucket.indexOf(optimistic);
    if (idx >= 0) optimisticBucket.splice(idx, 1);
    if (threadId) renderCwThread();
    else renderCwMessages();
    alert('Failed to send message: ' + e.message);
    return false;
  }
}

async function sendCwMessage() {
  const input = document.getElementById('cw-chat-input');
  const content = input.value.trim();
  if (!cwState.selected || !content) return;
  input.value = '';
  await sendMessage({ group: cwState.selected, content, optimisticBucket: cwState.messages });
}

async function sendCwThreadMessage() {
  const input = document.getElementById('cw-thread-input-text');
  if (!input) return;
  const content = input.value.trim();
  if (!cwState.selected || !cwState.thread || !content) return;
  input.value = '';
  // First reply in a thread: ship the parent message so the server can seed
  // it into the new per-thread session's inbound.db before the user's turn.
  // Server ignores parent_message when the session already exists.
  let parentMessage = null;
  const isFirstReply = (cwState.thread.messages || []).length === 0;
  const snap = cwState.thread.parentSnapshot;
  if (isFirstReply && snap) {
    const text = (snap.displayContent || snap.content || '').toString();
    if (text) {
      const sender =
        snap.direction === 'outgoing'
          ? cwState.selected || 'agent'
          : snap.senderCoworkerName
            ? `@${snap.senderCoworkerName}`
            : 'You';
      parentMessage = {
        content: text,
        timestamp: snap.timestamp || null,
        sender,
        direction: snap.direction === 'outgoing' ? 'outgoing' : 'incoming',
      };
    }
  }
  // sessionDirect → /api/chat/send-to-session (writes directly to the
  // session's inbound.db, bypassing messaging-group routing). Without this,
  // sends from a root a2a session (thread_id=null) misroute to the coworker's
  // main dashboard session because /api/chat/send keys on (channel, thread).
  if (cwState.thread.sessionDirect) {
    await sendToSessionDirect({
      sessionId: cwState.thread.parentId,
      content,
      parentMessage,
      optimisticBucket: cwState.thread.messages,
    });
    return;
  }
  await sendMessage({
    group: cwState.selected,
    content,
    threadId: cwState.thread.parentId,
    parentMessage,
    optimisticBucket: cwState.thread.messages,
  });
}

async function sendToSessionDirect({ sessionId, content, parentMessage, optimisticBucket }) {
  const optimistic = {
    id: null,
    optimistic: true,
    content,
    direction: 'incoming',
    sender: 'web@dashboard',
    sender_name: 'Dashboard',
    is_from_me: 0,
    is_bot_message: 0,
    timestamp: new Date().toISOString(),
  };
  optimisticBucket.push(optimistic);
  renderCwThread();
  try {
    const body = { session_id: sessionId, content };
    if (parentMessage) body.parent_message = parentMessage;
    const res = await fetch('/api/chat/send-to-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const idx = optimisticBucket.indexOf(optimistic);
      if (idx >= 0) optimisticBucket.splice(idx, 1);
      renderCwThread();
      let err = 'Failed to send message';
      try {
        err = (await res.json()).error || err;
      } catch {
        /* ignore */
      }
      alert(err);
      return false;
    }
    return true;
  } catch (err) {
    const idx = optimisticBucket.indexOf(optimistic);
    if (idx >= 0) optimisticBucket.splice(idx, 1);
    renderCwThread();
    alert(`Failed to send: ${err.message || err}`);
    return false;
  }
}

function openThread(parentId, opts = {}) {
  if (!cwState.selected || !parentId) return;
  const isSessionDirect = !!opts.sessionDirect;
  // Snapshot the parent message from the current main view for the header.
  const parentSnapshot = isSessionDirect ? null : (cwState.messages || []).find((m) => m.id === parentId) || null;
  if (cwState.thread?.polling) clearInterval(cwState.thread.polling);
  cwState.thread = {
    parentId,
    parentSnapshot,
    messages: [],
    polling: null,
    sessionDirect: isSessionDirect,
    // When a session-direct view was opened from a thread tile, remember the
    // originating thread_id so the header can show the thread title (not a2a
    // chrome) and the URL can keep a stable /t/ deep-link.
    threadId: opts.threadId || null,
    // Swim-lane mode: render the shared-thread union across all coworkers.
    // parentId is the thread_id in this mode.
    lane: !!opts.lane,
    lanes: [],
    hasMore: false,
    loadingOlder: false,
  };
  const panel = document.getElementById('cw-thread-panel');
  if (panel) panel.style.display = 'flex';
  // Show the reply composer for both threaded and a2a (sessionDirect) views.
  // Admin opens their own coworker's a2a sessions to interject — typing here
  // lands in this session's inbound.db so the agent picks it up like any DM.
  // (The cross-coworker peer inspector uses a different panel entirely and
  // remains read-only — see openA2aInspector / cw-a2a-inspector-panel.)
  const inputArea = panel?.querySelector('.cw-thread-input');
  if (inputArea) inputArea.style.display = '';
  // The dashboard's detail panel and thread panel fight for the same slot —
  // hide detail while the thread is open to avoid a squeezed layout.
  const detail = document.getElementById('cw-detail');
  if (detail && detail.style.display !== 'none') {
    detail.dataset.wasVisible = '1';
    detail.style.display = 'none';
  }
  renderCwThread(); // render placeholder immediately
  fetchCwThread(parentId);
  cwState.thread.polling = setInterval(() => {
    if (cwState.thread) fetchCwThread(cwState.thread.parentId);
  }, 3000);
  syncCwUrl();
}

function closeThread({ silent = false } = {}) {
  if (cwState.thread?.polling) clearInterval(cwState.thread.polling);
  cwState.thread = null;
  const panel = document.getElementById('cw-thread-panel');
  if (panel) panel.style.display = 'none';
  const coworkers = document.getElementById('coworkers');
  if (coworkers) coworkers.classList.remove('cw-thread-fullscreen');
  const detail = document.getElementById('cw-detail');
  if (detail && detail.dataset.wasVisible === '1') {
    detail.style.display = 'block';
    delete detail.dataset.wasVisible;
  }
  if (!silent) syncCwUrl();
}

/**
 * Option C read-only inspector for a2a delegations. Opens on demand
 * from "from @reviewer" bubbles and fetches the recipient's own
 * inbound/outbound for the keyed per-thread session. Shares the
 * right-side slot with the thread panel and detail panel; whichever
 * is open is stashed so closing the inspector restores it.
 */
function openA2aInspector({ recipientAgGroupId, senderThreadId, recipientName }) {
  const panel = document.getElementById('cw-a2a-inspector-panel');
  if (!panel) return;
  cwState.a2aInspector = { recipientAgGroupId, senderThreadId, recipientName, session: null, messages: [] };
  // Share the slot with the thread panel and detail panel. Hide
  // whichever is open so the inspector can take the slot without a
  // squeezed 3-way layout; remember to restore them on close.
  const threadPanel = document.getElementById('cw-thread-panel');
  if (threadPanel && threadPanel.style.display !== 'none') {
    threadPanel.dataset.wasVisible = '1';
    threadPanel.style.display = 'none';
  }
  const detail = document.getElementById('cw-detail');
  if (detail && detail.style.display !== 'none') {
    detail.dataset.wasVisibleA2a = '1';
    detail.style.display = 'none';
  }
  panel.style.display = 'flex';
  const title = document.getElementById('cw-a2a-inspector-title');
  if (title) title.textContent = `@${recipientName} session`;
  const label = document.getElementById('cw-a2a-inspector-label');
  if (label) label.textContent = senderThreadId ? `thread ${String(senderThreadId).slice(0, 12)}` : 'root session';
  const msgsEl = document.getElementById('cw-a2a-inspector-messages');
  if (msgsEl) msgsEl.innerHTML = '<div class="cw-a2a-inspector-empty">Loading…</div>';
  fetchA2aInspector();
}

function closeA2aInspector() {
  cwState.a2aInspector = null;
  const panel = document.getElementById('cw-a2a-inspector-panel');
  if (panel) panel.style.display = 'none';
  const threadPanel = document.getElementById('cw-thread-panel');
  if (threadPanel && threadPanel.dataset.wasVisible === '1') {
    threadPanel.style.display = 'flex';
    delete threadPanel.dataset.wasVisible;
  }
  const detail = document.getElementById('cw-detail');
  if (detail && detail.dataset.wasVisibleA2a === '1') {
    detail.style.display = 'block';
    delete detail.dataset.wasVisibleA2a;
  }
}

async function fetchA2aInspector() {
  const st = cwState.a2aInspector;
  if (!st) return;
  const qs = new URLSearchParams();
  qs.set('recipient_agent_group_id', st.recipientAgGroupId);
  if (st.senderThreadId) qs.set('sender_thread', st.senderThreadId);
  try {
    const res = await fetch(`/api/a2a-session?${qs.toString()}`);
    const msgsEl = document.getElementById('cw-a2a-inspector-messages');
    if (!msgsEl) return;
    if (res.status === 404) {
      msgsEl.innerHTML =
        '<div class="cw-a2a-inspector-empty">No recipient session exists yet for this thread. The delegation may not have landed, or the reviewer hasn\'t processed it yet.</div>';
      return;
    }
    if (!res.ok) {
      msgsEl.innerHTML = `<div class="cw-a2a-inspector-empty">Error loading session (${res.status}).</div>`;
      return;
    }
    const data = await res.json();
    st.session = data.session;
    st.messages = data.messages || [];
    renderA2aInspector();
  } catch (err) {
    const msgsEl = document.getElementById('cw-a2a-inspector-messages');
    if (msgsEl)
      msgsEl.innerHTML = `<div class="cw-a2a-inspector-empty">Error loading session: ${esc(String(err.message || err))}</div>`;
  }
}

function renderA2aInspector() {
  const st = cwState.a2aInspector;
  if (!st) return;
  const msgsEl = document.getElementById('cw-a2a-inspector-messages');
  if (!msgsEl) return;
  const label = document.getElementById('cw-a2a-inspector-label');
  if (label && st.session) {
    label.textContent = sessionLabelWithTitle(st.session.id, st.session.thread_id);
    label.title = `session=${st.session.id}\nthread_id=${st.session.thread_id ?? '(root)'}`;
  }
  // Oldest-first in the read-only pane (more natural to read top-down).
  const ordered = (st.messages || []).slice().reverse();
  if (ordered.length === 0) {
    msgsEl.innerHTML = '<div class="cw-a2a-inspector-empty">Session exists but has no messages yet.</div>';
    return;
  }
  msgsEl.innerHTML = ordered
    .map((m) => {
      // direction here is from the RECIPIENT's point of view:
      //   incoming = the @sender posted it into the recipient's session
      //   outgoing = the recipient (reviewer) replied
      const isOutgoing = m.direction === 'outgoing';
      const cls = isOutgoing ? 'assistant' : 'coworker';
      const time = m.timestamp ? formatTime(m.timestamp) : '';
      // content from session DBs is usually a JSON envelope — reuse the
      // same display-content normalization the main chat view does so
      // the text renders instead of a JSON blob.
      let text = '';
      try {
        const parsed = JSON.parse(m.content || '');
        text = parsed?.text || parsed?.content || m.content || '';
      } catch {
        text = m.content || '';
      }
      const authorName = isOutgoing ? esc(st.recipientName || 'recipient') : `@${esc(cwState.selected || 'sender')}`;
      const monogramSource = isOutgoing ? st.recipientName || 'R' : cwState.selected || 'S';
      const monogram = esc((monogramSource || 'A').trim().charAt(0).toUpperCase() || 'A');
      return `<div class="cw-msg ${cls}"><div class="cw-msg-avatar">${monogram}</div>
      <div class="cw-msg-header"><span class="cw-msg-author">${authorName}</span><span class="cw-msg-time">${time}</span></div>
      <div class="cw-msg-bubble">${text ? md(text) : '<span style="color:#9ca3af">(empty)</span>'}</div></div>`;
    })
    .join('');
  msgsEl.scrollTop = msgsEl.scrollHeight;
}

async function fetchCwThread(parentId, append = false) {
  if (!cwState.selected || !cwState.thread || cwState.thread.parentId !== parentId) return;
  if (append && cwState.thread.loadingOlder) return;
  // Capture the thread identity at fetch start; a late-arriving response
  // shouldn't mutate state for a thread the user has since closed/switched.
  const selectedAtStart = cwState.selected;
  try {
    if (append) cwState.thread.loadingOlder = true;
    // Swim-lane (shared-thread) view: request the cross-coworker union for this
    // thread_id with lane=1 so the server returns every participant's rows plus
    // the ordered `lanes` list. Otherwise the normal session/thread query.
    const queryParam = cwState.thread.lane
      ? `thread_id=${encodeURIComponent(parentId)}&lane=1`
      : cwState.thread.sessionDirect
        ? `session_id=${encodeURIComponent(parentId)}`
        : `thread_id=${encodeURIComponent(parentId)}`;
    // Polling-refresh limit covers the currently-loaded persisted row count
    // (capped at the server's 500 ceiling). See fetchCwMessages above for
    // the S1/S2 rationale — same trade-off, capped window covers backfills
    // and detects deletes within [0, 500].
    const persistedCount = (cwState.thread.messages || []).filter((m) => !m.optimistic).length;
    const fetchLimit = append ? 200 : Math.min(500, Math.max(200, persistedCount));
    let url = `/api/messages?group=${encodeURIComponent(selectedAtStart)}&${queryParam}&limit=${fetchLimit}`;
    if (append) {
      // Page backwards from the oldest persisted (non-optimistic) row in view.
      const persisted = (cwState.thread.messages || []).filter((m) => !m.optimistic && m.timestamp);
      const oldest = persisted[0]?.timestamp;
      if (oldest) url += '&before=' + encodeURIComponent(oldest);
    }
    const res = await fetch(url);
    if (!res.ok) return;
    // If the user closed the thread or switched coworkers mid-fetch, drop the
    // response on the floor.
    if (!cwState.thread || cwState.thread.parentId !== parentId || cwState.selected !== selectedAtStart) return;
    const data = await res.json();
    // Re-check identity after the parse-await — same race protection as the
    // pre-parse guard above, repeated because res.json() is also async.
    if (!cwState.thread || cwState.thread.parentId !== parentId || cwState.selected !== selectedAtStart) return;
    // Capture the ordered lane list for the swim-lane renderer (server only
    // emits it in lane mode).
    if (cwState.thread.lane && Array.isArray(data.lanes)) cwState.thread.lanes = data.lanes;
    const incoming = (data.messages || []).slice().reverse();
    // Preserve locally-pushed optimistic messages UNTIL their persisted
    // twin arrives. Heuristic: drop an optimistic row once the server
    // returns any outgoing thread row with identical content within 30 s
    // of the optimistic timestamp. Also drop optimistic rows older than
    // 60 s so a failed round-trip doesn't stick forever.
    const OPTIMISTIC_MAX_AGE_MS = 60_000;
    const MATCH_WINDOW_MS = 30_000;
    const now = Date.now();
    const matched = (opt) => {
      const optTs = Date.parse(opt.timestamp);
      if (!Number.isFinite(optTs)) return false;
      if (now - optTs > OPTIMISTIC_MAX_AGE_MS) return true; // expire
      // Server-returned rows go through normalizeMessageForDisplay which
      // may set displayContent to an unwrapped string while raw content
      // stays JSON; the optimistic row is plain text. Compare via the
      // same displayContent || content fallback the renderer uses.
      const optText = opt.displayContent || opt.content || '';
      return incoming.some((m) => {
        if (m.direction !== 'incoming') return false;
        const mText = m.displayContent || m.content || '';
        if (mText !== optText) return false;
        const mTs = Date.parse(m.timestamp);
        return Number.isFinite(mTs) && Math.abs(mTs - optTs) <= MATCH_WINDOW_MS;
      });
    };
    const pending = cwState.thread.messages.filter((m) => m.optimistic && !matched(m));
    if (append) {
      // Prepend older rows to existing persisted ones; dedup by id.
      const existing = cwState.thread.messages.filter((m) => !m.optimistic);
      const seen = new Set(existing.map((m) => m.id).filter(Boolean));
      const fresh = incoming.filter((m) => !m.id || !seen.has(m.id));
      cwState.thread.messages = fresh.concat(existing).concat(pending);
      cwState.thread.hasMore = !!data.hasMore && fresh.length > 0;
    } else {
      // Polling refresh. Same authoritative/partial split as fetchCwMessages:
      // when data.hasMore=false the bumped fetchLimit covers every loaded
      // persisted row, so absent ids are treated as deletes (closes S1).
      // When data.hasMore=true the response is partial — commonly because
      // the loaded thread exceeds the 500 cap, but also when a row was
      // backfilled below the current floor. Retained rows older than
      // incomingOldestTs cover both cases; the deep-pagination >500 case
      // keeps the residual zombie trade-off documented above.
      const incomingById = new Map(incoming.map((m) => [m.id, m]).filter(([id]) => id));
      const incomingOldestTs = incoming[0]?.timestamp || '';
      const olderRetained = data.hasMore
        ? cwState.thread.messages.filter((m) => {
            if (m.optimistic || !m.id) return false;
            if (incomingById.has(m.id)) return false;
            return !incomingOldestTs || (m.timestamp && m.timestamp < incomingOldestTs);
          })
        : [];
      cwState.thread.messages = olderRetained.concat(incoming).concat(pending);
      // Same hasMore ownership rule as the main view: authoritative response
      // → adopt server's flag; partial → load-more flow owns it.
      if (olderRetained.length === 0) {
        cwState.thread.hasMore = !!data.hasMore;
      }
    }
  } catch {
    /* ignore */
  } finally {
    // Clear the re-entrancy guard BEFORE rendering so the "Load older" button
    // exits its disabled "Loading…" state in the same tick — including on
    // failure paths where the success-side render would otherwise be skipped.
    // Guard render against mid-fetch thread switches: only repaint if the
    // captured (parentId, coworker) identity still matches.
    if (append && cwState.thread && cwState.thread.parentId === parentId && cwState.selected === selectedAtStart) {
      cwState.thread.loadingOlder = false;
    }
    if (cwState.thread && cwState.thread.parentId === parentId && cwState.selected === selectedAtStart) {
      renderCwThread();
    }
  }
}

function renderCwThread() {
  if (!cwState.thread) return;
  // Skip rebuilds while a "Load older messages" fetch is in flight — the rebuild
  // destroys the button mid-click and the click is silently dropped. Mirrors
  // the same guard in renderCwMessages above.
  if (cwState.thread.loadingOlder) return;
  const t = cwState.thread;
  const parentEl = document.getElementById('cw-thread-parent');
  const parentLabel = document.getElementById('cw-thread-parent-label');
  const msgsEl = document.getElementById('cw-thread-messages');
  // Derive the thread's NanoClaw session id from any message row (server
  // tags each row with session_id). Slug by session id, not parentId, so
  // this label matches the same session's label in the Timeline dropdown
  // and the detail panel. Fall back to parentId slug if the thread is
  // newly opened with no persisted messages yet.
  const matchingNano = t.sessionDirect
    ? (cachedSessions || []).find((s) => s.nanoclaw_session_id === t.parentId && s.group_folder === cwState.selected)
    : (cachedSessions || []).find((s) => s.thread_id === t.parentId && s.group_folder === cwState.selected);
  const sessionIdForSlug =
    matchingNano?.nanoclaw_session_id || (t.messages || []).find((m) => m.session_id)?.session_id || t.parentId;
  // A session opened from a thread tile is sessionDirect (scoped to one exact
  // session) but is NOT necessarily an a2a peer session — a GitHub webhook
  // session is a normal thread. Gate a2a chrome on the real signal (a2a_peer),
  // or a genuine peer-inspector open (sessionDirect with no originating thread).
  const isA2aThread = !t.lane && (!!matchingNano?.a2a_peer || (t.sessionDirect && !t.threadId));
  // The thread_id this view is anchored to: in lane mode it's parentId; for a
  // session-direct open the carried-through tile thread; else parentId.
  const anchorThreadId = t.lane
    ? t.parentId
    : t.threadId || (t.sessionDirect ? matchingNano?.thread_id || null : t.parentId);
  // Offer the swim-lane on any thread spanning ≥2 coworkers (not just gh-*).
  // The server's lane=1 union is thread-agnostic; the only gate is presentational.
  // Count distinct coworkers (group_folder) with an active session on this exact
  // thread_id from the already-loaded session list. gh-issue/pr chains are the
  // common multi-coworker case, but worktree-cleanup / reinforcement / dashboard
  // a2a threads fan out across coworkers too and benefit identically.
  const laneEligible =
    typeof anchorThreadId === 'string' &&
    anchorThreadId.length > 0 &&
    new Set(
      (cachedSessions || []).filter((s) => s.thread_id === anchorThreadId && s.group_folder).map((s) => s.group_folder),
    ).size > 1;
  if (parentLabel) {
    const labelText = t.lane ? anchorThreadId : sessionLabelWithTitle(sessionIdForSlug, anchorThreadId || t.parentId);
    const badge = isA2aThread
      ? '<span style="font-size:7px;background:#7c3aed;color:#fff;padding:1px 4px;border-radius:3px;margin-right:4px;vertical-align:middle;letter-spacing:.03em">a2a</span>'
      : t.lane
        ? '<span style="font-size:7px;background:#0ea5e9;color:#fff;padding:1px 4px;border-radius:3px;margin-right:4px;vertical-align:middle;letter-spacing:.03em">shared</span>'
        : '';
    parentLabel.innerHTML = `${badge}${esc(labelText)}`;
    parentLabel.title = `${t.lane ? 'shared thread across coworkers\n' : ''}session=${sessionIdForSlug}${isA2aThread ? ' (a2a read-only)' : anchorThreadId ? `\nthread_id=${anchorThreadId}` : ''}`;
  }
  const titleEl = document.querySelector('#cw-thread-panel .cw-thread-title strong');
  if (titleEl) titleEl.textContent = t.lane ? 'Shared thread' : isA2aThread ? 'A2A Session' : 'Thread';
  const actionsEl = document.getElementById('cw-thread-actions');
  if (actionsEl) {
    let actionsHtml = '';
    // Swim-lane toggle: shown on any thread that spans ≥2 coworkers. In lane
    // mode → switch back to the single-session view; in single view → open the
    // shared swim-lane across all coworkers on this thread. Always show it in
    // lane mode itself (so the toggle-off control is reachable even if the
    // session list momentarily lags).
    if (laneEligible || t.lane) {
      const tid = escAttr(anchorThreadId);
      // Icon-only to save header space; the title tooltip carries the meaning.
      actionsHtml += t.lane
        ? `<button class="session-icon-btn active" title="Showing all coworkers (swim-lane) — click for single session" data-thread-lane-off="${tid}">⇄</button>`
        : `<button class="session-icon-btn" title="Show this thread across all coworkers (swim-lane)" data-thread-lane-on="${tid}">⇄</button>`;
    }
    if (!t.lane && matchingNano && matchingNano.nanoclaw_session_id) {
      const sid = escAttr(matchingNano.nanoclaw_session_id);
      const agid = escAttr(matchingNano.agent_group_id || '');
      const tgrp = escAttr(cwState.selected || '');
      const currentTitle = matchingNano.display_title || '';
      const isPinned = !!matchingNano.pinned_at;
      actionsHtml +=
        `<button class="session-icon-btn${isPinned ? ' active' : ''}" title="${isPinned ? 'Unpin session' : 'Pin session'}" data-pin-session="${sid}" data-pin-on="${isPinned ? '0' : '1'}">📌</button>` +
        `<button class="session-icon-btn" title="Rename this session" data-rename-session="${sid}" data-rename-current="${escAttr(currentTitle)}">✎</button>` +
        `<button class="session-icon-btn" title="Open in Timeline" data-view-nanoclaw-session="${sid}" data-view-nanoclaw-agid="${agid}" data-view-session-group="${tgrp}">≡</button>`;
    }
    actionsEl.innerHTML = actionsHtml;
  }
  if (parentEl) {
    if (t.parentSnapshot) {
      const p = t.parentSnapshot;
      const pText = p.displayContent || p.content || '';
      const pIsOutgoing = p.direction === 'outgoing';
      // 'outgoing' = messages_out = agent reply → coworker folder as author.
      // !outgoing = user or a2a sender → "You" or "@coworker".
      const pAuthor = pIsOutgoing
        ? esc(cwState.selected || 'agent')
        : p.senderCoworkerName
          ? `@${esc(p.senderCoworkerName)}`
          : 'You';
      const pBody = tryRenderWebhookEnvelope(pText) || md(pText);
      parentEl.innerHTML = `<div class="parent-author">${pAuthor} <span style="color:var(--text-muted);font-weight:400">· ${p.timestamp ? formatTime(p.timestamp) : ''}</span></div>
        <div class="parent-body">${pBody}</div>`;
    } else if (isA2aThread) {
      parentEl.innerHTML =
        '<div class="parent-body" style="color:var(--text-muted);font-style:italic">Agent-to-agent session (read-only)</div>';
    } else {
      parentEl.innerHTML = '<div class="parent-body" style="color:var(--text-muted)">(parent message)</div>';
    }
  }
  if (!msgsEl) return;
  const wasAtBottom = msgsEl.scrollHeight - msgsEl.scrollTop - msgsEl.clientHeight < 60;
  const renderThreadMsg = (m) => {
    // Seed rows (written by router.ts into inbound.db when a new per-thread
    // session is minted) carry a `direction` inside their parsed content to
    // override the table-based default. Without this override, an agent's
    // own prior reply — stored in inbound.db for context — would render as
    // "You" in the thread panel. See src/router.ts seed block.
    const seededDirection =
      m.parsedContent && (m.parsedContent.direction === 'outgoing' || m.parsedContent.direction === 'incoming')
        ? m.parsedContent.direction
        : null;
    const effectiveDirection = seededDirection || m.direction;
    const isOutgoing = effectiveDirection === 'outgoing';
    const isFromCoworker = !isOutgoing && m.senderKind === 'coworker';
    const cls = isFromCoworker ? 'coworker' : isOutgoing ? 'assistant' : 'user';
    const time = m.timestamp ? formatTime(m.timestamp) : '';
    const text = m.displayContent || m.content || '';
    const renderAsMd = isOutgoing || isFromCoworker;
    const webhookRendered = !renderAsMd ? tryRenderWebhookEnvelope(text) : null;
    const body = text
      ? webhookRendered || (renderAsMd ? md(text) : esc(text))
      : '<span style="color:#9ca3af">(empty message)</span>';
    // direction='outgoing' = agent reply; !outgoing = user or a2a sender.
    const authorName = isOutgoing
      ? esc(cwState.selected || 'agent')
      : m.senderCoworkerName
        ? `@${esc(m.senderCoworkerName)}`
        : 'You';
    const monogramSource = isOutgoing ? cwState.selected || 'A' : m.senderCoworkerName || 'You';
    const monogram = esc((monogramSource || 'A').trim().charAt(0).toUpperCase() || 'A');
    // Hard-hide host↔container machine traffic in threads too: cli_request
    // and any other bare system-action envelope (update_task, append_learning,
    // create_agent, …) plus the cli_response reply. Action envelopes are
    // `{"action":"…"}` with no "text" field; chat carries "text". See the
    // main-feed path for rationale.
    const isCliResponse = !isOutgoing && /^\s*\{\s*"type"\s*:\s*"cli_response"/.test(text);
    const isActionEnvelope = isOutgoing && /^\s*\{\s*"action"\s*:\s*"[a-z_]+"/.test(text) && !/"text"\s*:/.test(text);
    if (isActionEnvelope || isCliResponse) return '';
    if (m.isRelay) {
      const relayLabel = m.recipientCoworkerName
        ? `${authorName} → @${esc(m.recipientCoworkerName)}`
        : `${authorName} · system action`;
      const preview = (text || '').replace(/\s+/g, ' ').trim();
      const short = preview.length > 80 ? preview.slice(0, 80) + '…' : preview;
      const expanded = cwState._expandedRelays && cwState._expandedRelays.has(m.id);
      return `<div class="cw-msg relay${expanded ? '' : ' collapsed'}" data-relay-id="${esc(m.id)}"><div class="cw-msg-avatar" style="opacity:0.4">${monogram}</div>
        <div class="cw-msg-header" onclick="var el=this.parentElement;el.classList.toggle('collapsed');var ev=new CustomEvent('relay-toggle',{detail:{id:el.dataset.relayId,open:!el.classList.contains('collapsed')}});document.dispatchEvent(ev)" style="cursor:pointer"><span class="cw-msg-author" style="opacity:0.5">${relayLabel}</span><span class="cw-msg-time">${time}</span><span style="font-size:8px;color:var(--text-dim);margin-left:6px">▸ toggle</span></div>
        <div class="cw-msg-bubble relay-preview" style="font-size:10px;color:var(--text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(short)}</div>
        <div class="cw-msg-bubble relay-full" style="display:none;opacity:0.7">${body}</div></div>`;
    }
    // Overlay event: critique-gate REFUSED. Mirrors the main-view path
    // above so threads also render with yellow border + collapsed by
    // default. See the main-view block for the full rationale.
    const isOverlayEvent = isOutgoing && /^\[critique-gate\] REFUSED/.test(text);
    if (isOverlayEvent) {
      const expanded = cwState._expandedRelays && cwState._expandedRelays.has(m.id);
      const headerLabel = `⚠ critique-gate refused ${m.recipientCoworkerName ? '→ @' + esc(m.recipientCoworkerName) : ''}`;
      return `<div class="cw-msg overlay-event${expanded ? '' : ' collapsed'}" data-relay-id="${esc(m.id)}">
        <div class="cw-msg-avatar" style="background:rgba(250,204,21,0.15);color:#ca8a04">⚠</div>
        <div class="cw-msg-header" onclick="var el=this.parentElement;el.classList.toggle('collapsed');var ev=new CustomEvent('relay-toggle',{detail:{id:el.dataset.relayId,open:!el.classList.contains('collapsed')}});document.dispatchEvent(ev)" style="cursor:pointer"><span class="cw-msg-author">${headerLabel}</span><span class="cw-msg-time">${time}</span><span style="font-size:8px;color:var(--text-dim);margin-left:6px">▸ toggle</span></div>
        <div class="cw-msg-bubble relay-preview" style="font-size:10px;color:var(--text-dim);font-style:italic">delivery marker without /codex-critique — click to expand</div>
        <div class="cw-msg-bubble relay-full" style="display:none">${body}</div></div>`;
    }
    if (m.cardType === 'card') {
      return renderCardBubble(m, { cls, monogram, authorName, time, isOutgoing });
    }
    // Ask question card — render with option buttons if still pending.
    // Mirrors the main-feed branch in renderCwMessages; the thread view
    // fetches from the same /api/messages endpoint, so cardType/questionId/
    // options/isPending are already populated. Without this branch the card
    // fell through to plain text and the operator saw no buttons — leaving a
    // timeout:0 ask_user_question wedged forever.
    if (m.cardType === 'ask_question' && m.questionId && m.options && m.options.length > 0) {
      const questionText = m.displayContent || m.content || '';
      if (m.isPending) {
        const btns = m.options
          .map((opt) => {
            const label = typeof opt === 'string' ? opt : opt.label || opt.value || String(opt);
            const value = typeof opt === 'string' ? opt : opt.value || opt.label || String(opt);
            return `<button class="question-btn" data-qid="${esc(m.questionId)}" data-option="${esc(value)}" style="background:#3B82F6;color:#fff;border:none;border-radius:3px;padding:4px 14px;margin-right:6px;margin-top:4px;cursor:pointer;font-size:10px">${esc(label)}</button>`;
          })
          .join('');
        return `<div class="cw-msg assistant">
          <div class="cw-msg-bubble" style="border-left:3px solid #3B82F6;padding-left:8px">
            ${md(questionText)}
            <div style="margin-top:8px">${btns}</div>
          </div>
          <div class="cw-msg-time">${time} <span style="font-size:7px;color:#3B82F6;font-style:italic">question</span></div>
        </div>`;
      }
      return `<div class="cw-msg assistant">
        <div class="cw-msg-bubble" style="border-left:3px solid #555;padding-left:8px;opacity:0.7">
          ${md(questionText)}
          <div style="margin-top:4px;font-size:9px;color:#666">(answered)</div>
        </div>
        <div class="cw-msg-time">${time} <span style="font-size:7px;color:#555;font-style:italic">question</span></div>
      </div>`;
    }
    const attachHtml = renderMessageAttachmentsHtml(m.attachments);
    // Dispatch badge: when an outbound message contains <message to="X"
    // thread_id="Y">, render a clickable "→ X" link that resolves the
    // recipient session via /api/dispatch-targets and opens it. The badge
    // stays inert (gray, no click) when the recipient session hasn't been
    // minted yet — the host writes the inbound row only after the next
    // wake of the recipient's group, so a fresh dispatch may show pending
    // for a few seconds before becoming clickable.
    let dispatchBadgeHtml = '';
    if (isOutgoing && text) {
      const m2 = /<message\s+to="([^"]+)"(?:\s+thread_id="([^"]+)")?[^>]*>/i.exec(text);
      if (m2 && m2[2]) {
        const fromSess = sessionIdForSlug || (matchingNano && matchingNano.nanoclaw_session_id) || '';
        dispatchBadgeHtml = ` <button class="cw-dispatch-badge" data-dispatch-to="${escAttr(m2[1])}" data-dispatch-thread="${escAttr(m2[2])}" data-dispatch-from-session="${escAttr(fromSess)}" title="Open recipient session for thread ${escAttr(m2[2])}">→ ${esc(m2[1])} <span style="opacity:.6">[open]</span></button>`;
      }
    }
    // Hover action toolbar — Copy + Link, mirroring the main feed
    // (renderCwMessages). Reply is intentionally omitted: rows here are
    // already inside the thread. Link reuses the same builder, which appends
    // /m/<id> onto the current /t/ or /s/ thread base. The shared cw-copy-btn
    // / cw-link-btn click handlers live on the main feed's delegate, so we
    // attach a parallel delegate on msgsEl below.
    const copyBtnHtml = text
      ? `<button class="cw-msg-action-btn cw-copy-btn" data-copy-text="${escAttr(text)}" title="Copy message">⧉ Copy</button>`
      : '';
    const linkBtnHtml = m.id
      ? `<button class="cw-msg-action-btn cw-link-btn" data-msg-id="${esc(m.id)}" title="Copy link to this message">🔗 Link</button>`
      : '';
    const actionsHtml =
      copyBtnHtml || linkBtnHtml ? `<div class="cw-msg-actions">${copyBtnHtml}${linkBtnHtml}</div>` : '';
    return `<div class="cw-msg ${cls}" data-msg-id="${esc(m.id || '')}"><div class="cw-msg-avatar">${monogram}</div>
      ${actionsHtml}
      <div class="cw-msg-header"><span class="cw-msg-author">${authorName}</span><span class="cw-msg-time">${time}</span>${dispatchBadgeHtml}</div>
      <div class="cw-msg-bubble">${body}${attachHtml}</div></div>`;
  };
  // Swim-lane view: when a shared-thread (lane) view is active, group the
  // chronological message stream into one labeled lane per coworker, so a
  // gh-issue chain reads as "orch | triager | fixer | reviewer" instead of an
  // ambiguous interleave. Each message already carries group_folder; lanes (if
  // the server sent them) fix the order and surface empty participants.
  // Same system-row filter as the main feed: hide scheduled-task / system rows
  // unless the toggle is on. Applies to both the lane view and the normal
  // thread view.
  const threadMsgs = (t.messages || []).filter(
    (m) => cwState.showSystem || !(m.kind === 'task' || m.kind === 'system'),
  );
  let html;
  if (t.lane) {
    const order = (t.lanes || []).map((l) => l.folder);
    const byFolder = new Map();
    for (const m of threadMsgs) {
      const f = m.group_folder || '(unknown)';
      if (!byFolder.has(f)) byFolder.set(f, []);
      byFolder.get(f).push(m);
    }
    // Folders the server listed first (joined-order), then any stragglers.
    const folders = [...new Set([...order, ...byFolder.keys()])];
    const laneNameByFolder = new Map((t.lanes || []).map((l) => [l.folder, l.name]));
    html = folders
      .map((f) => {
        const msgs = byFolder.get(f) || [];
        const laneLabel = esc(laneNameByFolder.get(f) || f);
        const body = msgs.length
          ? msgs.map(renderThreadMsg).join('')
          : '<div class="cw-empty" style="padding:6px 10px;color:var(--text-muted);font-size:10px">(no messages on this page)</div>';
        return `<div class="cw-lane" data-lane-folder="${escAttr(f)}">
          <div class="cw-lane-header" style="position:sticky;top:0;z-index:1;background:var(--bg);padding:4px 8px;border-bottom:1px solid var(--border);font-size:10px;font-weight:600;color:var(--text);display:flex;align-items:center;gap:6px">
            <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${laneColor(f)}"></span>${laneLabel}
            <span style="color:var(--text-muted);font-weight:400">· ${msgs.length} msg</span>
          </div>
          <div class="cw-lane-body" style="border-left:2px solid ${laneColor(f)};margin-left:7px;padding-left:6px">${body}</div>
        </div>`;
      })
      .join('');
  } else {
    html = threadMsgs.map(renderThreadMsg).join('');
  }
  const persistedCount = (t.messages || []).filter((m) => !m.optimistic).length;
  const loadMoreHtml =
    t.hasMore && persistedCount > 0
      ? `<button class="admin-load-more" id="cw-thread-more"${t.loadingOlder ? ' disabled' : ''}>${t.loadingOlder ? 'Loading…' : 'Load older messages'}</button>`
      : '';
  msgsEl.innerHTML =
    loadMoreHtml + (html || (loadMoreHtml ? '' : '<div class="cw-empty" style="padding:12px">No replies yet.</div>'));
  if (!msgsEl._loadMoreDelegateAttached) {
    msgsEl._loadMoreDelegateAttached = true;
    // Handled on mousedown (NOT click) for the same reason as renderCwMessages:
    // the 3 s polling loop rebuilds msgsEl.innerHTML, and a poll between the
    // user's mousedown and mouseup destroys the button so `click` never fires.
    // mousedown sidesteps that contract. Click handler kept for touch +
    // keyboard parity (Enter/Space arrive only as `click`).
    const handleThreadLoadMore = async (e) => {
      const btn = e.target.closest('#cw-thread-more');
      if (!btn || !cwState.thread) return;
      if (cwState.thread.loadingOlder) return;
      e.preventDefault();
      btn.classList.remove('lm-flash');
      void btn.offsetWidth;
      btn.classList.add('lm-flash');
      const firstRow = msgsEl.querySelector('.cw-msg');
      const anchorOffset = firstRow ? firstRow.getBoundingClientRect().top - msgsEl.getBoundingClientRect().top : 0;
      const anchorId = firstRow?.dataset.msgId || firstRow?.dataset.relayId || null;
      const anchorAttr = firstRow?.dataset.msgId ? 'data-msg-id' : 'data-relay-id';
      await fetchCwThread(cwState.thread.parentId, true);
      if (anchorId) {
        const restored = msgsEl.querySelector(`.cw-msg[${anchorAttr}="${CSS.escape(anchorId)}"]`);
        if (restored) {
          const newOffset = restored.getBoundingClientRect().top - msgsEl.getBoundingClientRect().top;
          msgsEl.scrollTop += newOffset - anchorOffset;
        }
      }
    };
    msgsEl.addEventListener('mousedown', handleThreadLoadMore);
    msgsEl.addEventListener('click', handleThreadLoadMore);
    // Copy / Link hover-toolbar buttons on thread rows — same handler as the
    // main feed. (Reply isn't offered in-thread, so no reply branch here.)
    msgsEl.addEventListener('click', async (e) => {
      if (e.target.closest('#cw-thread-more')) return; // handled above
      if (handleCwMsgActionClick(e)) return;
      // ── Question option buttons ──
      // Mirrors the main-feed handler in renderCwMessages. Without this, the
      // ask_question card rendered above would show buttons that do nothing in
      // the thread view — the operator could see the question but not answer it.
      const questionBtn = e.target.closest('.question-btn');
      if (questionBtn) {
        const qid = questionBtn.dataset.qid;
        const option = questionBtn.dataset.option;
        if (!qid || !option) return;
        if (!cwState._inflightApprovals) cwState._inflightApprovals = new Set();
        if (cwState._inflightApprovals.has(qid)) return;
        cwState._inflightApprovals.add(qid);
        const card = questionBtn.closest('.cw-msg');
        const allBtns = card ? card.querySelectorAll('.question-btn') : [questionBtn];
        allBtns.forEach((b) => {
          b.disabled = true;
        });
        questionBtn.textContent = 'Submitting…';
        try {
          const res = await fetch('/api/questions/respond', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questionId: qid, selectedOption: option }),
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            questionBtn.textContent = errData.error || 'Error';
            allBtns.forEach((b) => {
              b.disabled = false;
            });
          }
        } catch {
          questionBtn.textContent = 'Error';
          allBtns.forEach((b) => {
            b.disabled = false;
          });
        } finally {
          setTimeout(() => {
            cwState._inflightApprovals.delete(qid);
            if (cwState.thread) fetchCwThread(cwState.thread.parentId);
          }, 1000);
        }
        return;
      }
    });
  }
  if (wasAtBottom) msgsEl.scrollTop = msgsEl.scrollHeight;
}

document.addEventListener('relay-toggle', (e) => {
  if (!cwState._expandedRelays) cwState._expandedRelays = new Set();
  if (e.detail.open) cwState._expandedRelays.add(e.detail.id);
  else cwState._expandedRelays.delete(e.detail.id);
});

/**
 * Sync URL hash with current coworker/thread selection — shareable /
 * reload-safe. Schema: #/cw/<folder> or #/cw/<folder>/t/<parentId>.
 */
function syncCwUrl() {
  try {
    let hash = '';
    if (cwState.selected) {
      hash = `#/cw/${encodeURIComponent(cwState.selected)}`;
      if (cwState.thread?.lane) hash += `/l/${encodeURIComponent(cwState.thread.parentId)}`;
      else if (cwState.thread?.sessionDirect && cwState.thread.threadId)
        // Opened a specific session FROM a thread tile: keep the stable
        // /t/<threadId> URL (survives the canonical session changing / bookmarks)
        // even though we render it session-direct. Only a bare a2a/peer-inspector
        // open (no originating thread) uses /s/<sessionId>.
        hash += `/t/${encodeURIComponent(cwState.thread.threadId)}`;
      else if (cwState.thread?.sessionDirect) hash += `/s/${encodeURIComponent(cwState.thread.parentId)}`;
      else if (cwState.thread) hash += `/t/${encodeURIComponent(cwState.thread.parentId)}`;
    }
    if (location.hash !== hash) history.replaceState(null, '', hash || location.pathname);
  } catch {
    /* ignore */
  }
}

function applyCwUrl(retries = 8) {
  const fullHash = location.hash || ''; // permalink incl. /m/<id>, for one-shot restore
  let hashStr = fullHash;
  // Strip a trailing /m/<msgId> permalink anchor first. msgId has no slashes,
  // so this never collides with the slash-bearing thread/parent id captured by
  // the /t/ or /s/ segment below.
  let msgId = null;
  const mm = /\/m\/([^/]+)$/.exec(hashStr);
  if (mm) {
    msgId = decodeURIComponent(mm[1]);
    hashStr = hashStr.slice(0, mm.index);
  }
  const m = /^#\/cw\/([^/]+)(?:\/(t|s|l)\/(.+))?$/.exec(hashStr);
  if (!m) return;
  switchToTab('coworkers');
  const folder = decodeURIComponent(m[1]);
  const mode = m[2] || null;
  const parentId = m[3] ? decodeURIComponent(m[3]) : null;
  const known = getCwCoworkers().some((c) => c.folder === folder);
  if (!known && retries > 0) {
    setTimeout(() => applyCwUrl(retries - 1), 250);
    return;
  }
  // For a /t/<thread> deep-link we resolve the canonical session from
  // cachedSessions. If the coworker is known but its sessions haven't loaded
  // yet, retry rather than fall through to the thread-union open — otherwise a
  // cold page-load on a /t/ link would land on the interleaved view. Only the
  // /t/ path needs this; /s/ and /l/ open by id/thread directly.
  if (mode === 't' && parentId && retries > 0) {
    const folderForRetry = decodeURIComponent(m[1]);
    const sessionsLoaded = (cachedSessions || []).some((s) => s.group_folder === folderForRetry);
    if (!sessionsLoaded) {
      setTimeout(() => applyCwUrl(retries - 1), 250);
      return;
    }
  }
  // selectCoworker/openThread call syncCwUrl(), which rewrites the hash to the
  // base (without /m/<id>). Restore the full permalink after each sync fires so
  // the address bar keeps reflecting the shared message and a refresh re-targets
  // it. No-op when there's no anchor to preserve.
  const restorePermalink = () => {
    if (msgId && fullHash && location.hash !== fullHash) history.replaceState(null, '', fullHash);
  };

  if (cwState.selected !== folder) selectCoworker(folder);
  if (parentId) {
    // A /t/<threadId> deep-link names a thread, which can map to multiple
    // sessions (webhook + a2a). Resolve to the canonical session (prefer the
    // non-a2a, earliest-created one) and open it session-direct so the view
    // is one clean conversation, matching a tile click. The retry guard above
    // waits for cachedSessions to load before we get here; only after retries
    // are exhausted (sessions never loaded) do we fall through to the legacy
    // thread-union open rather than blocking forever.
    let openId = parentId;
    let opts = mode === 's' ? { sessionDirect: true } : {};
    if (mode === 'l') {
      // Swim-lane deep-link: open the shared cross-coworker view directly.
      opts = { lane: true };
    } else if (mode === 't') {
      const canonical = resolveCanonicalSessionForThread(folder, parentId);
      if (canonical) {
        openId = canonical.nanoclaw_session_id;
        opts = { sessionDirect: true, threadId: parentId };
      }
    }
    if (!cwState.thread || cwState.thread.parentId !== openId) {
      setTimeout(() => openThread(openId, opts), 600);
    }
    // Thread permalink: openThread's first fetch is async, so wait until the
    // thread is established AND settled before paginating it to find the target.
    // openThread's own syncCwUrl runs at +600ms, so restore the anchor here too.
    if (msgId) {
      waitForThreadThen(openId, () => {
        restorePermalink();
        ensureCwMessageLoaded(msgId, { thread: openId });
      });
    }
  } else if (msgId) {
    // Main-list permalink: paginate the main message list to find the target.
    ensureCwMessageLoaded(msgId, { thread: null });
  }
  restorePermalink(); // covers the synchronous selectCoworker sync (main-list case)
}

// CSS selector for a rendered message row by id — single source of truth for
// the CSS.escape dance, shared by ensureCwMessageLoaded and highlightCwMessage.
function cwMessageSelector(msgId) {
  const safe = window.CSS && CSS.escape ? CSS.escape(msgId) : msgId;
  return `.cw-msg[data-msg-id="${safe}"]`;
}

// Wait (bounded) until the thread for parentId is open AND its first fetch has
// settled, then run fn once. openThread is fired via setTimeout(600), sets
// cwState.thread synchronously with hasMore=false, then updates hasMore async in
// fetchCwThread — so we wait for the first persisted rows (or the floor flag to
// have been authored) before paginating, not merely for cwState.thread to exist.
function waitForThreadThen(parentId, fn, tries = 25) {
  const open = cwState.thread && cwState.thread.parentId === parentId;
  const settled = open && ((cwState.thread.messages || []).length > 0 || cwState.thread.hasMore);
  if (settled) {
    fn();
    return;
  }
  if (tries <= 0) {
    if (open) fn(); // thread opened but stayed empty — let the helper no-op
    return; // thread never opened (e.g. bad parentId) — give up
  }
  setTimeout(() => waitForThreadThen(parentId, fn, tries - 1), 200);
}

// Auto-paginate older pages until msgId is in the DOM or the loader hits its
// floor, then hand off to highlightCwMessage. Resolves the original permalink
// limitation: deep-linking to a message older than the loaded window.
//   opts.thread = parentId  → paginate the thread view (fetchCwThread)
//   opts.thread = null      → paginate the main list (fetchCwMessages)
async function ensureCwMessageLoaded(msgId, opts = {}) {
  const threadParent = opts.thread || null;
  const inDom = () => document.querySelector(cwMessageSelector(msgId));

  // Fast path: already loaded → highlight immediately, no fetching.
  if (inDom()) {
    highlightCwMessage(msgId);
    return;
  }

  // Snapshot the context this load is bound to. If the user switches coworker
  // (or closes/switches the thread) mid-loop, bail — a stale loop must not keep
  // paging a context the user has left.
  const selectedAtStart = cwState.selected;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Settle-wait: on a fresh deep link, selectCoworker resets messagesHasMore to
  // false and the authoritative value only lands after the first non-append
  // fetch. Without this wait the loop would read the default `false` and stop
  // before paging. Wait (bounded) until the first load has populated rows or set
  // the floor flag. (Thread links are already gated by waitForThreadThen, but
  // the same wait is cheap and harmless there.)
  for (let s = 0; s < 30; s++) {
    if (cwState.selected !== selectedAtStart) return;
    const loaded = threadParent ? cwState.thread?.messages || [] : cwState.messages;
    const hasMore = threadParent ? cwState.thread?.hasMore : cwState.messagesHasMore;
    if ((loaded && loaded.length > 0) || hasMore) break;
    await sleep(100);
  }

  const MAX_PAGES = 40; // hard cap so a bad/absent msgId can't loop forever
  for (let i = 0; i < MAX_PAGES; i++) {
    if (cwState.selected !== selectedAtStart) return;
    if (threadParent && (!cwState.thread || cwState.thread.parentId !== threadParent)) return;

    if (inDom()) break; // a poll-refresh may have rendered it between iterations

    // Floor reached → give up gracefully (msg older than the DB window, or absent).
    const hasMore = threadParent ? cwState.thread.hasMore : cwState.messagesHasMore;
    if (!hasMore) break;

    // Respect the re-entrancy guard. While a poll or prior append is mid-flight,
    // loadingOlder is true and an append call early-returns loading nothing — so
    // wait for the guard to clear rather than assume each call loaded a page.
    const loadingOlder = threadParent ? cwState.thread.loadingOlder : cwState.loadingOlder;
    if (loadingOlder) {
      await sleep(150);
      continue;
    }

    if (threadParent) await fetchCwThread(threadParent, true);
    else await fetchCwMessages(true);

    if (inDom()) break;
    await sleep(50); // small yield so we don't spin against an imminent poll
  }

  // Either it's in the DOM now, or we hit the floor / page cap. highlightCwMessage
  // no-ops gracefully (retries then gives up) if the row genuinely isn't there.
  highlightCwMessage(msgId);
}

// Scroll to + briefly highlight a message by id, retrying while the list loads.
// Note: the ~3s message-list re-render can cut the highlight short — acceptable;
// the scroll has already landed. Messages outside the loaded window are paged in
// by ensureCwMessageLoaded before this runs, so by here the row should be present.
function highlightCwMessage(msgId, tries = 12) {
  const el = document.querySelector(cwMessageSelector(msgId));
  if (!el) {
    if (tries > 0) setTimeout(() => highlightCwMessage(msgId, tries - 1), 400);
    return;
  }
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  el.classList.add('cw-msg-highlight');
  setTimeout(() => el.classList.remove('cw-msg-highlight'), 2500);
}

function renderOtherSessionLinks(cw, currentSession) {
  const sessions = activeNanoSessionsForCoworker(cw).filter(
    (s) => s.nanoclaw_session_id && s.nanoclaw_session_id !== currentSession?.nanoclaw_session_id,
  );
  if (sessions.length === 0) return '';
  return `<div style="font-size:0.625rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:.04em;margin:7px 0 3px">Other Sessions</div>
    <div style="display:flex;flex-direction:column;gap:3px">
      ${sessions
        .slice(0, 3)
        .map((sess) => {
          const lastMs = sess.last_active
            ? new Date(sess.last_active).getTime()
            : (sess.sdk_subsessions?.[0]?.last_ts ?? 0);
          const ago = lastMs ? timeAgo(lastMs) : '';
          const cs = sess.container_status || '';
          const status = sess.activity_status || 'idle';
          const agid = escAttr(sess.agent_group_id || '');
          const sid = escAttr(sess.nanoclaw_session_id);
          const grp = escAttr(cw.folder);
          const tid = escAttr(sess.thread_id || '');
          return `<div class="other-session-row" style="display:flex;align-items:center;gap:6px;padding:4px 6px;border:1px solid var(--border);border-radius:4px;background:rgba(255,255,255,0.02);font-size:9px">
          <span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:${statusDotCanvasColor(status)};opacity:.8;flex-shrink:0"></span>
          ${sessionTitleHtml(sess, { compact: true })}
          <span style="color:var(--text-muted);flex-shrink:0">${esc(cs)}${ago ? ' · ' + esc(ago) : ''}</span>
          <button class="other-session-open-btn" title="Open in Timeline"
            data-view-nanoclaw-session="${sid}" data-view-nanoclaw-agid="${agid}" data-view-session-group="${grp}">Timeline</button>
          <button class="other-session-open-btn" title="Open chat view"
            data-view-chat-session="${sid}" data-view-chat-thread="${tid}" data-view-chat-group="${grp}">Chat</button>
        </div>`;
        })
        .join('')}
      ${sessions.length > 3 ? `<div style="font-size:9px;color:var(--text-dim);margin-left:4px">+${sessions.length - 3} more in Timeline</div>` : ''}
    </div>`;
}

async function updateCwDetail() {
  const folder = cwState.selected;
  if (!folder) return;
  const cw = getCwCoworkers().find((c) => c.folder === folder);
  if (!cw) return;
  document.getElementById('cw-detail-name').textContent = cw.name;
  document.getElementById('cw-detail-type').innerHTML = esc(cw.type) + ' ' + updateDotHtml(cw.isAutoUpdate, true);
  document.getElementById('cw-detail-trigger').textContent = cw.trigger?.replace(/\\b$/, '') || '-';
  document.getElementById('cw-detail-jid').textContent = messagingGroupLabel({
    platform_id: cw.jid || `dashboard:${cw.folder}`,
  });
  document.getElementById('cw-detail-status').textContent = cw.status;
  document.getElementById('cw-detail-tasks').textContent = String(cw.taskCount);

  // MCP tools — show allowed (green) then blocked (struck-through). Hidden by default;
  // expand button toggles visibility so the panel isn't dominated by a long list.
  const mcpEl = document.getElementById('cw-detail-mcp');
  if (mcpEl) {
    const shortName = (t) => t.replace(/^mcp__\w+__/, '');
    const allowed = (cw.allowedMcpTools || [])
      .map((t) => `<span class="mcp-tag allowed">${esc(shortName(t))}</span>`)
      .join('');
    const blocked = (cw.disallowedMcpTools || [])
      .map((t) => `<span class="mcp-tag blocked">${esc(shortName(t))}</span>`)
      .join('');
    mcpEl.innerHTML = allowed + blocked || '<span style="color:var(--text-dim)">none</span>';
    const mcpToggle = document.getElementById('cw-mcp-toggle');
    if (mcpToggle) {
      mcpToggle.textContent = mcpEl.style.display === 'none' ? 'Expand' : 'Collapse';
      mcpToggle.onclick = () => {
        const hidden = mcpEl.style.display === 'none';
        mcpEl.style.display = hidden ? 'block' : 'none';
        mcpToggle.textContent = hidden ? 'Collapse' : 'Expand';
      };
    }
  }

  // Overlays — show current overlays as tags, with edit toggle
  const overlaysEl = document.getElementById('cw-detail-overlays');
  const overlayEditorEl = document.getElementById('cw-overlay-editor');
  const overlayToggleBtn = document.getElementById('cw-overlay-toggle');
  if (overlaysEl) {
    const currentOverlays = cw.overlays || [];
    if (currentOverlays.length > 0) {
      overlaysEl.innerHTML = currentOverlays.map((o) => `<span class="mcp-tag allowed">${esc(o)}</span>`).join('');
    } else {
      overlaysEl.innerHTML = '<span style="color:var(--text-dim)">none</span>';
    }
  }
  if (overlayToggleBtn && overlayEditorEl) {
    overlayToggleBtn.onclick = async () => {
      const isHidden = overlayEditorEl.style.display === 'none';
      if (isHidden) {
        // Always refetch with the current coworker — the catalog is
        // per-coworker now (different workflows → different overlays), so
        // a cached value from another coworker (or from the Create modal)
        // would show the wrong list.
        try {
          const r = await fetch(`/api/overlays?coworker=${encodeURIComponent(cwState.selected)}`);
          if (r.ok) {
            const body = await r.json();
            // Server may return either a bare array (filtered) or
            // `{ _warning, overlays }` when it had to fall back.
            cwState.availableOverlays = Array.isArray(body) ? body : body.overlays || [];
          }
        } catch {
          cwState.availableOverlays = [];
        }
        const currentOverlays = cw.overlays || [];
        overlayEditorEl.innerHTML =
          (cwState.availableOverlays || [])
            .map((o) => {
              const inherited =
                Array.isArray(o.inheritedFrom) && o.inheritedFrom.length > 0
                  ? ` <span style="font-size:9px;color:var(--text-dim)">via ${esc(o.inheritedFrom.map((w) => '/' + w).join(', '))}</span>`
                  : o.optInOnly
                    ? ` <span style="font-size:9px;color:var(--text-dim)">(opt-in only)</span>`
                    : '';
              return `<label style="display:block;margin:2px 0;cursor:pointer"><input type="checkbox" value="${esc(o.name)}" ${currentOverlays.includes(o.name) ? 'checked' : ''}> ${esc(o.name)}${inherited}</label>`;
            })
            .join('') +
          '<button id="cw-overlay-save" style="margin-top:6px;padding:3px 8px;background:var(--green);color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:0.6875rem">Save</button>';
        overlayEditorEl.style.display = 'block';
        overlayToggleBtn.textContent = 'Cancel';
        overlayEditorEl.querySelector('#cw-overlay-save')?.addEventListener('click', async () => {
          const selected = Array.from(overlayEditorEl.querySelectorAll('input:checked')).map((i) => i.value);
          try {
            const r = await fetch(`/api/coworkers/${encodeURIComponent(folder)}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ overlays: selected }),
            });
            if (!r.ok) {
              const e = await r.json();
              alert('Error: ' + e.error);
              return;
            }
            overlayEditorEl.style.display = 'none';
            overlayToggleBtn.textContent = 'Edit';
            cw.overlays = selected;
            if (overlaysEl) {
              overlaysEl.innerHTML =
                selected.length > 0
                  ? selected.map((o) => `<span class="mcp-tag allowed">${esc(o)}</span>`).join('')
                  : '<span style="color:var(--text-dim)">none</span>';
            }
          } catch (e) {
            alert('Error: ' + e.message);
          }
        });
      } else {
        overlayEditorEl.style.display = 'none';
        overlayToggleBtn.textContent = 'Edit';
      }
    };
  }

  // Last Activity: use hook timestamp, message timestamp, or task run — whichever is newest
  const liveCw = (state.coworkers || []).find((c) => c.folder === folder);
  let lastAct = cw.lastActivity ? new Date(cw.lastActivity).getTime() : 0;
  if (liveCw?.hookTimestamp && liveCw.hookTimestamp > lastAct) lastAct = liveCw.hookTimestamp;
  // Also check the most recent message in chat
  if (cwState.messages.length > 0) {
    const lastMsg = new Date(cwState.messages[cwState.messages.length - 1].timestamp).getTime();
    if (lastMsg > lastAct) lastAct = lastMsg;
  }
  document.getElementById('cw-detail-activity').textContent = lastAct > 0 ? new Date(lastAct).toLocaleString() : '-';

  // Subagents from live state
  const subagents = liveCw?.subagents || [];
  document.getElementById('cw-detail-subagents').textContent =
    subagents.length > 0
      ? subagents.map((s) => `${s.agentType || 'agent'} (${s.status || 'unknown'})`).join(', ')
      : 'None';

  // Recent events: lead with the currently viewed session (main or open
  // thread), then show the folder-wide rollup below. This avoids the old
  // ambiguity where a thread view displayed events from every session under
  // the coworker without saying so.
  const liveCwForHooks = (state.coworkers || []).find((c) => c.folder === folder);
  const toolsEl = document.getElementById('cw-detail-tools');
  if (liveCwForHooks) {
    const sessionsBlock = renderActiveSessionBlock(liveCwForHooks, { wrapField: false });
    const recentEvents = renderCurrentSessionEvents(folder);
    const newHtml = `${sessionsBlock || ''}${recentEvents || '<span style="color:var(--text-dim)">None</span>'}`;
    // Only rewrite the DOM when content actually changed — repeated identical writes
    // caused the panel to flash on every 3s poll.
    if (toolsEl._lastHtml !== newHtml) {
      // Preserve open/closed state of <details> elements (e.g. hidden sessions expander).
      const openDetailIds = new Set();
      toolsEl.querySelectorAll('details').forEach((d, i) => {
        if (d.open) openDetailIds.add(i);
      });
      toolsEl.innerHTML = newHtml;
      toolsEl._lastHtml = newHtml;
      // Restore open state by position (there's currently only one <details> per tools panel).
      if (openDetailIds.size > 0) {
        toolsEl.querySelectorAll('details').forEach((d, i) => {
          if (openDetailIds.has(i)) d.open = true;
        });
      }
      const searchEl = document.getElementById('cw-other-session-search');
      if (searchEl) {
        searchEl.addEventListener('input', () => {
          const q = searchEl.value.trim().toLowerCase();
          document.querySelectorAll('#cw-other-session-list .other-session-row').forEach((row) => {
            row.style.display = !q || row.dataset.haystack.includes(q) ? '' : 'none';
          });
        });
      }
    }
    // Wire up hook-entry-link click handlers (same as Pixel Office detail panel)
    toolsEl.querySelectorAll('.hook-entry-link').forEach((btn) => {
      btn.addEventListener('click', () => {
        const group = btn.dataset.eventGroup;
        const time = btn.dataset.eventTime;
        if (group && time) openTimelineForEvent(group, parseInt(time, 10));
      });
    });
    // Wire up "View Session" button if present
    toolsEl.querySelectorAll('[data-view-session]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sid = btn.dataset.viewSession;
        const grp = btn.dataset.viewSessionGroup;
        if (sid && grp) {
          document.querySelector('[data-tab="observability"]')?.click();
          setTimeout(() => openSessionFlowById(grp, sid), 300);
        }
      });
    });
  } else {
    toolsEl.textContent = 'None';
  }

  // Load artifacts (files in group folder)
  try {
    const res = await fetch(`/api/coworkers/${encodeURIComponent(folder)}/files`);
    if (res.ok) {
      const files = await res.json();
      const filesEl = document.getElementById('cw-detail-files');
      if (files.length === 0) {
        filesEl.textContent = 'No files';
      } else {
        filesEl.innerHTML = files
          .map((f) => {
            const icon = f.isDir ? '📁' : '📄';
            const size = f.isDir ? '' : ` (${f.size > 1024 ? Math.round(f.size / 1024) + 'KB' : f.size + 'B'})`;
            return `<div class="cw-file-link" data-name="${esc(f.name)}" data-isdir="${f.isDir}" style="cursor:pointer;color:#60a5fa">${icon} ${esc(f.name)}${size}</div>`;
          })
          .join('');
        filesEl.querySelectorAll('.cw-file-link').forEach((el) => {
          el.addEventListener('click', () => {
            // Switch to Artifacts tab
            document.querySelectorAll('.cw-toggle-btn').forEach((b) => b.classList.remove('active'));
            const workBtn = document.querySelector('[data-view="work"]');
            if (workBtn) workBtn.classList.add('active');
            document.getElementById('cw-chat-messages').style.display = 'none';
            const inputEl = document.getElementById('cw-chat-input-area');
            if (inputEl) inputEl.style.display = 'none';
            document.getElementById('cw-work-view').style.display = 'flex';
            renderCwWork(el.dataset.name, el.dataset.isdir === 'true');
          });
        });
      }
    }
  } catch {
    /* ignore */
  }

  // Load memory (API returns plain text, not JSON)
  try {
    const res = await fetch(`/api/memory/${encodeURIComponent(folder)}`);
    if (res.ok) {
      const text = await res.text();
      const memEl = document.getElementById('cw-memory-preview');
      memEl.innerHTML = md(text || '');
      // Wire up expand/collapse toggle (same pattern as Pixel Office)
      const memToggle = document.getElementById('cw-memory-toggle');
      if (memToggle) {
        memToggle.textContent = memEl.classList.contains('expanded') ? 'Collapse' : 'Expand';
        memToggle.onclick = () => {
          memEl.classList.toggle('expanded');
          memToggle.textContent = memEl.classList.contains('expanded') ? 'Collapse' : 'Expand';
        };
      }
    } else {
      document.getElementById('cw-memory-preview').innerHTML =
        '<span style="color:var(--text-muted)">(no CLAUDE.md found)</span>';
    }
  } catch {
    /* ignore */
  }
}

async function showCreateModal() {
  // Always re-fetch types + overlays on Create Modal open — it's a
  // user-initiated action, two cheap GETs, and ensures the dropdowns reflect
  // the current state even if a previous lazy fetch landed empty (e.g.
  // dashboard restart / transient network blip during initial sidebar render).
  try {
    const res = await fetch('/api/types');
    if (res.ok) cwState.types = await res.json();
  } catch {
    /* fall through — keep whatever we had */
  }
  try {
    const res = await fetch('/api/overlays');
    if (res.ok) cwState.availableOverlays = await res.json();
  } catch {
    /* fall through */
  }
  let instructionTemplates = [];
  try {
    const res = await fetch('/api/instruction-templates');
    if (res.ok) instructionTemplates = await res.json();
  } catch {
    /* none available */
  }
  // Users for the sidebar-group selector (besides the shared "prod" group).
  // Skip the synthetic 'system' user; everything else can own a group.
  let groupUsers = [];
  try {
    const res = await fetch('/api/users');
    if (res.ok) groupUsers = (await res.json()).filter((u) => u.id && u.id !== 'system');
  } catch {
    /* selector falls back to prod-only */
  }
  const groupOptions =
    '<option value="prod">prod (shared)</option>' +
    groupUsers.map((u) => `<option value="${esc(u.id)}">${esc(u.display_name || u.id)}</option>`).join('');

  const overlay = document.createElement('div');
  overlay.className = 'cw-modal-overlay';
  // Filter: hide abstract bases and flat upstream-parity types (main/global
  // are reserved and already provisioned; base-common / *-common are abstract
  // parents, never a direct coworker type).
  const selectableTypes = Object.entries(cwState.types || {}).filter(
    ([k, v]) => !v.flat && !k.endsWith('-common') && k !== 'base-common',
  );
  // Single-select: coworker types use single inheritance (one `extends`
  // parent); exposing multi-select produced invalid compositions like
  // slang-reader + slang-writer. Radio enforces exactly-one pick.
  const typeCheckboxes = selectableTypes
    .map(
      ([k, v]) =>
        `<label class="cw-type-checkbox"><input type="radio" name="cw-new-type" value="${esc(k)}"><span>${esc(k)}</span><span style="color:var(--text-muted)">— ${esc(v.description || '')}</span></label>`,
    )
    .join('');
  const overlayCheckboxes = (cwState.availableOverlays || [])
    .map(
      (o) =>
        `<label class="cw-type-checkbox"><input type="checkbox" name="cw-new-overlay" value="${esc(o.name)}"><span>${esc(o.name)}</span><span style="color:var(--text-muted)">— ${esc(o.description || '')}</span></label>`,
    )
    .join('');
  const instructionOptions = instructionTemplates
    .map((t) => `<option value="${esc(t.name)}">${esc(t.name)}</option>`)
    .join('');
  overlay.innerHTML = `<div class="cw-modal">
    <h3>Create Coworker</h3>
    <label>Name</label>
    <input id="cw-new-name" placeholder="e.g. Slang CUDA">
    <label>Folder</label>
    <input id="cw-new-folder" placeholder="e.g. slang-cuda">
    <label>Type (select one — single inheritance)</label>
    <div id="cw-new-types" style="max-height:200px;overflow-y:auto;overflow-x:hidden;border:1px solid var(--border);border-radius:4px;padding:8px;font-size:11px">${typeCheckboxes}</div>
    <label>Overlays (optional — compose-time gates)</label>
    <div id="cw-new-overlays" style="max-height:120px;overflow-y:auto;overflow-x:hidden;border:1px solid var(--border);border-radius:4px;padding:8px;font-size:11px">${overlayCheckboxes || '<span style="color:var(--text-muted)">No overlays available</span>'}</div>
    <label>Instruction style (optional)</label>
    <select id="cw-new-instruction-style" style="width:100%;padding:6px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text)">
      <option value="">(none — custom only)</option>
      ${instructionOptions}
    </select>
    <label>Agent provider</label>
    <select id="cw-new-provider" style="width:100%;padding:6px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text)">
      <option value="">claude (default)</option>
      <option value="codex">codex</option>
    </select>
    <label>Routing</label>
    <select id="cw-new-routing" style="width:100%;padding:6px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text)">
      <option value="direct">Direct — own channel (default)</option>
      <option value="internal">Internal — via Orchestrator only</option>
    </select>
    <label>Group (sidebar)</label>
    <input id="cw-new-group" list="cw-new-group-options" autocomplete="off" placeholder="Leave blank for prod — or pick/type a user" style="width:100%;padding:6px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text)">
    <datalist id="cw-new-group-options">${groupOptions}</datalist>
    <label>Custom instructions (optional)</label>
    <textarea id="cw-new-instructions" rows="3" placeholder="Additional instructions appended after the selected style..." style="width:100%;padding:6px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text);font-family:monospace;font-size:11px;resize:vertical"></textarea>
    <label>Trigger pattern</label>
    <input id="cw-new-trigger" placeholder="e.g. @SlangCuda">
    <div class="cw-modal-actions">
      <button id="cw-modal-cancel" style="background:var(--bg-hover);color:var(--text)">Cancel</button>
      <button id="cw-modal-create" style="background:var(--green);color:#fff">Create</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  // Auto-fill folder from name
  const nameInput = overlay.querySelector('#cw-new-name');
  const folderInput = overlay.querySelector('#cw-new-folder');
  const triggerInput = overlay.querySelector('#cw-new-trigger');
  nameInput.addEventListener('input', () => {
    const slug = nameInput.value
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9_-]/g, '');
    folderInput.value = slug;
    triggerInput.value = '@' + nameInput.value.replace(/\s+/g, '');
  });
  // Auto-fill from the selected type (radio group — exactly one can be picked).
  overlay.querySelector('#cw-new-types').addEventListener('change', (e) => {
    if (e.target.type !== 'radio') return;
    const picked = overlay.querySelector('#cw-new-types input:checked');
    if (picked && !nameInput.value) {
      const t = picked.value;
      const typeName = t
        .split('-')
        .map((w) => w[0].toUpperCase() + w.slice(1))
        .join(' ');
      nameInput.value = typeName;
      folderInput.value = t;
      triggerInput.value = '@' + typeName.replace(/\s+/g, '');
    }
  });
  overlay.querySelector('#cw-modal-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  overlay.querySelector('#cw-modal-create').addEventListener('click', async () => {
    const name = nameInput.value.trim();
    const folder = folderInput.value.trim();
    const checkedTypes = Array.from(overlay.querySelectorAll('#cw-new-types input:checked')).map((c) => c.value);
    const checkedOverlays = Array.from(overlay.querySelectorAll('#cw-new-overlays input:checked')).map((c) => c.value);
    const trigger = triggerInput.value.trim();
    const instructionStyle = overlay.querySelector('#cw-new-instruction-style')?.value || '';
    const agentProvider = overlay.querySelector('#cw-new-provider')?.value || '';
    const customInstructions = overlay.querySelector('#cw-new-instructions')?.value?.trim() || '';
    // Compose instructions: selected overlay + custom text
    let instructions = '';
    if (instructionStyle) {
      const tmpl = instructionTemplates.find((t) => t.name === instructionStyle);
      if (tmpl) instructions += tmpl.content + '\n\n';
    }
    if (customInstructions) instructions += customInstructions;
    if (!name || !folder) return alert('Name and folder are required');
    try {
      const res = await fetch('/api/coworkers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          folder,
          types: checkedTypes.length ? checkedTypes : undefined,
          overlays: checkedOverlays.length ? checkedOverlays : undefined,
          trigger: trigger || undefined,
          instructions: instructions || undefined,
          instructionTemplate: instructionStyle || undefined,
          agentProvider: agentProvider || undefined,
          routing: document.getElementById('cw-new-routing')?.value || 'direct',
          group: (document.getElementById('cw-new-group')?.value || '').trim() || 'prod',
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert('Error: ' + (err.error || 'Unknown error'));
        return;
      }
      overlay.remove();
      // Refresh and select the new coworker
      setTimeout(() => {
        renderCwSidebar();
        selectCoworker(folder);
      }, 500);
    } catch (e) {
      alert('Error: ' + e.message);
    }
  });
  nameInput.focus();
}

// Coworker tab event listeners
document.getElementById('cw-create-btn')?.addEventListener('click', showCreateModal);
document.getElementById('cw-chat-send')?.addEventListener('click', sendCwMessage);
document.getElementById('cw-chat-input')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendCwMessage();
  }
});

// Card action buttons (works in both main chat and thread panel)
if (!cwState._answeredCards) cwState._answeredCards = {};
document.addEventListener('click', async (e) => {
  const cardBtn = e.target.closest('.card-action-btn');
  if (!cardBtn) return;
  const label = cardBtn.dataset.label;
  if (!label || !cwState.selected) return;
  const msgId = cardBtn.closest('.cw-msg')?.dataset?.msgId;
  if (msgId && cwState._answeredCards[msgId]) return;
  const card = cardBtn.closest('.cw-msg');
  const allBtns = card ? card.querySelectorAll('.card-action-btn') : [cardBtn];
  allBtns.forEach((b) => {
    b.disabled = true;
    b.style.opacity = '0.5';
  });
  cardBtn.textContent = 'Sending…';
  const threadId = cwState.thread?.parentId || null;
  const bucket = cwState.thread ? cwState.thread.messages : cwState.messages;
  await sendMessage({ group: cwState.selected, content: label, threadId, optimisticBucket: bucket });
  if (msgId) {
    cwState._answeredCards[msgId] = label;
    if (cwState.thread) renderCwThread();
    else renderCwMessages();
  }
});

// Thread panel composer + close button
document.getElementById('cw-thread-send')?.addEventListener('click', sendCwThreadMessage);
document.getElementById('cw-thread-input-text')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendCwThreadMessage();
  }
});
document.getElementById('cw-thread-close')?.addEventListener('click', () => closeThread());
document.getElementById('cw-a2a-inspector-close')?.addEventListener('click', () => closeA2aInspector());

function normalizePathRouteToHash() {
  const m = /^\/(?:cw|coworkers)\/([^/]+)(?:\/t\/(.+))?\/?$/.exec(location.pathname || '');
  if (!m) return;
  const folder = decodeURIComponent(m[1]);
  const parentId = m[2] ? decodeURIComponent(m[2]) : null;
  let hash = `#/cw/${encodeURIComponent(folder)}`;
  if (parentId) hash += `/t/${encodeURIComponent(parentId)}`;
  history.replaceState(null, '', `${location.origin}${hash}`);
}

// Hash-routing: restore state on load, reconcile on history navigation.
normalizePathRouteToHash();
window.addEventListener('hashchange', () => {
  if (!applyTabHash()) applyCwUrl();
});
// Apply initial URL after the coworker list has been populated. The first
// applyState() call fills state.registeredGroups; this listener fires after
// that the first time via a short deferral.
setTimeout(() => {
  if (!applyTabHash()) applyCwUrl();
}, 500);

// Memory editor is read-only (CLAUDE.md re-composed at container startup from coworkerType)

// Chat/Artifacts toggle in Coworkers tab
document.getElementById('cw-fullscreen-btn')?.addEventListener('click', () => {
  const panel = document.getElementById('coworkers');
  if (!panel) return;
  panel.classList.remove('cw-thread-fullscreen');
  panel.classList.toggle('cw-fullscreen');
});

document.getElementById('cw-thread-fullscreen-btn')?.addEventListener('click', () => {
  const panel = document.getElementById('coworkers');
  if (!panel) return;
  const wasFullscreen = panel.classList.contains('cw-thread-fullscreen');
  panel.classList.remove('cw-fullscreen');
  panel.classList.toggle('cw-thread-fullscreen');
  if (wasFullscreen) {
    const detail = document.getElementById('cw-detail');
    if (detail && detail.dataset.wasVisible === '1') {
      detail.style.display = 'block';
      delete detail.dataset.wasVisible;
    }
  }
});

document.querySelectorAll('.cw-toggle-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;
    document.querySelectorAll('.cw-toggle-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const chatEl = document.getElementById('cw-chat-messages');
    const inputEl = document.getElementById('cw-chat-input-area');
    const workEl = document.getElementById('cw-work-view');
    chatEl.style.display = 'none';
    if (inputEl) inputEl.style.display = 'none';
    workEl.style.display = 'none';
    if (view === 'work') {
      workEl.style.display = 'flex';
      renderCwWork();
    } else {
      chatEl.style.display = '';
      if (inputEl && cwState.selected) inputEl.style.display = 'flex';
    }
  });
});

// Work output browser
async function renderCwWork(subpath, isDir) {
  const breadcrumb = document.getElementById('cw-work-breadcrumb');
  const content = document.getElementById('cw-work-content');
  if (!cwState.selected) {
    content.innerHTML = '<span style="color:var(--text-muted)">Select a coworker first.</span>';
    return;
  }
  const folder = cwState.selected;
  const path = subpath || '';
  // Track current directory for the work-shell
  cwState.workPath = path;
  cwState.workIsDir = isDir !== false;
  const wsInput = document.getElementById('cw-work-shell-input');
  if (wsInput) {
    const cwd = path && path.includes('.') ? path.replace(/\/[^/]+$/, '') || '' : path;
    wsInput.placeholder = cwd ? `runs in /workspace/agent/${cwd}` : 'runs in /workspace/agent/';
  }

  // Build breadcrumb
  const parts = path ? path.split('/') : [];
  let crumbs = `<a href="#" data-path="" style="color:#58a6ff;text-decoration:none;cursor:pointer">${esc(folder)}</a>`;
  let cumulative = '';
  for (const p of parts) {
    cumulative += (cumulative ? '/' : '') + p;
    crumbs += ` / <a href="#" data-path="${escAttr(cumulative)}" style="color:#58a6ff;text-decoration:none;cursor:pointer">${esc(p)}</a>`;
  }
  breadcrumb.innerHTML = crumbs;
  breadcrumb.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      renderCwWork(a.dataset.path);
    });
  });

  // Render file content if not a directory (isDir===false from browse, or fallback to extension check)
  if (path && isDir === false) {
    const fileExt = (path.split('.').pop() || '').toLowerCase();
    const imageExts = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp']);
    if (imageExts.has(fileExt)) {
      content.innerHTML = `<div style="padding:8px;text-align:center"><img src="/api/coworkers/${encodeURIComponent(folder)}/download/${encodeURIComponent(path)}" style="max-width:100%;border-radius:4px" alt="${esc(path)}"><div style="color:var(--text-muted);font-size:9px;margin-top:4px">${esc(path)}</div></div>`;
      return;
    }
    content.innerHTML = '<span style="color:var(--text-muted)">Loading...</span>';
    try {
      const res = await fetch(`/api/coworkers/${encodeURIComponent(folder)}/read?path=${encodeURIComponent(path)}`);
      if (!res.ok) {
        content.innerHTML = `<span style="color:#f87171">Error: ${(await res.json()).error}</span>`;
        return;
      }
      const file = await res.json();
      const isMarkdown = ['md', 'markdown'].includes(file.ext);
      const isDiff = ['diff', 'patch'].includes(file.ext);
      const isJson = file.ext === 'json';
      if (isMarkdown) {
        content.innerHTML = `<div style="padding:8px;background:var(--bg);border-radius:4px;line-height:1.6">${md(file.content)}</div>`;
      } else if (isJson) {
        try {
          const pretty = JSON.stringify(JSON.parse(file.content), null, 2);
          content.innerHTML = `<pre style="padding:8px;background:#0d1117;color:#c9d1d9;border-radius:4px;overflow-x:auto;font-size:10px;white-space:pre-wrap">${esc(pretty)}</pre>`;
        } catch {
          content.innerHTML = `<pre style="padding:8px;background:#0d1117;color:#c9d1d9;border-radius:4px;font-size:10px;white-space:pre-wrap">${esc(file.content)}</pre>`;
        }
      } else if (isDiff) {
        content.innerHTML = `<pre style="padding:8px;background:#0d1117;border-radius:4px;font-size:10px;white-space:pre-wrap;overflow-x:auto">${file.content
          .split('\n')
          .map((l) => {
            if (l.startsWith('+')) return `<span style="color:#3fb950">${esc(l)}</span>`;
            if (l.startsWith('-')) return `<span style="color:#f85149">${esc(l)}</span>`;
            if (l.startsWith('@@')) return `<span style="color:#a371f7">${esc(l)}</span>`;
            return esc(l);
          })
          .join('\n')}</pre>`;
      } else {
        content.innerHTML = `<pre style="padding:8px;background:#0d1117;color:#c9d1d9;border-radius:4px;font-size:10px;white-space:pre-wrap;overflow-x:auto">${esc(file.content)}</pre>`;
      }
    } catch (e) {
      content.innerHTML = `<span style="color:#f87171">Failed to load file</span>`;
    }
    return;
  }

  // Directory listing
  content.innerHTML = '<span style="color:var(--text-muted)">Loading...</span>';
  try {
    const res = await fetch(`/api/coworkers/${encodeURIComponent(folder)}/browse?path=${encodeURIComponent(path)}`);
    if (!res.ok) {
      content.innerHTML = '<span style="color:#f87171">Failed to load</span>';
      return;
    }
    const files = await res.json();
    if (files.length === 0) {
      content.innerHTML = '<span style="color:var(--text-muted)">Empty folder</span>';
      return;
    }
    content.innerHTML = `<div style="font-size:0.6875rem;color:var(--text-dim);padding:4px 8px;margin-bottom:4px;border:1px solid var(--border);border-radius:4px;background:var(--bg-card)">
        Shared artifacts for <strong style="color:var(--text)">${esc(folder)}</strong>. Files are common to main + all thread sessions; shell below uses any live session for this coworker.
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:10px">
      <tr style="border-bottom:1px solid var(--border);color:var(--text-muted)">
        <th style="text-align:left;padding:4px 8px">Name</th>
        <th style="text-align:right;padding:4px 8px">Size</th>
        <th style="text-align:right;padding:4px 8px">Modified</th>
      </tr>
      ${files
        .map((f) => {
          const icon = f.isDir
            ? '\uD83D\uDCC1'
            : f.name.endsWith('.md')
              ? '\uD83D\uDCDD'
              : f.name.endsWith('.json')
                ? '\uD83D\uDCCA'
                : f.name.endsWith('.diff') || f.name.endsWith('.patch')
                  ? '\uD83D\uDD00'
                  : '\uD83D\uDCC4';
          const size = f.isDir ? '-' : f.size > 1024 ? Math.round(f.size / 1024) + 'KB' : f.size + 'B';
          const time = new Date(f.modified).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          return `<tr style="border-bottom:1px solid var(--border);cursor:pointer" class="cw-work-row" data-path="${escAttr(f.path)}" data-isdir="${f.isDir}">
          <td style="padding:4px 8px">${icon} ${esc(f.name)}</td>
          <td style="text-align:right;padding:4px 8px;color:var(--text-muted)">${size}</td>
          <td style="text-align:right;padding:4px 8px;color:var(--text-muted)">${time}</td>
        </tr>`;
        })
        .join('')}
    </table>`;
    content.querySelectorAll('.cw-work-row').forEach((row) => {
      row.addEventListener('click', () => renderCwWork(row.dataset.path, row.dataset.isdir === 'true'));
      row.addEventListener('mouseenter', () => (row.style.background = 'var(--bg-hover)'));
      row.addEventListener('mouseleave', () => (row.style.background = ''));
    });
  } catch {
    content.innerHTML = '<span style="color:#f87171">Failed to load</span>';
  }

  // Init work-shell panel.
  //
  // Shared Artifacts is explicitly NOT thread-scoped (see index.html:961
  // tooltip). Always query the folder-level container endpoint here,
  // regardless of which thread is open on the chat side — otherwise when
  // a thread is active the shell 404s on the strict-thread fallback rule
  // and artifact-browsing falls back to a read-only state.
  const shellStatus = document.getElementById('cw-work-shell-status');
  const shellOutput = document.getElementById('cw-work-shell-output');
  const shellInput = document.getElementById('cw-work-shell-input');
  if (shellStatus && shellOutput && shellInput) {
    // Keep the output buffer per-folder only; thread toggles on the chat
    // side don't reset the artifact shell.
    const shellKey = `${folder}:__artifacts__`;
    if (shellOutput.dataset.shellKey !== shellKey) {
      shellOutput.dataset.shellKey = shellKey;
      shellOutput.textContent = '';
    }
    try {
      // No thread_id query — artifact view is folder-scoped, so a live
      // root container is an acceptable match even when the active chat
      // view is a thread.
      const res = await fetch(`/api/coworkers/${encodeURIComponent(folder)}/container`);
      const data = await res.json();
      if (data.running) {
        shellStatus.innerHTML = `<span style="color:#34d399">Live</span> <span style="color:var(--text-dim)">${esc(data.container)}</span>`;
        shellInput.disabled = false;
      } else {
        shellStatus.innerHTML = `<span style="color:var(--text-muted)">No running container for this coworker</span>`;
        shellInput.disabled = true;
      }
    } catch {
      shellStatus.innerHTML = '<span style="color:var(--text-muted)">Container status unavailable</span>';
      shellInput.disabled = true;
    }
  }
}

async function renderCwShell() {
  const statusEl = document.getElementById('cw-shell-status');
  const outputEl = document.getElementById('cw-shell-output');
  const inputEl = document.getElementById('cw-shell-input');
  if (!cwState.selected) {
    statusEl.innerHTML = '<span style="color:var(--text-muted)">Select a coworker first.</span>';
    return;
  }
  statusEl.innerHTML = 'Checking container...';
  try {
    const res = await fetch(
      `/api/coworkers/${encodeURIComponent(cwState.selected)}/container${currentShellThreadQuery()}`,
    );
    const data = await res.json();
    if (data.running) {
      statusEl.innerHTML = `<span style="color:#34d399">Connected</span> <span style="color:var(--text-muted)">${esc(data.container)}</span>`;
      if (!outputEl.dataset.initialized) {
        outputEl.textContent = `Connected to ${data.container}\nType commands below. Try: ls /workspace/agent/\n\n`;
        outputEl.dataset.initialized = '1';
      }
      inputEl.disabled = false;
      inputEl.focus();
    } else {
      statusEl.innerHTML = '<span style="color:#facc15">Starting container...</span>';
      inputEl.disabled = true;
      const ok = await ensureContainerRunning(cwState.selected);
      if (ok) {
        const r2 = await fetch(
          `/api/coworkers/${encodeURIComponent(cwState.selected)}/container${currentShellThreadQuery()}`,
        );
        const d2 = await r2.json();
        statusEl.innerHTML = `<span style="color:#34d399">Connected</span> <span style="color:var(--text-muted)">${esc(d2.container)}</span>`;
        outputEl.textContent = `Connected to ${d2.container}\nType commands below. Try: ls /workspace/agent/\n\n`;
        outputEl.dataset.initialized = '1';
        inputEl.disabled = false;
        inputEl.focus();
      } else {
        statusEl.innerHTML = '<span style="color:#f87171">Failed to start container.</span>';
      }
    }
  } catch (e) {
    statusEl.textContent = 'Error: ' + e.message;
  }
}

async function execShellCommand(cmd, outputId, inputId, { forceFolderShell = false } = {}) {
  const outputEl = document.getElementById(outputId || 'cw-shell-output');
  const inputEl = document.getElementById(inputId || 'cw-shell-input');
  if (!cwState.selected || !cmd.trim()) return;
  outputEl.textContent += `$ ${cmd}\n`;
  inputEl.disabled = true;
  try {
    // thread_id picks the per-thread container when a thread panel is
    // open; null / omitted → folder-level (root) session. The Shared
    // Artifacts shell always uses folder-level so it works even when
    // the chat side is currently in a thread with no running container.
    const threadId = forceFolderShell ? null : cwState.thread?.parentId || null;
    const res = await fetch(`/api/coworkers/${encodeURIComponent(cwState.selected)}/exec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: cmd, thread_id: threadId }),
    });
    const data = await res.json();
    if (data.error) {
      outputEl.textContent += `Error: ${data.error}\n\n`;
    } else {
      if (data.stdout) outputEl.textContent += data.stdout + (data.stdout.endsWith('\n') ? '' : '\n');
      if (data.stderr) outputEl.textContent += data.stderr + (data.stderr.endsWith('\n') ? '' : '\n');
      if (!data.stdout && !data.stderr) outputEl.textContent += '\n';
    }
  } catch (e) {
    outputEl.textContent += `Error: ${e.message}\n\n`;
  }
  inputEl.disabled = false;
  inputEl.focus();
  outputEl.scrollTop = outputEl.scrollHeight;
}

document.getElementById('cw-shell-input')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const cmd = e.target.value.trim();
    if (cmd) {
      execCwShellCommand(cmd);
      e.target.value = '';
    }
  }
});
document.getElementById('cw-shell-run')?.addEventListener('click', () => {
  const input = document.getElementById('cw-shell-input');
  const cmd = input.value.trim();
  if (cmd) {
    execCwShellCommand(cmd);
    input.value = '';
  }
});

// Main shell: track cwd so consecutive commands respect cd
cwState.shellCwd = '/workspace/agent';
function execCwShellCommand(cmd) {
  const cdMatch = cmd.match(/^\s*cd\s+(.+)$/);
  if (cdMatch) {
    let target = cdMatch[1].trim().replace(/^['"]|['"]$/g, '');
    if (target === '..') {
      cwState.shellCwd = cwState.shellCwd.replace(/\/[^/]+$/, '') || '/';
    } else if (target.startsWith('/')) {
      cwState.shellCwd = target;
    } else {
      cwState.shellCwd = cwState.shellCwd + '/' + target;
    }
    // Also sync work view path if it's a /workspace/agent subpath
    if (cwState.shellCwd.startsWith('/workspace/agent')) {
      const rel = cwState.shellCwd.slice('/workspace/agent'.length).replace(/^\//, '');
      cwState.workPath = rel;
    }
    const outputEl = document.getElementById('cw-shell-output');
    if (outputEl) {
      outputEl.textContent += `$ cd ${target}\n`;
      outputEl.scrollTop = outputEl.scrollHeight;
    }
    return;
  }
  const wrappedCmd = `cd '${cwState.shellCwd.replace(/'/g, "'\\''")}' && ${cmd}`;
  execShellCommand(wrappedCmd);
}

// Work-shell handlers — commands run in the directory shown in the Work breadcrumb
function execWorkShellCommand(cmd) {
  // Intercept `cd` commands and update the file browser path
  const cdMatch = cmd.match(/^\s*cd\s+(.+)$/);
  if (cdMatch) {
    let target = cdMatch[1].trim().replace(/^['"]|['"]$/g, '');
    let newPath;
    if (target === '/' || target === '/workspace/agent') {
      newPath = '';
    } else if (target === '..') {
      newPath = cwState.workPath ? cwState.workPath.replace(/\/?[^/]+$/, '') : '';
    } else if (target.startsWith('/workspace/agent/')) {
      newPath = target.slice('/workspace/agent/'.length);
    } else if (target.startsWith('/')) {
      // Absolute path outside group — can't browse it, just run the command
    } else {
      // Relative path
      newPath = cwState.workPath ? cwState.workPath + '/' + target : target;
    }
    if (newPath !== undefined) {
      renderCwWork(newPath, true);
      const outputEl = document.getElementById('cw-work-shell-output');
      if (outputEl) outputEl.textContent += `$ cd ${target}\n`;
      return;
    }
  }

  const dir = '/workspace/agent' + (cwState.workPath ? '/' + cwState.workPath : '');
  // If browsing a file (not a directory), use its parent directory
  const cwd = cwState.workPath && !cwState.workIsDir ? dir.replace(/\/[^/]+$/, '') : dir;
  const wrappedCmd = `cd '${cwd.replace(/'/g, "'\\''")}' && ${cmd}`;
  // Shared Artifacts shell runs folder-scoped, never thread-scoped —
  // see renderCwWork note at the /container fetch above.
  execShellCommand(wrappedCmd, 'cw-work-shell-output', 'cw-work-shell-input', { forceFolderShell: true });
}
document.getElementById('cw-work-shell-input')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const cmd = e.target.value.trim();
    if (cmd) {
      execWorkShellCommand(cmd);
      e.target.value = '';
    }
  }
});
document.getElementById('cw-work-shell-run')?.addEventListener('click', () => {
  const input = document.getElementById('cw-work-shell-input');
  const cmd = input.value.trim();
  if (cmd) {
    execWorkShellCommand(cmd);
    input.value = '';
  }
});

// Drag-to-resize between file browser and shell
(function () {
  const divider = document.getElementById('cw-work-divider');
  const shell = document.getElementById('cw-work-shell');
  const container = document.getElementById('cw-work-view');
  if (!divider || !shell || !container) return;
  let dragging = false,
    startY = 0,
    startH = 0;
  divider.addEventListener('mousedown', (e) => {
    dragging = true;
    startY = e.clientY;
    startH = shell.offsetHeight;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const delta = startY - e.clientY;
    const newH = Math.max(60, Math.min(startH + delta, container.offsetHeight - 100));
    shell.style.flex = 'none';
    shell.style.height = newH + 'px';
  });
  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
})();

// View Timeline button (opens full Timeline tab filtered)
document.getElementById('cw-view-timeline')?.addEventListener('click', () => {
  if (!cwState.selected) return;
  switchToTab('observability');
  if (typeof setTimelineFilter === 'function') setTimelineFilter(cwState.selected);
});

// Export coworker as YAML bundle (saved to host). Prompt for mode:
//   lightweight — metadata only; new instance rehydrates from the local lego registry
//   standard    — default; includes .instructions.md overlay and memory snapshot
document.getElementById('cw-export-btn')?.addEventListener('click', async () => {
  if (!cwState.selected) return;
  const useLight = confirm(
    'Export as lightweight bundle?\n\n' +
      'OK  → lightweight (metadata only — the new instance rehydrates identity/invariants/' +
      'context/workflows from its coworker type)\n' +
      'Cancel → standard (metadata + .instructions.md overlay + memory snapshot)',
  );
  const mode = useLight ? 'lightweight' : 'standard';
  try {
    const res = await fetch(`/api/coworkers/${encodeURIComponent(cwState.selected)}/export?mode=${mode}`);
    const result = await res.json();
    if (!res.ok || !result.ok) {
      alert('Export failed: ' + (result.error || 'Unknown'));
      return;
    }
    const sizeKB = (result.size / 1024).toFixed(1);
    alert(`Exported to host (${mode}):\n${result.path}\n\nSize: ${sizeKB} KB`);
  } catch (e) {
    alert('Export error: ' + e.message);
  }
});

// Full Archive export (saved to host)
document.getElementById('cw-full-archive-btn')?.addEventListener('click', async () => {
  // Prompt for folder — button is in admin tab, not coworker detail
  const folder = prompt('Coworker folder to export:\n(e.g. slang-triage)');
  if (!folder) return;
  const pauseTasks = confirm(
    'Pause scheduled tasks on source after export?\n\n(Recommended to prevent duplicate execution)',
  );
  try {
    const qp = `full=true${pauseTasks ? '&pauseTasks=true' : ''}`;
    const res = await fetch(`/api/coworkers/${encodeURIComponent(folder)}/export?${qp}`);
    const result = await res.json();
    if (!res.ok || !result.ok) {
      alert('Full archive export failed: ' + (result.error || 'Unknown'));
      return;
    }
    const sizeMB = (result.size / (1024 * 1024)).toFixed(1);
    let msg = `Exported to host:\n${result.path}\n\nSize: ${sizeMB} MB`;
    if (result.pausedTasks) msg += '\n\nSource tasks have been paused.';
    alert(msg);
  } catch (e) {
    alert('Full archive export error: ' + e.message);
  }
});

// Import coworker from YAML, JSON, or full archive (.tar.gz)
document.getElementById('cw-import-btn')?.addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.yaml,.yml,.json,.tar.gz,.tgz';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const isArchive = file.name.endsWith('.tar.gz') || file.name.endsWith('.tgz');

      if (isArchive) {
        // Binary archive import
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        if (
          !confirm(
            `Import full archive "${file.name}"?\n\nSize: ${sizeMB} MB\nThis will restore sessions, tasks, and Claude state.`,
          )
        )
          return;
        const buf = await file.arrayBuffer();
        const res = await fetch('/api/coworkers/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/gzip' },
          body: buf,
        });
        const result = await res.json();
        if (result.ok) {
          let msg = `Imported "${result.name}" (full archive)\nFolder: ${result.folder}`;
          msg += `\nSessions restored: ${result.sessionsRestored || 0}`;
          msg += `\nTasks imported: ${result.tasksImported || 0} (all paused)`;
          msg += `\nDestinations: ${result.destsCreated || 0}`;
          if (result.backupPath) msg += `\n\nDB backup: ${result.backupPath}`;
          if (result.resolvedDests && result.resolvedDests.length > 0) {
            msg +=
              '\n\nDestination mappings:\n' +
              result.resolvedDests.map((d) => `  ${d.name} (${d.type}) \u2192 ${d.resolvedTo}`).join('\n');
          }
          if (result.warnings && result.warnings.length > 0) {
            msg += '\n\nWarnings:\n' + result.warnings.map((w) => '  - ' + w).join('\n');
          }
          alert(msg);
          setTimeout(renderCwSidebar, 500);
        } else {
          alert('Import error: ' + (result.error || 'Unknown'));
        }
        return;
      }

      // Lightweight YAML/JSON import
      const text = await file.text();
      let name = 'Unknown';
      let folder = 'unknown';
      let fileCount = 0;
      try {
        const preview = JSON.parse(text);
        name = preview.agent?.name || preview.coworker?.name || name;
        folder = preview.agent?.folder || preview.coworker?.folder || folder;
        fileCount = Object.keys(preview.files || {}).length;
      } catch {
        const nameMatch = text.match(/name:\s*['"]?([^'"\n]+)/);
        const folderMatch = text.match(/folder:\s*['"]?([^'"\n]+)/);
        if (nameMatch) name = nameMatch[1].trim();
        if (folderMatch) folder = folderMatch[1].trim();
      }
      if (!confirm(`Import "${name}"?\n\nFolder: ${folder}\n${fileCount > 0 ? fileCount + ' files' : ''}`)) return;
      const res = await fetch('/api/coworkers/import', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: text,
      });
      const result = await res.json();
      if (result.ok) {
        let msg = `Imported "${result.name}"\nFolder: ${result.folder}\nFiles: ${result.filesWritten}\nDestinations: ${result.destsCreated || 0}`;
        if (result.resolvedDests && result.resolvedDests.length > 0) {
          msg +=
            '\n\nDestination mappings:\n' +
            result.resolvedDests.map((d) => `  ${d.name} (${d.type}) \u2192 ${d.resolvedTo}`).join('\n');
        }
        if (result.warnings && result.warnings.length > 0) {
          msg += '\n\nWarnings:\n' + result.warnings.map((w) => '  - ' + w).join('\n');
        }
        alert(msg);
        setTimeout(renderCwSidebar, 500);
      } else {
        alert('Import error: ' + (result.error || 'Unknown'));
      }
    } catch (e) {
      alert('Import error: ' + e.message);
    }
  };
  input.click();
});

// Import from V1 instance
document.getElementById('cw-import-v1-btn')?.addEventListener('click', async () => {
  const v1Path = prompt('V1 NanoClaw instance path:\n(e.g. ~/path/to/v1/nanoclaw)');
  if (!v1Path) return;
  const folder = prompt('Agent folder name:\n(e.g. slang-triage)');
  if (!folder) return;
  if (
    !confirm(
      `Import from V1?\n\nPath: ${v1Path}\nFolder: ${folder}\n\nThis will migrate all data: instructions, sessions, learnings, tasks, conversations.`,
    )
  )
    return;
  try {
    const res = await fetch('/api/coworkers/import-v1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ v1Path, folder }),
    });
    const result = await res.json();
    if (result.ok) {
      let msg = `Imported "${result.name}" from V1\nFolder: ${result.folder}\nID: ${result.id}`;
      msg += `\n\nMigration stats:`;
      if (result.stats) {
        msg += `\n  Group files: ${result.stats.groupFiles || 0}`;
        msg += `\n  Claude session files: ${result.stats.claudeFiles || 0}`;
        msg += `\n  Scheduled tasks: ${result.stats.tasks || 0}`;
      }
      msg += `\nSessions restored: ${result.sessionsRestored || 0}`;
      msg += `\nTasks imported: ${result.tasksImported || 0} (all paused)`;
      if (result.backupPath) msg += `\n\nDB backup: ${result.backupPath}`;
      if (result.warnings && result.warnings.length > 0) {
        msg += '\n\nWarnings:\n' + result.warnings.map((w) => '  - ' + w).join('\n');
      }
      alert(msg);
      setTimeout(renderCwSidebar, 500);
    } else {
      alert('V1 Import error: ' + (result.error || 'Unknown'));
    }
  } catch (e) {
    alert('V1 Import error: ' + e.message);
  }
});

document.getElementById('cw-delete-btn')?.addEventListener('click', async () => {
  if (!cwState.selected) return;
  if (!confirm(`Remove coworker "${cwState.selected}"? (DB entries will be cleaned up)`)) return;
  const deleteData = confirm('Also delete the group folder and artifacts from disk?');
  const qs = deleteData ? '?deleteData' : '';
  try {
    const res = await fetch(`/api/coworkers/${encodeURIComponent(cwState.selected)}${qs}`, { method: 'DELETE' });
    if (res.ok) {
      selectCoworker(null);
      setTimeout(renderCwSidebar, 500);
    } else {
      const err = await res.json();
      alert('Error: ' + (err.error || 'Unknown error'));
    }
  } catch (e) {
    alert('Error: ' + e.message);
  }
});

// Refresh coworker sidebar when switching to the tab
document.querySelector('[data-tab="coworkers"]')?.addEventListener('click', () => {
  renderCwSidebar();
});

// Fetch pending approval counts for all main groups (for sidebar amber dot + global toast)
let approvalCountFetchPending = false;
async function refreshApprovalCounts() {
  if (approvalCountFetchPending) return;
  approvalCountFetchPending = true;
  try {
    const mainGroups = getCwCoworkers().filter((c) => c.isMain);
    for (const g of mainGroups) {
      try {
        const r = await fetch(`/api/approvals?group=${encodeURIComponent(g.folder)}`);
        const arr = r.ok ? await r.json() : [];
        cwState.approvalCountByFolder[g.folder] = arr.length;
      } catch {
        cwState.approvalCountByFolder[g.folder] = 0;
      }
    }
  } finally {
    approvalCountFetchPending = false;
  }
}

// Also refresh on state updates (called from WebSocket handler)
let cwSidebarRefreshPending = false;
function scheduleCwRefresh() {
  if (cwSidebarRefreshPending) return;
  cwSidebarRefreshPending = true;
  requestAnimationFrame(() => {
    cwSidebarRefreshPending = false;
    if (document.getElementById('coworkers')?.classList.contains('active')) {
      refreshApprovalCounts().then(() => renderCwSidebar());
      if (cwState.selected) {
        updateCwHeader();
        updateCwDetail();
      }
    }
  });
}

// ===================================================================
// LOGS PANEL
// ===================================================================

let logSearchTimer = null;

async function loadAdminLogs() {
  const source = document.getElementById('log-source-select')?.value || 'app';
  const group = document.getElementById('log-group-select')?.value || '';
  const search = document.getElementById('log-search-input')?.value || '';

  let url = `/api/logs?source=${source}&limit=500`;
  if (source === 'container' && group) url += `&group=${encodeURIComponent(group)}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('fetch failed');
    const data = await res.json();
    adminState.logs = data.lines || [];
    adminState.loaded.add('logs');
    renderLogs();
  } catch {
    document.getElementById('log-viewer').textContent = 'Failed to load logs';
  }
}

function renderLogs() {
  const viewer = document.getElementById('log-viewer');
  if (!viewer) return;
  if (adminState.logs.length === 0) {
    viewer.innerHTML = '<span style="color:var(--text-muted)">No log lines found</span>';
    return;
  }
  viewer.innerHTML = adminState.logs
    .map((line) => {
      let cls = 'log-info';
      const lower = line.toLowerCase();
      if (lower.includes('error') || lower.includes('err]')) cls = 'log-error';
      else if (lower.includes('warn')) cls = 'log-warn';
      else if (lower.includes('debug')) cls = 'log-debug';
      return `<div class="log-line ${cls}">${esc(line)}</div>`;
    })
    .join('');
  viewer.scrollTop = viewer.scrollHeight;
}

// Logs events
document.getElementById('log-source-select')?.addEventListener('change', (e) => {
  const groupSelect = document.getElementById('log-group-select');
  if (e.target.value === 'container') {
    groupSelect.style.display = '';
    // Populate with groups
    groupSelect.innerHTML = '<option value="">Select group...</option>';
    for (const g of state.registeredGroups) {
      const opt = document.createElement('option');
      opt.value = g.folder;
      opt.textContent = g.name || g.folder;
      groupSelect.appendChild(opt);
    }
  } else {
    groupSelect.style.display = 'none';
  }
  loadAdminLogs();
});

document.getElementById('log-group-select')?.addEventListener('change', () => loadAdminLogs());

document.getElementById('log-search-input')?.addEventListener('input', () => {
  clearTimeout(logSearchTimer);
  logSearchTimer = setTimeout(loadAdminLogs, 300);
});

// ===================================================================
// CHANNELS PANEL
// ===================================================================

async function loadAdminChannels() {
  const el = document.getElementById('admin-channels-content');
  el.innerHTML = '<div class="admin-loading">Loading...</div>';
  try {
    const res = await fetch('/api/channels');
    if (!res.ok) throw new Error('fetch failed');
    adminState.channels = await res.json();
    adminState.loaded.add('channels');
    renderChannels();
  } catch {
    el.innerHTML = '<div class="admin-empty">Failed to load channels</div>';
  }
}

function renderChannels() {
  const el = document.getElementById('admin-channels-content');
  if (adminState.channels.length === 0) {
    el.innerHTML = '<div class="admin-empty">No channels found in src/channels/</div>';
    return;
  }
  el.innerHTML = adminState.channels
    .map((ch) => {
      const dotColor = ch.configured ? 'var(--green)' : 'var(--text-muted)';
      const statusText = ch.configured ? 'Connected' : 'Not configured';
      const groupsList = ch.groups.length > 0 ? ch.groups.map((g) => esc(g.name || g.folder)).join(', ') : 'No groups';
      return `<div class="channel-card">
      <div class="channel-status-dot" style="background:${dotColor}"></div>
      <div class="channel-info">
        <h4>${esc(ch.name)}</h4>
        <div style="font-size:9px;color:${ch.configured ? 'var(--green)' : 'var(--text-muted)'};margin-bottom:4px">${statusText}</div>
        <div class="channel-groups">${groupsList}</div>
      </div>
    </div>`;
    })
    .join('');
}

// ===================================================================
// CONFIG PANEL
// ===================================================================

async function loadAdminConfig() {
  const el = document.getElementById('admin-config-content');
  el.innerHTML = '<div class="admin-loading">Loading...</div>';
  try {
    const [configRes, claudeMdRes] = await Promise.all([
      fetch('/api/config'),
      fetch('/api/config/claude-md')
        .then((r) => (r.ok ? r.text() : '(not found)'))
        .catch(() => '(not found)'),
    ]);
    if (!configRes.ok) throw new Error('fetch failed');
    adminState.config = await configRes.json();
    adminState.loaded.add('config');
    renderConfig(claudeMdRes);
  } catch {
    el.innerHTML = '<div class="admin-empty">Failed to load config</div>';
  }
}

function renderConfig(claudeMdContent) {
  const el = document.getElementById('admin-config-content');
  let html = `<h4 style="font-size:11px;margin-bottom:8px">Environment Configuration</h4>
    <table class="admin-table">
    <tr><th>Key</th><th>Value</th><th>Env Var</th><th>Description</th></tr>`;
  for (const c of adminState.config) {
    html += `<tr>
      <td style="font-weight:600">${esc(c.key)}</td>
      <td style="color:${c.value ? 'var(--text)' : 'var(--text-muted)'}">${esc(c.value || '(not set)')}</td>
      <td style="font-size:9px;color:var(--text-muted)">${esc(c.env)}</td>
      <td style="color:var(--text-dim)">${esc(c.description)}</td>
    </tr>`;
  }
  html += '</table>';

  // CLAUDE.md editor — edits the project root CLAUDE.md. The earlier
  // "Global Memory (groups/global)" scope was a v1-era concept (composed
  // CLAUDE.md base) that v2 retired; v2 installs have no `groups/global/`
  // dir, so the option only ever rendered "(not found)".
  html += `<h4 style="font-size:11px;margin:16px 0 8px">CLAUDE.md Editor</h4>
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
      <span style="color:var(--text-muted);font-size:10px">Root CLAUDE.md</span>
      <button class="admin-action-btn" id="config-md-toggle-view" style="font-size:9px;padding:2px 8px">Edit</button>
    </div>
    <div id="config-md-preview" class="md-content md-preview" style="max-height:400px;overflow-y:auto;margin-bottom:8px">${md(claudeMdContent)}</div>
    <textarea id="config-md-editor" class="admin-editor" style="min-height:200px;display:none">${esc(claudeMdContent)}</textarea>
    <button class="admin-save-btn" data-action="save-config-md">Save</button>`;
  el.innerHTML = html;

  // Preview toggle
  document.getElementById('config-md-toggle-view')?.addEventListener('click', () => {
    const editor = document.getElementById('config-md-editor');
    const preview = document.getElementById('config-md-preview');
    const btn = document.getElementById('config-md-toggle-view');
    if (preview.style.display === 'none') {
      preview.innerHTML = md(editor.value);
      preview.style.display = 'block';
      editor.style.display = 'none';
      btn.textContent = 'Edit';
    } else {
      preview.style.display = 'none';
      editor.style.display = '';
      btn.textContent = 'Preview';
    }
  });
}

// Auto-load overview when admin tab is first shown
document.querySelector('[data-tab="admin"]')?.addEventListener('click', () => {
  if (!adminState.loaded.has('overview')) loadAdminOverview();
});

// --- Init ---
window.addEventListener('resize', () => {
  needsResize = true;
});
// Ensure canvas is sized after layout settles (fixes race in some browsers)
function scheduleResize() {
  needsResize = true;
}
window.addEventListener('load', scheduleResize);
setTimeout(scheduleResize, 100);
setTimeout(scheduleResize, 500);
needsResize = !resizeCanvas();

async function bootstrapDashboardApp() {
  const authed = await ensureDashboardAuth();
  if (!authed) {
    setLiveStatus('Locked', 'var(--yellow)');
    return;
  }
  await resyncLiveData();
  connectLiveUpdates();
  animate();
}

bootstrapDashboardApp().catch(() => {
  setLiveStatus('Auth Error', 'var(--red)');
});

window.addEventListener('beforeunload', () => {
  if (liveSource) liveSource.close();
  if (liveReconnectTimer) clearTimeout(liveReconnectTimer);
  if (hiddenDisconnectTimer) clearTimeout(hiddenDisconnectTimer);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenDisconnectTimer = setTimeout(() => {
      if (!document.hidden) return;
      if (liveSource) liveSource.close();
      liveSource = null;
      if (liveReconnectTimer) clearTimeout(liveReconnectTimer);
      liveReconnectTimer = null;
      setLiveStatus('Paused', 'var(--text-muted)');
    }, 30000);
    return;
  }

  if (hiddenDisconnectTimer) clearTimeout(hiddenDisconnectTimer);
  hiddenDisconnectTimer = null;
  void resyncLiveData().finally(() => connectLiveUpdates());
});

// --- Infrastructure Panel ---
async function loadAdminInfra() {
  const el = document.getElementById('admin-infra-content');
  el.innerHTML = '<div class="admin-loading">Loading...</div>';
  try {
    const res = await fetch('/api/infrastructure');
    if (!res.ok) throw new Error('fetch failed');
    adminState.infra = await res.json();
    adminState.loaded.add('infra');
    renderAdminInfra();
  } catch {
    el.innerHTML = '<div class="admin-empty">Failed to load infrastructure status</div>';
  }
}

function renderAdminInfra() {
  const d = adminState.infra;
  if (!d) return;
  const el = document.getElementById('admin-infra-content');

  const dot = (ok) =>
    ok ? '<span style="color:var(--green)">&#9679;</span>' : '<span style="color:var(--red)">&#9679;</span>';
  const mcpOk = d.mcpAuthProxy?.status === 'running';
  const onecliOk = d.onecli?.status === 'running';
  const netOk = d.network?.status === 'active';

  // Local MCP servers (auto-discovered) with stop/restart controls. Server-side now
  // emits per-server tool counts as Record<name, count>; the flat `toolCount` is
  // still used for the top "Discovered Tools" stat card. Before this, every row
  // read the global sum — with slang-mcp (12) and slang-pr-knowledge (7) the table
  // showed "19 tools" on both rows. Accept the legacy `string[]` shape too so a
  // newer client against an older server doesn't regress.
  const serverMap = d.mcpAuthProxy?.servers;
  const serverEntries = Array.isArray(serverMap)
    ? serverMap.map((name) => [name, d.mcpAuthProxy?.toolCount || 0])
    : Object.entries(serverMap || {});
  // Buttons use data-mcp-action + data-mcp-server so a single delegated
  // click handler (wired in setupMcpActionDelegation) invokes the right
  // window.* function. Avoids interpolating untrusted server names into JS
  // string literals inside onclick="" (RC-H1: MCP names containing an
  // apostrophe would have broken out of the JS-string context).
  const localServers = serverEntries
    .map(
      ([s, count]) => `
    <tr><td>${esc(s)}</td><td>Local (stdio)</td><td>${count} tools</td>
    <td><span class="admin-chip active">Running</span>
    <button class="admin-action-btn" style="font-size:9px;padding:1px 6px;margin-left:4px" data-mcp-action="restartMcp" data-mcp-server="${esc(s)}">Restart</button>
    <button class="admin-action-btn danger" style="font-size:9px;padding:1px 6px" data-mcp-action="stopMcp" data-mcp-server="${esc(s)}">Stop</button></td></tr>`,
    )
    .join('');

  // Remote MCP servers (registered via dashboard) — check token status per server
  const tokenStatus = d.oauth?.tokenStatus || {};
  const remoteServers = (d.remoteMcpServers || [])
    .map((s) => {
      const hasToken = tokenStatus[s.name];
      const authBadge = hasToken
        ? `<span class="admin-chip active" style="font-size:8px">Authorized</span>`
        : `<span class="admin-chip stopped" style="font-size:8px">No token</span>`;
      const authBtn = hasToken
        ? `<button class="admin-action-btn danger" style="font-size:9px;padding:1px 6px" data-mcp-action="revokeOAuth" data-mcp-server="${esc(s.name)}">Revoke</button>`
        : `<button class="admin-action-btn success" style="font-size:9px;padding:1px 6px" data-mcp-action="pasteToken" data-mcp-server="${esc(s.name)}">Add Token</button>`;
      return `<tr><td>${esc(s.name)}</td><td>${authBadge}</td><td style="font-size:8px;max-width:200px;overflow:hidden;text-overflow:ellipsis">${esc(s.url)}</td>
    <td>${authBtn} <button class="admin-action-btn danger" style="font-size:9px;padding:1px 6px" data-mcp-action="removeRemoteMcp" data-mcp-server="${esc(s.name)}">Remove</button></td></tr>`;
    })
    .join('');

  // OAuth servers
  const oauthServers = d.oauth?.servers || [];
  const oauthRows =
    oauthServers
      .map(
        (s) => `
    <tr><td>${esc(s.name)}</td>
    <td><span class="admin-chip ${s.authorized ? 'active' : 'stopped'}">${s.authorized ? 'Authorized' : 'Not authorized'}</span></td>
    <td>${
      s.authorized
        ? `<button class="admin-action-btn danger" data-mcp-action="revokeOAuth" data-mcp-server="${esc(s.name)}">Revoke</button>`
        : `<button class="admin-action-btn success" data-mcp-action="authorizeOAuth" data-mcp-server="${esc(s.name)}">Browser Auth</button>
         <button class="admin-action-btn" data-mcp-action="pasteToken" data-mcp-server="${esc(s.name)}">Paste Token</button>`
    }</td></tr>`,
      )
      .join('') ||
    '<tr><td colspan="3" style="color:var(--text-muted)">No OAuth servers. Import MCP servers below to auto-create.</td></tr>';

  // Containers
  const containers =
    (d.containers?.list || [])
      .map(
        (c) => `
    <tr><td>${esc(c.name.replace('nanoclaw-', ''))}</td>
    <td><span class="admin-chip running">${esc(c.status)}</span></td>
    <td>${esc(c.networks || 'default')}</td></tr>`,
      )
      .join('') || '<tr><td colspan="3" style="color:var(--text-muted)">No containers running</td></tr>';

  // Host disk usage. Snapshot from /api/infrastructure (computed via statfsSync);
  // the "Refresh" button below re-fetches the whole infra payload. >=90% used is
  // flagged red (the /ephemeral docker disk filling breaks image rebuilds), >=75%
  // amber, else green.
  const fmtBytes = (n) => {
    if (n == null || isNaN(n)) return '—';
    const u = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    let i = 0;
    let v = n;
    while (v >= 1024 && i < u.length - 1) {
      v /= 1024;
      i++;
    }
    return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${u[i]}`;
  };
  const diskRows =
    (d.disk || [])
      .map((x) => {
        const color = x.usedPercent >= 90 ? 'var(--red)' : x.usedPercent >= 75 ? 'var(--yellow)' : 'var(--green)';
        return `
    <tr><td>${esc(x.mount)}</td>
    <td>${fmtBytes(x.used)} / ${fmtBytes(x.total)}</td>
    <td>${fmtBytes(x.avail)} free</td>
    <td style="min-width:120px">
      <div style="display:flex;align-items:center;gap:6px">
        <div style="flex:1;height:8px;background:var(--bg-hover);border-radius:4px;overflow:hidden">
          <div style="width:${x.usedPercent}%;height:100%;background:${color}"></div>
        </div>
        <span style="color:${color};font-weight:600;min-width:34px;text-align:right">${x.usedPercent}%</span>
      </div>
    </td></tr>`;
      })
      .join('') || '<tr><td colspan="4" style="color:var(--text-muted)">No disk data</td></tr>';

  el.innerHTML = `
    <div class="admin-stat-grid">
      <div class="admin-stat-card"><div class="num">${dot(mcpOk)} ${mcpOk ? 'Up' : 'Down'}</div><div class="label">MCP Auth Proxy</div></div>
      <div class="admin-stat-card"><div class="num">${d.mcpAuthProxy?.toolCount || 0}</div><div class="label">Discovered Tools</div></div>
      <div class="admin-stat-card"><div class="num">${dot(onecliOk)} ${onecliOk ? 'Up' : 'Down'}</div><div class="label">OneCLI Gateway</div></div>
      <div class="admin-stat-card"><div class="num">${dot(netOk)} ${netOk ? 'On' : 'Off'}</div><div class="label">Network Isolation</div></div>
      <div class="admin-stat-card"><div class="num">${d.containers?.count || 0}</div><div class="label">Containers</div></div>
      <div class="admin-stat-card"><div class="num">${(d.remoteMcpServers || []).length}</div><div class="label">Remote Servers</div></div>
      ${(d.disk || [])
        .map((x) => {
          const c = x.usedPercent >= 90 ? 'var(--red)' : x.usedPercent >= 75 ? 'var(--yellow)' : 'var(--green)';
          return `<div class="admin-stat-card"><div class="num" style="color:${c}">${x.usedPercent}%</div><div class="label">Disk ${esc(x.mount)}</div></div>`;
        })
        .join('')}
    </div>

    <h4 style="font-size:11px;margin:10px 0 6px">MCP Servers</h4>
    ${
      d.mcpAuthProxy?.status && d.mcpAuthProxy.status !== 'running'
        ? `<p style="font-size:10px;color:var(--red);margin:0 0 6px">Proxy ${esc(d.mcpAuthProxy.status)}${d.mcpAuthProxy.statusCode ? ` (HTTP ${d.mcpAuthProxy.statusCode})` : ''} — check that the main service is running and data/.mcp-management-token matches the proxy process</p>`
        : ''
    }
    <table class="admin-table">
      <tr><th>Server</th><th>Type</th><th>Details</th><th></th></tr>
      ${localServers}${remoteServers}
      ${!localServers && !remoteServers ? '<tr><td colspan="4" style="color:var(--text-muted)">No servers</td></tr>' : ''}
    </table>

    <h4 style="font-size:11px;margin:14px 0 6px">Import Remote MCP Servers</h4>
    <p style="font-size:9px;color:var(--text-dim);margin:0 0 6px">Paste your mcpServers JSON config (from Cursor, Claude, etc.) to register remote servers.</p>
    <textarea id="infra-import-json" class="admin-editor" style="height:80px;font-size:9px" placeholder='{"mcpServers": {"MaaS NVBugs": {"url": "https://..."}, ...}}'></textarea>
    <div style="display:flex;gap:8px;margin-top:6px">
      <button class="admin-save-btn" onclick="importMcpServers()" style="margin:0">Import Servers</button>
    </div>

    <h4 style="font-size:11px;margin:14px 0 6px">OAuth Authorization</h4>
    <table class="admin-table">
      <tr><th>Server</th><th>Status</th><th>Action</th></tr>
      ${oauthRows}
    </table>

    <h4 style="font-size:11px;margin:14px 0 6px">Running Containers</h4>
    <table class="admin-table">
      <tr><th>Name</th><th>Status</th><th>Network</th></tr>
      ${containers}
    </table>

    <div style="display:flex;align-items:center;justify-content:space-between;margin:14px 0 6px">
      <h4 style="font-size:11px;margin:0">Host Disk</h4>
      <button class="admin-action-btn" style="font-size:9px;padding:1px 8px" onclick="refreshAdminInfra()">Refresh</button>
    </div>
    <table class="admin-table">
      <tr><th>Mount</th><th>Used / Total</th><th>Available</th><th>Usage</th></tr>
      ${diskRows}
    </table>

    <h4 style="font-size:11px;margin:14px 0 6px">Security Layers</h4>
    <table class="admin-table">
      <tr><th>Layer</th><th>Status</th><th>Details</th></tr>
      <tr><td>MCP Auth Proxy</td><td><span class="admin-chip ${mcpOk ? 'active' : 'stopped'}">${mcpOk ? 'Enforcing' : 'Down'}</span></td><td>Per-container tokens + tool ACL</td></tr>
      <tr><td>OneCLI MITM</td><td><span class="admin-chip ${onecliOk ? 'active' : 'stopped'}">${onecliOk ? 'Enforcing' : 'Down'}</span></td><td>API key injection (Anthropic, GitHub)</td></tr>
      <tr><td>Network Isolation</td><td><span class="admin-chip ${netOk ? 'active' : 'stopped'}">${netOk ? 'Enforcing' : 'Off'}</span></td><td>icc=false (no inter-container traffic)</td></tr>
      <tr><td>Credential Isolation</td><td><span class="admin-chip active">Enforcing</span></td><td>.env shadowed, tokens on host only</td></tr>
    </table>
  `;
}

// --- Infra panel actions ---
// Force a fresh /api/infrastructure fetch (used by the Host Disk "Refresh"
// button — disk usage is a point-in-time snapshot, so this re-reads statfs).
window.refreshAdminInfra = function () {
  adminState.loaded.delete('infra');
  loadAdminInfra();
};

window.authorizeOAuth = function (serverName) {
  window.open('/oauth/authorize?server=' + encodeURIComponent(serverName), '_blank');
};

window.pasteToken = function (serverName) {
  const token = prompt('Paste your access token for ' + serverName + ':');
  if (!token) return;
  const refresh = prompt('Paste refresh token (optional, press Cancel to skip):');
  fetch('/oauth/manual-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serverName, accessToken: token, refreshToken: refresh || undefined }),
  })
    .then((r) => {
      if (r.ok) {
        adminState.loaded.delete('infra');
        loadAdminInfra();
        alert('Token saved for ' + serverName);
      } else r.json().then((j) => alert('Error: ' + j.error));
    })
    .catch((e) => alert('Failed: ' + e.message));
};

window.revokeOAuth = function (serverName) {
  if (!confirm('Revoke tokens for ' + serverName + '?')) return;
  fetch('/oauth/revoke?server=' + encodeURIComponent(serverName), { method: 'POST' })
    .then(() => {
      adminState.loaded.delete('infra');
      loadAdminInfra();
    })
    .catch((e) => alert('Revoke failed: ' + e.message));
};

window.removeRemoteMcp = function (name) {
  if (!confirm('Remove remote MCP server ' + name + '?')) return;
  fetch('/api/mcp-servers?name=' + encodeURIComponent(name), { method: 'DELETE' })
    .then(() => {
      adminState.loaded.delete('infra');
      loadAdminInfra();
    })
    .catch((e) => alert('Remove failed: ' + e.message));
};

window.stopMcp = function (name) {
  if (!confirm('Stop MCP server ' + name + '? Agents will lose access to its tools.')) return;
  // Auth proxy management endpoints are on the MCP port — read from infra data
  const mcpPort = location.port; // Dashboard proxies, or use direct
  fetch('/api/mcp-control', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'stop', name }),
  })
    .then((r) => r.json())
    .then((j) => {
      if (j.ok) {
        adminState.loaded.delete('infra');
        loadAdminInfra();
      } else alert(j.error);
    })
    .catch((e) => alert('Failed: ' + e.message));
};

window.restartMcp = function (name) {
  fetch('/api/mcp-control', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'restart', name }),
  })
    .then((r) => r.json())
    .then((j) => {
      if (j.ok) {
        adminState.loaded.delete('infra');
        loadAdminInfra();
      } else alert(j.error);
    })
    .catch((e) => alert('Failed: ' + e.message));
};

// Delegated click handler for MCP action buttons. Buttons opt in with
// `data-mcp-action="<fn>"` + `data-mcp-server="<name>"` so server names
// containing quotes / backslashes don't need to be safely interpolated
// into an inline onclick="" JS-string context (RC-H1).
if (!window.__mcpActionDelegated) {
  window.__mcpActionDelegated = true;
  document.addEventListener('click', function (ev) {
    const btn = ev.target && ev.target.closest && ev.target.closest('[data-mcp-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-mcp-action');
    const name = btn.getAttribute('data-mcp-server') || '';
    const fn = window[action];
    if (typeof fn === 'function') fn(name);
  });
}

window.importMcpServers = function () {
  const textarea = document.getElementById('infra-import-json');
  try {
    const raw = JSON.parse(textarea.value);
    const payload = raw.mcpServers ? raw : { mcpServers: raw };
    fetch('/api/mcp-servers/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          textarea.value = '';
          adminState.loaded.delete('infra');
          loadAdminInfra();
          alert('Imported ' + j.count + ' servers: ' + j.imported.join(', '));
        } else alert('Error: ' + j.error);
      })
      .catch((e) => alert('Import failed: ' + e.message));
  } catch {
    alert('Invalid JSON. Paste a valid mcpServers config.');
  }
};

// ============================================================
// Metrics Tab — Token Usage, Activity, Users, Channels
// ============================================================

function fmtNum(n) {
  if (n == null) return '-';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toLocaleString();
}

const metricsState = { loaded: new Set(), tokenPeriod: '1d' };

// --- Token Metrics (ccusage) ---
async function loadMetricsTokens(period) {
  if (period) metricsState.tokenPeriod = period;
  const p = metricsState.tokenPeriod;
  const el = document.getElementById('metrics-tokens-content');
  try {
    const res = await fetch(`/api/token-metrics?period=${p}`);
    if (!res.ok) throw new Error('fetch failed');
    const data = await res.json();
    metricsState.loaded.add('tokens');
    renderMetricsTokens(el, data);
  } catch {
    el.innerHTML = '<div class="admin-empty">Failed to load token metrics</div>';
  }
}

function fmtUsd(n) {
  if (n == null || n === 0) return '$0.00';
  if (n < 0.01) return '<$0.01';
  return '$' + n.toFixed(2);
}

// "Context" cell for the By-Coworker table: how hard a coworker pushes context.
// Renders a 5-bar peak-context histogram (per-session peak as % of the model's
// window: <25/25-50/50-75/75-90/90%+), the mean peak %, and the compaction count
// (⟳). Colored by mean peak so a glance flags coworkers running hot. cs is the
// server-side ContextStats ({sessions, compactions, auto/manual, avgPeakPct,
// avgPreTokens, histogram, maxContext, capped}) or null.
function contextCellHtml(cs) {
  if (!cs || !cs.sessions) return '<span style="color:var(--text-muted)">—</span>';
  const pct = cs.avgPeakPct || 0;
  const pctColor = pct >= 90 ? '#f85149' : pct >= 75 ? '#d29922' : pct >= 50 ? '#58a6ff' : '#3fb950';
  // 5-bar sparkline histogram of per-session peak-context buckets.
  const hist = Array.isArray(cs.histogram) ? cs.histogram : [];
  const maxBar = Math.max(1, ...hist);
  const barColors = ['#3fb950', '#79c0ff', '#58a6ff', '#d29922', '#f85149'];
  const bucketLabels = ['<25%', '25–50%', '50–75%', '75–90%', '90%+'];
  const BW = 7,
    GAP = 2,
    HH = 22;
  const bars = hist
    .map((v, i) => {
      const h = Math.max(1, Math.round((v / maxBar) * HH));
      return `<rect x="${i * (BW + GAP)}" y="${HH - h}" width="${BW}" height="${h}" fill="${barColors[i]}" fill-opacity="${v ? 0.95 : 0.2}"><title>${bucketLabels[i]} peak: ${v} session${v === 1 ? '' : 's'}</title></rect>`;
    })
    .join('');
  const svgW = hist.length * (BW + GAP);
  const compTitle =
    `${cs.compactions} compaction${cs.compactions === 1 ? '' : 's'}` +
    (cs.compactions
      ? ` (${cs.autoCompactions} auto / ${cs.manualCompactions} manual; avg ${fmtNum(cs.avgPreTokens)} tok at compaction)`
      : '') +
    ` across ${cs.sessions} session${cs.sessions === 1 ? '' : 's'}${cs.capped ? ' (capped)' : ''}`;
  const comp = cs.compactions
    ? `<span title="${esc(compTitle)}" style="color:${cs.compactions >= 5 ? '#f85149' : cs.compactions >= 1 ? '#d29922' : 'var(--text-muted)'}">⟳${cs.compactions}</span>`
    : `<span title="${esc(compTitle)}" style="color:var(--text-muted)">⟳0</span>`;
  return `<div style="display:flex;align-items:center;gap:8px" title="mean per-session peak context: ${pct}% of ${fmtNum(cs.maxContext)}-token window">
      <svg width="${svgW}" height="${HH}" viewBox="0 0 ${svgW} ${HH}" style="flex:none">${bars}</svg>
      <span style="color:${pctColor};font-weight:600">${pct}%</span>
      ${comp}
    </div>`;
}

function renderMetricsTokens(el, data) {
  // The cost CLI is a locked dependency and is never installed at read time, so
  // "cannot resolve it" is a real state the panel has to show. Rendering the
  // usual grid here would print a confident $0.00 that looks like a quiet week
  // rather than a metric that never ran.
  if (data.unavailable) {
    el.innerHTML = '<div class="admin-empty">Token metrics unavailable — ' + esc(String(data.unavailable)) + '</div>';
    return;
  }
  const days = data.daily || [];
  const p = data.period || metricsState.tokenPeriod;

  // Aggregate across all days in the period
  let totalCost = 0,
    totalInput = 0,
    totalOutput = 0,
    totalCacheRead = 0,
    totalCacheCreation = 0,
    totalTokens = 0;
  const modelAgg = {};
  for (const day of days) {
    totalCost += day.totalCost || 0;
    totalInput += day.inputTokens || 0;
    totalOutput += day.outputTokens || 0;
    totalCacheRead += day.cacheReadTokens || 0;
    totalCacheCreation += day.cacheCreationTokens || 0;
    totalTokens += day.totalTokens || 0;
    for (const mb of day.modelBreakdowns || []) {
      if (!modelAgg[mb.modelName])
        modelAgg[mb.modelName] = {
          cost: 0,
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
        };
      modelAgg[mb.modelName].cost += mb.cost || 0;
      modelAgg[mb.modelName].inputTokens += mb.inputTokens || 0;
      modelAgg[mb.modelName].outputTokens += mb.outputTokens || 0;
      modelAgg[mb.modelName].cacheReadTokens += mb.cacheReadTokens || 0;
      modelAgg[mb.modelName].cacheCreationTokens += mb.cacheCreationTokens || 0;
    }
  }
  const cacheHitPct =
    totalInput + totalCacheRead + totalCacheCreation > 0
      ? Math.round((totalCacheRead / (totalInput + totalCacheRead + totalCacheCreation)) * 100)
      : 0;

  // Period filter buttons
  const periods = [
    ['1d', '24h'],
    ['7d', '7 days'],
    ['30d', '30 days'],
    ['all', 'All time'],
  ];
  const filterHtml = periods
    .map(
      ([val, label]) =>
        `<button style="padding:4px 12px;border-radius:4px;border:1px solid ${p === val ? '#3B82F6' : '#334155'};background:${p === val ? '#3B82F6' : 'transparent'};color:${p === val ? '#fff' : '#94A3B8'};cursor:pointer;font-size:12px" data-metrics-period="${val}">${label}</button>`,
    )
    .join(' ');

  let html = `<div style="display:flex;gap:6px;margin-bottom:12px">${filterHtml}</div>`;

  html += `
    <div class="admin-stat-grid">
      <div class="admin-stat-card"><div class="num" style="color:#10B981">${fmtUsd(totalCost)}</div><div class="label">Total Cost</div></div>
      <div class="admin-stat-card"><div class="num">${fmtNum(totalTokens)}</div><div class="label">Total Tokens</div></div>
      <div class="admin-stat-card"><div class="num">${fmtNum(totalInput)}</div><div class="label">Input</div></div>
      <div class="admin-stat-card"><div class="num">${fmtNum(totalOutput)}</div><div class="label">Output</div></div>
      <div class="admin-stat-card"><div class="num">${fmtNum(totalCacheRead)}</div><div class="label">Cache Read</div></div>
      <div class="admin-stat-card"><div class="num">${cacheHitPct}%</div><div class="label">Cache Hit Rate</div></div>
    </div>`;

  // By Model table
  const models = Object.entries(modelAgg);
  if (models.length > 0) {
    html += `<h4 style="margin:16px 0 8px;color:#94A3B8">By Model</h4>
    <table class="admin-table"><thead><tr><th>Model</th><th>Cost</th><th>Input</th><th>Output</th><th>Cache Read</th><th>Cache Create</th></tr></thead><tbody>`;
    for (const [model, m] of models.sort((a, b) => b[1].cost - a[1].cost)) {
      html += `<tr><td><code>${esc(model)}</code></td><td style="color:#10B981">${fmtUsd(m.cost)}</td><td>${fmtNum(m.inputTokens)}</td><td>${fmtNum(m.outputTokens)}</td><td>${fmtNum(m.cacheReadTokens)}</td><td>${fmtNum(m.cacheCreationTokens)}</td></tr>`;
    }
    html += '</tbody></table>';
  }

  // Daily breakdown table
  if (days.length > 0) {
    html += `<h4 style="margin:16px 0 8px;color:#94A3B8">Daily Breakdown</h4>
    <table class="admin-table"><thead><tr><th>Date</th><th>Cost</th><th>Input</th><th>Output</th><th>Cache Read</th><th>Cache Create</th><th>Total</th><th>Models</th></tr></thead><tbody>`;
    for (const day of [...days].reverse()) {
      html += `<tr><td>${esc(day.date)}</td><td style="color:#10B981">${fmtUsd(day.totalCost)}</td><td>${fmtNum(day.inputTokens)}</td><td>${fmtNum(day.outputTokens)}</td><td>${fmtNum(day.cacheReadTokens)}</td><td>${fmtNum(day.cacheCreationTokens)}</td><td>${fmtNum(day.totalTokens)}</td><td><code style="font-size:10px">${esc((day.modelsUsed || []).join(', '))}</code></td></tr>`;
    }
    html += '</tbody></table>';
  }

  // By Coworker cost breakdown
  const coworkers = data.byCoworker || [];
  if (coworkers.length > 0) {
    const cwSummary = coworkers
      .map((cw) => {
        let cost = 0,
          tokens = 0,
          input = 0,
          output = 0,
          cacheRead = 0,
          cacheCreate = 0;
        for (const d of cw.daily) {
          cost += d.totalCost || 0;
          tokens += d.totalTokens || 0;
          input += d.inputTokens || 0;
          output += d.outputTokens || 0;
          cacheRead += d.cacheReadTokens || 0;
          cacheCreate += d.cacheCreationTokens || 0;
        }
        const models = [...new Set(cw.daily.flatMap((d) => d.modelsUsed || []))];
        return {
          name: cw.groupName,
          cost,
          tokens,
          input,
          output,
          cacheRead,
          cacheCreate,
          models,
          contextStats: cw.contextStats || null,
        };
      })
      .sort((a, b) => b.cost - a.cost);

    html += `<h4 style="margin:16px 0 8px;color:#94A3B8">By Coworker</h4>
    <table class="admin-table"><thead><tr><th>Coworker</th><th>Cost</th><th>Tokens</th><th>Input</th><th>Output</th><th>Cache Read</th><th>Models</th><th title="Per-session peak context (histogram: &lt;25/25-50/50-75/75-90/90%+ of the model window), mean peak %, and compaction count ⟳">Context</th></tr></thead><tbody>`;
    for (const cw of cwSummary) {
      html += `<tr><td>${esc(cw.name)}</td><td style="color:#10B981">${fmtUsd(cw.cost)}</td><td>${fmtNum(cw.tokens)}</td><td>${fmtNum(cw.input)}</td><td>${fmtNum(cw.output)}</td><td>${fmtNum(cw.cacheRead)}</td><td><code style="font-size:10px">${esc(cw.models.join(', '))}</code></td><td>${contextCellHtml(cw.contextStats)}</td></tr>`;
    }
    html += '</tbody></table>';
  }

  if (days.length === 0 && coworkers.length === 0)
    html += '<div class="admin-empty">No usage data yet. Data appears after agent container sessions.</div>';
  el.innerHTML = html;
}

// Wire period filter clicks via event delegation. Metrics now lives inside Overview.
document.getElementById('admin-overview-content')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-metrics-period]');
  if (btn) loadMetricsTokens(btn.dataset.metricsPeriod);
});

// --- 24h Activity ---
async function loadMetricsActivity() {
  const el = document.getElementById('metrics-activity-content');
  try {
    const res = await fetch('/api/activity');
    if (!res.ok) throw new Error('fetch failed');
    const data = await res.json();
    metricsState.loaded.add('activity');
    renderMetricsActivity(data);
  } catch {
    el.innerHTML = '<div class="admin-empty">Failed to load activity data</div>';
  }
}

function renderMetricsActivity(data) {
  const canvas = document.getElementById('metrics-activity-canvas');
  if (!canvas?.parentElement?.clientWidth) return;
  canvas.width = canvas.parentElement.clientWidth - 4;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const legend = document.getElementById('metrics-activity-legend');

  if (!data || data.length === 0) {
    ctx.fillStyle = '#64748B';
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText('No activity data yet', 10, 80);
    return;
  }

  const maxVal = Math.max(...data.map((d) => Math.max(d.inbound, d.outbound)), 1);
  const pairW = Math.max(8, (canvas.width - 40) / data.length - 2);
  const halfBar = pairW / 2 - 1;
  const chartH = canvas.height - 24;

  for (let i = 0; i < data.length; i++) {
    const x = 20 + i * (pairW + 2);
    const inH = (data[i].inbound / maxVal) * chartH;
    const outH = (data[i].outbound / maxVal) * chartH;

    // Side-by-side: inbound (blue) left, outbound (green) right
    ctx.fillStyle = '#3B82F680';
    ctx.fillRect(x, chartH - inH, halfBar, inH);
    ctx.fillStyle = '#10B98180';
    ctx.fillRect(x + halfBar + 1, chartH - outH, halfBar, outH);
  }

  // Labels
  ctx.fillStyle = '#64748B';
  ctx.font = '9px "Courier New", monospace';
  ctx.fillText('24h ago', 20, canvas.height - 2);
  ctx.fillText('now', canvas.width - 30, canvas.height - 2);
  ctx.fillText('max: ' + maxVal, canvas.width - 60, 10);

  if (legend) {
    const totalIn = data.reduce((s, d) => s + d.inbound, 0);
    const totalOut = data.reduce((s, d) => s + d.outbound, 0);
    legend.innerHTML = `<span style="color:#3B82F6;margin-right:12px">&#9632; Inbound: ${totalIn}</span><span style="color:#10B981">&#9632; Outbound: ${totalOut}</span>`;
  }
}

// --- Users ---
async function loadMetricsUsers() {
  const el = document.getElementById('metrics-users-content');
  try {
    const res = await fetch('/api/users');
    if (!res.ok) throw new Error('fetch failed');
    const data = await res.json();
    metricsState.loaded.add('users');
    renderMetricsUsers(el, data);
  } catch {
    el.innerHTML = '<div class="admin-empty">Failed to load users</div>';
  }
}

function renderMetricsUsers(el, users) {
  if (!users || users.length === 0) {
    el.innerHTML = '<div class="admin-empty">No users configured</div>';
    return;
  }

  const privColors = {
    owner: '#EF4444',
    global_admin: '#F59E0B',
    admin: '#F97316',
    member: '#10B981',
    none: '#64748B',
  };
  let html = `<table class="admin-table"><thead><tr><th>Name</th><th>Kind</th><th>Privilege</th><th>Memberships</th><th>DM Channels</th></tr></thead><tbody>`;
  for (const u of users) {
    const badge = `<span style="color:${privColors[u.privilege] || '#64748B'};font-weight:600">${esc(u.privilege)}</span>`;
    const mems = u.memberships.map((m) => esc(m.agent_group_name)).join(', ') || '-';
    const dms = u.dmChannels.map((d) => esc(d.channel_type)).join(', ') || '-';
    html += `<tr><td>${esc(u.display_name || u.id)}</td><td>${esc(u.kind)}</td><td>${badge}</td><td>${mems}</td><td>${dms}</td></tr>`;
  }
  html += '</tbody></table>';
  el.innerHTML = html;
}

// --- Channels ---
async function loadMetricsChannels() {
  const el = document.getElementById('metrics-channels-content');
  try {
    const res = await fetch('/api/channel-status');
    if (!res.ok) throw new Error('fetch failed');
    const data = await res.json();
    metricsState.loaded.add('channels');
    renderMetricsChannels(el, data);
  } catch {
    el.innerHTML = '<div class="admin-empty">Failed to load channel status</div>';
  }
}

function renderMetricsChannels(el, channels) {
  if (!channels || channels.length === 0) {
    el.innerHTML = '<div class="admin-empty">No channels found in src/channels/</div>';
    return;
  }

  let html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">';
  for (const ch of channels) {
    const dot = ch.configured
      ? '<span style="color:#10B981">&#9679;</span>'
      : '<span style="color:#64748B">&#9679;</span>';
    const status = ch.configured
      ? '<span style="color:#10B981;font-size:11px">Connected</span>'
      : '<span style="color:#64748B;font-size:11px">Not configured</span>';
    let groupList = '';
    if (ch.groups.length > 0) {
      groupList =
        '<div style="margin-top:6px;font-size:11px;color:#94A3B8">' +
        ch.groups
          .map((g) => {
            const label = esc(messagingGroupLabel(g)) + (g.is_group ? ' (group)' : '');
            const agents = g.agentGroups ? g.agentGroups.map((a) => esc(a)).join(', ') : '';
            return agents ? `${label} → ${agents}` : label;
          })
          .join('<br>') +
        '</div>';
    }
    html += `<div style="background:#1E293B;border:1px solid #334155;border-radius:8px;padding:12px">
      <div style="display:flex;align-items:center;gap:8px">${dot}<strong style="color:#E2E8F0">${esc(ch.channelType)}</strong>${status}</div>
      <div style="color:#94A3B8;font-size:12px;margin-top:4px">${ch.groupCount} messaging group${ch.groupCount !== 1 ? 's' : ''}</div>
      ${groupList}
    </div>`;
  }
  html += '</div>';
  el.innerHTML = html;
}

function loadAllMetrics() {
  loadMetricsTokens();
  loadMetricsActivity();
  loadMetricsUsers();
  loadMetricsChannels();
}

// Custom CSS zoom removed — use browser zoom (Ctrl+/- or Cmd+/-) instead.
// Clean up stale localStorage from previous custom zoom.
localStorage.removeItem('nanoclaw-zoom');
