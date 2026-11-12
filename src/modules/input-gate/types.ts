/** The GitHub delivery kinds the gate tells apart. */
export type GateEvent =
  | 'issue_opened'
  | 'issue_labeled'
  | 'pr_reviewable'
  | 'pr_closed'
  | 'comment'
  | 'review'
  | 'review_thread'
  | 'check_suite'
  | 'other';

export interface GateActor {
  id: number | null;
  login: string;
  /** GitHub's account type: 'User', 'Bot', 'Organization'. */
  type: string;
  /** The payload's `author_association` for this actor, when the event carries one. */
  association: string | null;
}

/** What one delivery asks of the gate, extracted from the webhook payload. */
export interface GateRequest {
  deliveryId: string;
  event: GateEvent;
  repo: string;
  number: number | null;
  /** null for events no person sends (CI, merges, review-thread resolution). */
  actor: GateActor | null;
  /** True only for an exact-word bot mention: the one GitHub entry that starts work. */
  startsWork: boolean;
}

/** Check 1 (threat model): is this account on the allowlist? */
export interface AllowlistResult {
  allowlisted: boolean;
  via: 'roster' | 'permission' | 'org_member' | null;
  evidence: {
    association: string | null;
    rosterHit: boolean;
    permission?: string;
    orgMember?: boolean;
    /** False when the delivery's repo is not protected, so its permission was not asked. */
    repoProtected?: boolean;
    lookupError?: 'permission' | 'org';
  };
}

/** Evidence state for one Claude-policy input. */
export type EvidenceState = 'verified' | 'unknown' | 'expired' | 'conflicting' | 'denied';

/** Check 2 (Claude access policy): is this person eligible now? */
export interface EligibilityResult {
  eligible: boolean;
  identity: EvidenceState;
  entity: EvidenceState;
  location: EvidenceState;
  reason: string | null;
}

export type GateOutcome = 'admitted' | 'not_eligible' | 'external_blocked' | 'no_start' | 'bot' | 'system_event';

export interface GateDecision {
  outcome: GateOutcome;
  reason: string | null;
  tier: 'allowlisted' | 'external' | 'n/a';
  allowlist: AllowlistResult | null;
  eligibility: EligibilityResult | null;
}
