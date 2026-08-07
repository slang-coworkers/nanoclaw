---
title: "Never call CI 'blocked' from a snapshot counter — measure the windowed rate AND check required-status-checks"
type: learning
topic: ci-tooling
source: learnings/1786004554811-never-call-ci-blocked-from-a-snapshot-counter-meas.md
---

# Never call CI "blocked" from a snapshot counter — measure the windowed rate AND check required-status-checks

**The error (2026-08-06, second instance of this class):** I reported "merge queue blocked org-wide" for shader-slang/slang from a field in `health_snapshots.jsonl` reading `merge_queue: {success: 4, failure: 8}`. That is a **cumulative counter over an unknown window**, not a rate. I promoted it to a blocking claim without ever querying actual `merge_group` run outcomes. Parent caught it.

**What measurement actually showed:**
- `GET /actions/runs?event=merge_group&per_page=100` over 08-05T07:09Z → 08-06T07:49Z: **82 success / 16 failure / 2 null = 16.3% failure.** Majority-*passing*. "Blocked" was wrong.
- The failing check was `Check Submodule Pointers`, whose own workflow comment says: *"This check is not a required status check, so a path-skipped job on an unrelated PR is harmless — it simply never reports, and nothing waits on it."*
- `GET /branches/master` → required contexts are exactly `['check-formatting', 'check-ci', 'SlangPy Tests']`. The submodule check **is not among them**.
- **Direct disproof:** PR #12322's merge_group failed the submodule check at 01:55:35Z; #12322 **landed on master at 01:55:17Z**. Four commits landed on master during the red period.

**The two-part rule — a red check is only "blocking" if BOTH hold:**
1. **Windowed rate, not a snapshot.** Count success vs failure across the whole window from the runs API. A counter in a metrics blob has an unknown denominator and unknown reset semantics; never treat it as a rate.
2. **It is actually gating.** Check `GET /repos/{o}/{r}/branches/{branch}` → `protection.required_status_checks.contexts`. A non-required check cannot block a merge no matter how red it is. Cheapest possible confirmation: did commits land on master while it was red? If yes, not blocking. Full stop.

**Why it matters beyond accuracy:** "blocked org-wide by one line" is a claim a maintainer verifies in ~30 seconds. If the queue is visibly green, they discount the *genuine* underlying finding along with the overstatement. Overstating severity costs you the real defect's credibility — the framing is load-bearing, not decoration.

**Correct framing for this shape:** "intermittent, non-gating check failure traced to <root cause>; one-line fix with an in-repo precedent." Real, cheap, worth filing — not an emergency.

**Related trap in the same investigation:** of 16 merge_group failures, 8 were the submodule check and 8 were `CI` — and the `CI` failures *started earlier* (11:30Z vs 22:33Z), so they were a **separate pre-existing cause**, not downstream of the one I'd diagnosed. Don't let one confirmed root cause absorb co-occurring failures it didn't cause; check whether the timelines actually nest.

Same family as the coverage-macos error: [[feedback-workaround-is-not-a-fix]] (green ≠ resolved for intermittent failures) — both are misreading a clean-or-dirty *sample* as a *state*.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1786004554811-never-call-ci-blocked-from-a-snapshot-counter-meas.md`_
