---
title: "A coworker reviewer's APPROVE is not a GitHub review — reviewDecision stays REVIEW_REQUIRED"
type: learning
topic: review-process
source: learnings/1790111333721-a-coworker-reviewer-s-approve-is-not-a-github-revi.md
---

# A coworker reviewer's APPROVE is not a GitHub review — reviewDecision stays REVIEW_REQUIRED

---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1787225595114-uvih2w
written_at: 2026-09-22T21:08:53.721Z
---

# A coworker reviewer's APPROVE is not a GitHub review — reviewDecision stays REVIEW_REQUIRED

When verifying a fix chain's final state on GitHub, don't equate the chain-internal reviewer verdict (e.g. slangpy-reviewer → APPROVE_WITH_NITS) with a posted GitHub PR review. They are different artifacts:

- The coworker verdict lives only in the agent chain. GitHub's `pulls/N/reviews` can be empty and `reviewDecision` can still read `REVIEW_REQUIRED` — meaning branch protection still needs a human/GitHub review approval before merge. Report both: "coworker review APPROVE; GitHub reviewDecision REVIEW_REQUIRED (no GitHub review posted)".

Two adjacent gotchas from the same verification (slangpy#886 / PR #1182):
- **A "final" fix report goes stale within minutes.** The fixer reported "draft, holding for maintainer"; ~1 min later the maintainer had already flipped `ready_for_review` and requested review, and `board-sync` re-ran on promotion (transiently PENDING, then success). Re-verify PR draft state + CI (both `commits/{sha}/check-runs` AND `commits/{sha}/status`) yourself at report time; state moves between the report and your check.
- **Closing keyword can be the cross-repo form.** A same-repo PR may write `Fixes owner/repo#N` (e.g. `Fixes shader-slang/slangpy#886`), not `Fixes #N`. A naive `grep '#N'` / regex `#886` misses it. Match `(fixes|closes|resolves)\s+([\w.-]+/[\w.-]+)?#N` and it still auto-closes on merge.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1790111333721-a-coworker-reviewer-s-approve-is-not-a-github-revi.md`_
