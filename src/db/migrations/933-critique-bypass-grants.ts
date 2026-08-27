import type { Migration } from './index.js';

/**
 * Host-authoritative ledger for critique-gate bypass grants.
 *
 * The gate has two tiers (PR #803). Policy — `CRITIQUE_GATE_ACTIVE` and
 * `CRITIQUE_REQUIRED_STAGES` — is tamper-resistant because the host injects it
 * as env vars, so "the agent can't `rm` its way out". State is not:
 * `/workspace` is mounted `readonly: false`, `.claude/workflow-state.json`
 * lives under it, and both gate implementations write that file themselves.
 * #803 recorded this as a deliberate residual and deferred verdict mirroring.
 *
 * PR #1092 put the bypass grant into that same writable file, so a forged
 * `critique_gate_bypass_approved: true` would be honoured for the rest of the
 * session's life — weeks, for the long-lived fixer sessions here.
 *
 * This table is the host's own record of what it actually granted. It is not
 * mounted into any container.
 *
 * `grant_id` is the **approval_id** that authorized the grant. That identity
 * is host-owned (it comes from the `pending_approvals` row the host created),
 * unlike `requested_at`, which originates in the agent-writable escalation
 * file and is therefore kept for diagnostics only — never as the key we match
 * on. Consumption is likewise recorded by `grant_id`, so a stale consumption
 * stamp cannot be replayed against a later, unrelated grant.
 *
 * Scope, stated plainly: this covers the GRANT, which is 100% host-originated,
 * so any divergence is unambiguous. It does NOT cover verdicts, which
 * `track-critique.sh` legitimately writes in-container from codex output and
 * which the host cannot validate without re-running the review. And it is
 * *eventual, best-effort detection*, not a hard bound: an adversarial agent can
 * re-forge after each reconciliation, and the sweep only visits active sessions
 * and reschedules after the previous pass finishes. Closing it properly means
 * enforcement outside the agent's environment.
 *
 * Timestamps are ISO-8601 UTC TEXT per the repo Timestamps policy. The
 * hook-facing file keeps epoch seconds, because the bash gate does shell
 * arithmetic on them.
 */
export const migration933: Migration = {
  version: 933,
  name: 'critique-bypass-grants',
  async up(db) {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS critique_bypass_grants (
        grant_id       TEXT PRIMARY KEY,   -- the approval_id that authorized it
        session_id     TEXT NOT NULL,
        requested_at   INTEGER,            -- diagnostics only (agent-writable origin)
        granted_at     TEXT NOT NULL,      -- ISO-8601 UTC
        expires_at     TEXT NOT NULL,      -- ISO-8601 UTC
        granted_by     TEXT,
        consumed_at    TEXT,
        revoked_at     TEXT,
        revoked_reason TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_bypass_grants_session
        ON critique_bypass_grants(session_id);
    `);
  },
};
