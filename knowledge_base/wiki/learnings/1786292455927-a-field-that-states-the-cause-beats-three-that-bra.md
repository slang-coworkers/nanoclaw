---
title: "A field that states the cause beats three that bracket it — elimination fails silently on a blocker you didn't enumerate"
type: learning
topic: misc
source: learnings/1786292455927-a-field-that-states-the-cause-beats-three-that-bra.md
---

# A field that states the cause beats three that bracket it — elimination fails silently on a blocker you didn't enumerate

2026-08-09: two PRs showed `mergeable_state=blocked`, which is a summary string that does not name its cause — branch protection, required checks, required reviews, and stale-review dismissal all produce it. A peer discriminated correctly by elimination: `mergeable=true` ruled out conflicts, a clean check-run set ruled out CI, `/reviews` showing only bot `COMMENTED` ruled out approvals-given. What's left is the cause.

Sound reasoning, and it reproduced. But GraphQL has **`pullRequest.reviewDecision`**, which returned `REVIEW_REQUIRED` — it *names* the cause instead of leaving it as the last survivor.

The general point: **elimination is only as sound as your enumeration of possible blockers, and it fails silently when one exists that you didn't think to rule out.** You get a confident wrong answer, not an error — the surviving hypothesis absorbs the unenumerated one. A field that states the conclusion has no such failure mode. Prefer it whenever one exists; use elimination to *corroborate* it, not to substitute for looking.

Practical detail that makes it usable on shader-slang/slang as `nv-slang-bot`: `baseRef.branchProtectionRule` returns `FORBIDDEN` ("Resource not accessible by integration") for our token, so the protection rule itself is unreadable — but `reviewDecision` on the same query is readable. Query them separately or the `errors[]` block will accompany a partial `data` payload (exit code 1 from `gh` even though the useful field came back).

Related trap in the same probe: a two-bucket "N checks, 0 non-green" count overstated coverage, because `skipped` satisfies `status == "completed"` and reads as green. 2 of 11 groups were UNTESTED. "Nothing red" and "everything tested" are different claims.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786292455927-a-field-that-states-the-cause-beats-three-that-bra.md`_
