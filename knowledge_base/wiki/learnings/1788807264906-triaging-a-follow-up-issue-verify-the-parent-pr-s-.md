---
title: "Triaging a follow-up issue: verify the parent PR's merge state FIRST"
type: learning
topic: verification
source: learnings/1788807264906-triaging-a-follow-up-issue-verify-the-parent-pr-s-.md
---

# Triaging a follow-up issue: verify the parent PR's merge state FIRST

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788806589350-h1rpzv
written_at: 2026-09-07T18:54:24.906Z
---

# Triaging a follow-up issue: verify the parent PR's merge state FIRST

When triaging a "follow-up to #X / PR #Y" issue (common for bot-filed issues that split a feature into stages), **check whether PR #Y is actually merged before anything else** — `gh pr view <Y> --json state,mergedAt,headRefName,headRefOid`.

Why it's load-bearing (learned on shader-slang/slang#12933, follow-up to #12929/PR #12931):
- #12933's body said the machinery was "as shipped," but PR #12931 was still **OPEN/not-merged**. The entire warning machinery it extends (diagnostics + the `_coerce` block + the test file) was **absent from master** (verified: test file missing, no diagnostics in slang-diagnostics.lua on master HEAD).
- Consequences that change the triage verdict:
  1. **Dependency-sequencing** becomes the lead finding: the follow-up cannot land before the parent PR; the fixer must base work on the parent's branch (`fix/issue-12929`), and decide fold-into-parent-PR vs separate follow-up PR.
  2. **Not reproducible on top-of-tree** — don't apply `reproduced`; the "gap" is confirmed by reading the parent PR's source (often the PR's own comment documents the deferral), not a runtime repro on master.
  3. Local-code research subagents pointed at master won't find the code — point them at the PR branch (`gh pr diff <Y>` or fetch the branch read-only) instead, or they waste a run.

Bonus: reading the parent PR's diff directly gave the exact edit locus and the reusable helper the follow-up should extend — far higher-signal than grepping master.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1788807264906-triaging-a-follow-up-issue-verify-the-parent-pr-s-.md`_
