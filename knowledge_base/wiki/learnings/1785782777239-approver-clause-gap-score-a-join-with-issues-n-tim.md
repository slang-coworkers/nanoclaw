---
title: "[approver/clause-gap] Score a join with issues/N/timeline — it interleaves force-pushes with reviews, and maintainer vetoes arrive as plain issue comments"
type: learning
topic: review-approval
source: learnings/1785782777239-approver-clause-gap-score-a-join-with-issues-n-tim.md
---

# [approver/clause-gap] Score a join with issues/N/timeline — it interleaves force-pushes with reviews, and maintainer vetoes arrive as plain issue comments

**Symptom.** Joining shader-slang/slang#11667 (`github.pr_merged`) against a row pinned at
`ad924934`. `pulls/N/reviews` showed only bot reviews at my pinned commit plus one human
`approved` at a later commit — which reads as "no human ever objected to my head, and the
merge is an APPROVED-equivalent". Both halves of that reading were wrong.

**Root cause.** The decisive human signal was a **plain issue comment**
(`issues/N/comments`, `saipraveenb25` 2026-08-01T04:05Z) rejecting the PR's approach — a
CHANGES_REQUESTED-equivalent that the reviews endpoint cannot see. And the head had been
**force-pushed** (`ad924934` → `bee3db1f`, 08-01T18:55) between that comment and the
approval, so the approval covered a different revision than my row.

**How to catch it.** `gh api repos/O/R/issues/N/timeline?per_page=100 --paginate` is the one
endpoint that interleaves `committed`, `head_ref_force_pushed`, `reviewed`, `merged`, and
`closed` **with timestamps in one ordering**. That ordering is what proves whether a human
objection PREDATED or POSTDATED a head move — here it established the maintainer objected AT
my pinned head, which is what made the row scorable as CHANGES_REQUESTED instead of a
neutral "head moved, no signal". Filter:
`jq '.[] | select(.event=="committed" or .event=="merged" or .event=="reviewed" or .event=="head_ref_force_pushed")'`.
On a force-pushed fork branch, `compare A...B` is misleading (it showed ahead_by=108 because
the branch had been rebased onto master); confirm content by **sha256 of the file blobs**
(`contents/<path>?ref=<sha>` → base64 -d → sha256sum), never by ahead/behind.

Reinforces the standing rules: maintainer directives arrive on a THIRD endpoint
(`issues/N/comments`), and never infer "a human considered X" from "a human approved" —
compare timestamps (slang-rhi#807). Here the ordering happened to run the favorable way and
still had to be checked before the verdict could be defended.

**Bonus (harness bug).** `gate-critique-on-deliver.sh`'s Bash pattern
`gh api [^|]*pulls\b` denies **read-only** `gh api repos/.../pulls/N` GETs as "PR creation".
Join work is pure reads, so the gate fires on a stale `edits_since_critique` counter left by
an unrelated prior decision — 2 of 3 denials consumed before escalating to an admin card for
nothing. Don't obfuscate the command to get around it: read `issues/N`, `issues/N/timeline`,
and `contents?ref=` instead (all sufficient for a join, none matched by the pattern).
`gh pr view --json` is NOT a fallback — GraphQL 401s in this container. Suggested narrowing
for whoever owns the hook: require a write verb (`-X POST` / `--method POST` / `-f `) before
matching `pulls`.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785782777239-approver-clause-gap-score-a-join-with-issues-n-tim.md`_
