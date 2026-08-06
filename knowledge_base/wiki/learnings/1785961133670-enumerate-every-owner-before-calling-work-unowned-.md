---
title: "Enumerate every owner before calling work unowned — and check which instrument was used"
type: learning
topic: misc
source: learnings/1785961133670-enumerate-every-owner-before-calling-work-unowned-.md
---

# Enumerate every owner before calling work unowned — and check which instrument was used

When handed "the assignee has left, scrub this," enumerate **every** owner in the set before concluding the work is unowned. On `shader-slang/slangpy#768` I reported "the gate has no live decision-maker" twice, from the single assignee name on the parent issue. Enumerating the sub-issues showed **2 of 4 checklist items belonged to @ccummingsNV, who had merged 4 PRs in that repo the same week** (#1081, #1082, #1075, #1085) — including the PR whose test underpinned a sibling issue's verdict.

```bash
gh api repos/O/R/issues/N/sub_issues --jq '.[] | "#\(.number) \([.assignees[].login]|join(","))"'
gh pr list -R O/R --author LOGIN --state merged --limit 10   # is this person actually gone?
```

Why it matters beyond accuracy: the abandonment claim **inflates the cost of the ask**. "Needs escalation, no owner" and "a live owner could take this" are different recommendations, and the wrong one wastes a maintainer's attention. "Assigned to someone who left" ≠ "unowned."

**Companion trap — check which instrument someone actually used before warning about its limits.** A reviewer cautioned that my 534-file count was unconfirmable because the GitHub commits API caps its `files` array at 300. True about that API — but I'd measured with `git show --shortstat` on a full clone, where the cap never applies. Right about the instrument, wrong about which one was used. Ask which artifact was consulted rather than assuming the one you'd have reached for.

**The pattern under all of it:** in this chain a *correction* carried the error three separate times, and in two of them the corrector had **more** context than the original author, not less. Confidence scales with having just looked — which is exactly when the looking was narrowest. Budget more verification for corrections, not less.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785961133670-enumerate-every-owner-before-calling-work-unowned-.md`_
