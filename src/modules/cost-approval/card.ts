/**
 * PURE card-content builders for the cost-cap escalation card. No DB / router / adapter
 * deps — both the cost-approval module (send path) and chat-sdk-bridge (render path)
 * import these, so they must stay side-effect-free and cheap.
 *
 * The wire shape (`CostCardContent`) is the contract the bridge's deliver switch consumes:
 * a title, body lines, and zero-or-more decision buttons. Buttons carry the episode's
 * `short_id` in the action id (`ncc:<shortId>:<decision>`) — short enough for Telegram's
 * 64-byte callback_data cap. Zero buttons = an informational (born-terminal) card.
 */
import type { CostEpisodeRow } from '../../db/cost-escalation-episodes.js';

export interface CostCardButton {
  decision: 'continue' | 'stop';
  label: string;
  style?: 'primary' | 'danger' | 'default';
}

export interface CostCardContent {
  type: 'cost_card';
  shortId: string;
  title: string;
  bodyLines: string[];
  buttons: CostCardButton[];
}

function usd(n: number | null): string {
  return typeof n === 'number' && Number.isFinite(n) ? `$${n.toFixed(2)}` : '$?';
}

/** True for the born-terminal ceiling card: the runner already hard-stopped a
 *  non-immortal session, so the card is informational (no Continue buys past the ceiling). */
export function isBornTerminalCeiling(ep: Pick<CostEpisodeRow, 'reason' | 'immortal'>): boolean {
  return ep.reason === 'ceiling' && !ep.immortal;
}

/**
 * Build the interactive card content for a live escalation episode. Three shapes:
 *   - non-immortal ceiling (born-terminal): informational, no buttons.
 *   - immortal (cap or ceiling): Continue-only — immortal groups are never stopped, so the
 *     card raises today's cap; the DM/card IS the per-day visibility bound.
 *   - non-immortal cap: Continue (raise cap + resume) / Stop (quiesce).
 */
export function buildCostCardContent(ep: CostEpisodeRow): CostCardContent {
  const immortal = !!ep.immortal;
  const spent = usd(ep.spent_usd);
  const cap = usd(ep.cap_usd);
  const ceiling = usd(ep.ceiling_usd);
  const base = { type: 'cost_card' as const, shortId: ep.short_id };

  if (isBornTerminalCeiling(ep)) {
    return {
      ...base,
      title: '🛑 Cost ceiling reached — session hard-stopped',
      bodyLines: [
        `Session ${ep.session_id} (per-run)`,
        `Spent ${spent}  ›  ceiling ${ceiling}`,
        'Stopped automatically — Continue cannot buy past the ceiling. /clear to reset the budget.',
      ],
      buttons: [],
    };
  }

  if (immortal) {
    return {
      ...base,
      title: '📊 Daily cost — over p90/day  (visibility · ∞ never stopped)',
      bodyLines: [
        `∞ immortal · Session ${ep.session_id}  (per-day cap)`,
        `Spent ${spent} today  ›  cap ${cap}/day  (p90)`,
        'Continue raises today’s cap. No Stop — immortal runs by design; this card is the bound.',
      ],
      buttons: [{ decision: 'continue', label: '▶ Continue — raise today’s cap', style: 'primary' }],
    };
  }

  return {
    ...base,
    title: '⚠️ Cost cap — decision needed',
    bodyLines: [
      `Session ${ep.session_id}  (per-run cap)`,
      `Spent ${spent}  ›  cap ${cap}${ep.ceiling_usd != null ? `  ·  ceiling ${ceiling}` : ''}  (p90)`,
    ],
    buttons: [
      { decision: 'continue', label: '▶ Continue — raise cap and resume', style: 'primary' },
      { decision: 'stop', label: '■ Stop — finish this turn, take no new work', style: 'danger' },
    ],
  };
}

export type CostCardOutcome = 'continued' | 'stopped' | 'expired' | 'already' | 'unauthorized';

/**
 * The terminal card content shown after a click / expiry resolves the episode: keep the
 * context, drop the buttons, show who acted. `already` = this click lost the CAS (someone/
 * another surface decided first) — re-render the standing decision, don't imply this actor
 * decided it.
 */
export function buildCostTerminalCard(
  ep: CostEpisodeRow,
  actorName: string,
  outcome: CostCardOutcome,
): { title: string; bodyLines: string[] } {
  const who = actorName ? ` by ${actorName}` : '';
  const spent = usd(ep.spent_usd);
  const cap = usd(ep.cap_usd);
  const context = `Session ${ep.session_id}  ·  spent ${spent} › cap ${cap}`;
  const resolution =
    outcome === 'continued'
      ? `▶ Continued${who} — cap raised, resuming`
      : outcome === 'stopped'
        ? `■ Stopped${who} — taking no new work`
        : outcome === 'expired'
          ? '⌛ Dismissed — no decision within 24h (advisory; spend still ceiling-bounded)'
          : `Already resolved (${ep.decision_state})${who ? ` — latest action${who}` : ''}`;
  return { title: 'Cost cap', bodyLines: [context, resolution] };
}
