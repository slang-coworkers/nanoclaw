/**
 * Classify a critique-gate denial reason, and decide whether it needs a human.
 *
 * The gate emits exactly six denial reasons (container/hooks/
 * gate-critique-on-deliver.sh). Measured over the 18 escalations prod raised
 * between 2026-07-07 and 2026-08-05, they split:
 *
 *   missing  12/18   the critique never ran (or ran without recording a verdict)
 *   stale     5/18   it ran and passed, then the artifacts moved underneath it
 *   failed    1/18   it ran, and said must-fix
 *
 * Only `failed` carries a decision a human can meaningfully make ("the
 * reviewer says this is wrong — ship anyway?"). The other two have exactly one
 * correct answer: run the critique. Carding those to a human produced a 13/16
 * rejection rate and batch-clearing, i.e. the human had become a rubber stamp
 * on a question with a known answer.
 *
 * Unrecognized reasons classify as `failed` — a reason we don't understand
 * must reach a human rather than be silently self-healed.
 */
export type EscalationClass = 'missing' | 'stale' | 'failed';

/** Escalation classes the host resolves by driving the agent, with no human. */
export function isSelfHealable(cls: EscalationClass): boolean {
  return cls === 'missing' || cls === 'stale';
}

export function classifyEscalation(reason: string): EscalationClass {
  const r = (reason || '').trim();

  // ── failed: the critique ran and returned a non-approve verdict. The only
  // class where a human is deciding something. Checked first: this string also
  // contains "Re-run /codex-critique", which must not be mistaken for staleness.
  if (/last verdict is\s+"[^"]*"\s*\(must be "approve"\)/i.test(r)) return 'failed';

  // ── missing: no round recorded at all, or a round whose verdict the
  // recorder could not parse. Both are fixed by running the stage again.
  if (/^missing critique stages:/i.test(r)) return 'missing';
  if (/^no critique rounds recorded/i.test(r)) return 'missing';
  if (/ran but no verdict was recorded/i.test(r)) return 'missing';

  // ── stale: a passing approve that no longer covers the current state.
  if (/edit\(s\) recorded since the last critique round/i.test(r)) return 'stale';
  if (/^reviewed artifacts changed since the OUTPUT_REVIEW approve/i.test(r)) return 'stale';

  return 'failed';
}

/**
 * The stage the agent must re-run, parsed out of the reason. Falls back to
 * OUTPUT_REVIEW, which is the stage every freshness/verdict reason refers to.
 */
export function stageToRerun(reason: string): string {
  const r = reason || '';
  const missing = r.match(/^missing critique stages:\s*([A-Z_]+)/i);
  if (missing) return missing[1].toUpperCase();
  const staged = r.match(/STAGE:\s*([A-Z_]+)/i);
  if (staged) return staged[1].toUpperCase();
  return 'OUTPUT_REVIEW';
}

/**
 * The message the host injects into the agent's session instead of carding a
 * human. Imperative and specific: it names the stage, the blocked surface, and
 * states plainly that waiting will not clear the gate — the previous design
 * taught agents that waiting 30 minutes worked, because it did.
 */
export function selfHealDirective(opts: {
  cls: EscalationClass;
  reason: string;
  hit: string;
  attempt: number;
  maxAttempts: number;
}): string {
  const { cls, reason, hit, attempt, maxAttempts } = opts;
  const stage = stageToRerun(reason);
  const why =
    cls === 'stale'
      ? `Your last critique approve no longer covers the current state.`
      : `The required critique has not been recorded for this work.`;

  return [
    `CRITIQUE GATE BLOCKED your ${hit} (attempt ${attempt} of ${maxAttempts}).`,
    ``,
    why,
    `Unmet requirement: ${reason}`,
    ``,
    `Run \`/codex-critique\` with STAGE: ${stage} now, then retry the ${hit}.`,
    ``,
    `The gate will NOT open on its own — there is no timeout that lets this`,
    `through. Running the critique is the only thing that clears it. If you`,
    `genuinely cannot run it, say why in this session; after ${maxAttempts} attempts`,
    `an admin is asked to decide.`,
  ].join('\n');
}
