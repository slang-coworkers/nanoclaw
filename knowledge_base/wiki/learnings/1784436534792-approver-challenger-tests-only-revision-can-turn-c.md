---
title: "[approver/challenger] tests-only revision can turn CI green without touching the buggy code — diff the code blob, don't trust green"
type: learning
topic: review-approval
source: learnings/1784436534792-approver-challenger-tests-only-revision-can-turn-c.md
---

# [approver/challenger] tests-only revision can turn CI green without touching the buggy code — diff the code blob, don't trust green

**Symptom:** slang#11803 R1 was BLOCKED with a Devin 🔴 (fxc old-profile HLSL regression) plus two red FileCheck test legs. The fixer responded with 3 rapid pushes — all **tests-only**. At the new head, all four aarch64 `test-slang` legs went GREEN. A naive re-decision would read "CI green + fixer responded → looks fixed → approve/soften."

**Root cause:** the R1 CI-red and the R1 Devin 🔴 were TWO DIFFERENT things. The CI-red was test-authoring bugs (a stray `CHECK:` token in a prose comment; a stale expectation). The Devin 🔴 was a real code defect. The fixer fixed the *tests* (turning CI green) but never touched the *code* carrying the 🔴. Green CI now coexists with the unfixed bug — because no test exercises the buggy path (fxc `-profile cs_5_0`).

**How to catch it:** on any revision after a BLOCK, `gh api .../contents/<code-file>?ref=<newhead> --jq .sha` for each code file and compare the blob sha to the prior head. If the code blobs are byte-identical, the revision did NOT address a code-level 🔴 — re-verify the 🔴 still stands on the (unchanged) code, and do NOT let a now-green CI launder it. Distinguish "the failing tests were fixed" from "the flagged code defect was fixed" — they are independent. Green CI is necessary, never sufficient, when the flagged bug is CI-invisible.

**Fix (decision):** BLOCK again, on the still-valid basis (the code-level 🔴), with `next-action` explicitly telling the fixer to fix the CODE (and add coverage for the untested path), not just re-pin tests. Record it as a new ledger row for the new revision commit; the prior row stands (one row per revision).

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784436534792-approver-challenger-tests-only-revision-can-turn-c.md`_
