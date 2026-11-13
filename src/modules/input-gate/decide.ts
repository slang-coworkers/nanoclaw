import { checkAllowlist, type GitHubLookups } from './allowlist.js';
import { checkEligibility, type EligibilitySources } from './eligibility.js';
import type { OpenLane } from './open-lane.js';
import type { GateDecision, GateRequest } from './types.js';

const SYSTEM_EVENTS = new Set(['pr_closed', 'review_thread', 'check_suite', 'other']);

export interface DecideContext {
  org: string;
  roster: Set<number>;
  lookups: GitHubLookups;
  eligibility: EligibilitySources;
  selfLogins?: ReadonlySet<string>;
  /** Repos whose write permission counts for Check 1; null means every repo of the org. */
  repos?: readonly string[] | null;
  /** The open-weights lane, read only when a person fails Check 2; absent means unset. */
  openLane?: () => Promise<OpenLane>;
}

/**
 * One gate, two checks. Check 1 (threat model) asks who the actor is; Check 2
 * (closed-model access policy) asks whether that person is eligible now. A
 * request that starts work and passes both is admitted. A request that passes
 * Check 1 and fails Check 2 goes to the open-weights lane when one is ready,
 * because Check 2 governs closed models only; otherwise it is not eligible.
 * Events no person sends (CI, merges) inherit their chain and are never judged
 * here.
 *
 * The bot's own logins are never judged. Another `Bot` account is judged only
 * when its delivery starts work: routing starts work on any exact mention,
 * whoever writes it, so a third-party App that quotes the handle in a comment
 * must pass Check 1 like a person.
 */
export async function decide(req: GateRequest, ctx: DecideContext): Promise<GateDecision> {
  if (SYSTEM_EVENTS.has(req.event) || !req.actor) {
    return { outcome: 'system_event', reason: null, tier: 'n/a', allowlist: null, eligibility: null };
  }
  if (ctx.selfLogins?.has(req.actor.login) || (req.actor.type === 'Bot' && !req.startsWork)) {
    return { outcome: 'bot', reason: null, tier: 'n/a', allowlist: null, eligibility: null };
  }

  const allowlist = await checkAllowlist(req.actor, {
    repo: req.repo,
    org: ctx.org,
    roster: ctx.roster,
    lookups: ctx.lookups,
    prefilter: !req.startsWork,
    repos: ctx.repos ?? null,
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
    const lane = ctx.openLane ? await ctx.openLane() : null;
    const outcome = lane?.status === 'ready' ? 'open_lane' : 'not_eligible';
    return { outcome, reason: eligibility.reason, tier, allowlist, eligibility };
  }
  return { outcome: 'admitted', reason: null, tier, allowlist, eligibility };
}
