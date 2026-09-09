---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787086126486-d7kw84
written_at: 2026-08-19T14:32:07.626Z
---

# [approver/human-disagreement] OPEN_GAP abstain on a deployment-dependent CI-ops risk was overruled — the fleet owner holds facts the diff cannot carry

**PR:** shader-slang/slang#12599 @ `76d00453dc63`. I decided **ABSTAIN_POLICY(OPEN_GAP)** (2026-08-18 21:02Z). Human outcome: **APPROVED unchanged** — `jvepsalainen-nv` "LGTM" at my exact head 07:00:48Z, merged by author `jkiviluoto-nv` 14:27:06Z, **zero commits after my decided head**. My abstain was overruled toward approve.

**The change.** CI autoscaler GCP VM boot scripts (`extras/scaler/internal/gcp/startup.{sh,ps1}`) replaced a hardcoded runner-version/SHA pin with an unauthenticated `api.github.com/.../releases/latest` lookup made unconditionally per VM boot, failing closed (`shutdown -h now`).

**The gap I flagged (and CodeRabbit independently rated Major / High-merge-risk "not merge-ready"):** unauthenticated GitHub REST is 60 req/hr per source IP; on a shared Cloud-NAT egress IP a busy fleet could exhaust it → mass VM shutdowns → the same outage class the PR fixes. Two independent reviewers flagged it; a human approved it as-is with one word.

**Why it was overruled, and the transferable lesson.** This gap is *deployment-dependent* — whether 60/hr is ever approached depends on boots/hour, NAT topology, and whether the deployed environment actually authenticates the call. Those facts live with the person who operates the fleet, NOT in the diff. This is the archetypal case where "route to a human" is process-correct (I genuinely could not verify it), but the class **resolves toward approve** because the owner has the missing context. Two reinforcing tells were present that I under-weighted:
1. **The author documented the operating incident history themselves** — the commit/comments narrate the exact prior outages (2026-04-29, 2026-08-11) and the manual-bump toil. An author who writes the operational failure history INTO the PR has already weighed the operational tradeoff; the risk was not novel to them.
2. **The risk is one of *degradation vs. the status quo*, not a *new* failure mode** — the pre-PR pinned constant ALSO caused fleet-wide outages (that's the motivation). A change that trades a certain recurring outage for a conditional, deployment-dependent one is a net-positive ops call the owner is entitled to make.

**How to sharpen Step-0 recall / the challenger.** For CI-runner / autoscaler / ops-infra changes whose only open concern is a *deployment-dependent operational risk* (rate limits, shared egress IPs, boot-time external dependencies, retry/backoff policy): before escalating to OPEN_GAP, ask (a) is the risk resolvable only with deployment facts absent from the diff? and (b) has the author demonstrably already operated this system / documented the incident history? If both yes, the honest severity is usually **advisory**, not OPEN_GAP — note the concern for the human but lean toward not treating it as merge-blocking, because the owner reliably accepts these. Abstaining was defensible under "uncertainty ⇒ ABSTAIN", but this class of uncertainty is one a human owner routinely and correctly resolves toward merge.

**What I got right (keep):** my read of the diff beat the automated reviewer — I correctly saw checksum verification was RETAINED (asset `digest` field) where Devin claimed it was dropped, and the merge confirmed that. Reading the actual source at head is what let me discount Devin's false clearance.
