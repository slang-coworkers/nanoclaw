/**
 * Critique-gate escalation module — self-healing enforcement for the critique
 * delivery gate.
 *
 * The in-container gate (container/hooks/gate-critique-on-deliver.sh) denies a
 * delivery whose critique requirement is unmet. After its denial cap it writes
 * an escalation request file into the session's `.claude/` dir (host-visible:
 * /workspace is the session-dir mount) and keeps denying. The host sweep calls
 * `checkCritiqueEscalation` per active session and decides what to do with it.
 *
 * The decision is driven by WHY the gate denied (see ./classify.ts):
 *
 *   stale / missing → SELF-HEAL. The gate stays shut and the host injects an
 *     imperative directive telling the agent to run the critique stage it
 *     skipped, then wakes it. No human is involved. Retried up to
 *     CRITIQUE_SELF_HEAL_ATTEMPTS times, spaced CRITIQUE_SELF_HEAL_COOLDOWN_SECS
 *     apart so the agent has real time to comply between nudges. Only if the
 *     loop makes no progress does it reach a human.
 *
 *   failed (the critique RAN and returned must-fix) → card a human
 *     immediately. This is the only class carrying a decision a human can
 *     meaningfully make.
 *
 * Why: measured over prod's first 18 escalations, 17 were stale/missing — i.e.
 * "go run the critique", a question with one correct answer. Carding those
 * produced a 13/16 rejection rate and batch-clearing, while the gate's own
 * 30-minute timeout opened it anyway. The human was simultaneously a rubber
 * stamp and irrelevant.
 *
 * ENFORCEMENT CONTRACT. Nothing in this module may open the gate. The only
 * paths that release it are an explicit admin approval (now one-shot and
 * TTL'd) and the legacy CRITIQUE_ESCALATION=0 kill switch — and both are
 * recorded as `approved` / `failed_open` rows in critique_escalation_events.
 * There is no longer a timeout that lets a delivery through with the
 * requirement unmet.
 *
 *   - Approve → `critique_gate_bypass_approved: true` plus a grant id, a
 *     request id and an expiry. BOTH gate implementations (the bash hook and
 *     poll-loop's in-process check) CONSUME it on the next delivery; it no
 *     longer stands open for the rest of the session's life.
 *   - Reject  → `critique_gate_bypass_rejected: true` scoped to THIS request
 *     id, so a rejection cannot answer a future, unrelated escalation.
 *
 * That file is agent-writable (`/workspace` is mounted `readonly: false`), so
 * the grant is ALSO recorded in a host-only ledger (critique_bypass_grants) and
 * `reconcileBypassState` revokes any claim the ledger does not back. That is
 * eventual, best-effort detection — an adversarial agent can re-forge between
 * sweeps — not a hard bound.
 *
 * Registered in src/modules/index.ts so the approval handler is bound even
 * after a host restart with a pending card.
 */
import fs from 'fs';
import path from 'path';

import {
  createBypassGrant,
  getBypassGrant,
  getLatestSpendableGrant,
  lookupPrForSession,
  markBypassGrantConsumed,
  markBypassGrantReleaseRecorded,
  recordEscalationEvent,
  revokeBypassGrant,
  type EscalationEventKind,
  type EventRecordResult,
} from '../../db/critique-escalations.js';
import { deletePendingApproval, getPendingApprovalsByAction } from '../../db/sessions.js';
import { log } from '../../log.js';
import { sessionDir } from '../../session-manager.js';
import type { Session } from '../../types.js';
import {
  notifyAgent,
  registerApprovalHandler,
  registerApprovalResolvedHandler,
  requestApproval,
} from '../approvals/index.js';

import { classifyEscalation, isSelfHealable, selfHealDirective, type EscalationClass } from './classify.js';

const BYPASS_ACTION = 'critique_gate_bypass';

function envInt(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw >= 0 ? raw : fallback;
}

/** Self-heal nudges before a human is asked. */
const MAX_SELF_HEAL_ATTEMPTS = envInt('CRITIQUE_SELF_HEAL_ATTEMPTS', 3);
/**
 * Gap between nudges. The sweep runs far more often than an agent can complete
 * a critique round, so without a cooldown the attempt budget would burn in
 * three consecutive sweeps and every escalation would reach a human in
 * minutes — reintroducing the noise this module exists to remove.
 */
const SELF_HEAL_COOLDOWN_SECS = envInt('CRITIQUE_SELF_HEAL_COOLDOWN_SECS', 600);
/** How long an admin-approved bypass stays usable before it must be re-asked. */
const BYPASS_TTL_SECS = envInt('CRITIQUE_BYPASS_TTL_SECS', 3600);
/**
 * How long the host waits for the release stamp a CONSUMED grant owes it
 * before declaring the release orphaned and retiring anyway.
 *
 * The gate writes the stamp milliseconds after the consumption it precedes, so
 * this is not a latency budget — it is the bound on how long an unexplained
 * consumption may wedge a session shut. 15 minutes is ~15 sweeps of margin and
 * well inside the one-hour grant TTL. Without a bound, "hold until the stamp
 * arrives" trades the interleaving race for a permanent leak: the escalation
 * file never goes away, and the in-container gate only opens a NEW escalation
 * when that file is ABSENT, so the session could never escalate again.
 */
const RELEASE_STAMP_TIMEOUT_SECS = envInt('CRITIQUE_RELEASE_STAMP_TIMEOUT_SECS', 900);
/**
 * Sanity bound on the container's release journal. One line per enforcement
 * release means a healthy session accumulates a handful over its whole life;
 * anything approaching this is a release loop and is reported as such.
 */
const MAX_RELEASE_JOURNAL_LINES = 500;

/** Shape of `.claude/critique-escalation.json`. Hook-written keys, host-written keys. */
interface EscalationFile {
  // written by the container hook
  requested_at?: number; // epoch SECONDS
  reason?: string;
  hit?: string;
  denials?: number;
  failed_open_at?: string; // the gate released a delivery with the requirement unmet
  /** Gate-generated id for the release above; the same id is in the journal line. */
  failed_open_event_id?: string;
  // written by the host
  class?: EscalationClass;
  forwarded_at?: string;
  approval_id?: string | null;
  self_heal_at?: string;
  self_heal_attempts?: number;
  failed_open_recorded?: boolean;
  resolved?: string;
  resolved_by?: string;
  /** Grant issued by the approval that resolved this request, if any. */
  grant_id?: string;
  /** Set when a consumed grant's release never arrived — see retirementDecision. */
  release_orphaned_at?: string;
  release_orphan_grant_id?: string;
}

/** One line of `.claude/critique-releases.jsonl`, written by both gates. */
interface ReleaseJournalLine {
  event_id?: string;
  at?: string;
  why?: string;
  reason?: string;
  hit?: string;
  grant_id?: string | null;
}

/** The session's `.claude/` dir on the host. Overridable for tests. */
function claudeDir(session: Session, dirOverride?: string): string {
  return dirOverride ?? path.join(sessionDir(session.agent_group_id, session.id), '.claude');
}

/** Merge keys into the session's workflow-state.json (tmp+rename). */
export function patchWorkflowState(session: Session, patch: Record<string, unknown>, dirOverride?: string): void {
  const file = path.join(claudeDir(session, dirOverride), 'workflow-state.json');
  let state: Record<string, unknown> = {};
  try {
    state = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;
  } catch {
    state = {};
  }
  Object.assign(state, patch);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Unique temp name: both in-container gates write this file too, and the
  // bash hook's tmp is literally `$STATE.tmp`. Sharing that path lets two
  // writers interleave into one another's partial document.
  const tmp = `${file}.host-${process.pid}-${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state));
  fs.renameSync(tmp, file);
  // Both writers rewrite the WHOLE document, so a concurrent container write
  // can still land after ours and drop the patch. We accept that race rather
  // than change the gates (which would force a coupled deploy), but we do not
  // accept it silently: re-read and say so if the write did not stick. Matters
  // most for a revocation — silently losing one leaves the bypass live.
  try {
    const after = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;
    const lost = Object.keys(patch).filter((k) => JSON.stringify(after[k]) !== JSON.stringify(patch[k]));
    if (lost.length > 0) {
      log.warn('workflow-state patch did not stick — concurrent container write', { file, lost });
    }
  } catch {
    /* unreadable right after write: nothing useful to report */
  }
}

function readWorkflowState(session: Session, dirOverride?: string): Record<string, unknown> {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(claudeDir(session, dirOverride), 'workflow-state.json'), 'utf-8'),
    ) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function escalationPath(session: Session, dirOverride?: string): string {
  return path.join(claudeDir(session, dirOverride), 'critique-escalation.json');
}

function readEscalation(session: Session, dirOverride?: string): EscalationFile | null {
  try {
    return JSON.parse(fs.readFileSync(escalationPath(session, dirOverride), 'utf-8')) as EscalationFile;
  } catch {
    return null; // No pending escalation.
  }
}

function patchEscalationFile(session: Session, patch: Record<string, unknown>, dirOverride?: string): void {
  const file = escalationPath(session, dirOverride);
  try {
    const esc = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;
    Object.assign(esc, patch);
    fs.writeFileSync(file, JSON.stringify(esc));
  } catch {
    // No escalation file to mark — nothing to do.
  }
}

/**
 * Retire a terminal escalation file so this session can escalate AGAIN.
 *
 * The in-container gate only opens a new escalation when the file is ABSENT —
 * `if [ -f "$ESC_FILE" ] … exit 2` in gate-critique-on-deliver.sh. A resolved
 * file left behind therefore wedges the session shut in both directions: the
 * gate keeps denying with "already escalated / awaiting the admin", and every
 * host sweep fast-returns on `esc.resolved`, so no later denial can ever reach
 * a human again. One approval used to disable escalation for the rest of the
 * session's life — weeks, for the long-lived fixer sessions here.
 *
 * Renamed rather than deleted (one slot, overwritten each time) so the last
 * escalation stays inspectable on the session mount. The authoritative history
 * is `critique_escalation_events` in the central DB, which is why retirement is
 * only safe once everything durable has been recorded.
 */
function retireEscalation(session: Session, esc: EscalationFile, dirOverride?: string): void {
  const file = escalationPath(session, dirOverride);
  try {
    fs.renameSync(file, path.join(path.dirname(file), 'critique-escalation.last.json'));
  } catch {
    // Rename can fail across weird mounts; the point is that the live path is
    // gone, so fall back to removing it.
    try {
      fs.unlinkSync(file);
    } catch {
      return; // already gone — nothing to retire, nothing to say
    }
  }
  log.info('Critique escalation retired — the session can escalate again', {
    sessionId: session.id,
    resolved: esc.resolved,
    requestedAt: esc.requested_at ?? null,
  });
}

/**
 * What to do with a resolved escalation file this sweep.
 *
 * `hold` is not "nothing happened" — it is a positive statement that something
 * is still due to land in the file, so retiring it now would destroy the
 * record. `orphaned` is the bounded escape from that hold, and it is an
 * integrity event, not a quiet cleanup.
 */
type RetirementDecision =
  | { kind: 'retire' }
  | { kind: 'hold'; why: 'awaiting-release-stamp' | 'requirement-unmet' }
  | { kind: 'orphaned'; grantId: string; consumedAt: string; waitedSecs: number };

/**
 * Is a resolved escalation actually finished, or is something still due to
 * land in its file?
 *
 * Resolving the REQUEST and consuming the GRANT are two different events at
 * two different times: the approval handler marks the file resolved the moment
 * a human clicks approve, but the container spends the one-shot grant — and
 * stamps `failed_open_at` — only on its next delivery attempt, which may be
 * an hour later. Retiring in between would throw away the file that stamp is
 * written into, and the release would go unrecorded exactly as it did when the
 * `resolved` fast-return swallowed it.
 *
 * CONSUMPTION IS NOT COMPLETION. The gate's two writes are not atomic and
 * cannot be made so from here — it marks the grant consumed in
 * workflow-state.json first and stamps `failed_open_at` into the escalation
 * file only after. `reconcileBypassState` runs at the top of every sweep, so a
 * sweep landing between those writes used to see `consumed_at` set, call the
 * escalation spent, and retire an unstamped file; the gate's stamp then found
 * no file and fabricated a `requested_at: 0` replacement, which the next sweep
 * carded as a brand-new human decision. So a SPENT grant holds the file until
 * the host has actually recorded the release it paid for — bounded by
 * RELEASE_STAMP_TIMEOUT_SECS, after which the missing release is reported.
 *
 * Revoked and expired grants retire without a release stamp, as before: they
 * were never spent, so there is no release to wait for.
 */
async function retirementDecision(
  session: Session,
  esc: EscalationFile,
  dirOverride?: string,
): Promise<RetirementDecision> {
  if (esc.resolved === 'approved') {
    const grant = esc.grant_id ? await getBypassGrant(esc.grant_id) : null;
    if (grant) {
      if (grant.consumed_at === null) {
        const dead = grant.revoked_at !== null || Date.parse(grant.expires_at) <= Date.now();
        return dead ? { kind: 'retire' } : { kind: 'hold', why: 'awaiting-release-stamp' };
      }
      if (grant.release_recorded_at !== null) return { kind: 'retire' };
      // An unparseable consumption stamp yields Infinity, i.e. orphaned now.
      // That fails toward REPORTING a release we cannot account for rather
      // than toward holding the file — and the session — forever.
      const consumedMs = Date.parse(grant.consumed_at);
      const waitedMs = Number.isFinite(consumedMs) ? Date.now() - consumedMs : Infinity;
      if (waitedMs < RELEASE_STAMP_TIMEOUT_SECS * 1000) return { kind: 'hold', why: 'awaiting-release-stamp' };
      return {
        kind: 'orphaned',
        grantId: grant.grant_id,
        consumedAt: grant.consumed_at,
        waitedSecs: Number.isFinite(waitedMs) ? Math.round(waitedMs / 1000) : RELEASE_STAMP_TIMEOUT_SECS,
      };
    }
    // No grant id recorded (a file written by an older host, or a grant the
    // ledger never got): fall back to "has this session anything left to
    // spend". This branch cannot tell a spent grant from an expired one, so it
    // keeps the pre-existing rule rather than guessing — every grant this host
    // issues carries an id, so only legacy files land here.
    if ((await getLatestSpendableGrant(session.id, new Date().toISOString())) !== null) {
      return { kind: 'hold', why: 'awaiting-release-stamp' };
    }
    if (!esc.failed_open_at) {
      log.warn('Retiring an approved critique escalation with no grant id and no release stamp', {
        sessionId: session.id,
        requestedAt: esc.requested_at ?? null,
      });
    }
    return { kind: 'retire' };
  }
  if (esc.resolved === 'rejected') {
    // The gate's "an admin REJECTED this" branch is scoped by comparing
    // `critique_gate_bypass_rejected_request` against the `requested_at` it
    // reads out of THIS file. Retire it early and an immediate retry looks
    // like a brand-new unanswered request, re-carding the human who just said
    // no. Hold it until the agent actually satisfies the requirement.
    return isRequirementCleared(session, esc, dirOverride)
      ? { kind: 'retire' }
      : { kind: 'hold', why: 'requirement-unmet' };
  }
  // self-healed / expired-stale: the requirement was satisfied to get here.
  return { kind: 'retire' };
}

/** Common event fields so every row carries the same identity. */
async function eventBase(session: Session, esc: EscalationFile): Promise<Record<string, unknown>> {
  const pr = await lookupPrForSession(session.id);
  return {
    session_id: session.id,
    agent_group_id: session.agent_group_id,
    reason: esc.reason ?? '',
    hit: esc.hit ?? 'delivery',
    requested_at: esc.requested_at ?? 0,
    repo: pr?.repo ?? null,
    pr_number: pr?.pr_number ?? null,
  };
}

async function record(
  session: Session,
  esc: EscalationFile,
  event: EscalationEventKind,
  extra: Record<string, unknown> = {},
): Promise<EventRecordResult> {
  return recordEscalationEvent({
    ...(await eventBase(session, esc)),
    event,
    class: esc.class ?? null,
    ...extra,
  } as Parameters<typeof recordEscalationEvent>[0]);
}

/** Exactly-once key for one enforcement release, stable across both routes. */
function releaseKey(sessionId: string, eventId: string): string {
  return `failed_open:${sessionId}:${eventId}`;
}

/**
 * Say so when a release could not be written to the audit trail.
 *
 * `duplicate` is the exactly-once key working as intended and is silent.
 * Anything else means the one durable record of a gate opening did not land,
 * which is the failure this whole table exists to prevent — it does not get to
 * pass as success.
 */
function reportReleaseRecord(session: Session, outcome: EventRecordResult, ctx: Record<string, unknown>): void {
  if (outcome === 'recorded' || outcome === 'duplicate') return;
  log.error('Critique gate release could NOT be recorded — the audit trail is incomplete', {
    sessionId: session.id,
    agentGroupId: session.agent_group_id,
    outcome,
    ...ctx,
  });
}

/** The container's append-only release journal, on the session mount. */
function releaseJournalPath(session: Session, dirOverride?: string): string {
  return path.join(claudeDir(session, dirOverride), 'critique-releases.jsonl');
}

/**
 * Ingest enforcement releases from the container's append-only journal.
 *
 * Both gates now record every release TWICE: merged into the escalation file
 * (the rich route — it carries the request's own audit context) and appended
 * here (the route that survives the file being gone). The journal exists
 * because the escalation file legitimately DISAPPEARS: the host retires it.
 * Previously a stamp that found no file made the gate fabricate a
 * `requested_at: 0` escalation, so the real release went unrecorded and a
 * synthetic one got carded in its place.
 *
 * Both routes carry the same gate-generated `event_id`, and the row is written
 * under a unique dedupe key, so whichever arrives first wins and the second is
 * a no-op. Attribution comes from the host's own grant ledger, not from the
 * journal line, so a release ingested this way still joins the original
 * request via the grant's `requested_at`.
 *
 * Runs before the escalation file is even read: a journal line can be the ONLY
 * evidence left, and every branch below returns early when there is no file.
 */
async function ingestReleaseJournal(session: Session, dirOverride?: string): Promise<void> {
  const file = releaseJournalPath(session, dirOverride);
  let raw: string;
  try {
    raw = fs.readFileSync(file, 'utf-8');
  } catch {
    return; // No journal — the overwhelmingly common case.
  }
  const lines = raw.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length > MAX_RELEASE_JOURNAL_LINES) {
    log.error('Critique release journal is over its sanity bound — the gate may be releasing in a loop', {
      sessionId: session.id,
      agentGroupId: session.agent_group_id,
      lines: lines.length,
      ingesting: MAX_RELEASE_JOURNAL_LINES,
      file,
    });
  }
  const pr = await lookupPrForSession(session.id);
  // Sequential on purpose: each iteration's dedupe-key insert must be visible
  // to the next, and the release-recorded stamp must follow its own insert.
  for (const line of lines.slice(-MAX_RELEASE_JOURNAL_LINES)) {
    let entry: ReleaseJournalLine;
    try {
      entry = JSON.parse(line) as ReleaseJournalLine;
      // eslint-disable-next-line no-catch-all/no-catch-all -- one bad line must not stop the rest
    } catch {
      log.error('Unparseable line in the critique release journal — a release may be unaccounted for', {
        sessionId: session.id,
        file,
      });
      continue;
    }
    const grant = typeof entry.grant_id === 'string' && entry.grant_id ? await getBypassGrant(entry.grant_id) : null;
    // Older gates carry no event id; `at`+`why` is the best stable key left.
    const eventId = entry.event_id ?? `${entry.at ?? ''}|${entry.why ?? ''}`;
    const outcome = await recordEscalationEvent({
      session_id: session.id,
      agent_group_id: session.agent_group_id,
      event: 'failed_open',
      reason: entry.reason ?? null,
      hit: entry.hit ?? null,
      // The grant ledger is what re-attaches this release to the request that
      // produced it — the reason the synthetic `requested_at: 0` file was so
      // damaging is that it had no way back.
      requested_at: grant?.requested_at ?? 0,
      repo: pr?.repo ?? null,
      pr_number: pr?.pr_number ?? null,
      dedupe_key: releaseKey(session.id, eventId),
    });
    reportReleaseRecord(session, outcome, { via: 'release-journal', eventId, grantId: entry.grant_id ?? null });
    if (grant) await markBypassGrantReleaseRecorded(grant.grant_id, new Date().toISOString());
    if (outcome === 'recorded') {
      log.error('Critique gate FAILED OPEN — release ingested from the container journal', {
        sessionId: session.id,
        agentGroupId: session.agent_group_id,
        at: entry.at ?? null,
        why: entry.why ?? null,
        reason: entry.reason ?? null,
        grantId: entry.grant_id ?? null,
      });
    }
  }
}

/** The pending bypass card for this session, if one is outstanding. */
async function pendingCardFor(sessionId: string): Promise<{ approval_id: string } | null> {
  try {
    const rows = (await getPendingApprovalsByAction(BYPASS_ACTION)).filter(
      (r) => r.session_id === sessionId && r.status === 'pending',
    );
    return rows.length ? { approval_id: rows[rows.length - 1].approval_id } : null;
    // eslint-disable-next-line no-catch-all/no-catch-all -- retraction is best-effort; never block the sweep
  } catch (err) {
    log.error('Failed to look up pending critique card', { sessionId, err });
    return null;
  }
}

/**
 * Has the underlying requirement been satisfied since the escalation was
 * raised? A critique round recorded after `requested_at` means the agent did
 * the thing the gate was asking for, so the escalation — and any card raised
 * for it — is moot.
 *
 * This check was missing entirely: nothing retracted a card when its cause
 * disappeared, so cards accumulated as permanent queue residue. One of prod's
 * two outstanding cards on 2026-08-05 was in exactly this state — its session
 * had recorded an OUTPUT_REVIEW approve 37 minutes after the card went out.
 */
export function isRequirementCleared(session: Session, esc: EscalationFile, dirOverride?: string): boolean {
  const requestedAt = esc.requested_at ?? 0;
  if (!requestedAt) return false;
  const state = readWorkflowState(session, dirOverride);
  const last = state.last_critique_at;
  if (typeof last !== 'string') return false;
  const lastMs = Date.parse(last);
  if (!Number.isFinite(lastMs)) return false;
  return Math.floor(lastMs / 1000) > requestedAt;
}

/**
 * Reconcile the session's claimed bypass against the host's grant ledger.
 *
 * `workflow-state.json` is agent-writable — `/workspace` is mounted
 * `readonly: false` and the in-container hook writes that file itself. PR #803
 * recorded this as a deliberate residual ("verdicts remain same-user-writable
 * in-container") after hardening the POLICY tier via env injection. The bypass
 * grant landed in that same writable tier in #1092, which meant a forged
 * `critique_gate_bypass_approved: true` would be honoured for the rest of the
 * session's life — weeks, for the long-lived fixer sessions here.
 *
 * The host now keeps its own ledger of what it actually granted
 * (critique_bypass_grants, not mounted into any container) and revokes a claim
 * nothing backs. That bounds a forged bypass to one sweep interval (60s)
 * rather than the session lifetime.
 *
 * This is a narrowing, not a closure: an agent that forges the flag and
 * delivers inside the same interval still gets through once, and the hook
 * still decides locally. Closing it properly means moving enforcement outside
 * the agent's environment (conditioning credential release at the proxy).
 *
 * Scope is the grant only. Verdicts are legitimately written in-container by
 * track-critique.sh from codex output, so the host cannot tell a real approve
 * from a forged one without re-running the review; the grant, by contrast, is
 * 100% host-originated, so any divergence is unambiguous and false positives
 * are impossible by construction.
 */
export async function reconcileBypassState(session: Session, dirOverride?: string): Promise<void> {
  const state = readWorkflowState(session, dirOverride);
  const nowMs = Date.now();
  const nowIso = new Date().toISOString();

  const divergence = async (reason: string): Promise<void> => {
    await recordEscalationEvent({
      session_id: session.id,
      agent_group_id: session.agent_group_id,
      event: 'state_divergence',
      reason,
    });
    log.error('Critique-gate STATE DIVERGENCE', {
      sessionId: session.id,
      agentGroupId: session.agent_group_id,
      reason,
    });
  };

  // ── 1. Consumption. Processed BEFORE any early return, because the attack
  // that actually SUCCEEDS ends here: a forged flag is consumed by the gate,
  // which clears `approved` and stamps the consumption. Gating this behind the
  // `approved === true` check below would make the successful forgery the one
  // case that never produces a divergence event.
  const consumedGrantId =
    typeof state.critique_gate_bypass_consumed_grant_id === 'string'
      ? state.critique_gate_bypass_consumed_grant_id
      : null;
  if (state.critique_gate_bypass_consumed_at != null) {
    // The gates stamp epoch seconds. Fall back to "now" when it is missing or
    // unparseable, which fails toward flagging rather than excusing.
    const consumedAtRaw = Number(state.critique_gate_bypass_consumed_at);
    const consumedAtMs = Number.isFinite(consumedAtRaw) && consumedAtRaw > 0 ? consumedAtRaw * 1000 : nowMs;
    const consumed = consumedGrantId ? await getBypassGrant(consumedGrantId) : null;
    if (consumedGrantId) {
      // Attributed. Either it names a grant we issued to this session, or it
      // doesn't — and "doesn't" is the forgery that actually succeeds.
      if (!consumed || consumed.session_id !== session.id) {
        await divergence(
          `a bypass was CONSUMED under grant ${consumedGrantId}, which this host never issued for this session`,
        );
      } else if (consumed.consumed_at) {
        // The stamp is cleared every pass, so any stamp we see is a NEW
        // consumption. A second one against an already-spent grant means the
        // grant was replayed — the agent re-set `approved` and spent it again
        // between sweeps. Silently ignoring it (the obvious "already recorded,
        // nothing to do" reading) would let a replay through with no event at
        // all, which is precisely the case one-shot exists to prevent.
        await divergence(
          `grant ${consumedGrantId} was CONSUMED AGAIN (already spent at ${consumed.consumed_at}) — replayed waiver`,
        );
      } else if (consumed.revoked_at) {
        // Existing-and-unspent is not the same as valid. A revoked grant is
        // dead; consuming it means the gate honoured local state the host had
        // already withdrawn.
        await divergence(
          `grant ${consumedGrantId} was CONSUMED although the host REVOKED it at ${consumed.revoked_at} (${consumed.revoked_reason ?? 'no reason recorded'})`,
        );
      } else if (Date.parse(consumed.expires_at) <= consumedAtMs) {
        // Consumed outside its validity interval. Checked against the stamped
        // consumption time, not "now", so a late sweep can't excuse it.
        await divergence(
          `grant ${consumedGrantId} was CONSUMED at ${new Date(consumedAtMs).toISOString()}, after it expired at ${consumed.expires_at}`,
        );
      } else {
        await markBypassGrantConsumed(consumed.grant_id, nowIso);
      }
    } else {
      // Unattributed. A gate older than this host does not write the grant id,
      // and the two gates deploy on different cadences (hooks are bind-mounted
      // and live on restart; the agent-runner ships as a per-group image copy).
      // Falling straight to `divergence` here would flag EVERY legitimate
      // bypass taken through an older gate — a false positive on the happy
      // path, which would train us to ignore the signal. Attribute it to the
      // session's newest spendable grant instead, and only call it divergence
      // when the session has no grant to spend at all.
      const fallback = await getLatestSpendableGrant(session.id, nowIso);
      if (fallback) {
        await markBypassGrantConsumed(fallback.grant_id, nowIso);
        log.warn('Critique-gate bypass consumed without a grant id — attributed to the newest live grant', {
          sessionId: session.id,
          grantId: fallback.grant_id,
        });
      } else {
        await divergence('a bypass was CONSUMED with no grant id and no live grant exists for this session');
      }
    }
    // Clear the stamp either way. Left in place it would be re-evaluated every
    // sweep (noisy) and, worse, could be replayed against a later legitimate
    // grant — marking a fresh grant spent before its owner ever used it.
    patchWorkflowState(
      session,
      { critique_gate_bypass_consumed_grant_id: null, critique_gate_bypass_consumed_at: null },
      dirOverride,
    );
  }

  // ── 2. A claimed, unspent bypass.
  if (state.critique_gate_bypass_approved !== true) return;

  const grantId = typeof state.critique_gate_bypass_grant_id === 'string' ? state.critique_gate_bypass_grant_id : null;
  const grant = grantId ? await getBypassGrant(grantId) : null;
  const live =
    grant !== null &&
    grant.session_id === session.id &&
    grant.consumed_at === null &&
    grant.revoked_at === null &&
    Date.parse(grant.expires_at) > nowMs;

  if (!live) {
    // Nothing the host issued backs this claim: forged, replayed, expired or
    // already spent. Revoke rather than trust it.
    patchWorkflowState(
      session,
      { critique_gate_bypass_approved: false, critique_gate_bypass_revoked_at: Math.floor(nowMs / 1000) },
      dirOverride,
    );
    await divergence(
      `bypass claimed under grant ${grantId ?? 'none'} with no live host grant (${
        grant === null ? 'unknown grant' : 'dead grant'
      }) — revoked`,
    );
    return;
  }

  // A live grant exists, but the file claims a longer life than the host gave
  // it. The file carries epoch seconds (the bash gate does shell arithmetic).
  const grantExpiresEpoch = Math.floor(Date.parse(grant.expires_at) / 1000);
  const fileExpires = Number(state.critique_gate_bypass_expires_at);
  if (Number.isFinite(fileExpires) && fileExpires > grantExpiresEpoch) {
    patchWorkflowState(session, { critique_gate_bypass_expires_at: grantExpiresEpoch }, dirOverride);
    await divergence(`bypass expiry extended to ${fileExpires}, clamped to the granted ${grantExpiresEpoch}`);
  }
}

/** Admin approved the bypass: a ONE-SHOT, TTL'd grant — not a standing open. */
export async function applyBypassApproval(
  session: Session,
  userId: string,
  dirOverride?: string,
  approvalId?: string,
): Promise<void> {
  const esc = readEscalation(session, dirOverride) ?? {};
  const grantedAtMs = Date.now();
  const expiresAtMs = grantedAtMs + BYPASS_TTL_SECS * 1000;
  const expiresEpoch = Math.floor(expiresAtMs / 1000);
  // The grant is keyed on the approval that authorized it — a host-owned id
  // from the pending_approvals row. `esc.requested_at` comes from the
  // agent-writable escalation file, so it is recorded for diagnostics but is
  // never what we match on. Falls back to the escalation's own recorded
  // approval id, then to a synthetic one, so a grant always has an identity.
  const grantId = approvalId ?? esc.approval_id ?? `grant-${grantedAtMs}-${Math.random().toString(36).slice(2, 8)}`;

  // LEDGER FIRST, then the file. Reversed, a sweep landing between the two
  // writes would see a flag with no grant behind it and revoke a legitimate
  // approval. The ledger is the host's own record and is not reachable from
  // any container; the file is only the gate's read path.
  await createBypassGrant({
    grant_id: grantId,
    session_id: session.id,
    requested_at: esc.requested_at ?? null,
    granted_at: new Date(grantedAtMs).toISOString(),
    expires_at: new Date(expiresAtMs).toISOString(),
    granted_by: userId,
  });
  try {
    patchWorkflowState(
      session,
      {
        critique_gate_bypass_approved: true,
        critique_gate_bypass_grant_id: grantId,
        // Scope + expiry are what make this ONE delivery's grant rather than a
        // permanent hole. Both gates consume the flag on use and honour the TTL.
        critique_gate_bypass_request: esc.requested_at ?? null,
        // Epoch seconds: the bash gate does shell arithmetic on this. Derived
        // from the same instant the ledger stored, so reconciliation's clamp
        // check can't trip against our own grant.
        critique_gate_bypass_expires_at: expiresEpoch,
      },
      dirOverride,
    );
    // eslint-disable-next-line no-catch-all/no-catch-all -- compensating action, then rethrow
  } catch (err) {
    // The row is in but the session can't see it. Left alone that is an orphan
    // capability: a live grant nobody is using, which an agent could later
    // claim by forging matching file fields. Kill it, then let the caller fail.
    await revokeBypassGrant(grantId, new Date().toISOString(), 'workflow-state patch failed after grant insert');
    log.error('Critique-gate bypass grant REVOKED — could not write it to the session', {
      sessionId: session.id,
      grantId,
      err,
    });
    throw err;
  }
  // `grant_id` ties the resolved REQUEST to the grant it issued, so the sweep
  // can tell "answered" from "answered and spent" and only retire the file
  // once the container can no longer write into it (see isEscalationSpent).
  patchEscalationFile(session, { resolved: 'approved', resolved_by: userId, grant_id: grantId }, dirOverride);
  await record(session, esc, 'approved', { approval_id: esc.approval_id ?? null });
  log.warn('Critique-gate bypass APPROVED (one-shot)', {
    sessionId: session.id,
    approvedBy: userId,
    expiresInSecs: BYPASS_TTL_SECS,
  });
}

/** Admin rejected the bypass: keep the gate closed, scoped to THIS request. */
export async function applyBypassRejection(session: Session, userId: string, dirOverride?: string): Promise<void> {
  const esc = readEscalation(session, dirOverride) ?? {};
  patchWorkflowState(
    session,
    {
      critique_gate_bypass_rejected: true,
      // Without this scoping a single reject answered every future escalation
      // in the session forever — a weeks-old decision silently deciding
      // today's, and suppressing re-escalation with it.
      critique_gate_bypass_rejected_request: esc.requested_at ?? null,
    },
    dirOverride,
  );
  patchEscalationFile(session, { resolved: 'rejected', resolved_by: userId }, dirOverride);
  await record(session, esc, 'rejected', { approval_id: esc.approval_id ?? null });
  log.warn('Critique-gate bypass REJECTED', { sessionId: session.id, rejectedBy: userId });
}

registerApprovalHandler(BYPASS_ACTION, async (ctx) => {
  // ctx.approval is the verified host-side row — the authoritative identity for
  // the grant, unlike anything read out of the session's own files.
  await applyBypassApproval(ctx.session, ctx.userId, undefined, ctx.approval?.approval_id);
  await ctx.notify(
    'Critique-gate bypass approved by an admin — resend your delivery. This grant is ONE-SHOT and expires: it covers this delivery only, and the critique requirement itself is still unmet. Prefer running /codex-critique.',
  );
});

registerApprovalResolvedHandler(async (event) => {
  if (event.approval.action !== BYPASS_ACTION || event.outcome !== 'reject') return;
  await applyBypassRejection(event.session, event.userId);
  await notifyAgent(
    event.session,
    'Critique-gate bypass request was REJECTED by an admin. Satisfy the critique requirement (/codex-critique) or report the blocker to your parent — do not retry the delivery.',
  );
});

/**
 * Sweep hook. Drives one session's escalation to resolution: ingest any
 * container-side release, retract a moot card, self-heal a stale/missing
 * requirement, or card a human for a failed critique.
 *
 * Idempotent — safe to call every sweep.
 */
export async function checkCritiqueEscalation(session: Session, dirOverride?: string): Promise<void> {
  // FIRST, and unconditionally — before the escalation file is even read.
  // A forged bypass can exist with no escalation file at all, and every branch
  // below returns early in that case, so anything gated behind them would
  // never run for exactly the sessions that matter most.
  await reconcileBypassState(session, dirOverride);

  // Also unconditionally: a release whose escalation file was already retired
  // reaches the host only through the journal, and every branch below returns
  // early when there is no file to read.
  await ingestReleaseJournal(session, dirOverride);

  const esc = readEscalation(session, dirOverride);
  if (!esc) return;

  // ── 1. Ingest a container-side enforcement release, exactly once — BEFORE
  // any check on `resolved`. The hook writes `failed_open_at` when it allows a
  // delivery with the requirement unmet. Before this, that event existed only
  // on the container's stderr — and containers run --rm, so the host could
  // never learn a gate had opened. Surfacing it is the whole point of stamping
  // it.
  //
  // This used to sit BELOW a `resolved` fast-return, which made it unreachable
  // for the release it most needed to catch: an approval marks the file
  // resolved, and only afterwards does the container consume the one-shot
  // grant and stamp `failed_open_at`. The stamp therefore always landed on an
  // already-resolved file, so `failed_open` was never recorded and
  // `failed_open_recorded` was never set — the audit trail lost precisely the
  // event #1092 added it to make durable.
  //
  // `failed_open_recorded` lives in an agent-writable file, so it is only the
  // cheap check; the unique dedupe key below is the actual exactly-once
  // guarantee, shared with the journal route.
  if (esc.failed_open_at && !esc.failed_open_recorded) {
    const eventId = esc.failed_open_event_id ?? esc.failed_open_at;
    const outcome = await record(session, esc, 'failed_open', { dedupe_key: releaseKey(session.id, eventId) });
    reportReleaseRecord(session, outcome, { via: 'escalation-file', eventId, grantId: esc.grant_id ?? null });
    patchEscalationFile(session, { failed_open_recorded: true }, dirOverride);
    // Discharge the consumed grant's obligation. This — not the file flag — is
    // what lets the retirement below finally let go of the file.
    if (esc.grant_id) await markBypassGrantReleaseRecorded(esc.grant_id, new Date().toISOString());
    if (outcome === 'recorded') {
      log.error('Critique gate FAILED OPEN — delivery allowed with requirement unmet', {
        sessionId: session.id,
        agentGroupId: session.agent_group_id,
        at: esc.failed_open_at,
        reason: esc.reason,
      });
    }
  }

  // ── 2. Terminal state. Retire the file once nothing is still due to land in
  // it (see retirementDecision) — otherwise it suppresses every future
  // escalation for this session — and never retire an outstanding release
  // obligation quietly.
  if (esc.resolved) {
    const decision = await retirementDecision(session, esc, dirOverride);
    if (decision.kind === 'orphaned') {
      // The gate spent a grant and no release ever reached us. Holding the
      // file any longer wedges the session shut; retiring it silently would
      // hide a delivery that may well have gone out with the requirement
      // unmet. Record it as the integrity event it is, then retire.
      const outcome = await record(session, esc, 'release_orphaned', {
        dedupe_key: `release_orphaned:${session.id}:${decision.grantId}`,
        reason: `bypass grant ${decision.grantId} was consumed at ${decision.consumedAt} and no release stamp arrived within ${decision.waitedSecs}s`,
      });
      reportReleaseRecord(session, outcome, { via: 'orphan-recovery', grantId: decision.grantId });
      patchEscalationFile(
        session,
        { release_orphaned_at: new Date().toISOString(), release_orphan_grant_id: decision.grantId },
        dirOverride,
      );
      log.error('Critique gate release ORPHANED — a consumed bypass never recorded where it went', {
        sessionId: session.id,
        agentGroupId: session.agent_group_id,
        grantId: decision.grantId,
        consumedAt: decision.consumedAt,
        waitedSecs: decision.waitedSecs,
        requestedAt: esc.requested_at ?? null,
      });
      retireEscalation(session, { ...esc, resolved: 'orphaned-release' }, dirOverride);
      return;
    }
    if (decision.kind === 'retire') retireEscalation(session, esc, dirOverride);
    return;
  }

  // ── 3. Requirement satisfied since we raised this? Retract and close out.
  if (isRequirementCleared(session, esc, dirOverride)) {
    const card = await pendingCardFor(session.id);
    if (card) {
      await deletePendingApproval(card.approval_id);
      log.info('Critique-gate card auto-retracted — requirement satisfied', {
        sessionId: session.id,
        approvalId: card.approval_id,
      });
    }
    const outcome: EscalationEventKind = esc.forwarded_at ? 'expired' : 'self_healed';
    await record(session, esc, outcome, {
      approval_id: card?.approval_id ?? null,
      attempt: esc.self_heal_attempts ?? null,
    });
    patchEscalationFile(
      session,
      { resolved: outcome === 'expired' ? 'expired-stale' : 'self-healed', resolved_by: 'host:auto' },
      dirOverride,
    );
    return;
  }

  // ── 4. Already with a human — leave it alone.
  if (esc.forwarded_at) return;

  const reason = typeof esc.reason === 'string' ? esc.reason : 'unspecified';
  const hit = typeof esc.hit === 'string' ? esc.hit : 'delivery';
  const cls = esc.class ?? classifyEscalation(reason);
  const attempts = esc.self_heal_attempts ?? 0;

  // ── 5. Self-heal: drive the agent to run the critique. Gate stays SHUT.
  if (isSelfHealable(cls) && attempts < MAX_SELF_HEAL_ATTEMPTS) {
    const lastNudgeMs = esc.self_heal_at ? Date.parse(esc.self_heal_at) : NaN;
    if (Number.isFinite(lastNudgeMs) && Date.now() - lastNudgeMs < SELF_HEAL_COOLDOWN_SECS * 1000) {
      return; // Nudged recently — give the agent time to actually comply.
    }
    const attempt = attempts + 1;
    patchEscalationFile(
      session,
      { class: cls, self_heal_at: new Date().toISOString(), self_heal_attempts: attempt },
      dirOverride,
    );
    await record(session, { ...esc, class: cls }, 'self_heal', { attempt });
    await notifyAgent(session, selfHealDirective({ cls, reason, hit, attempt, maxAttempts: MAX_SELF_HEAL_ATTEMPTS }));
    log.info('Critique-gate self-heal nudge', { sessionId: session.id, cls, attempt, reason });
    return;
  }

  // ── 6. Human decision required: a failed critique, or self-heal exhausted.
  const pr = await lookupPrForSession(session.id);
  const target = pr ? `${pr.repo}#${pr.pr_number}` : (session.thread_id ?? 'no PR mapped');
  const prUrl = pr ? `https://github.com/${pr.repo}/pull/${pr.pr_number}` : null;
  const exhausted = isSelfHealable(cls) && attempts >= MAX_SELF_HEAL_ATTEMPTS;
  const title = exhausted
    ? `Critique gate — ${target}: agent could not self-heal`
    : `Critique gate — ${target}: critique returned must-fix`;

  const question = [
    exhausted
      ? `**${session.agent_group_id}** was asked ${attempts} time(s) to run the critique and has not, so its ${hit} is still blocked.`
      : `**${session.agent_group_id}** ran the critique and it returned **must-fix**, then tried to ${hit} anyway.`,
    ``,
    `- **Target:** ${prUrl ?? target}`,
    `- **Session:** \`${session.id}\``,
    `- **Blocked surface:** ${hit}`,
    `- **Unmet requirement:** ${reason}`,
    ``,
    `**Approve** lets this ONE delivery through with the requirement unmet (one-shot, expires in ${Math.round(BYPASS_TTL_SECS / 60)} min).`,
    `**Reject** keeps it blocked; the agent is told to comply or report the blocker.`,
  ].join('\n');

  await requestApproval({
    session,
    agentName: session.agent_group_id,
    action: BYPASS_ACTION,
    payload: {
      sessionId: session.id,
      agentGroupId: session.agent_group_id,
      threadId: session.thread_id ?? null,
      repo: pr?.repo ?? null,
      prNumber: pr?.pr_number ?? null,
      prUrl,
      reason,
      hit,
      class: cls,
      denials: esc.denials ?? null,
      selfHealAttempts: attempts,
      requestedAt: esc.requested_at ?? null,
    },
    title,
    question,
  });

  const card = await pendingCardFor(session.id);
  patchEscalationFile(
    session,
    { forwarded_at: new Date().toISOString(), class: cls, approval_id: card?.approval_id ?? null },
    dirOverride,
  );
  await record(session, { ...esc, class: cls }, 'carded', {
    approval_id: card?.approval_id ?? null,
    attempt: attempts || null,
  });
  log.info('Critique-gate escalation carded', {
    sessionId: session.id,
    cls,
    target,
    exhaustedSelfHeal: exhausted,
    reason,
  });
}
