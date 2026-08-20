import type { Migration } from './index.js';

/**
 * `cost_escalation_episodes` — the durable record backing the cost-cap escalation
 * approval card (NanoClaw #1 cost cap, Option 2).
 *
 * WHY a central table at all. Today a cost escalation is a fire-and-forget event:
 * the runner emits one `cost_escalation` outbound row, the host DMs a human PLAIN
 * text, and the only actionable surface is the dashboard pill. Authority is
 * scattered across runner memory, `session_state`, an unversioned approval row and
 * unversioned `cost_override` messages — so a late or duplicate click can raise the
 * cap twice, reverse a newer decision, or apply yesterday's card to today's budget.
 * This table is the single source of truth for one escalation "episode": its
 * decision, the effect of that decision, and whether the effect actually landed.
 *
 * ONE ROW PER EPISODE, keyed by a runner-generated stable `episode_id`
 * (`esc-<sessionId>-<reason>-<epochKey>`). Because the id is deterministic per
 * (session, reason, epoch), host INGEST is an idempotent `INSERT … ON CONFLICT DO
 * NOTHING`: a runner respawn or a host retry that re-emits the same escalation
 * produces exactly one row, one card. `short_id` is a 6-char UNIQUE handle carried
 * in chat callback data (the full episode_id is too long for some adapters).
 *
 * THREE INDEPENDENT LIFECYCLE COLUMNS, each advanced idempotently and repaired by a
 * host reconciler so no step is ever permanently lost:
 *   - `decision_state`  pending | continued | stopped | expired | superseded | observed
 *       The human/expiry decision. `resolveCostEpisode` is a compare-and-set on this
 *       (WHERE decision_state='pending' AND expires_at>now): first writer wins, a
 *       stale/duplicate transition is a no-op that re-renders the terminal result.
 *       `observed` = recorded under the OFF feature flag (S1); never carded/actioned.
 *   - `effect_state`    none | enqueued | applied
 *       Whether the decision's effect landed. The decision enqueues ONE epoch-fenced
 *       `cost_override` (Continue → runner raises the cap by one allotment; Stop →
 *       runner soft-quiesces, taking no new work). The host stays READ-ONLY on
 *       outbound.db: it marks `applied` by observing the runner's durable `cost_cap`
 *       (episodeId cleared → the override was consumed). The reconciler re-drives a
 *       decided-but-`enqueued` episode until that observation lands. No receipt ledger,
 *       no host kill.
 *   - `card_state`      observed | undelivered | sending | delivered | edited | failed
 *       Delivery of the interactive card. Retryable: a crash between INGEST and send
 *       leaves `undelivered`, which the card reconciler resends; `platform_message_id`
 *       is stored on success so the card can be terminal-edited on resolve.
 *
 * `protocol_version` gates the flag rollout: S1 records episodes at the current
 * version but takes no action; when S2 activates, the host acts only on episodes
 * created after activation and marks all prior `observed` rows `superseded`, so a
 * flag flip can never suddenly card a backlog of observation-era episodes.
 *
 * `epoch_key` is the runner's monotonic BUDGET GENERATION (`String(budgetGen)`) live when
 * the episode escalated — one counter for both windows, rotated on every budget-epoch
 * change (/clear, new_session, daily rollover, each applied Continue). It is validated on
 * resolve and by the runner's fence: a decision whose epoch no longer matches the
 * session's live generation (a pre-`/clear` escalation, a re-enqueued click, yesterday's
 * daily card) is refused, so an old-epoch action can never touch fresh work — the
 * exactly-once GRANT guarantee (see applyCostOverride in poll-loop.ts).
 *
 * FK to `sessions(id) ON DELETE CASCADE`: deleting a session removes its episodes, so
 * a session/group delete can't be blocked by, or leave, orphan episodes.
 */
export const migration939: Migration = {
  version: 939,
  name: 'cost-escalation-episodes',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS cost_escalation_episodes (
        episode_id          TEXT PRIMARY KEY,
        short_id            TEXT NOT NULL UNIQUE,
        protocol_version    INTEGER NOT NULL,
        session_id          TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        agent_group_id      TEXT,
        reason              TEXT NOT NULL,                       -- 'cap' | 'ceiling'
        window              TEXT NOT NULL,                       -- 'lifetime' | 'daily'
        epoch_key           TEXT NOT NULL,                       -- escalatedAt (lifetime) | dayKey (daily)
        day_key             TEXT,
        spent_usd           REAL,
        cap_usd             REAL,
        ceiling_usd         REAL,
        immortal            INTEGER NOT NULL DEFAULT 0,
        decision_state      TEXT NOT NULL DEFAULT 'pending',     -- pending|continued|stopped|expired|superseded|observed
        effect_state        TEXT NOT NULL DEFAULT 'none',        -- none|enqueued|applied
        card_state          TEXT NOT NULL DEFAULT 'undelivered', -- observed|undelivered|sending|delivered|edited|failed
        platform_message_id TEXT,
        approval_id         TEXT,
        created_at          TEXT NOT NULL,
        expires_at          TEXT,
        resolved_at         TEXT,
        resolved_by         TEXT,
        effect_attempts     INTEGER NOT NULL DEFAULT 0,
        last_error          TEXT
      )
    `);
    // Reconciler hot paths: find undelivered cards, decided-but-unapplied effects,
    // and expired-but-pending episodes without a full scan.
    db.exec(`CREATE INDEX IF NOT EXISTS idx_cost_ep_card    ON cost_escalation_episodes (card_state)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_cost_ep_effect  ON cost_escalation_episodes (decision_state, effect_state)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_cost_ep_session ON cost_escalation_episodes (session_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_cost_ep_pending ON cost_escalation_episodes (decision_state, expires_at)`);
  },
};
