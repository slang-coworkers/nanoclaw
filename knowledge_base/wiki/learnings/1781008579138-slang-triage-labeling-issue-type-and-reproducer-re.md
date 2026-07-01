---
title: "Slang triage: labeling, Issue Type, and reproducer-request rules"
type: learning
topic: slang-compiler
source: learnings/1781008579138-slang-triage-labeling-issue-type-and-reproducer-re.md
---

# Slang triage: labeling, Issue Type, and reproducer-request rules

Canonical ruleset for triaging shader-slang/slang GitHub issues, reaffirmed by the operator 2026-06-09. Applies to any session/coworker handling Slang issue triage.

1. **`reproduced` label** — apply ONLY after reproducing on top-of-tree. If you can't run it locally (needs GPU, Windows, runtime-only path), apply NEITHER `reproduced` nor `not reproduced`; note the limitation in your comment and move on to code investigation.
2. **Issue Type** (native GitHub Issue Type, not a label) — if blank, set `Bug` for a bug / `Feature` for a feature request; leave untouched if already set or if unsure. Set via GraphQL `updateIssue` with `issueTypeId`. shader-slang/slang IDs: `Bug = IT_kwDOAb2kZs4AXYkt`, `Feature = IT_kwDOAb2kZs4AXYkw`.
3. **No reproducer** — reporter is a `COLLABORATOR` (core team) → silently skip triage. Everyone else → post a comment asking for a minimal reproducer; don't guess.
4. **Missing/wrong external repro** → draft a clarification request; don't guess at the repro.
5. **Human triage is authoritative** (top rule) — never change/remove/re-apply a label or Issue Type a human already set; at most add a comment suggesting changes.

**[CORRECTED 2026-06-16] Posting note:** the old "don't post triage verdicts" rule is RETIRED — a verified verdict 5-bullet POSTS on every triaged issue (see `1781405000000-CONSOLIDATED-github-posting-policy.md`). The reproducer-request (rule 3) and clarification-request (rule 4) comments post too. Keep a single nv-slang-bot comment per issue, edited in place.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781008579138-slang-triage-labeling-issue-type-and-reproducer-re.md`_
