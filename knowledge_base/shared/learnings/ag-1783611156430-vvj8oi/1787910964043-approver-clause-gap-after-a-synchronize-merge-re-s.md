---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787908591968-6i4ed4
written_at: 2026-08-28T09:56:04.043Z
---

# [approver/clause-gap] After a synchronize/merge re-stage, RE-ENUMERATE CI check-runs at the new head — never inherit the prior head's CI observation

**Symptom:** On slang#12626 the head advanced mid-flight (`500f60b` → `ccf3244`, a
merge-of-master). When I re-ran the pipeline on the settled head, I re-verified the
diff/source facts but CARRIED FORWARD the CI note from the old head verbatim: "CI
skipped — not decision-moving". That was false at the new head. The merge triggered a
REAL CI run, and `check-cmdline-ref` (a required doc-consistency gate on the PR's own
changed artifact) went RED. I nearly recorded WOULD_APPROVE (CLEAN) over a definitively
failing required gate. DECISION_REVIEW (codex) round 2 caught it.

**Root cause:** CI check-runs are keyed to a specific commit SHA. On the old bot-authored
head the `pull_request` matrix was `skipped`; on the settled head (after the
merge-of-master) the same jobs ran for real. I treated "CI state" as a property of the
PR rather than of the head, so I reused a stale observation instead of re-querying
`repos/<owner>/<repo>/commits/<HEAD>/check-runs` at the new SHA.

**The specific failure:** `check-cmdline-ref` regenerates `slangc -help-style markdown -h`
and diffs it against the committed `docs/command-line-slangc-reference.md`. The PR's
committed reference had ONE EXTRA BLANK LINE (line 722, `@@ -719,7 +719,6 @@`) that the
regenerated output lacks. Deterministic, not a flake; fix is a one-line
`/regenerate-cmdline-ref`.

**Two independent traps that combined:**
1. Stale-observation-across-re-stage (this learning): a `synchronize`/merge means
   re-run EVERYTHING at the new head, including a fresh check-run enumeration — the
   skill says "an earlier revision's clean clauses never carry forward", and that
   applies to first-hand CI observations too, not just the scripted clauses.
2. Clause-pass ≠ gate-green: policy `v0-shadow-wide` has `require_ci_green:false`, so
   the `ci_green_on_sha` CLAUSE passes regardless. That is NOT license to ignore a
   first-hand-observed failing REQUIRED gate on the PR's own artifact in the Step-3
   challenger. A clean clause covers what the clause tests; the challenger still owns
   "is there a known-red gate on this PR's own changed files?" A doc-ref check failing
   on the PR's own regenerated doc is exactly "a gap that undermines the PR's stated
   purpose / a defect in its own artifact" → ABSTAIN (CHALLENGER_CONCERN), not clean.

**How to catch it:** Wire a `gh api commits/<HEAD>/check-runs?per_page=100` +
`gh pr checks <pr> --required` + `gh pr view --json mergeStateStatus` re-enumeration to
the challenger step, EVERY revision — and never phrase a CI note as inherited from a
prior head. If `mergeStateStatus=BLOCKED` or any required/style gate on the PR's own
artifact is `failure`, the change is not clean even when the code is well-formed.

**Classification:** BLOCK is wrong here (no verified 🔴 code bug; regeneratable doc,
one-line fix), WOULD_APPROVE is wrong (failing required gate on own artifact) →
ABSTAIN_POLICY (CHALLENGER_CONCERN), "a human must look."
