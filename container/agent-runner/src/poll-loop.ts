import fs from 'fs';
import path from 'path';

import {
  buildSystemPromptAddendum,
  findByName,
  getAllDestinations,
  getDestinationsFingerprint,
  type DestinationEntry,
} from './destinations.js';
import {
  getPendingMessages,
  markProcessing,
  markCompleted,
  markBounced,
  markFailed,
  markScriptSkipped,
  getMessageInBySeq,
  type MessageInRow,
} from './db/messages-in.js';
import { classifyTurnError } from './transient-error.js';
import { hasIdenticalSend, outboundWatermark, writeMessageOut } from './db/messages-out.js';
import { getInboundDb, touchHeartbeat, clearStaleProcessingAcks } from './db/connection.js';
import {
  clearContinuation,
  getContinuationAgeMs,
  clearCurrentInReplyTo,
  migrateLegacyContinuation,
  setContinuation,
  setCurrentInReplyTo,
  getCostCap,
  setCostCap,
  type CostCapState,
  type CostCapStatus,
  type CostCapWindow,
} from './db/session-state.js';
import { getConfig } from './config.js';
import { priceUsage } from './pricing.js';
import {
  formatMessages,
  extractRouting,
  categorizeMessage,
  isClearCommand,
  isRunnerCommand,
  stripInternalTags,
  type RoutingContext,
} from './formatter.js';
import { classifyAndPrepend } from './intent-router-bridge.js';
import { isUploadTraceCommand, uploadTrace } from './upload-trace.js';
import type { AgentProvider, AgentQuery, ProviderEvent, ProviderExchange } from './providers/types.js';

const POLL_INTERVAL_MS = 1000;
const ACTIVE_POLL_INTERVAL_MS = 500;
// End stream after this many ms with no SDK events.
// Set NANOCLAW_IDLE_END_MS in the container env to override per-agent-group.
const IDLE_END_MS = process.env.NANOCLAW_IDLE_END_MS
  ? Math.max(60_000, parseInt(process.env.NANOCLAW_IDLE_END_MS, 10))
  : 1_200_000;

/**
 * Number of consecutive `database disk image is malformed` errors after which
 * the follow-up poll gives up and exits the process. At ACTIVE_POLL_INTERVAL_MS
 * = 500ms this is roughly 5 seconds — long enough to dodge a transient torn
 * read during a host write, short enough to recover quickly from a poisoned
 * page cache (host-sweep then respawns with a fresh mount).
 */
const CORRUPTION_STREAK_EXIT = 10;

// ── Per-session cost cap (NanoClaw #1, v2 two-window) ─────────────────────────
//
// Live per-session cost accounting + a soft escalation when spend crosses the
// cap. TWO WINDOWS, chosen by immortality:
//
//   - NON-IMMORTAL → 'lifetime': spend accrues across turns AND container
//     respawns; reset only on a new_session batch or /clear. Escalates once per
//     run (a new_session re-arms it).
//   - IMMORTAL (orchestrator/admin) → 'daily': spend accrues per UTC day; a new
//     day resets the counter and re-arms escalation. Immortal groups escalate
//     for visibility only and are NEVER quiesced — the DM itself is the bound.
//
// State is persisted to outbound.db `session_state` under the single `cost_cap`
// JSON key (the shared contract the dashboard reads) so spend survives respawns.
//
// FIX #4: only the Claude provider emits 'usage' events. costEnabled therefore
// requires providerName === 'claude'; other providers accrue nothing and would
// otherwise paint a false-green $0, so we leave the cap disabled (no row → the
// dashboard shows "—").
//
// Module-level because the accounting happens inside `processQuery`'s event
// loop (a free function) while init/override live in `runPollLoop`; one
// container == one session, so a singleton is correct.
const WARN_FRACTION = 0.8;

let costEnabled = false;
let costImmortal = false;
// 'lifetime' for non-immortal, 'daily' for immortal.
let costWindow: CostCapWindow = 'lifetime';
// UTC day ("YYYY-MM-DD") the daily spend belongs to. Only meaningful for the
// daily window; undefined for lifetime.
let costDayKey: string | undefined;
// One "allotment" — the base cap and the amount a 'continue' override adds.
let costAllotmentUsd = 0;
// Effective cap: allotment plus any raises from 'continue' overrides.
let costCapUsd = 0;
let costSpentUsd = 0;
let costEscalatedAt: string | undefined;
let costDecision: 'continue' | 'stop' | undefined;
let costDecidedAt: string | undefined;
// Quiesce marker: a 'stop' override was applied — take no NEW work. Never set
// for immortal groups.
let costStopRequested = false;

/** Current UTC day as "YYYY-MM-DD" — the daily-window bucket key. */
function utcDayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Load persisted cost state once at loop start so accrued spend (and any raised
 * cap / stop decision) survives a container respawn. Immortality comes from the
 * authoritative host-materialized config field, not the persisted row.
 *
 * FIX #4: the cap is enabled only for the Claude provider (the only one that
 * emits 'usage' events). A non-Claude group leaves costEnabled false so no
 * cost_cap row is written — the dashboard renders "—" rather than a false $0.
 *
 * Window handling:
 *  - lifetime (non-immortal): adopt persisted spend/escalation as-is.
 *  - daily (immortal): adopt persisted spend/escalation ONLY if the persisted
 *    dayKey is today's UTC day; a stale day starts fresh at 0.
 */
function initCostTracking(providerName: string): void {
  // getConfig() throws if loadConfig() was never called — the case in poll-loop
  // integration tests that exercise the loop without scaffolding container.json.
  // Cost accounting is simply off there; production always loads config first.
  let cfg: ReturnType<typeof getConfig>;
  try {
    cfg = getConfig();
  } catch {
    costEnabled = false;
    return;
  }
  costAllotmentUsd = cfg.costCapT2Usd && cfg.costCapT2Usd > 0 ? cfg.costCapT2Usd : 0;
  costImmortal = cfg.immortal === true;
  costWindow = costImmortal ? 'daily' : 'lifetime';
  costEnabled = costAllotmentUsd > 0 && providerName === 'claude';
  if (!costEnabled) return;

  const persisted = getCostCap();

  if (costWindow === 'daily') {
    costDayKey = utcDayKey();
    const persistedIsToday = persisted?.dayKey === costDayKey;
    // A fresh UTC day starts back at the p90/day allotment so the daily bound
    // holds day-over-day; only a same-day respawn adopts the persisted (possibly
    // 'continue'-raised) cap, spend, and escalation.
    costCapUsd = persistedIsToday && persisted?.capUsd && persisted.capUsd > 0 ? persisted.capUsd : costAllotmentUsd;
    costSpentUsd = persistedIsToday && persisted?.spentUsd && persisted.spentUsd > 0 ? persisted.spentUsd : 0;
    costEscalatedAt = persistedIsToday ? persisted?.escalatedAt : undefined;
  } else {
    costCapUsd = persisted?.capUsd && persisted.capUsd > 0 ? persisted.capUsd : costAllotmentUsd;
    costDayKey = undefined;
    costSpentUsd = persisted?.spentUsd && persisted.spentUsd > 0 ? persisted.spentUsd : 0;
    costEscalatedAt = persisted?.escalatedAt;
  }
  costDecision = persisted?.decision;
  costDecidedAt = persisted?.decidedAt;
  costStopRequested = persisted?.status === 'stopped' && !costImmortal;

  // Publish immediately so the dashboard shows a cap even before the first turn
  // (and so a flipped immortal flag / window is reflected).
  persistCostCap();
}

/**
 * Reset the LIFETIME window to a fresh allotment — called when a non-immortal
 * session genuinely starts over (a new_session task batch or an explicit
 * /clear). No-op for the immortal daily window (that rolls on the UTC day, not
 * on session boundaries) and when the cap is disabled.
 */
function resetCostForNewSession(): void {
  if (!costEnabled || costWindow !== 'lifetime') return;
  costSpentUsd = 0;
  costCapUsd = costAllotmentUsd;
  costEscalatedAt = undefined;
  costStopRequested = false;
  costDecision = undefined;
  costDecidedAt = undefined;
  persistCostCap();
}

/** Current status band from spent/cap/escalation/stop state. */
function computeCostStatus(): CostCapStatus {
  if (costStopRequested && !costImmortal) return 'stopped';
  if (costSpentUsd >= costCapUsd) return 'escalated';
  if (costSpentUsd >= WARN_FRACTION * costCapUsd) return 'warn';
  return 'ok';
}

function persistCostCap(): void {
  if (!costEnabled) return;
  const state: CostCapState = {
    capUsd: costCapUsd,
    spentUsd: costSpentUsd,
    status: computeCostStatus(),
    immortal: costImmortal,
    window: costWindow,
    // dayKey is present ONLY for the daily window (shared contract #1).
    ...(costWindow === 'daily' && costDayKey ? { dayKey: costDayKey } : {}),
    ...(costEscalatedAt ? { escalatedAt: costEscalatedAt } : {}),
    ...(costDecision ? { decision: costDecision } : {}),
    ...(costDecidedAt ? { decidedAt: costDecidedAt } : {}),
  };
  setCostCap(state);
}

/**
 * Price one usage event, add it to lifetime spend, persist, and fire the
 * one-shot escalation on first crossing. Reprices from the token fields for
 * dashboard parity; falls back to the SDK's own cost only for models the copied
 * rate table doesn't know (so an unpriced model still accrues rather than
 * silently reading $0 forever).
 */
function recordTurnCost(event: Extract<ProviderEvent, { type: 'usage' }>): void {
  if (!costEnabled) return;

  // IMMORTAL daily rollover: crossing into a new UTC day zeroes today's spend
  // and re-arms the once-per-day escalation. The lifetime window never rolls —
  // it resets only on a new_session batch or /clear (resetCostForNewSession).
  if (costWindow === 'daily') {
    const today = utcDayKey();
    if (today !== costDayKey) {
      costDayKey = today;
      costSpentUsd = 0;
      costEscalatedAt = undefined;
      // New day → back to the p90/day allotment; a prior day's 'continue' raise
      // does not carry over (the bound is per-day).
      costCapUsd = costAllotmentUsd;
    }
  }

  // Prefer the per-TTL cache-write split (authoritative for this fleet, which
  // runs 1h prompt caching); fall back to the flat cache_creation field only
  // when no split is reported, matching the dashboard's priceUsage semantics.
  const hasSplit = event.ephemeral1hInputTokens > 0 || event.ephemeral5mInputTokens > 0;
  let delta = priceUsage(getConfig().model, {
    input_tokens: event.inputTokens,
    output_tokens: event.outputTokens,
    cache_read_input_tokens: event.cacheReadInputTokens,
    cache_creation_input_tokens: event.cacheCreationInputTokens,
    ...(hasSplit
      ? {
          cache_creation: {
            ephemeral_1h_input_tokens: event.ephemeral1hInputTokens,
            ephemeral_5m_input_tokens: event.ephemeral5mInputTokens,
          },
        }
      : {}),
  });
  if (delta <= 0 && event.totalCostUsd > 0) delta = event.totalCostUsd; // unpriced model fallback
  if (delta <= 0) return;

  costSpentUsd += delta;

  // One-shot soft escalation on first crossing of the cap. Dedupe via
  // escalatedAt so a warm session that keeps spending only escalates once per
  // allotment (a 'continue' override clears escalatedAt and raises the cap).
  if (costSpentUsd >= costCapUsd && !costEscalatedAt) {
    costEscalatedAt = new Date().toISOString();
    emitCostEscalation();
  }
  persistCostCap();
}

/**
 * Fire the escalation: a kind:'system' outbound row the host's `cost_escalation`
 * delivery action picks up and routes to a human approver (owner/admin). This
 * is the ONLY signal — the runner cannot block on a reply; the human decision
 * returns asynchronously as a `cost_override` inbound row.
 */
function emitCostEscalation(): void {
  const sessionId = process.env.NANOCLAW_SESSION_ID || '';
  writeMessageOut({
    id: generateId(),
    kind: 'system',
    content: JSON.stringify({
      action: 'cost_escalation',
      sessionId,
      spentUsd: Number(costSpentUsd.toFixed(4)),
      capUsd: Number(costCapUsd.toFixed(4)),
      immortal: costImmortal,
      window: costWindow,
    }),
  });
  log(
    `Cost cap escalation: spent=$${costSpentUsd.toFixed(2)} >= cap=$${costCapUsd.toFixed(2)} ` +
      `(immortal=${costImmortal}, window=${costWindow})`,
  );
}

/**
 * Apply a human cost-override decision (from a `cost_override` inbound row).
 *   - continue: clear the escalation, raise the cap by one allotment, resume.
 *   - stop: quiesce (finish current turn, take no new work). Immortal groups
 *     never stop — the decision is recorded but status stays at 'escalated'.
 */
function applyCostOverride(msg: MessageInRow): void {
  if (!costEnabled) return;
  let decision: unknown;
  try {
    decision = (JSON.parse(msg.content) as { decision?: unknown }).decision;
  } catch {
    log(`cost_override with unparseable content — ignoring (id=${msg.id})`);
    return;
  }
  const now = new Date().toISOString();
  if (decision === 'continue') {
    costStopRequested = false;
    costEscalatedAt = undefined;
    costCapUsd += costAllotmentUsd;
    costDecision = 'continue';
    costDecidedAt = now;
    log(`cost_override continue — cap raised to $${costCapUsd.toFixed(2)}, resuming`);
  } else if (decision === 'stop') {
    costDecision = 'stop';
    costDecidedAt = now;
    if (!costImmortal) {
      costStopRequested = true;
      log('cost_override stop — quiescing after current turn, taking no new work');
    } else {
      log('cost_override stop on immortal group — recorded, but immortal never quiesces');
    }
  } else {
    log(`cost_override with unknown decision "${String(decision)}" — ignoring`);
    return;
  }
  persistCostCap();
}

/**
 * User-facing notice for a turn that produced nothing at all, even after the
 * re-send nudge. Delivered so the thread reports the failure instead of just
 * stopping — the whole point of the silent-turn path.
 */
const SILENT_TURN_NOTICE =
  'The agent finished its turn without producing any output, so there is nothing to deliver. ' +
  'Your message was not answered — please re-send it.';

/**
 * True for SQLite errors that indicate a corrupt READ view — almost always a
 * cross-mount page-cache coherency issue on Docker Desktop macOS rather than
 * actual file damage (host-side integrity_check passes). Reopening the DB
 * handle inside this process does NOT recover; only a fresh container mount
 * does. Caller's job is to exit so host-sweep respawns the container.
 */
export function isCorruptionError(msg: string): boolean {
  return (
    msg.includes('database disk image is malformed') ||
    msg.includes('SQLITE_CORRUPT') ||
    msg.includes('file is not a database')
  );
}

function log(msg: string): void {
  console.error(`[poll-loop] ${msg}`);
}

/**
 * Mirror an overlay event to the dashboard's hook-event ingest. Same
 * shape the universal SDK PostToolUse curl uses, with `tool_name="overlay"`
 * and an `event` namespace prefix so the timeline can filter / colorize.
 *
 * Container-runner sets `NANOCLAW_HOOK_URL` when the dashboard is
 * configured; empty value → silent no-op (dashboards don't exist on every
 * install). Errors are swallowed: this is observability, not control flow.
 */
function postOverlayEvent(event: string, extra: Record<string, unknown> = {}): void {
  const url = process.env.NANOCLAW_HOOK_URL;
  if (!url) return;
  const payload = JSON.stringify({
    hook_event_name: event,
    tool_name: 'overlay',
    session_id: process.env.NANOCLAW_SESSION_ID ?? '',
    thread_id: process.env.NANOCLAW_SESSION_THREAD_ID ?? '',
    group: process.env.NANOCLAW_GROUP_FOLDER ?? '',
    ...extra,
  });
  // Fire-and-forget — do not await, do not block dispatch on a slow
  // dashboard. The host curl runs as a child process so we get the same
  // proxy-bypass behavior as the universal hook.
  try {
    const { spawn } = require('child_process') as typeof import('child_process');
    const child = spawn(
      'curl',
      [
        '-sf',
        '--proxy',
        '',
        '-X',
        'POST',
        url,
        '-H',
        'Content-Type: application/json',
        '-H',
        `X-Group-Folder: ${process.env.NANOCLAW_GROUP_FOLDER ?? ''}`,
        '-H',
        `X-NanoClaw-Session-Id: ${process.env.NANOCLAW_SESSION_ID ?? ''}`,
        '-H',
        `X-NanoClaw-Session-Thread-Id: ${process.env.NANOCLAW_SESSION_THREAD_ID ?? ''}`,
        '-d',
        payload,
        '--max-time',
        '3',
      ],
      { stdio: 'ignore', detached: true },
    );
    child.unref();
    child.on('error', () => {});
  } catch {
    // ignore — observability is best-effort
  }
}

/**
 * True iff the message is a scheduled task that explicitly OPTS OUT of the
 * fresh-session default by setting `content.new_session === false`. The
 * default across the system is now fresh-session-on for recurring task
 * batches (see isNewSessionBatch); tasks that genuinely need the stored
 * continuation (chained workflows that carry state in conversation memory,
 * rather than in files) must opt out explicitly.
 *
 * Strict `=== false` matters — an absent key or `true` both participate in
 * the default; only an explicit `false` blocks it. Swallows malformed JSON
 * rather than throwing.
 */
export function taskOptsOutOfNewSession(m: { kind: string; content: string }): boolean {
  if (m.kind !== 'task') return false;
  try {
    return (JSON.parse(m.content) as Record<string, unknown>).new_session === false;
  } catch {
    return false;
  }
}

/**
 * Decide whether a THROWN turn error (outer-catch path) should bounce the a2a
 * trigger for host redrive.
 *
 * The structured-isError bounce in processQuery only fires when the provider
 * YIELDS a result event. A transport death — the SDK's readMessages stream
 * erroring mid-read (e.g. "Connection closed mid-response", ECONNRESET) — is
 * re-raised as a thrown Error instead and lands in runPollLoop's outer catch,
 * bypassing that bounce (the #12108 drop). This re-arms those for host redrive.
 *
 * CRITICAL asymmetry with the result branch: that branch is gated on
 * `event.isError === true`, which PROVES the provider turn itself failed and
 * produced no output — so it can safely bounce even an `unknown` error. The
 * thrown path has NO such proof. A throw reaching this catch can be a genuine
 * provider transport death OR a LOCAL runner exception raised AFTER
 * dispatchResultText already wrote outbound rows (e.g. a downstream throw in
 * the result branch). Bouncing the latter would redrive the trigger and
 * DUPLICATE already-delivered peer messages. So the thrown path only bounces
 * errors we POSITIVELY recognize as transient provider/transport shapes
 * (classifyTurnError === 'transient'); `unknown` and `permanent` both fall
 * through to the unchanged relay+complete path. This is allowlist-driven on
 * purpose — an unrecognized throw is treated as possibly-local, not redriven.
 *
 *   - non-`agent` channel  → null  (never bounce; deliver the notice as today)
 *   - transient error text → 'bounced-transient'  (known provider/transport outage)
 *   - unknown / permanent  → null  (may be a local post-delivery throw — do NOT redrive)
 *
 * Returns 'bounced-transient' to bounce, or null when the turn must NOT bounce.
 */
export function classifyThrownBounce(channelType: string | null, errMsg: string): 'bounced-transient' | null {
  if (channelType !== 'agent') return null;
  return classifyTurnError(errMsg) === 'transient' ? 'bounced-transient' : null;
}

/**
 * Default-on fresh-session policy for recurring task batches:
 *   - Empty batch: false (defensive — no spurious fresh sessions).
 *   - Any chat in the batch: false (mixed batches preserve chat history).
 *   - All-tasks AND at least one opts out via `new_session: false`: false
 *     (safer to preserve continuity than drop it when any task asks).
 *   - All-tasks AND none opts out: true (the common heartbeat/cron case,
 *     now the default without any flag needing to be set).
 *
 * Historical note: PR #58 introduced opt-in (`new_session: true`); PR #106
 * fixed the follow-up-push bypass; empirical prod rollout (slang-discord-
 * support: $0.57 after flip vs $1.00 before, on 11 turns vs 3) confirmed
 * the delta is real enough to make opt-out the sane default.
 */
export function isNewSessionBatch(keep: Array<{ kind: string; content: string }>): boolean {
  return keep.length > 0 && keep.every((m) => m.kind === 'task') && !keep.some(taskOptsOutOfNewSession);
}

/**
 * Idle cap for providers with no transcript of their own to rotate. Mirrors the
 * Claude age knob's default and its disable semantics (non-positive = off).
 */
function continuationMaxIdleMs(): number {
  const raw = process.env.CONTINUATION_MAX_IDLE_DAYS;
  if (raw === undefined || raw.trim() === '') return 14 * 86_400_000;
  const days = Number(raw);
  if (!Number.isFinite(days)) return 14 * 86_400_000;
  return days > 0 ? days * 86_400_000 : Infinity;
}

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Build a per-loop refresher for the destinations section of the system
 * prompt. The host re-projects `inbound.db::destinations` whenever a new
 * coworker is wired up (dashboard/server.ts → refreshRunningSessions),
 * but Claude SDK pins the system prompt at the initial query and never
 * re-reads it for `query.push()` follow-ups. Two-part fix:
 *
 *   1. Always update `systemContext.instructions` so the NEXT fresh query
 *      starts with the current destinations list.
 *   2. Return an inline `[System: destinations updated …]` block that the
 *      caller prepends to the pushed prompt so the agent sees the live
 *      list even while the frozen system prompt is stale.
 *
 * Returns null (no inline note needed) when destinations haven't changed
 * since the last call, or on the very first call (seed observation —
 * otherwise every container's first push carries a redundant note).
 */
function makeDestinationsRefresher(systemContext: PollLoopConfig['systemContext']): () => string | null {
  let last: string | null = null;
  return () => {
    const fp = getDestinationsFingerprint();
    if (fp === last) return null;
    const firstCall = last === null;
    last = fp;
    if (systemContext) systemContext.instructions = buildSystemPromptAddendum();
    if (firstCall) return null;
    log('Destinations changed — refreshed system prompt + push-block');
    return buildDestinationsPushNote();
  };
}

/** Inline system note listing current destinations; prepended to pushed prompts. */
function buildDestinationsPushNote(): string {
  const all = getAllDestinations();
  if (all.length === 0) {
    return '\n[System: destinations updated — you currently have no configured destinations.]\n\n';
  }
  const names = all
    .map((d) => (d.displayName && d.displayName !== d.name ? `${d.name} (${d.displayName})` : d.name))
    .map((s) => `  - ${s}`)
    .join('\n');
  return (
    '\n[System: destinations list updated since your previous turn. Current list:\n' +
    names +
    '\nUse THIS list, not any earlier mention. No restart is needed.]\n\n'
  );
}

export interface PollLoopConfig {
  provider: AgentProvider;
  /**
   * Name of the provider (e.g. "claude", "codex", "opencode"). Used to key
   * the stored continuation per-provider so flipping providers doesn't
   * resurrect a stale id from a different backend.
   */
  providerName: string;
  cwd: string;
  systemContext?: {
    instructions?: string;
  };
  /**
   * Optional stop signal. In production the loop runs until the container
   * dies; tests pass a signal so an abandoned loop actually exits instead of
   * polling forever and stealing messages from the next test's DB.
   */
  signal?: AbortSignal;
  /** Test seam: shorten active-query follow-up polling without changing prod. */
  activePollIntervalMs?: number;
}

/**
 * Main poll loop. Runs indefinitely until the process is killed.
 *
 * 1. Poll messages_in for pending rows
 * 2. Format into prompt, call provider.query()
 * 3. While query active: continue polling, push new messages via provider.push()
 * 4. On result: write messages_out
 * 5. Mark messages completed
 * 6. Loop
 */
export async function runPollLoop(config: PollLoopConfig): Promise<void> {
  // Resume the agent's prior session from a previous container run if one
  // was persisted. The continuation is opaque to the poll-loop — the
  // provider decides how to use it (Claude resumes a .jsonl transcript,
  // other providers may reload a thread ID, etc.). Keyed per-provider so
  // a Codex thread id never gets handed to Claude or vice versa.
  let continuation: string | undefined = migrateLegacyContinuation(config.providerName);

  // Before resuming, drop a session whose on-disk transcript has grown too
  // large/old to cold-resume within the host's idle ceiling. Without this a
  // long-lived hub keeps trying to reload an ever-growing .jsonl, hangs the
  // first turn, and gets killed before it can reply (then repeats forever).
  if (continuation) {
    let rotateReason = config.provider.maybeRotateContinuation?.(continuation, config.cwd);
    // Providers whose history lives server-side legitimately omit that hook
    // (providers/types.ts) — there is no local transcript to measure. They were
    // therefore never rotated at all, at any age. Codex resumed a thread last
    // touched seven weeks earlier on 2026-07-17, returned task_complete with
    // last_agent_message null, and the thread went silent.
    //
    // Only applied when the provider has no rotation of its own, so a
    // file-based provider can never be double-rotated by this. Idle age comes
    // from session_state's existing per-write timestamp — no new bookkeeping,
    // and no size cap: bytes are meaningless when the transcript is not local.
    if (!rotateReason && !config.provider.maybeRotateContinuation) {
      const ageMs = getContinuationAgeMs(config.providerName);
      const maxIdleMs = continuationMaxIdleMs();
      if (ageMs !== null && ageMs > maxIdleMs) {
        rotateReason = `continuation idle ${(ageMs / 86_400_000).toFixed(1)}d > ${(maxIdleMs / 86_400_000).toFixed(0)}d cap`;
      }
    }
    if (rotateReason) {
      log(`Rotating session — ${rotateReason}; starting fresh`);
      clearContinuation(config.providerName);
      continuation = undefined;
    }
  }

  if (continuation) {
    log(`Resuming agent session ${continuation}`);
  }

  // Clear leftover 'processing' acks from a previous crashed container.
  // This lets the new container re-process those messages.
  clearStaleProcessingAcks();

  // Cost cap (NanoClaw #1): load persisted spend so the cap survives respawns,
  // and publish the current cap state for the dashboard. Provider name gates
  // enablement (only Claude emits the 'usage' events the cap prices — FIX #4).
  initCostTracking(config.providerName);

  const refreshDestinations = makeDestinationsRefresher(config.systemContext);

  let pollCount = 0;
  let isFirstPoll = true;
  while (true) {
    if (config.signal?.aborted) return;
    // Skip system messages — they're responses for MCP tools (e.g., ask_user_question)
    const messages = getPendingMessages(isFirstPoll).filter((m) => m.kind !== 'system');
    isFirstPoll = false;
    pollCount++;

    // Periodic heartbeat so we know the loop is alive
    if (pollCount % 30 === 0) {
      log(`Poll heartbeat (${pollCount} iterations, ${messages.length} pending)`);
    }

    if (messages.length === 0) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    // Accumulate gate: if the batch contains only trigger=0 rows
    // (context-only, router-stored under ignored_message_policy='accumulate'),
    // don't wake the agent. Leave them `pending` — they'll ride along the
    // next time a real trigger=1 message lands via this same getPendingMessages
    // query. Without this gate, a warm container keeps processing
    // (and potentially responding to) every accumulate-only batch, defeating
    // the "store as context, don't engage" contract. Host-side countDueMessages
    // gates the same way for wake-from-cold (see src/db/session-db.ts).
    if (!messages.some((m) => m.trigger === 1)) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    // Cost-cap quiesce (NanoClaw #1): after a 'stop' override, take no NEW
    // work — but still process any `cost_override` control rows so a later
    // 'continue' can resume. Normal messages are left `pending` (never
    // markProcessing'd) so they run once the session resumes.
    if (costStopRequested) {
      // Recovery out of a cost stop is TWO-WAY: a cost_override 'continue' (the
      // dashboard button) OR an explicit /clear. A /clear clears the stop and
      // falls through to the normal command path below (which resets the window
      // + continuation). Everything else stays pending until the session resumes.
      const hasClear = messages.some(
        (m) => (m.kind === 'chat' || m.kind === 'chat-sdk') && isClearCommand(m),
      );
      if (!hasClear) {
        const controls = messages.filter((m) => m.kind === 'cost_override');
        if (controls.length === 0) {
          await sleep(POLL_INTERVAL_MS);
          continue;
        }
        const controlIds = controls.map((m) => m.id);
        markProcessing(controlIds);
        for (const c of controls) applyCostOverride(c);
        markCompleted(controlIds);
        continue;
      }
      // /clear present → drop the quiesce and let the normal loop reset us.
      costStopRequested = false;
    }

    const ids = messages.map((m) => m.id);
    markProcessing(ids);

    const routing = extractRouting(messages);

    // Command handling: the host router gates filtered and unauthorized
    // admin commands before they reach the container. The only command
    // the runner handles directly is /clear (session reset).
    const normalMessages: MessageInRow[] = [];
    const commandIds: string[] = [];

    for (const msg of messages) {
      // Cost-cap override (NanoClaw #1): a human decision from the dashboard.
      // Applied to the in-memory cost state and acked — never fed to the agent.
      if (msg.kind === 'cost_override') {
        applyCostOverride(msg);
        commandIds.push(msg.id);
        continue;
      }
      if ((msg.kind === 'chat' || msg.kind === 'chat-sdk') && isClearCommand(msg)) {
        log('Clearing session (resetting continuation)');
        continuation = undefined;
        clearContinuation(config.providerName);
        // /clear is a genuine restart — zero the lifetime cost window too so the
        // fresh conversation starts on a fresh allotment (no-op for daily).
        resetCostForNewSession();
        writeMessageOut({
          id: generateId(),
          kind: 'chat',
          platform_id: routing.platformId,
          channel_type: routing.channelType,
          thread_id: routing.threadId,
          content: JSON.stringify({ text: 'Session cleared.' }),
        });
        commandIds.push(msg.id);
        continue;
      }
      if ((msg.kind === 'chat' || msg.kind === 'chat-sdk') && isUploadTraceCommand(msg)) {
        log('Uploading session trace to Hugging Face');
        writeMessageOut({
          id: generateId(),
          kind: 'chat',
          platform_id: routing.platformId,
          channel_type: routing.channelType,
          thread_id: routing.threadId,
          content: JSON.stringify({ text: uploadTrace() }),
        });
        commandIds.push(msg.id);
        continue;
      }
      normalMessages.push(msg);
    }

    if (commandIds.length > 0) {
      markCompleted(commandIds);
    }

    if (normalMessages.length === 0) {
      const remainingIds = ids.filter((id) => !commandIds.includes(id));
      if (remainingIds.length > 0) markCompleted(remainingIds);
      log(`All ${messages.length} message(s) were commands, skipping query`);
      continue;
    }

    // Pre-task scripts: for any task rows with a `script`, run it before the
    // provider call. Scripts returning wakeAgent=false (or erroring) gate
    // their own task row only — surviving messages still go to the agent.
    // Without the scheduling module, the marker block is empty, `keep`
    // falls back to `normalMessages`, and no gating happens.
    let keep: MessageInRow[] = normalMessages;
    let skipped: Array<{ id: string; reason: string }> = [];
    // MODULE-HOOK:scheduling-pre-task:start
    const { applyPreTaskScripts } = await import('./scheduling/task-script.js');
    const preTask = await applyPreTaskScripts(normalMessages);
    keep = preTask.keep;
    skipped = preTask.skipped;
    if (skipped.length > 0) {
      markScriptSkipped(skipped);
      log(`Pre-task script skipped ${skipped.length} task(s): ${skipped.map((s) => s.id).join(', ')}`);
    }
    // MODULE-HOOK:scheduling-pre-task:end

    if (keep.length === 0) {
      log(`All ${normalMessages.length} non-command message(s) gated by script, skipping query`);
      continue;
    }

    // Scheduled tasks with new_session:true run in a fresh context so
    // heartbeat/cron history doesn't accumulate across runs. Only applies
    // when the entire batch is tasks (no chat messages mixed in) — mixed
    // batches default to the stored continuation so chat history is preserved.
    const newSessionBatch = isNewSessionBatch(keep);
    // A fresh-session batch starts the conversation over — reset the lifetime
    // cost window to a new allotment (no-op for the immortal daily window).
    if (newSessionBatch) resetCostForNewSession();

    // Format messages: passthrough commands get raw text (only if the
    // provider natively handles slash commands), others get XML.
    let prompt = formatMessagesWithCommands(keep, config.provider.supportsNativeSlashCommands);

    // Non-native providers: run intent router on the initial prompt too.
    // Claude SDK fires UserPromptSubmit hooks natively; for Codex/OpenCode
    // we call the same bridge so workflow classification applies to every
    // user message regardless of provider.
    if (!config.provider.supportsNativeSlashCommands) {
      prompt = await classifyAndPrepend(prompt);
    }

    log(`Processing ${keep.length} message(s), kinds: ${[...new Set(keep.map((m) => m.kind))].join(',')}`);
    if (newSessionBatch) log('new_session flag set — running task in fresh context');

    // Pick up destination changes the host wrote mid-session so the agent
    // sees new coworkers without requiring a container restart.
    refreshDestinations();

    const query = config.provider.query({
      prompt,
      continuation: newSessionBatch ? undefined : continuation,
      cwd: config.cwd,
      systemContext: config.systemContext,
    });

    // Process the query while concurrently polling for new messages
    const skippedSet = new Set(skipped.map((s) => s.id));
    const processingIds = ids.filter((id) => !commandIds.includes(id) && !skippedSet.has(id));
    // Publish the batch's in_reply_to so MCP tools (send_message, send_file)
    // can stamp it on outbound rows — needed for a2a return-path routing.
    setCurrentInReplyTo(routing.inReplyTo);
    let queryResult: QueryResult | undefined;
    // Trigger ids bounced via the THROWN-error path (outer catch) this turn.
    // Kept separate from queryResult.bouncedIds because a throw means
    // processQuery never returned a result to carry them.
    let thrownBouncedIds: string[] = [];
    try {
      queryResult = await processQuery(
        query,
        routing,
        processingIds,
        config.providerName,
        newSessionBatch,
        refreshDestinations,
        config.provider.onExchangeComplete?.bind(config.provider),
        prompt,
        continuation,
        config.signal,
        config.activePollIntervalMs,
      );
      // Don't overwrite the stored chat continuation with a task's ephemeral session.
      if (!newSessionBatch && queryResult.continuation && queryResult.continuation !== continuation) {
        continuation = queryResult.continuation;
        setContinuation(config.providerName, continuation);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log(`Query error: ${errMsg}`);

      // Stale/corrupt continuation recovery: ask the provider whether
      // this error means the stored continuation is unusable, and clear
      // it so the next attempt starts fresh.
      if (continuation && config.provider.isSessionInvalid(err)) {
        log(`Stale session detected (${continuation}) — clearing for next retry`);
        continuation = undefined;
        clearContinuation(config.providerName);
      }

      // a2a bounce on the THROWN-error path (#12108). The structured-isError
      // bounce in processQuery only fires when the provider YIELDS a result
      // event. But a transport death — the SDK's readMessages stream erroring
      // mid-read (e.g. "Connection closed mid-response", ECONNRESET) — is
      // re-raised as `Error("Claude Code returned an error result: <text>")`
      // and lands HERE instead, bypassing that bounce. Without this, such a
      // turn relayed the raw error to the peer and was acked completed
      // (tries=0), permanently consuming an un-actioned a2a handoff — the exact
      // #12108 drop. classifyThrownBounce mirrors the result-branch decision:
      // on an `agent` edge a transient/unknown error bounces (trigger left
      // un-acked for the host redrive sweep, blip NOT relayed to the peer);
      // permanent errors and non-a2a channels fall through to the unchanged
      // write-error-and-complete path.
      const thrownBounce = classifyThrownBounce(routing.channelType, errMsg);
      if (thrownBounce) {
        markBounced(processingIds, thrownBounce);
        thrownBouncedIds = processingIds;
        log(
          `a2a thrown-error bounce (${thrownBounce}) — trigger left pending for host redrive: ` + errMsg.slice(0, 80),
        );
      } else {
        // Write error response so the user knows something went wrong
        writeMessageOut({
          id: generateId(),
          kind: 'chat',
          platform_id: routing.platformId,
          channel_type: routing.channelType,
          thread_id: routing.threadId,
          content: JSON.stringify({ text: `Error: ${errMsg}` }),
        });

        // The batch is still acked completed below (no redelivery). Without
        // this line the only log trace of the errored turn is "Query error"
        // followed by a "Completed" line that reads like success.
        log(`Errored batch will be acked completed — ${processingIds.length} message(s), no redelivery`);
      }
    } finally {
      clearCurrentInReplyTo();
    }

    // A caller-requested stop is not a completed turn. If the query already
    // produced a result, processQuery handled its normal ack; otherwise leave the
    // processing claim for the next container/test loop to reset instead of
    // consuming an unanswered message.
    if (config.signal?.aborted) return;

    // Ensure completed even if processQuery ended without a result event
    // (e.g. stream closed unexpectedly). EXCLUDE any ids marked as a transient
    // a2a bounce — completing them here would clobber the 'bounced-*' marker
    // back to 'completed' and permanently consume the un-actioned handoff. This
    // covers both bounce paths: the structured-result bounce (queryResult.
    // bouncedIds) and the thrown-error bounce (thrownBouncedIds) above.
    // Silent turns (queryResult.undeliveredIds) are excluded for the same
    // reason: they were acked 'failed' after delivering a failure notice, and
    // overwriting that with 'completed' is exactly how the silence used to
    // disappear from the record.
    const skipAck = new Set([
      ...(queryResult?.bouncedIds ?? []),
      ...(queryResult?.undeliveredIds ?? []),
      ...thrownBouncedIds,
    ]);
    const ackedIds = processingIds.filter((id) => !skipAck.has(id));
    markCompleted(ackedIds);
    log(
      skipAck.size > 0
        ? `Completed ${ackedIds.length} message(s); ${skipAck.size} NOT completed (bounced or undelivered)`
        : `Completed ${ids.length} message(s)`,
    );
  }
}

/**
 * For non-native providers, resolve a slash command to its SKILL.md body.
 * Claude Code's SDK loads SKILL.md on demand via its Skill tool; for Codex
 * and other providers we inject the body directly into the prompt so the
 * agent gets the same information without needing to `cat` the file.
 */
function resolveSkillBody(command: string): string | null {
  const skillName = command.replace(/^\//, '').split(/\s/)[0];
  if (!skillName) return null;

  const agentDirs: string[] = [];
  try {
    agentDirs.push(...fs.readdirSync('/workspace/agent'));
  } catch {
    /* /workspace/agent may not exist */
  }

  const candidates = [
    path.join('/home/node/.claude/skills', skillName, 'SKILL.md'),
    // Additional dirs: cloned repos may put skills under the agent workspace
    ...agentDirs.flatMap((dir) => {
      const p = path.join('/workspace/agent', dir, '.claude', 'skills', skillName, 'SKILL.md');
      return fs.existsSync(p) ? [p] : [];
    }),
  ];

  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) continue;
      let body = fs.readFileSync(candidate, 'utf-8');
      // Strip YAML frontmatter
      body = body.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');
      return body.trim();
    } catch {
      /* skip */
    }
  }
  return null;
}

/**
 * Format messages, handling passthrough commands differently.
 * When the provider handles slash commands natively (Claude Code),
 * passthrough commands are sent raw (no XML wrapping) so the SDK can
 * dispatch them. For non-native providers, skill bodies are resolved and
 * injected so the agent gets the full SKILL.md content on invocation.
 */
function formatMessagesWithCommands(messages: MessageInRow[], nativeSlashCommands: boolean): string {
  const parts: string[] = [];
  const normalBatch: MessageInRow[] = [];

  for (const msg of messages) {
    if (msg.kind === 'chat' || msg.kind === 'chat-sdk') {
      const cmdInfo = categorizeMessage(msg);
      if (cmdInfo.category === 'passthrough' || cmdInfo.category === 'admin') {
        if (nativeSlashCommands) {
          // Flush normal batch first
          if (normalBatch.length > 0) {
            parts.push(formatMessages(normalBatch));
            normalBatch.length = 0;
          }
          // Pass raw command text (no XML wrapping) — SDK handles it natively
          parts.push(cmdInfo.text);
          continue;
        }

        // Non-native provider: resolve SKILL.md body and inject it
        if (cmdInfo.category === 'passthrough') {
          const body = resolveSkillBody(cmdInfo.command);
          if (body) {
            if (normalBatch.length > 0) {
              parts.push(formatMessages(normalBatch));
              normalBatch.length = 0;
            }
            const args = cmdInfo.text.slice(cmdInfo.command.length).trim();
            parts.push(
              `<skill-invocation name="${cmdInfo.command.slice(1)}"${args ? ` args="${args}"` : ''}>\n${body}\n</skill-invocation>`,
            );
            continue;
          }
        }
      }
    }
    normalBatch.push(msg);
  }

  if (normalBatch.length > 0) {
    parts.push(formatMessages(normalBatch));
  }

  return parts.join('\n\n');
}

interface QueryResult {
  continuation?: string;
  // Trigger ids that were marked as a transient a2a bounce (markBounced) this
  // turn instead of completed. The outer poll loop must EXCLUDE these from its
  // fallback markCompleted, or it would clobber the bounce marker back to
  // 'completed' and permanently consume the un-actioned handoff.
  bouncedIds?: string[];
  // Ids acked `failed` because the turn delivered nothing at all (see the
  // silent-turn branch in processQuery). Same contract as bouncedIds: the
  // outer loop's fallback markCompleted must skip them, or it would overwrite
  // the failure with 'completed' and the silence would go unrecorded again.
  undeliveredIds?: string[];
}

export async function processQuery(
  query: AgentQuery,
  routing: RoutingContext,
  initialBatchIds: string[],
  providerName: string,
  skipPersistContinuation = false,
  refreshDestinations: () => string | null = () => null,
  onExchangeComplete: ((exchange: ProviderExchange) => void) | undefined = undefined,
  initialPrompt = '',
  initialContinuation: string | undefined = undefined,
  signal?: AbortSignal,
  activePollIntervalMs = ACTIVE_POLL_INTERVAL_MS,
): Promise<QueryResult> {
  let queryContinuation: string | undefined;
  let done = false;
  let lastEventTime = Date.now();
  let unwrappedNudged = false;
  // Once-per-turn guard for the task-run "<message> block was not delivered"
  // nudge — mirrors unwrappedNudged for chat turns.
  let taskBlockNudged = false;
  // Trigger ids marked as a transient a2a bounce this turn (see the result
  // branch). Returned so the outer loop's fallback markCompleted skips them.
  const bouncedIds: string[] = [];
  // Ids acked 'failed' by finalizeSilentTurn. Same contract as bouncedIds.
  const undeliveredIds: string[] = [];
  // Once-per-batch guard for the silent-turn re-send nudge, and the flag that
  // says a nudged turn is still awaiting its retry (so nothing is acked yet).
  let silentTurnNudged = false;
  let silentTurnOpen = false;
  // Outbound watermark at the start of the current turn. A turn that ends with
  // no text is only truly silent if this has not moved (see the silent-turn
  // branch); resampled after every result event.
  let turnWatermark = outboundWatermark();
  // Prompt queue for the exchange hook — each result event consumes the
  // oldest unanswered prompt, except a wrapping-retry result, which answers
  // the same prompt again. Unused (and unmaintained) when the provider
  // doesn't implement `onExchangeComplete`.
  const archivePrompts: string[] = [initialPrompt];

  /**
   * Close out a turn that delivered nothing by any path: emit a durable,
   * user-visible notice (so the thread does not just stop) and ack the batch
   * 'failed' — never 'completed'. `failed` is deliberate: syncProcessingAcks
   * maps it onto the inbound row, so the silence is recorded once and the
   * message is not re-driven into an identical silent turn forever.
   */
  const finalizeSilentTurn = (resultText: string | null): void => {
    silentTurnOpen = false;
    log('Turn delivered nothing (no text, no outbound row) — acking failed, not completed');
    if (routing.channelType && routing.platformId && routing.channelType !== 'system') {
      writeMessageOut({
        id: generateId(),
        in_reply_to: routing.inReplyTo,
        kind: 'chat',
        platform_id: routing.platformId,
        channel_type: routing.channelType,
        thread_id: routing.threadId,
        content: JSON.stringify({ text: SILENT_TURN_NOTICE }),
      });
    } else {
      log('No deliverable routing for the silent-turn notice — recorded in the log only');
    }
    notifyExchangeComplete(onExchangeComplete, {
      prompt: archivePrompts[0] ?? initialPrompt,
      result: resultText,
      continuation: queryContinuation ?? initialContinuation,
      status: 'undelivered',
    });
    archivePrompts.shift();
    for (const id of initialBatchIds) markFailed(id);
    undeliveredIds.push(...initialBatchIds);
  };

  // Concurrent polling: push follow-ups into the active query as they arrive.
  // We do NOT force-end the stream on silence — keeping the query open avoids
  // re-spawning the SDK subprocess (~few seconds) and re-loading the .jsonl
  // transcript on every turn. The Anthropic prompt cache is server-side with
  // a 5-min TTL keyed on prefix hash, so stream lifecycle does NOT affect
  // cache lifetime — close+reopen within 5 min still gets cache hits.
  // Stream liveness is decided host-side via the heartbeat file + processing
  // claim age (see src/host-sweep.ts); if something is truly stuck, the host
  // will kill the container and messages get reset to pending.
  let pollInFlight = false;
  let endedForCommand = false;
  let corruptionStreak = 0;
  const onSignalAbort = () => query.abort();
  signal?.addEventListener('abort', onSignalAbort, { once: true });
  const pollHandle = setInterval(() => {
    if (done || pollInFlight || endedForCommand) return;
    pollInFlight = true;

    void (async () => {
      try {
        const pending = getPendingMessages();

        // Slash commands need a fresh query: /clear resets the SDK's
        // resume id (fixed at sdkQuery() time); admin/passthrough commands
        // (/compact, /cost, …) only dispatch when they're the first input
        // of a query — pushed mid-stream they arrive as plain text and
        // the SDK never runs them. Abort the active stream and leave the
        // rows pending; the outer loop handles them on next iteration via
        // the canonical command path + formatMessagesWithCommands. Abort,
        // not end: end() lets an in-flight turn run to completion, which
        // can block the command (e.g. /clear during a long task) for as
        // long as the turn takes.
        if (pending.some((m) => isRunnerCommand(m))) {
          log('Pending slash command — aborting active stream so outer loop can process');
          endedForCommand = true;
          query.abort();
          return;
        }

        // Skip system messages (MCP tool responses) and /clear (needs fresh query).
        // Thread routing is the router's concern — if a message landed in this
        // session, the agent should see it. Per-thread sessions already isolate
        // threads into separate containers; shared sessions intentionally merge
        // everything. Filtering on thread_id here caused deadlocks when the
        // initial batch and follow-ups had mismatched thread_ids (e.g. a
        // host-generated welcome trigger with null thread vs a Discord DM reply).
        const newMessages = pending.filter((m) => {
          if (m.kind === 'system') return false;
          if ((m.kind === 'chat' || m.kind === 'chat-sdk') && isClearCommand(m)) return false;
          return true;
        });

        // Cost-cap override mid-query (FIX #1): the router writes cost_override
        // with trigger:1, so without this it would fall through the trigger gate
        // below, get pushed to the provider as a bogus prompt, and be
        // markCompleted'd — applyCostOverride would NEVER run mid-query. Extract
        // and apply these BEFORE the trigger gate (and before routing promotion,
        // so the override's dashboard routing can't hijack the real routing),
        // ack them, and drop them from newMessages so they never reach
        // query.push. A 'stop' quiesces promptly: end the active stream and
        // return so the outer loop settles into the stop state.
        const overrides = newMessages.filter((m) => m.kind === 'cost_override');
        if (overrides.length > 0) {
          const overrideIds = overrides.map((m) => m.id);
          markProcessing(overrideIds);
          for (const o of overrides) applyCostOverride(o);
          markCompleted(overrideIds);
          for (const o of overrides) {
            const idx = newMessages.indexOf(o);
            if (idx >= 0) newMessages.splice(idx, 1);
          }
          if (costStopRequested) {
            log('cost_override stop applied mid-query — ending active stream to quiesce');
            endedForCommand = true;
            query.end();
            return;
          }
        }

        if (newMessages.length === 0) {
          // End stream when agent is idle: no SDK events and no pending messages
          if (Date.now() - lastEventTime > IDLE_END_MS) {
            log(`No SDK events for ${IDLE_END_MS / 1000}s, ending query`);
            query.end();
          }
          return;
        }

        // new_session bypass guard: if any arriving task defaults to fresh
        // session (a task kind with no `new_session: false` opt-out), DO NOT
        // push into the active query — that would resume the stored
        // continuation and defeat the default. End the active query instead;
        // the next poll iteration's initial-batch path will pick up the
        // pending rows via the fresh-session path. Leave rows as 'pending'.
        const wantsFreshSession = (m: { kind: string; content: string }) =>
          m.kind === 'task' && !taskOptsOutOfNewSession(m);
        if (newMessages.some(wantsFreshSession)) {
          log(
            `fresh-session task arrived mid-query (${newMessages.length} msg) — ending active query to route through fresh-session path`,
          );
          query.end();
          done = true;
          return;
        }

        // Update the shared routing when a follow-up brings richer routing
        // than the initial batch had.
        const followUpRouting = extractRouting(newMessages);
        if (followUpRouting.channelType && followUpRouting.platformId) {
          if (!routing.channelType || !routing.platformId) {
            log(
              `Promoting routing from follow-up (${followUpRouting.channelType}:${followUpRouting.platformId}); initial routing was null`,
            );
          }
          routing = followUpRouting;
        }

        // Accumulated context must not engage a warm query by itself.
        if (!newMessages.some((m) => m.trigger === 1)) return;

        const newIds = newMessages.map((m) => m.id);
        markProcessing(newIds);

        // Run pre-task scripts on follow-ups too — without this, a task that
        // arrives during an active query (e.g. a */10 monitoring cron) bypasses
        // its script gate and always wakes the agent, defeating the gate.
        let keep = newMessages;
        let skipped: Array<{ id: string; reason: string }> = [];
        // MODULE-HOOK:scheduling-pre-task-followup:start
        const { applyPreTaskScripts } = await import('./scheduling/task-script.js');
        const preTask = await applyPreTaskScripts(newMessages);
        keep = preTask.keep;
        skipped = preTask.skipped;
        if (skipped.length > 0) {
          markScriptSkipped(skipped);
          log(`Pre-task script skipped ${skipped.length} follow-up task(s): ${skipped.map((s) => s.id).join(', ')}`);
        }
        // MODULE-HOOK:scheduling-pre-task-followup:end

        if (keep.length === 0) return;
        // Re-check done — the outer query may have finished while the script
        // was awaited.
        if (done) return;

        const keptIds = keep.map((m) => m.id);
        const prompt = formatMessages(keep);
        // The SDK fires UserPromptSubmit (and the intent-router hook) only on
        // the initial query prompt. Mid-query pushes bypass the hook, so run
        // the router ourselves here so workflow classification is applied to
        // every user message — not just the first.
        let routedPrompt = await classifyAndPrepend(prompt);
        // Claude SDK pins the system prompt to the initial query — pushed
        // follow-ups don't re-read it. If destinations changed since the
        // last push, inline the current list so the agent sees it alongside
        // this user message even though its frozen system prompt is stale.
        const destNote = refreshDestinations();
        if (destNote) routedPrompt = destNote + routedPrompt;
        log(`Pushing ${keep.length} follow-up message(s) into active query`);
        unwrappedNudged = false;
        taskBlockNudged = false;
        query.push(routedPrompt);
        archivePrompts.push(prompt);
        markCompleted(keptIds);
        lastEventTime = Date.now(); // new input counts as activity
      } catch (err) {
        // Without this catch the rejection escapes the void IIFE and Node
        // terminates the container on unhandled-rejection.
        const errMsg = err instanceof Error ? err.message : String(err);
        log(`Follow-up poll error: ${errMsg}`);

        // Detect SQLite cross-mount corruption (Docker Desktop macOS virtiofs /
        // gRPC-FUSE coherency bug — the kernel page cache for the inbound.db
        // bind mount can latch a torn snapshot mid-host-write, after which
        // every fresh openInboundDb() in this process sees the same broken
        // view. Reopening inside the container does NOT recover; only a fresh
        // container mount does. Exit so the host sweep respawns us.
        if (isCorruptionError(errMsg)) {
          corruptionStreak += 1;
          if (corruptionStreak >= CORRUPTION_STREAK_EXIT) {
            log(
              `Follow-up poll: ${corruptionStreak} consecutive '${errMsg}' errors — ` +
                `inbound.db page cache is poisoned. Exiting so host respawns with a fresh mount.`,
            );
            // Stop touching the heartbeat so host-sweep stale detection fires
            // promptly even if exit() races with in-flight async work.
            done = true;
            clearInterval(pollHandle);
            // Defer exit one tick so this log line flushes through Docker's
            // log driver before the process dies.
            setTimeout(() => process.exit(75), 100);
          }
        } else {
          corruptionStreak = 0;
        }
      } finally {
        pollInFlight = false;
      }
    })();
  }, activePollIntervalMs);

  try {
    for await (const event of query.events) {
      lastEventTime = Date.now();
      handleEvent(event, routing);
      touchHeartbeat();

      // Cost cap (NanoClaw #1): reprice each turn's usage, accrue lifetime
      // spend, persist, and fire the one-shot soft escalation on cap crossing.
      if (event.type === 'usage') recordTurnCost(event);

      if (event.type === 'init') {
        queryContinuation = event.continuation;
        // Persist immediately so a mid-turn container crash still lets the
        // next wake resume the conversation. Without this, the session id
        // was only written after the full stream completed — if the
        // container died between `init` and `result`, the SDK session was
        // effectively orphaned and the next message started a blank
        // Claude session with no prior context.
        if (!skipPersistContinuation) setContinuation(providerName, event.continuation);
      } else if (event.type === 'result') {
        // A result — with or without text — means the turn is done. We normally
        // mark the initial batch completed (at the BOTTOM of this branch) so the
        // host sweep doesn't see stale 'processing' claims while the query stays
        // open for follow-up pushes.
        // EXCEPTION — a2a bounce (#943): a FAILED turn (structured isError) that
        // classifies transient/unknown on an a2a edge must NOT be ack'd (that
        // permanently consumes an un-actioned handoff — the #12097 bug). We skip
        // dispatch entirely (do NOT relay the auth blip to the peer) and leave
        // the trigger un-acked so the host redrive sweep re-arms it. Permanent
        // errors and non-a2a channels fall through to the normal dispatch path.
        let bounced = false;
        // Any result closes out an open silent turn: either it delivered (and
        // acks normally below) or it was silent again (and the branch at the
        // bottom finalizes it, because silentTurnNudged is already set).
        silentTurnOpen = false;
        const bounceClass =
          event.isError === true && event.text && routing.channelType === 'agent'
            ? classifyTurnError(event.text)
            : 'permanent';
        if (event.isError === true && event.text && routing.channelType === 'agent' && bounceClass !== 'permanent') {
          markBounced(initialBatchIds, bounceClass === 'transient' ? 'bounced-transient' : 'bounced-unknown');
          bouncedIds.push(...initialBatchIds);
          bounced = true;
          log(
            `a2a transient bounce (${bounceClass}) — trigger left pending for host redrive: ` + event.text.slice(0, 80),
          );
          notifyExchangeComplete(onExchangeComplete, {
            prompt: archivePrompts[0] ?? initialPrompt,
            result: event.text,
            continuation: queryContinuation ?? initialContinuation,
            status: 'error',
          });
          archivePrompts.shift();
        } else if (event.text?.trim()) {
          const { sent, hasUnwrapped, danglingOpen, gateRefusals, taskBlocks } = dispatchResultText(
            event.text,
            routing,
          );
          const willRetryTaskBlocks = shouldNudgeTaskBlocks(routing.taskRun, taskBlocks, taskBlockNudged);
          // Gate refusals are sender feedback — push them back to the emitting
          // agent so it re-sends correctly (parity with the bash-hook gates).
          // The gates' own 3-denial soft-cap bounds the re-send loop.
          if (gateRefusals?.length) {
            query.push(`<system>${gateRefusals.join('\n\n')}</system>`);
          }
          // One-door task delivery: the final text becomes the run log entry
          // while explicit append-log calls remain optional additive notes.
          // Errors included: a failed run's text belongs in its log, not chat.
          // A corrective retry handles delivery only; its result is not a
          // second run summary.
          if (routing.taskRun && !taskBlockNudged) autoAppendTaskLog(event.text);
          if (sent === 0 && event.isError === true && !routing.taskRun) {
            // Non-retryable error turn (e.g. a 403 billing_error) on a
            // non-task channel, whose text dispatchResultText could not route:
            // skip the re-wrap nudge — it would just re-hammer the failing
            // gateway turn after turn. The common case (plain error text, known
            // channel) is already delivered by the auto-route gate above.
            //
            // NOTE: the `deliverErrorResult(event.text, routing)` call that used
            // to head this branch was dropped by the e77ee838e2 upstream-sync
            // merge, which also left this comment truncated mid-sentence. It is
            // deliberately NOT restored here: as written it also fired when the
            // critique/routing gates had BLOCKED every <message> block, which
            // would push the withheld body straight to the channel. Restoring a
            // safe version needs `blocked` out of dispatchResultText and a rule
            // for un-routable turns — its own change, not this one.
            notifyExchangeComplete(onExchangeComplete, {
              prompt: archivePrompts[0] ?? initialPrompt,
              result: event.text,
              continuation: queryContinuation ?? initialContinuation,
              status: 'error',
            });
            archivePrompts.shift();
          } else {
            const willRetryWrapping = hasUnwrapped && !unwrappedNudged;
            // A turn with no meaningful text never reaches here — the branch
            // below owns it. (It used to be tested for HERE, inside a branch
            // gated on `event.text`, which made the check dead for the exact
            // `text: null` silent turn it was written to catch.)
            notifyExchangeComplete(onExchangeComplete, {
              prompt: archivePrompts[0] ?? initialPrompt,
              result: event.text,
              continuation: queryContinuation ?? initialContinuation,
              status: hasUnwrapped || willRetryTaskBlocks ? 'undelivered' : 'completed',
            });
            if (willRetryWrapping) {
              unwrappedNudged = true;
              const destinations = getAllDestinations();
              const names = destinations.map((d) => d.name).join(', ');
              // Fork: distinguish a dangling-open <message> tag from a fully
              // unwrapped response so the nudge tells the agent which to fix.
              const reason = danglingOpen
                ? `Your response was not delivered — you opened a <message to="…"> tag but never emitted the matching </message> close tag. ` +
                  `Each block must be self-contained in the same response: <message to="name">…</message>. ` +
                  `Re-send the full block with both tags.`
                : `Your response was not delivered — it was not wrapped in <message to="name">...</message> blocks. ` +
                  `All output must be wrapped: use <message to="name"> for content to send, or <internal> for scratchpad. ` +
                  `Please re-send your response with the correct wrapping.`;
              query.push(`<system>${reason} Your destinations: ${names}.</system>`);
            }
            if (willRetryTaskBlocks) {
              taskBlockNudged = true;
              const names = getAllDestinations()
                .map((d) => d.name)
                .join(', ');
              query.push(buildTaskBlockNudge(taskBlocks, names));
            }
            // A retry result (wrapping or task-block nudge) answers the SAME
            // user prompt — keep it queued so the retry archives against it,
            // not the nudge text.
            if (!willRetryWrapping && !willRetryTaskBlocks) archivePrompts.shift();
          }
        } else {
          // SILENT TURN — the result carried no usable text (`null`, or blank).
          // A turn that delivered nothing by ANY path is not "completed": the
          // thread simply stops, with no error for anyone to notice. Codex
          // reaches here routinely — it emits turn/completed with
          // last_agent_message null (observed 2026-07-17: 7.5s turn, zero
          // output, acked completed, thread dead) and never sets isError, so
          // the bounce branch above can't catch it either. Claude has the same
          // hole structurally.
          //
          // The outbound watermark, NOT `sent`, is the discriminator: the MCP
          // tools (send_message, send_file) run in a separate stdio process,
          // so a turn that answered purely through a tool call moves the
          // watermark while `sent` stays 0. Task runs legitimately end with no
          // chat message (they append to a run log) and are excluded.
          const producedOutput = outboundWatermark() > turnWatermark;
          if (producedOutput || routing.taskRun) {
            archivePrompts.shift();
          } else if (!silentTurnNudged && event.isError !== true) {
            // Recovery attempt #1, owned by the poll loop (not by an optional
            // provider hook no production provider implements): ask for the
            // answer again on the SAME open query. Nothing is acked yet, and
            // the prompt stays queued so the retry archives against the user's
            // message rather than against this nudge.
            silentTurnNudged = true;
            silentTurnOpen = true;
            const names = getAllDestinations()
              .map((d) => d.name)
              .join(', ');
            log('Turn produced no output at all — pushing a re-send nudge before acking anything');
            query.push(
              `<system>Your last turn produced NO output — no final text and no message sent. ` +
                `Nothing reached the user, who is still waiting on the message above. ` +
                `Re-send your answer now, wrapped in <message to="name">...</message>. ` +
                `Your destinations: ${names}.</system>`,
            );
          } else {
            // Either the nudged retry came back empty too, or the turn was
            // already flagged as an error (re-asking would just re-hammer it).
            // Emit the durable notice and ack failed.
            finalizeSilentTurn(event.text);
          }
        }
        // Ack the turn as completed UNLESS it was a transient a2a bounce (left
        // pending above for the host redrive), it delivered nothing and was
        // acked 'failed' by finalizeSilentTurn, or a silent turn is still
        // awaiting its re-send retry. This replaces the former unconditional
        // markCompleted at the top of the branch.
        if (!bounced && !silentTurnOpen && undeliveredIds.length === 0) markCompleted(initialBatchIds);
        turnWatermark = outboundWatermark();
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    notifyExchangeComplete(onExchangeComplete, {
      prompt: archivePrompts[0] ?? initialPrompt,
      result: `Error: ${errMsg}`,
      continuation: queryContinuation ?? initialContinuation,
      status: 'error',
    });
    throw err;
  } finally {
    done = true;
    clearInterval(pollHandle);
    signal?.removeEventListener('abort', onSignalAbort);
  }

  // The stream ended while a nudged silent turn was still outstanding (the
  // provider never answered the re-send). The batch is still un-acked at this
  // point — close it out the same way a second silent result would, so the
  // outer loop's fallback markCompleted can't quietly call it a success.
  if (silentTurnOpen) finalizeSilentTurn(null);

  return { continuation: queryContinuation, bouncedIds, undeliveredIds };
}

function notifyExchangeComplete(
  hook: ((exchange: ProviderExchange) => void) | undefined,
  exchange: ProviderExchange,
): void {
  if (!hook) return;
  try {
    hook(exchange);
  } catch (err) {
    log(`onExchangeComplete failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function handleEvent(event: ProviderEvent, _routing: RoutingContext): void {
  switch (event.type) {
    case 'init':
      log(`Session: ${event.continuation}`);
      break;
    case 'result':
      log(`Result: ${event.text ? event.text.slice(0, 200) : '(empty)'}`);
      break;
    case 'error':
      log(
        `Error: ${event.message} (retryable: ${event.retryable}${event.classification ? `, ${event.classification}` : ''})`,
      );
      break;
    case 'progress':
      log(`Progress: ${event.message}`);
      break;
    case 'usage':
      // Structured per-turn accounting. Grep-friendly: every field is a
      // bare keyword=value token, same line. Stable schema so downstream
      // tooling (ccusage / ad-hoc awk / the 2×2 stress-test harness)
      // can parse without JSON.
      log(
        `Usage: sessionId=${event.sessionId ?? 'null'} ` +
          `durationMs=${event.durationMs} ` +
          `numTurns=${event.numTurns} ` +
          `input=${event.inputTokens} ` +
          `output=${event.outputTokens} ` +
          `cacheCreate=${event.cacheCreationInputTokens} ` +
          `cacheRead=${event.cacheReadInputTokens} ` +
          `ephemeral1h=${event.ephemeral1hInputTokens} ` +
          `ephemeral5m=${event.ephemeral5mInputTokens} ` +
          `costUsd=${event.totalCostUsd}`,
      );
      break;
  }
}

/**
 * Critique-gate scope-extender: the bash hook
 * (container/hooks/gate-critique-on-deliver.sh) is wired as a PreToolUse
 * matcher on `mcp__nanoclaw__send_message|Bash`, so it only catches
 * delivery-marker traffic that goes through those tools. The most common
 * delivery path — the agent emitting `<message to="X">[Fix Report]…</message>`
 * as plain text and letting `dispatchResultText` parse it — uses neither
 * tool, so the hook never fires and the gate is silently bypassed.
 *
 * This in-process check mirrors the bash hook's logic (same MARKER file,
 * same workflow-state.json, same delivery-marker regex) and runs at the
 * one chokepoint left for text-output dispatch.
 *
 * Returns null when the gate either doesn't apply or permits the body.
 * Returns a string (the explanation) when the gate refuses delivery —
 * the caller substitutes that explanation for the original body so the
 * destination sees a clear refusal note instead of the gated content.
 *
 * Paths overridable for tests via the optional opts.
 */
// Anchored to line start (multiline): the chain protocol emits markers as
// message/line prefixes, and unanchored matching treated a mid-sentence
// MENTION of a marker as a delivery — burning a denial and one of the
// session's soft-cap strikes each time.
// Built-in floor = the GENERAL chain-protocol primitives only (chain-reporting.md):
// [Resolution] (terminal chain close) and [handoff] (lateral peer pass). These
// are project-agnostic and every coworker uses them. Role-specific terminal
// names ([Fix Report], [Triage Resolution], [Review Verdict], [Triage handoff])
// are NOT built in — each emitting role declares them in its coworker-type
// `delivery_markers` (materialized to .critique-delivery-markers, unioned here
// and by the routing gate). [Report] is deliberately absent: it's the status
// channel, not a gated deliverable.
const DEFAULT_DELIVERY_MARKERS = ['Resolution', 'handoff'];
const DELIVERY_MARKER_RE = /^[ \t]*\[(Resolution|handoff)\]/m;

// Critique-gate vocabulary: built-in defaults plus ADDITIVE extensions from
// .critique-delivery-markers (materialized by the composer from the
// coworker-type chain's delivery_markers declarations). Labels are
// re-validated to a regex-metachar-free charset before splicing — and since
// extensions can only add markers, tampering with the file can only widen
// the gate, never narrow it. Both the critique gate AND the always-on
// chain-routing gate resolve their vocabulary through this helper, so a
// per-role delivery_markers extension is recognized identically by both —
// otherwise moving a marker into per-role YAML would keep the critique gate
// working while silently regressing routing for that role.
function deliveryMarkerRe(markersPath: string): RegExp {
  const fs = require('fs') as typeof import('fs');
  let extra: string[] = [];
  try {
    const parsed = JSON.parse(fs.readFileSync(markersPath, 'utf-8')) as { message_markers?: unknown };
    if (Array.isArray(parsed.message_markers)) {
      extra = parsed.message_markers.filter(
        (m): m is string => typeof m === 'string' && /^[A-Za-z0-9][A-Za-z0-9 _-]*$/.test(m),
      );
    }
  } catch {
    extra = [];
  }
  if (extra.length === 0) return DELIVERY_MARKER_RE;
  return new RegExp(`^[ \\t]*\\[(${[...DEFAULT_DELIVERY_MARKERS, ...extra].join('|')})\\]`, 'm');
}
// Default location of the per-role delivery vocabulary file (materialized by
// the composer). Shared by both gates; overridable in tests via opts.
const DEFAULT_DELIVERY_MARKERS_PATH = '/workspace/agent/.critique-delivery-markers';

// Soft-cap shared by the in-process gates, mirroring the bash hooks
// (gate-critique-on-deliver.sh:73-89). After GATE_DENIAL_CAP refusals on a
// single session the gate stops denying and yields — without this, a gate
// whose precondition the agent can't satisfy (e.g. a workflow step that
// genuinely has no inbound to reply to, or a misconfigured critique-less
// orchestrator) would thrash the agent's entire turn budget retrying. The
// counter is persisted in workflow-state.json under `<key>`; the file is
// CREATED if absent, so a coworker that never runs critique still escapes.
const GATE_DENIAL_CAP = 3;

// Returns true if the gate should yield (soft-cap reached) rather than deny.
// Mirrors gate-critique-on-deliver.sh: check the persisted count BEFORE
// incrementing, so after GATE_DENIAL_CAP denials the counter stays pinned at
// the cap and the gate yields without bumping further. Best-effort persistence
// — a state-write failure never blocks delivery, it just disables the cap.
/**
 * Merge keys into workflow-state.json. Used to consume/expire a bypass grant,
 * mirroring the bash hook's jq patch so both gate implementations leave the
 * same trail.
 */
function patchGateState(statePath: string, patch: Record<string, unknown>): void {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  let state: Record<string, unknown> = {};
  try {
    state = JSON.parse(fs.readFileSync(statePath, 'utf-8')) as Record<string, unknown>;
  } catch {
    state = {};
  }
  Object.assign(state, patch);
  try {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify(state));
  } catch {
    // Best-effort, as elsewhere in this file.
  }
}

/**
 * Record an enforcement release into the escalation file — the session
 * bind-mount, which the host reads. Anything that ALLOWS a delivery with the
 * requirement unmet must leave a durable trace: this container runs --rm, so a
 * release logged only to stderr is a release nobody ever learns about.
 */
/**
 * Record an enforcement release where the HOST can see it, in parity with
 * container/hooks/gate-critique-on-deliver.sh.
 *
 * Two sinks, one id. `critique-releases.jsonl` is append-only and always
 * written, because the escalation file can legitimately be GONE by the time we
 * get here: the host retires a settled request, and it does that between our
 * own two writes (the consumption patch above, then this stamp). The
 * escalation file is merged into when it exists, since it carries the
 * request's audit context. The host records under the shared event id exactly
 * once, so writing both never double-counts a release.
 *
 * It deliberately never CREATES the escalation file. Fabricating one with
 * `requested_at: 0` — what this did before — made the host read a real release
 * as a brand-new escalation and card a human for it, while the release itself
 * went unrecorded and its link to the original request was destroyed.
 *
 * @returns false when nothing was recorded; an invisible release is not a
 * release the caller may allow.
 */
function stampFailedOpen(escPath: string, denialReason: string, why: string, grantId?: string | null): boolean {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const nowIso = new Date().toISOString();
  const eventId = `rel-${Date.now()}-${process.pid}-${Math.floor(Math.random() * 1e6)}`;
  let recorded = false;

  const journalPath =
    process.env.CRITIQUE_RELEASE_JOURNAL ?? path.join(path.dirname(escPath), 'critique-releases.jsonl');
  try {
    fs.appendFileSync(
      journalPath,
      `${JSON.stringify({
        event_id: eventId,
        at: nowIso,
        why,
        reason: denialReason,
        hit: 'text-output delivery',
        grant_id: grantId ?? null,
      })}\n`,
    );
    recorded = true;
  } catch {
    // Reported by the caller via the return value, not swallowed here.
  }

  try {
    const esc = JSON.parse(fs.readFileSync(escPath, 'utf-8')) as Record<string, unknown>;
    esc.failed_open_at = nowIso;
    esc.failed_open_why = why;
    esc.failed_open_event_id = eventId;
    fs.writeFileSync(escPath, JSON.stringify(esc));
    recorded = true;
  } catch {
    // Absent or unreadable: the journal is the sink. Never fabricate one.
  }
  return recorded;
}

function gateShouldYield(statePath: string, key: string): boolean {
  const fs = require('fs') as typeof import('fs');
  let state: Record<string, unknown> = {};
  try {
    state = JSON.parse(fs.readFileSync(statePath, 'utf-8')) as Record<string, unknown>;
  } catch {
    state = {};
  }
  const current = typeof state[key] === 'number' ? (state[key] as number) : 0;
  if (current >= GATE_DENIAL_CAP) return true;
  state[key] = current + 1;
  try {
    const path = require('path') as typeof import('path');
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify(state));
  } catch {
    // Best-effort; see note above.
  }
  return false;
}

// Re-arm a gate's soft-cap counter. Called when the agent demonstrates it CAN
// satisfy the gate (e.g. a properly-linked handoff). Without this the counter
// only ever climbs, so after GATE_DENIAL_CAP denials ANYWHERE in a session's
// life the gate yields permanently and every later unlinked handoff slips
// through — the counter is meant to bound a thrash loop, not disable the gate.
// Best-effort: a read/write failure just leaves the counter as-is.
function resetGateDenials(statePath: string, key: string): void {
  const fs = require('fs') as typeof import('fs');
  let state: Record<string, unknown>;
  try {
    state = JSON.parse(fs.readFileSync(statePath, 'utf-8')) as Record<string, unknown>;
  } catch {
    return; // no state file → nothing to reset
  }
  if (!state[key]) return; // already cleared
  delete state[key];
  try {
    fs.writeFileSync(statePath, JSON.stringify(state));
  } catch {
    // Best-effort.
  }
}

// The chain-routing check is ALWAYS ON — not an overlay. It enforces a pure
// structural invariant ("a chain handoff must name the inbound it answers",
// the [MUST] in chain-reporting.md), and it is self-scoping: it only fires on
// bodies carrying a chain delivery marker, which is the chain protocol's own
// vocabulary — non-chain coworkers never emit those markers, so they never
// trip it. There is nothing to select and nothing to opt into.
//
// It resolves its vocabulary through the SAME deliveryMarkerRe() union as the
// critique gate, so a per-role delivery_markers extension is recognized here
// too. Built-in defaults always apply; the per-role file (if present) only
// widens the set.
export function checkRoutingGate(
  body: string,
  attrs: { threadIdOverride?: string; inReplyToOverride?: string },
  opts: { workflowStatePath?: string; deliveryMarkersPath?: string } = {},
): { blocked: boolean; reason?: string } {
  const routingRe = deliveryMarkerRe(opts.deliveryMarkersPath ?? DEFAULT_DELIVERY_MARKERS_PATH);
  if (!routingRe.test(body)) return { blocked: false };
  // in_reply_to is the canonical routing primitive: it resolves the inbound
  // row → source_session_id → the exact edge, and the runtime auto-derives
  // thread_id from it (see applyInReplyToDefaults in mcp-tools/core.ts). So
  // in_reply_to alone is sufficient; thread_id is optional. Requiring both
  // would reject the spec's canonical upstream report form
  // (send_message(to="parent", in_reply_to=<id>, ...)).
  const statePath =
    opts.workflowStatePath ?? process.env.ROUTING_GATE_STATE_PATH ?? '/workspace/.claude/workflow-state.json';
  if (attrs.inReplyToOverride) {
    // A properly-linked handoff proves the agent CAN satisfy the gate — re-arm
    // the soft-cap so unlinked handoffs earlier in the session don't leave the
    // gate permanently yielded (routing_gate_denials otherwise only climbs).
    resetGateDenials(statePath, 'routing_gate_denials');
    return { blocked: false };
  }
  if (gateShouldYield(statePath, 'routing_gate_denials')) {
    return { blocked: false };
  }
  const marker = body.match(routingRe)?.[1] ?? '<handoff>';
  return {
    blocked: true,
    reason:
      `[chain-routing-gate] REFUSED — your message contained a [${marker}] handoff/delivery marker but the <message> tag omitted in_reply_to. ` +
      `Re-send the original body in a <message to="..." in_reply_to="...">...</message> block linked to the inbound message you are answering ` +
      `(thread_id is optional — the runtime derives it from in_reply_to). ` +
      `Do not describe the routing in prose; set the attribute on the tag. The original body was retained in the container scratchpad log only — it was not delivered to the destination.`,
  };
}

export function checkCritiqueGate(
  body: string,
  opts: {
    overlayMarkerPath?: string;
    workflowStatePath?: string;
    requiredStagesPath?: string;
    deliveryMarkersPath?: string;
  } = {},
): { blocked: boolean; reason?: string } {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  // Path resolution mirrors the bash hook's two-stage override (env var
  // wins over default), with an opts-arg layer on top for unit tests.
  const markerPath =
    opts.overlayMarkerPath ?? process.env.CRITIQUE_GATE_OVERLAY_PATH ?? '/workspace/agent/.overlay-critique-gate';
  // Activation precedence: the host-injected CRITIQUE_GATE_ACTIVE env var is
  // authoritative when set (the agent can't `rm` its way out — a child can't
  // mutate the harness's inherited env). The marker file is the fallback for
  // local mode / tests. opts.overlayMarkerPath (tests) forces file mode.
  if (opts.overlayMarkerPath === undefined && process.env.CRITIQUE_GATE_ACTIVE !== undefined) {
    if (process.env.CRITIQUE_GATE_ACTIVE !== '1') return { blocked: false };
  } else if (!fs.existsSync(markerPath)) {
    return { blocked: false };
  }
  const markerRe = deliveryMarkerRe(
    opts.deliveryMarkersPath ?? path.join(path.dirname(markerPath), '.critique-delivery-markers'),
  );
  if (!markerRe.test(body)) return { blocked: false };
  const statePath =
    opts.workflowStatePath ?? process.env.CRITIQUE_GATE_STATE_PATH ?? '/workspace/.claude/workflow-state.json';

  let state: {
    critique_rounds?: number;
    critique_stages?: Record<string, number>;
    critique_verdicts?: Record<string, string>;
    critique_gate_bypass_approved?: boolean;
    critique_gate_bypass_rejected?: boolean;
    // Grant envelope written by the host on an admin Approve. `grant_id` is the
    // approving approval_id — the host's ledger is keyed on it, so consumption
    // can be attributed to a specific grant rather than to a session.
    critique_gate_bypass_grant_id?: string;
    critique_gate_bypass_expires_at?: number; // epoch secs (shell arithmetic in the bash gate)
    critique_gate_bypass_rejected_request?: number;
    edits_since_critique?: number;
    critique_attested?: Record<string, Record<string, string>>;
  } = {};
  try {
    state = JSON.parse(fs.readFileSync(statePath, 'utf-8')) as typeof state;
  } catch {
    state = {};
  }

  // Required-stages + verdict enforcement — full parity with
  // gate-critique-on-deliver.sh. The composer materializes
  // .critique-required-stages next to the overlay marker; when present (and
  // non-empty) the gate requires every listed stage recorded AND, when
  // OUTPUT_REVIEW is required, its last verdict to be "approve" — failing
  // closed on a missing verdict unless CRITIQUE_VERDICT_STRICT=0. Without
  // the file, the historical any-1-round check applies. Before this parity
  // the text-output path (the most common delivery path) enforced only the
  // count check, so a must-fix OUTPUT_REVIEW could ship via plain
  // <message> emission while the tool path denied it.
  // Required stages: env wins over file (same tamper-resistance as activation);
  // opts.requiredStagesPath (tests) forces file mode.
  const requiredPath = opts.requiredStagesPath ?? path.join(path.dirname(markerPath), '.critique-required-stages');
  let required: string[] = [];
  try {
    const raw =
      opts.requiredStagesPath === undefined && process.env.CRITIQUE_REQUIRED_STAGES !== undefined
        ? process.env.CRITIQUE_REQUIRED_STAGES
        : fs.readFileSync(requiredPath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) required = parsed.filter((s): s is string => typeof s === 'string');
  } catch {
    required = [];
  }

  let denialReason = '';
  if (required.length > 0) {
    const stages = state.critique_stages ?? {};
    const verdicts = state.critique_verdicts ?? {};
    const missing = required.filter((s) => (stages[s] ?? 0) < 1);
    if (missing.length > 0) {
      denialReason = `required critique stages are missing: ${missing.join(', ')}`;
    } else if (required.includes('OUTPUT_REVIEW')) {
      const verdict = verdicts['OUTPUT_REVIEW'] ?? '';
      if (verdict !== '' && verdict !== 'approve') {
        denialReason = `OUTPUT_REVIEW last verdict is "${verdict}" (must be "approve") — re-run /codex-critique with STAGE: OUTPUT_REVIEW after fixing the issues`;
      } else if (verdict === '' && process.env.CRITIQUE_VERDICT_STRICT !== '0') {
        denialReason =
          'OUTPUT_REVIEW ran but no verdict was recorded (missing or unparseable) — re-run /codex-critique with STAGE: OUTPUT_REVIEW';
      }
    }
    // Freshness: the OUTPUT_REVIEW approve must postdate the last mutation.
    // track-edits.sh bumps edits_since_critique on every substantive edit and
    // track-critique.sh zeroes it on every recorded round — a nonzero count
    // means the approve covers code that has since changed. Mirrors the bash
    // hook; CRITIQUE_FRESHNESS=0 disables.
    if (denialReason === '' && required.includes('OUTPUT_REVIEW') && process.env.CRITIQUE_FRESHNESS !== '0') {
      const edits = typeof state.edits_since_critique === 'number' ? state.edits_since_critique : 0;
      if (edits > 0) {
        denialReason = `${edits} edit(s) recorded since the last critique round — the OUTPUT_REVIEW approve no longer covers the current state; re-run /codex-critique with STAGE: OUTPUT_REVIEW`;
      }
    }
    // Attested-hash binding: re-hash the artifacts the reviewer attested to
    // (### Attested → critique_attested, recorded by track-critique.sh) —
    // an approve whose reviewed artifacts have since changed does not ship.
    // Mirrors the bash hook; CRITIQUE_ATTEST=0 disables,
    // CRITIQUE_ATTEST_ROOT bounds verified paths (default /workspace).
    if (denialReason === '' && required.includes('OUTPUT_REVIEW') && process.env.CRITIQUE_ATTEST !== '0') {
      const attested = (state.critique_attested ?? {})['OUTPUT_REVIEW'] ?? {};
      const attestRoot = process.env.CRITIQUE_ATTEST_ROOT ?? '/workspace';
      const changed: string[] = [];
      for (const [artifactPath, hash] of Object.entries(attested).slice(0, 20)) {
        if (!artifactPath.startsWith(`${attestRoot}/`)) continue;
        try {
          const crypto = require('crypto') as typeof import('crypto');
          const digest = crypto.createHash('sha256').update(fs.readFileSync(artifactPath)).digest('hex');
          if (digest !== hash) changed.push(artifactPath);
        } catch {
          changed.push(`${artifactPath}(missing)`);
        }
      }
      if (changed.length > 0) {
        denialReason = `reviewed artifacts changed since the OUTPUT_REVIEW approve: ${changed.join(', ')} — re-run /codex-critique with STAGE: OUTPUT_REVIEW`;
      }
    }
  } else {
    const rounds = typeof state.critique_rounds === 'number' ? state.critique_rounds : 0;
    if (rounds < 1) {
      denialReason = `no /codex-critique round has been recorded for this session (critique_rounds=${rounds})`;
    }
  }
  if (denialReason === '') return { blocked: false };

  const marker = body.match(markerRe)?.[1] ?? '<delivery>';

  // Denial cap → graduated escalation, in parity with the bash hook. At the
  // cap the gate no longer silently fails open: it writes an escalation
  // request file (the host sweep turns it into an admin approval card) and
  // keeps denying until an admin approves the bypass, rejects it, or the
  // request times out (backstop preserving the original anti-thrash
  // contract). CRITIQUE_ESCALATION=0 restores the legacy fail-open cap.
  if (gateShouldYield(statePath, 'critique_gate_denials')) {
    const escPath =
      process.env.CRITIQUE_ESCALATION_FILE ?? path.join(path.dirname(statePath), 'critique-escalation.json');
    const nowS = Math.floor(Date.now() / 1000);
    let requestedAt = 0;
    try {
      const esc = JSON.parse(fs.readFileSync(escPath, 'utf-8')) as { requested_at?: number };
      requestedAt = typeof esc.requested_at === 'number' ? esc.requested_at : 0;
    } catch {
      requestedAt = 0;
    }
    const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

    // The kill switch still fails open, but the release is now recorded where
    // the HOST can see it: this container is --rm'd, so anything written only
    // to stderr is unrecoverable once the session ends.
    if (process.env.CRITIQUE_ESCALATION === '0') {
      // The kill switch is an operator's explicit standing instruction to let
      // deliveries through, so an unrecordable release does not convert it into
      // a refusal the way the admin-bypass path below does. It is still said
      // out loud rather than passing as success.
      if (!stampFailedOpen(escPath, denialReason, 'CRITIQUE_ESCALATION=0 kill switch')) {
        log(
          `[critique-gate] kill-switch release could NOT be recorded in ${path.dirname(escPath)} — ` +
            `the host will never learn the gate opened (${denialReason})`,
        );
      }
      return { blocked: false };
    }

    // Admin bypass — ONE-SHOT and time-limited, in parity with the bash hook.
    // This was a bare `=== true` with no expiry and no consumption, so a single
    // approval stood THIS path open for the session's whole life even after the
    // hook path was fixed — and this is the more common delivery path.
    if (state.critique_gate_bypass_approved === true) {
      const expiresAt = num(state.critique_gate_bypass_expires_at);
      // A grant with no usable expiry is NOT an unlimited grant. Treating a
      // missing or non-numeric value as "no expiry" would let a forged flag
      // with no expiry at all defeat the TTL entirely — fail closed instead.
      if (expiresAt <= 0 || nowS >= expiresAt) {
        patchGateState(statePath, {
          critique_gate_bypass_approved: false,
          critique_gate_bypass_expired_at: nowS,
        });
        // Expired (or unusable) grant: fall through to the denial path below.
      } else {
        patchGateState(statePath, {
          critique_gate_bypass_approved: false,
          critique_gate_bypass_consumed_grant_id: state.critique_gate_bypass_grant_id ?? null,
          critique_gate_bypass_consumed_at: nowS,
        });
        // The one-shot property depends on that write. If it did not land the
        // grant is still `approved` and would be reusable on every subsequent
        // delivery, so refuse rather than allow — a denied delivery is
        // recoverable, a permanently reusable waiver is not.
        let stillApproved = true;
        try {
          const after = JSON.parse(fs.readFileSync(statePath, 'utf-8')) as {
            critique_gate_bypass_approved?: boolean;
          };
          stillApproved = after.critique_gate_bypass_approved === true;
        } catch {
          stillApproved = true; // unreadable → assume the worst
        }
        if (stillApproved) {
          return {
            blocked: true,
            reason:
              `[critique-gate] REFUSED — the admin bypass could NOT be recorded as consumed, so allowing it ` +
              `would leave a reusable waiver (${denialReason}).`,
          };
        }
        // Same reasoning as the consumption check above, one step further on: a
        // release nobody can see is worse than a denied delivery. The grant is
        // already spent, so the host reports it as an ORPHANED release — which
        // is exactly what it is.
        if (
          !stampFailedOpen(
            escPath,
            denialReason,
            'admin bypass consumed (one-shot)',
            state.critique_gate_bypass_grant_id ?? null,
          )
        ) {
          return {
            blocked: true,
            reason:
              `[critique-gate] REFUSED — the admin bypass was consumed but the release could NOT be recorded ` +
              `anywhere the host can see it, so allowing it would open the gate with no durable trace (${denialReason}).`,
          };
        }
        return { blocked: false };
      }
    }

    // A rejection answers the request it was made about — not every later one.
    // Unscoped, a single old "no" silently decided every subsequent delivery
    // in the session and suppressed re-escalation with it.
    if (
      state.critique_gate_bypass_rejected === true &&
      num(state.critique_gate_bypass_rejected_request) === requestedAt
    ) {
      return {
        blocked: true,
        reason:
          `[critique-gate] REFUSED — an admin REJECTED the bypass request (${denialReason}). ` +
          `Satisfy the critique requirement (/codex-critique) or report the blocker to your parent instead of delivering.`,
      };
    }

    // NOTE: there is deliberately NO timeout fail-open here any more. It used
    // to allow the delivery once CRITIQUE_ESCALATION_TIMEOUT_SECS elapsed,
    // which meant an agent could satisfy the requirement by waiting.
    if (requestedAt === 0) {
      try {
        fs.writeFileSync(
          escPath,
          JSON.stringify({
            requested_at: nowS,
            reason: denialReason,
            hit: 'text-output delivery',
            denials: GATE_DENIAL_CAP,
          }),
        );
      } catch {
        // Best-effort — an unwritable escalation file degrades to deny-only.
      }
    }
    return {
      blocked: true,
      reason:
        `[critique-gate] REFUSED — denial cap reached; a bypass request has been sent to an admin (${denialReason}). ` +
        `Satisfy the requirement with /codex-critique or wait for the decision; do not retry the delivery in a tight loop.`,
    };
  }
  return {
    blocked: true,
    reason:
      `[critique-gate] REFUSED — your message contained a [${marker}] marker but ${denialReason}. ` +
      `Run /codex-critique on the work first, then resend. The original delivery body was retained in the container scratchpad log only — it was not delivered to the destination.`,
  };
}

/**
 * Deliver a turn's text straight to the channel the batch arrived on. Used when
 * a turn ends in a provider error (e.g. a non-retryable 403 billing_error) with
 * no <message> envelope: the notice would otherwise be dropped as scratchpad.
 * This is the same user-facing write the outer catch block does, minus the
 * `Error:` prefix — the provider's text is already a user-facing message.
 */
function deliverErrorResult(text: string, routing: RoutingContext): void {
  log('Error result with no <message> envelope — delivering to channel');
  writeMessageOut({
    id: generateId(),
    in_reply_to: routing.inReplyTo,
    kind: 'chat',
    platform_id: routing.platformId,
    channel_type: routing.channelType,
    thread_id: routing.threadId,
    content: JSON.stringify({ text }),
  });
}

/**
 * Parse the agent's final text for <message to="name">...</message> blocks
 * and dispatch each one to its resolved destination. Text outside of blocks
 * (including <internal>...</internal>) is scratchpad — logged but not sent.
 *
 * The agent must always wrap output in <message to="name">...</message>
 * blocks, even with a single destination. Bare text is scratchpad only.
 */
export interface TaskMessageBlock {
  to: string;
  body: string;
}

export function dispatchResultText(
  text: string,
  routing: RoutingContext,
): {
  sent: number;
  hasUnwrapped: boolean;
  danglingOpen?: boolean;
  gateRefusals?: string[];
  taskBlocks: TaskMessageBlock[];
} {
  // Capture the destination name (group 1), any additional attributes as one
  // string (group 2), and the body (group 3). Extra attributes — `thread_id`,
  // `in_reply_to`, plus unknown ones — are tolerated. Earlier versions of
  // this regex demanded `>` immediately after `to="..."`, so any agent
  // emitting `<message to="X" thread_id="Y">` saw the entire markup fall
  // through to the scratchpad path and get dumped to the inbound channel
  // instead of routed to the chain target. Branching workflows need the
  // explicit thread_id channel because `resolveDestinationThread` only
  // recovers a thread from prior inbound history — it has no way to
  // synthesize a NEW thread.
  const MESSAGE_RE = /<message\s+to="([^"]+)"((?:\s+\w+="[^"]*")*)\s*>([\s\S]*?)<\/message>/g;
  const ATTR_RE = /(\w+)="([^"]*)"/g;

  let match: RegExpExecArray | null;
  let sent = 0;
  let blocked = 0;
  // <message to> blocks left inert in a task run — drives the same-turn
  // "use send_message" nudge in processQuery (upstream task-delivery feature).
  const taskBlocks: TaskMessageBlock[] = [];
  let lastIndex = 0;
  const scratchpadParts: string[] = [];
  // Gate refusals are feedback for the SENDER, not the peer destination — the
  // caller pushes these back to the emitting agent as a <system> nudge (parity
  // with the bash-hook gates, which exit 2 and surface the error to the sender).
  const gateRefusals: string[] = [];

  while ((match = MESSAGE_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      scratchpadParts.push(text.slice(lastIndex, match.index));
    }
    const toName = match[1];
    const attrsStr = match[2] ?? '';
    const body = match[3].trim();
    lastIndex = MESSAGE_RE.lastIndex;

    // One-door delivery in task sessions: only the send_message tool delivers.
    // A final-text <message to> block here is either an echo of a tool send the
    // agent already made (the double-delivery class) or a send down the wrong
    // path — never deliver it, keep it visible in the scratchpad/run log.
    if (routing.taskRun) {
      log(`Task run: <message to="${toName}"> block not delivered — task sessions send only via explicit tools`);
      scratchpadParts.push(
        `[not delivered — task sessions send only via the send_message tool; to="${toName}"] ${body}`,
      );
      taskBlocks.push({ to: toName, body });
      continue;
    }

    let threadIdOverride: string | undefined;
    let inReplyToOverride: string | undefined;
    for (const am of attrsStr.matchAll(ATTR_RE)) {
      if (am[1] === 'thread_id') threadIdOverride = am[2];
      else if (am[1] === 'in_reply_to') inReplyToOverride = am[2];
      // Unknown attributes are tolerated and ignored — keeps the parser
      // forward-compatible with future protocol extensions.
    }

    const dest = findByName(toName);
    if (!dest) {
      log(`Unknown destination in <message to="${toName}">, dropping block`);
      scratchpadParts.push(`[dropped: unknown destination "${toName}"] ${body}`);
      continue;
    }
    const routingGate = checkRoutingGate(body, { threadIdOverride, inReplyToOverride });
    if (routingGate.blocked) {
      log(`Chain-routing gate refused delivery to "${toName}": handoff marker missing thread_id/in_reply_to`);
      // Keep the body in the scratchpad log (the refusal text claims it's
      // "retained in the container scratchpad log only") and emit the overlay
      // event for measurement, but do NOT deliver the refusal to the peer —
      // collect it for the sender-directed nudge instead.
      scratchpadParts.push(`[chain-routing-gate refused delivery to "${toName}"] ${body}`);
      postOverlayEvent('chain-routing-gate.refused', { destination: toName, reason: routingGate.reason });
      gateRefusals.push(routingGate.reason!);
      blocked++;
      continue;
    }

    // Critique-gate scope extension (#67): the bash PreToolUse hook only
    // catches send_message/Bash invocations; this text-output path is
    // where most delivery markers actually land. Same gate, same state,
    // re-applied here. When gated, the body is withheld from the peer and the
    // refusal is routed back to the SENDER (see the routing-gate block above) —
    // delivering it to the peer mis-routed gate feedback into the chain.
    const gate = checkCritiqueGate(body);
    if (gate.blocked) {
      log(`Critique-gate refused delivery to "${toName}": body contained delivery marker, critique_rounds=0`);
      scratchpadParts.push(`[critique-gate refused delivery to "${toName}"] ${body}`);
      postOverlayEvent('critique-gate.refused', { destination: toName, reason: gate.reason });
      gateRefusals.push(gate.reason!);
      blocked++;
      continue;
    }
    sendToDestination(dest, body, routing, { threadIdOverride, inReplyToOverride });
    sent++;
  }
  if (lastIndex < text.length) {
    scratchpadParts.push(text.slice(lastIndex));
  }

  const scratchpad = stripInternalTags(scratchpadParts.join(''));

  // Refuse to deliver when an opening `<message to="…">` was emitted with no
  // matching close tag — the regex above silently skipped the block, and the
  // single-destination/auto-route shortcut below would otherwise dump the
  // entire half-finished payload onto the inbound channel (the case that
  // mis-routed an a2a "Review Resume" dispatch to the dashboard in May 2026).
  // Treat it as undelivered so the nudge fires and the agent re-sends.
  const danglingOpen = /<message\s+to="[^"]+"[^>]*>/.test(scratchpad);

  // Single-destination shortcut: plain text is auto-routed.
  // 'system' is blocked — its inbound carries platformId=null, so there's
  // nowhere to send anyway; explicit gate as defense-in-depth.
  // 'agent' auto-routes to platformId (the source agent group). Same-session
  // protection lives in agent-route.ts's same-session guard, which catches
  // any write that resolves back to the emitting session regardless of how
  // it was emitted (auto-route, <message to=…>, or send_message).
  //
  // NOT in a task run (upstream one-door contract): a task session's final
  // text is its run-log summary (autoAppendTaskLog handles it in processQuery),
  // never auto-delivered to a destination. Without this guard the fork's
  // single-destination shortcut would deliver task-run scratchpad, breaking the
  // "final-output blocks stay inert" invariant.
  if (!routing.taskRun && sent === 0 && blocked === 0 && scratchpad && !danglingOpen) {
    const internalChannel = routing.channelType === 'system';
    if (routing.channelType && routing.platformId && !internalChannel) {
      writeMessageOut({
        id: generateId(),
        in_reply_to: routing.inReplyTo,
        kind: 'chat',
        platform_id: routing.platformId,
        channel_type: routing.channelType,
        thread_id: routing.threadId,
        content: JSON.stringify({ text: scratchpad }),
      });
      return { sent: 1, hasUnwrapped: false, taskBlocks: [] };
    }
    if (!internalChannel) {
      const all = getAllDestinations();
      if (all.length === 1) {
        sendToDestination(all[0], scratchpad, routing);
        return { sent: 1, hasUnwrapped: false, taskBlocks: [] };
      }
    }
  }

  if (scratchpad) {
    log(`[scratchpad] ${scratchpad.slice(0, 500)}${scratchpad.length > 500 ? '…' : ''}`);
  }

  // A purely-gated batch (blocked > 0, sent === 0) is NOT "unwrapped" — the
  // agent wrapped its output correctly; the gate withheld it. It gets the
  // gate-specific refusal nudge instead of the generic "wrap your output" one.
  // In a task run, plain final text is the NORMAL ending (it becomes the run
  // log) — never treat it as an undelivered reply or nudge the agent to wrap it.
  const hasUnwrapped = !routing.taskRun && sent === 0 && blocked === 0 && (!!scratchpad || danglingOpen);
  if (hasUnwrapped) {
    if (danglingOpen) {
      log(`WARNING: agent emitted <message to="..."> with no closing </message>; nothing was sent`);
    } else {
      log(`WARNING: agent output had no <message to="..."> blocks — nothing was sent`);
    }
  }
  return {
    sent,
    hasUnwrapped,
    danglingOpen,
    gateRefusals: gateRefusals.length ? gateRefusals : undefined,
    taskBlocks,
  };
}

/**
 * Should this task-run result get the same-turn "your <message> block was
 * not delivered — use send_message" nudge? True at most once per turn
 * (mirrors the unwrappedNudged flag for chat turns).
 */
export function shouldNudgeTaskBlocks(
  taskRun: boolean,
  taskBlocks: TaskMessageBlock[],
  alreadyNudged: boolean,
): boolean {
  return taskRun && taskBlocks.length > 0 && !alreadyNudged;
}

export function buildTaskBlockNudge(taskBlocks: TaskMessageBlock[], destinationNames: string): string {
  const blocks = taskBlocks
    .map(
      ({ to, body }) =>
        `<undelivered_message to="${escapePromptXml(to)}">${escapePromptXml(body)}</undelivered_message>`,
    )
    .join('\n');
  return (
    '<system>The final-output content below was not delivered from this task run:\n' +
    `${blocks}\n` +
    'If and only if any of it still needs to be sent, call send_message with an explicit to destination. ' +
    'If it was already sent or no notification is required, do not send it again. ' +
    `Your destinations: ${escapePromptXml(destinationNames)}. ` +
    'The original task result is already recorded in the run log; do not repeat it.</system>'
  );
}

function escapePromptXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Task runs: the final text is the automatic run summary. Explicit
 * `ncl tasks append-log` calls are additive mid-run notes. Written as a
 * `task_log` outbound row; the host appends it to the series' tasks/<id>.md
 * with its usual timestamp stamp. Never delivered to anyone.
 */
export function autoAppendTaskLog(text: string): void {
  // Run-log hygiene: an inert <message to> block never belongs in the log as
  // raw XML — replace each with its inner text, marked undelivered, so the
  // log stays readable prose.
  const prose = text.replace(
    /<message\s+to="([^"]+)"\s*>([\s\S]*?)<\/message>/g,
    (_m, to: string, body: string) => `[undelivered → ${to}] ${body.trim()}`,
  );
  const line = stripInternalTags(prose).replace(/\s+/g, ' ').trim().slice(0, 500);
  if (!line) return;
  writeMessageOut({
    id: generateId(),
    kind: 'task_log',
    content: JSON.stringify({ text: line }),
  });
  log('Task run log auto-appended from final text');
}

/**
 * Resolve an agent-supplied `in_reply_to` override to the canonical inbound
 * message id, mirroring `resolveInReplyTo` in the send_message MCP tool.
 *
 * The formatter shows each inbound message as id="<seq>", so agents quote the
 * integer seq. Returns:
 *   - `undefined` when there is no override (so the caller's `??` chain falls
 *     through to the destination/routing default),
 *   - the resolved canonical id when the seq maps to a real inbound row,
 *   - `undefined` when a numeric seq does NOT resolve (fall back to the
 *     canonical routing value — never persist a bare seq),
 *   - the raw value unchanged when it is already a non-numeric canonical id.
 */
export function resolveInReplyToOverride(raw: string | undefined): string | undefined {
  if (raw == null) return undefined;
  const seq = Number(raw);
  if (Number.isNaN(seq)) return raw; // non-numeric → already a canonical id, use as-is
  if (!Number.isInteger(seq) || seq <= 0) return undefined; // numeric but not a valid seq → fall back
  try {
    const row = getMessageInBySeq(seq);
    return row ? row.id : undefined; // resolved id, or fall back — never persist a bare seq
  } catch {
    return undefined; // never worse than the canonical routing fallback
  }
}

function sendToDestination(
  dest: DestinationEntry,
  body: string,
  routing: RoutingContext,
  overrides?: { threadIdOverride?: string; inReplyToOverride?: string },
): void {
  const platformId = dest.type === 'channel' ? dest.platformId! : dest.agentGroupId!;
  const channelType = dest.type === 'channel' ? dest.channelType! : 'agent';
  // Task runs: an explicitly-addressed final-text block that duplicates an MCP
  // send the agent already made this turn is a turn-final echo — drop it here,
  // where the duplication originates (#943). `taskRun` is the upstream-sync
  // rename of the fork's former `taskFire`.
  if (routing.taskRun && hasIdenticalSend(platformId, channelType, body)) {
    log(`Dropping turn-final echo of an already-sent task message to ${dest.name}`);
    return;
  }
  // Resolve thread_id per-destination from the most recent inbound message
  // that came from this same channel+platform. In agent-shared sessions,
  // different destinations have different thread contexts — using a single
  // routing.threadId would stamp one channel's thread onto another.
  // Agent-supplied overrides win: a `<message to="X" thread_id="...">` is
  // explicit branching intent (e.g. starting a new chain on a destination
  // we've never received from), and inbound-history resolution can't
  // produce a thread we've never seen.
  const destRouting = resolveDestinationThread(channelType, platformId);
  const threadId = overrides?.threadIdOverride ?? destRouting?.threadId ?? null;
  // An agent-supplied `in_reply_to` override is the integer id shown on an
  // inbound message (the formatter renders id="<seq>"). Resolve it to the
  // canonical message id the same way `send_message` does — otherwise the raw
  // seq is persisted as `in_reply_to`, the host's id-based source lookup
  // (getInboundSourceSessionId) misses, and routing silently falls back to
  // peer-affinity guessing. That is the seq-as-id ("D2") misroute.
  const resolvedOverride = resolveInReplyToOverride(overrides?.inReplyToOverride);
  const inReplyTo = resolvedOverride ?? destRouting?.inReplyTo ?? routing.inReplyTo;
  writeMessageOut({
    id: generateId(),
    in_reply_to: routing.taskRun ? null : inReplyTo,
    kind: 'chat',
    platform_id: platformId,
    channel_type: channelType,
    thread_id: threadId,
    content: JSON.stringify({ text: body }),
  });
}

/**
 * Find the thread_id and message id from the most recent inbound message
 * matching the given channel+platform. Returns null if no match found.
 */
function resolveDestinationThread(
  channelType: string,
  platformId: string,
): { threadId: string | null; inReplyTo: string | null } | null {
  try {
    const db = getInboundDb();
    const row = db
      .prepare(
        `SELECT thread_id, id FROM messages_in
         WHERE channel_type = ? AND platform_id = ?
         ORDER BY seq DESC LIMIT 1`,
      )
      .get(channelType, platformId) as { thread_id: string | null; id: string } | undefined;
    if (row) return { threadId: row.thread_id, inReplyTo: row.id };
  } catch (err) {
    log(`resolveDestinationThread error: ${err instanceof Error ? err.message : String(err)}`);
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
