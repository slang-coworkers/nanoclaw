import { getDb, hasTable } from '../../db/connection.js';
import { log } from '../../log.js';
import type { GateDecision, GateRequest } from './types.js';

export type RecordResult = 'recorded' | 'duplicate' | 'unavailable' | 'failed';

export interface DecisionRow {
  delivery_id: string;
  mode: string;
  surface: string;
  event: string;
  repo: string | null;
  number: number | null;
  actor_id: number | null;
  actor_login: string | null;
  actor_type: string | null;
  starts_work: number;
  tier: string;
  tier_via: string | null;
  evidence: string;
  eligibility: string;
  outcome: string;
  reason: string | null;
  current_outcome: string | null;
  created_at: string;
}

/**
 * Append one decision. A delivery id comes back on GitHub redelivery and on
 * inbox-drain replay, so the row is inserted only if absent: one decision per
 * delivery. Never throws — the log must not change what routing does.
 */
export async function recordGateDecision(
  req: GateRequest,
  decision: GateDecision,
  opts: { mode: string; currentOutcome: string | null },
): Promise<RecordResult> {
  try {
    if (!(await hasTable(getDb(), 'input_gate_decisions'))) return 'unavailable';
    const info = await getDb().run(
      `INSERT INTO input_gate_decisions
         (delivery_id, mode, surface, event, repo, number, actor_id, actor_login, actor_type,
          starts_work, tier, tier_via, evidence, eligibility, outcome, reason, current_outcome, created_at)
       SELECT ?, ?, 'github', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        WHERE NOT EXISTS (SELECT 1 FROM input_gate_decisions WHERE delivery_id = ?)`,
      req.deliveryId,
      opts.mode,
      req.event,
      req.repo || null,
      req.number,
      req.actor?.id ?? null,
      req.actor?.login ?? null,
      req.actor?.type ?? null,
      req.startsWork ? 1 : 0,
      decision.tier,
      decision.allowlist?.via ?? null,
      JSON.stringify(decision.allowlist?.evidence ?? {}),
      JSON.stringify(
        decision.eligibility
          ? {
              identity: decision.eligibility.identity,
              entity: decision.eligibility.entity,
              location: decision.eligibility.location,
            }
          : {},
      ),
      decision.outcome,
      decision.reason,
      opts.currentOutcome,
      new Date().toISOString(),
      req.deliveryId,
    );
    return info.changes > 0 ? 'recorded' : 'duplicate';
    // eslint-disable-next-line no-catch-all/no-catch-all -- the decision log must never block delivery
  } catch (err) {
    log.warn('input-gate: decision not recorded (non-fatal)', {
      delivery: req.deliveryId,
      err: err instanceof Error ? err.message : String(err),
    });
    return 'failed';
  }
}

export async function listGateDecisions(): Promise<DecisionRow[]> {
  return getDb().all<DecisionRow>('SELECT * FROM input_gate_decisions ORDER BY id');
}
