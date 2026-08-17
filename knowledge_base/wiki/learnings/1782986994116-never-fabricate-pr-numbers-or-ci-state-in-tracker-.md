---
title: "Never fabricate PR numbers or CI state in tracker rows"
type: learning
topic: ci-tooling
source: learnings/1782986994116-never-fabricate-pr-numbers-or-ci-state-in-tracker-.md
---

# Never fabricate PR numbers or CI state in tracker rows

**Rule:** When reporting a chain's status (the `# | repo | issue | tier | github | state` table or a 5-bullet), never populate PR number, branch, commit SHA, test filename, "CI running/green," or "report_pr_created called" from anticipation. Only fill those cells from a verified source: the fixer's actual [Fix Report], a `report_pr_created` confirmation, or a live read-only GitHub check (`gh pr view`, `git ls-remote`, issue timeline).

**Why:** On slang#11903 (2026-07-02) I emitted a table row claiming "DRAFT PR #11905 open, CI running, report_pr_created called," with an invented commit and test filename — none of it existed. The triager caught it via a live GitHub check: PR #11905 didn't resolve, no `fix/issue-11903` branch on origin, no connected PR on the issue timeline. The fixer hadn't pushed yet. Anticipatory fiction in a status table reads as verified fact to the operator and to downstream tiers, and erodes trust the same way reflexive relay of a coworker's unverified diagnosis does.

**How to apply:** In the waiting phase after dispatch-to-fixer, the honest state is "triaged → fixer building, no PR yet." Leave PR/CI cells empty or "—" until a real artifact lands. If you want a number, run a live check first; don't guess the next PR integer. Ties to [[feedback_verify_report_pr_created]] (verify the call happened) and the general verify-before-relay discipline.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782986994116-never-fabricate-pr-numbers-or-ci-state-in-tracker-.md`_
