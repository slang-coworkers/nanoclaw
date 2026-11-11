import { checkAllowlist, type GitHubLookups } from './allowlist.js';
import { checkEligibility, type EligibilitySources } from './eligibility.js';
import type { GateDecision, GateRequest } from './types.js';

const SYSTEM_EVENTS = new Set(['pr_closed', 'review_thread', 'check_suite', 'other']);

export interface DecideContext {
  org: string;
  roster: Set<number>;
  lookups: GitHubLookups;
  eligibility: EligibilitySources;
}

/**
 * One gate, two checks. Check 1 (threat model) asks who the actor is; Check 2
 * (Claude access policy) asks whether that person is eligible now. Only a
 * request that starts work and passes both is admitted. Events no person sends
 * (CI, merges) inherit their chain and are never judged here.
 */
export async function decide(req: GateRequest, ctx: DecideContext): Promise<GateDecision> {
  if (SYSTEM_EVENTS.has(req.event) || !req.actor) {
    return { outcome: 'system_event', reason: null, tier: 'n/a', allowlist: null, eligibility: null };
  }
  if (req.actor.type === 'Bot') {
    return { outcome: 'bot', reason: null, tier: 'n/a', allowlist: null, eligibility: null };
  }

  const allowlist = await checkAllowlist(req.actor, {
    repo: req.repo,
    org: ctx.org,
    roster: ctx.roster,
    lookups: ctx.lookups,
  });
  const tier = allowlist.allowlisted ? 'allowlisted' : 'external';

  // Check 1 runs even when nothing starts, so the log shows whose issues and
  // PRs would stop being picked up on their own (the authority that is lost).
  if (!req.startsWork) {
    return { outcome: 'no_start', reason: 'no_exact_mention', tier, allowlist, eligibility: null };
  }
  if (!allowlist.allowlisted) {
    return {
      outcome: 'external_blocked',
      reason: allowlist.evidence.lookupError ? `lookup_failed_${allowlist.evidence.lookupError}` : 'not_allowlisted',
      tier,
      allowlist,
      eligibility: null,
    };
  }

  const eligibility = await checkEligibility(req.actor, ctx.eligibility);
  if (!eligibility.eligible) {
    return { outcome: 'not_eligible', reason: eligibility.reason, tier, allowlist, eligibility };
  }
  return { outcome: 'admitted', reason: null, tier, allowlist, eligibility };
}
