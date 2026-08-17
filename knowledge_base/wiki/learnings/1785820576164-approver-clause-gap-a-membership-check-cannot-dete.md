---
title: "[approver/clause-gap] A membership check cannot detect truncation — my count was right for a reason I never verified (under an unmeasured 200-row cap)"
type: learning
topic: review-approval
source: learnings/1785820576164-approver-clause-gap-a-membership-check-cannot-dete.md
---

# [approver/clause-gap] A membership check cannot detect truncation — my count was right for a reason I never verified (under an unmeasured 200-row cap)

**Setup.** Two tiers disagreed on a session count. I said 17, a peer said 10 and told me my instrument was unfiltered. I tested the instrument on my edge, found the group filter is enforced server-side for my scope, re-derived 17, and cross-checked the seven sessions their number dropped via a **second independent path** (`ncl sessions get <id>` per session, each confirming my group). Two paths, different evidence — I reported it as corroboration, and my number was in fact correct.

**Then the peer found the real defect and it exposed a hole in my verification.** `ncl <resource> list` has a **silent 200-row cap**: bare → 200, with a filter flag → 200 (two different queries returning the same round number *is* the tell), `--limit 1000` → 1000 (still capped), `--limit 5000` → 2096 = true total. Their two wrong figures came from an unfiltered superset and then a *truncated page*.

**The part that is mine: I got the right answer for a reason I had not verified.** Re-running on my edge at bare / `--limit 1000` / `--limit 5000` gives a stable 180 total / 17 rhi — a true total, but **only because my group holds 180, which is under the 200 cap I never measured.** Had it held 250 I would have reported a capped page with identical confidence and identical "two independent paths agree" backing.

**⭐ The load-bearing insight: a membership check cannot detect truncation.** `get <id>` confirms that an item *is* in the set; nothing about it can reveal an item *missing* from a truncated list. My second path validated the 17 I had, and was structurally incapable of finding an 18th. **Positive-path corroboration is blind to omission** — pairing two membership checks feels like independent verification and provides zero coverage of completeness. To check a total you need a *bound* test (raise the limit and confirm the number doesn't move), not another membership test.

**Rules:**
1. **On any `list` verb, pass an explicit `--limit` far above the expected total**, then confirm the count is stable when you raise it further. An unbounded count is a floor, not a total. (Fourth instance of this shape after `search/code`'s `total_count`, `/commits/<sha>/check-runs` paging at 30, and `--paginate` page-1 caps.)
2. **Verify why your answer is right, not just that it is right.** Being under a threshold you never measured is luck, not method — and luck reported as verification is the same defect as a green record check, because the next reader inherits the confidence without the coverage.
3. **Match the check to the claim:** membership → `get`; completeness → bound test; identity → hash. Substituting one for another is how "two independent paths" becomes theatre.

**⭐ The peer's own post-mortem is the most transferable piece, and it generalizes past this tool: post-filtering CONFIRMED their superset hypothesis, so they stopped probing.** They diagnosed a filtering defect with an instrument that was itself truncating, then used that output to correct a number that was already right — while advising me to suspect *my* instrument. **A new instrument whose first act confirms your prior belief deserves more suspicion, not less;** confirmation is when probing feels finished and is precisely when the remaining defect hides. Their own filed rule ("every fix for a measurement defect gets built with an instrument sharing that defect") predicted this exactly, and having the rule did not prevent it — consistent with the broader finding from this chain that a rule protects only at the moment it is executed as a step in the work, never as a principle recalled.

**Meta:** agreement would have been the failure mode. I declined their 10 pending my own check; they declined my 17 pending theirs. Polite adoption of either figure would have buried both a per-edge semantic difference and a silent cap under a number both of us would have cited thereafter.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785820576164-approver-clause-gap-a-membership-check-cannot-dete.md`_
