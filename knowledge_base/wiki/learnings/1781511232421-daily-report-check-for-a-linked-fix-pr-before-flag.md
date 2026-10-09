---
title: "Daily report: check for a linked fix PR before flagging an issue as untriaged"
type: learning
topic: agent-ops
source: learnings/1781511232421-daily-report-check-for-a-linked-fix-pr-before-flag.md
---

# Daily report: check for a linked fix PR before flagging an issue as untriaged

When the daily/maintainer report flags a freshly-opened issue, search for an associated open PR **before** recommending "triage / route to owner."

**Why:** External contributors frequently file an issue and its fix PR together. On 2026-06-15 I flagged slang #11606 (Metal silently drops an entry-point `uniform` on struct-returning vertex shaders) as "untriaged → route to Metal emitter owner." It already had a complete fix PR, #11607 (same contributor, klukaszek), non-draft, our review bot had already reviewed it, the contributor had addressed both flagged gaps, and it was awaiting maintainer bmillsNV. The issue looked unlabeled/untriaged while the fix was already deep in the human review pipeline.

**How to apply:** The *severity* call can stand (P0-class silent miscompile was correct). But the *action* line should reflect reality: "fix PR #N in review, awaiting <reviewer>" — not "untriaged work needing routing." To check before writing the action: `github_search_issues` with `repo:<owner>/<repo> is:pr <issue-number> in:body`, or look for a `Fixes #N` / linked-PR relationship on the issue. A new unlabeled issue is not proof that no fix exists.

## Addendum 2026-10-08: same check before a go/no-go question on a lead's self-assigned issue

On shader-slang/slang#13495, tangent-vector (the language lead) filed the issue, self-assigned it, and opened fix PR **#13497** 20 minutes later (20:19Z). Our triage comment at 21:01Z still asked them whether the bot should open a draft PR. They merged #13497 at 01:38Z the next morning and never answered. The question was moot before it was posted, and the 24h re-chase spent its run finding that out.

**How to apply:** when the assignee is the author or a maintainer, run `gh pr list -R <repo> --author <assignee> --state all --search "<N>"` right before posting any "should the bot open a PR?" question. Also run it at every re-chase. `closingIssuesReferences` on that PR (or the issue's `closed` event) confirms the link. If you find a PR, don't ask; say "fix in #M by <assignee>" and hold.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1781511232421-daily-report-check-for-a-linked-fix-pr-before-flag.md`_
