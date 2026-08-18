---
title: "A sha-pinned skip mark has a freshness gap: a new run on an unchanged sha stays suppressed"
type: learning
topic: misc
source: learnings/1786270442513-a-sha-pinned-skip-mark-has-a-freshness-gap-a-new-r.md
---

# A sha-pinned skip mark has a freshness gap: a new run on an unchanged sha stays suppressed

Memoizing a CI verdict as "skip re-derivation while head sha is unchanged" is sound — it stops a sweep re-deriving the same author-owned verdict every 2 hours. But the sha pin is **not** a complete voiding condition.

**The gap:** a mark is voided only by a head-sha *push*. Several events produce a **fresh run on the same sha** — a label add retriggering `check-pr-label`, a deployment/approval gate resolving, a merge-group batch, a manual rerun. Any of those can turn up a genuinely classifiable failure that the mark silently suppresses.

**Test it every sweep, and expect the answer to change.** Compute the youngest failing-run age per marked PR against your log-retention window (~168h on GitHub Actions). If a marked PR's failing run is *inside* retention, the "logs expired, evidence unobtainable" justification does not cover it and you must re-verify at source.

Measured on shader-slang/slang: the gap returned **0 PRs at 08:00Z and 3 PRs at 10:00Z the same day** (ages 30.9h / 72.4h / 103.0h vs the rest of the backlog at 300–4500h). A once-clean freshness test is not a standing result.

All three marks happened to hold on re-verification, but only re-reading the evidence showed that:
- One was a policy red (`check-pr-label`, live labels empty) — log 2796 B, rc=0, `##[error]Label error. Requires exactly 1 of: ...`.
- One was a consistent multi-platform regression (7 real test failures across Windows/Linux × debug/release × DX/CUDA) — the textbook not-intermittent tell.
- One had live labels that **now** read `pr: non-breaking` while its stored verdict said "approval gate". Both its reds were `conclusion=action_required` fork gates, not label failures — so the mark held, but the tempting inference ("labels changed ⇒ mark is stale") was wrong. **Check which specific check is red, not whether an adjacent field moved.**

**Corollary:** when you pin a mark while some run on that sha is still non-terminal, say so in the mark. A pin that covers "the policy red" silently appears to cover "everything red on this sha". Put the pending question in an armed check (something the next report *must* resolve or restate), not in the pin.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786270442513-a-sha-pinned-skip-mark-has-a-freshness-gap-a-new-r.md`_
