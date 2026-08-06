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
  lookupPrForSession,
  markBypassGrantConsumed,
  recordEscalationEvent,
  revokeBypassGrant,
  type EscalationEventKind,
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

/** Shape of `.claude/critique-escalation.json`. Hook-written keys, host-written keys. */
interface EscalationFile {
  // written by the container hook
  requested_at?: number; // epoch SECONDS
  reason?: string;
  hit?: string;
  denials?: number;
  failed_open_at?: string; // the gate released a delivery with the requirement unmet
  // written by the host
  class?: EscalationClass;
  forwarded_at?: string;
  approval_id?: string | null;
  self_heal_at?: string;
  self_heal_attempts?: number;
  failed_open_recorded?: boolean;
  resolved?: string;
  resolved_by?: string;
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

/** Common event fields so every row carries the same identity. */
function eventBase(session: Session, esc: EscalationFile): Record<string, unknown> {
  const pr = lookupPrForSession(session.id);
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

function record(
  session: Session,
  esc: EscalationFile,
  event: EscalationEventKind,
  extra: Record<string, unknown> = {},
): void {
  recordEscalationEvent({
    ...eventBase(session, esc),
    event,
    class: esc.class ?? null,
    ...extra,
  } as Parameters<typeof recordEscalationEvent>[0]);
}

/** The pending bypass card for this session, if one is outstanding. */
function pendingCardFor(sessionId: string): { approval_id: string } | null {
  try {
    const rows = getPendingApprovalsByAction(BYPASS_ACTION).filter(
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
export function reconcileBypassState(session: Session, dirOverride?: string): void {
  const state = readWorkflowState(session, dirOverride);
  const nowMs = Date.now();
  const nowIso = new Date().toISOString();

  const divergence = (reason: string): void => {
    recordEscalationEvent({
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
    const consumed = consumedGrantId ? getBypassGrant(consumedGrantId) : null;
    if (!consumed || consumed.session_id !== session.id) {
      divergence(
        `a bypass was CONSUMED under grant ${consumedGrantId ?? 'none'}, which this host never issued for this session`,
      );
    } else if (!consumed.consumed_at) {
      markBypassGrantConsumed(consumed.grant_id, nowIso);
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
  const grant = grantId ? getBypassGrant(grantId) : null;
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
    divergence(
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
    divergence(`bypass expiry extended to ${fileExpires}, clamped to the granted ${grantExpiresEpoch}`);
  }
}

/** Admin approved the bypass: a ONE-SHOT, TTL'd grant — not a standing open. */
export function applyBypassApproval(session: Session, userId: string, dirOverride?: string, approvalId?: string): void {
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
  createBypassGrant({
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
    revokeBypassGrant(grantId, new Date().toISOString(), 'workflow-state patch failed after grant insert');
    log.error('Critique-gate bypass grant REVOKED — could not write it to the session', {
      sessionId: session.id,
      grantId,
      err,
    });
    throw err;
  }
  patchEscalationFile(session, { resolved: 'approved', resolved_by: userId }, dirOverride);
  record(session, esc, 'approved', { approval_id: esc.approval_id ?? null });
  log.warn('Critique-gate bypass APPROVED (one-shot)', {
    sessionId: session.id,
    approvedBy: userId,
    expiresInSecs: BYPASS_TTL_SECS,
  });
}

/** Admin rejected the bypass: keep the gate closed, scoped to THIS request. */
export function applyBypassRejection(session: Session, userId: string, dirOverride?: string): void {
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
  record(session, esc, 'rejected', { approval_id: esc.approval_id ?? null });
  log.warn('Critique-gate bypass REJECTED', { sessionId: session.id, rejectedBy: userId });
}

registerApprovalHandler(BYPASS_ACTION, async (ctx) => {
  // ctx.approval is the verified host-side row — the authoritative identity for
  // the grant, unlike anything read out of the session's own files.
  applyBypassApproval(ctx.session, ctx.userId, undefined, ctx.approval?.approval_id);
  ctx.notify(
    'Critique-gate bypass approved by an admin — resend your delivery. This grant is ONE-SHOT and expires: it covers this delivery only, and the critique requirement itself is still unmet. Prefer running /codex-critique.',
  );
});

registerApprovalResolvedHandler((event) => {
  if (event.approval.action !== BYPASS_ACTION || event.outcome !== 'reject') return;
  applyBypassRejection(event.session, event.userId);
  notifyAgent(
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
  reconcileBypassState(session, dirOverride);

  const esc = readEscalation(session, dirOverride);
  if (!esc || esc.resolved) return;

  // ── 1. Ingest a container-side enforcement release, exactly once.
  // The hook writes `failed_open_at` when it allows a delivery with the
  // requirement unmet. Before this, that event existed only on the container's
  // stderr — and containers run --rm, so the host could never learn a gate had
  // opened. Surfacing it is the whole point of stamping it.
  if (esc.failed_open_at && !esc.failed_open_recorded) {
    record(session, esc, 'failed_open');
    patchEscalationFile(session, { failed_open_recorded: true }, dirOverride);
    log.error('Critique gate FAILED OPEN — delivery allowed with requirement unmet', {
      sessionId: session.id,
      agentGroupId: session.agent_group_id,
      at: esc.failed_open_at,
      reason: esc.reason,
    });
  }

  // ── 2. Requirement satisfied since we raised this? Retract and close out.
  if (isRequirementCleared(session, esc, dirOverride)) {
    const card = pendingCardFor(session.id);
    if (card) {
      deletePendingApproval(card.approval_id);
      log.info('Critique-gate card auto-retracted — requirement satisfied', {
        sessionId: session.id,
        approvalId: card.approval_id,
      });
    }
    const outcome: EscalationEventKind = esc.forwarded_at ? 'expired' : 'self_healed';
    record(session, esc, outcome, {
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

  // ── 3. Already with a human — leave it alone.
  if (esc.forwarded_at) return;

  const reason = typeof esc.reason === 'string' ? esc.reason : 'unspecified';
  const hit = typeof esc.hit === 'string' ? esc.hit : 'delivery';
  const cls = esc.class ?? classifyEscalation(reason);
  const attempts = esc.self_heal_attempts ?? 0;

  // ── 4. Self-heal: drive the agent to run the critique. Gate stays SHUT.
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
    record(session, { ...esc, class: cls }, 'self_heal', { attempt });
    notifyAgent(session, selfHealDirective({ cls, reason, hit, attempt, maxAttempts: MAX_SELF_HEAL_ATTEMPTS }));
    log.info('Critique-gate self-heal nudge', { sessionId: session.id, cls, attempt, reason });
    return;
  }

  // ── 5. Human decision required: a failed critique, or self-heal exhausted.
  const pr = lookupPrForSession(session.id);
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

  const card = pendingCardFor(session.id);
  patchEscalationFile(
    session,
    { forwarded_at: new Date().toISOString(), class: cls, approval_id: card?.approval_id ?? null },
    dirOverride,
  );
  record(session, { ...esc, class: cls }, 'carded', {
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
