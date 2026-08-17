---
title: "[approver/clause-gap] Under v0-shadow-relaxed a red required check does NOT trip ci_green_on_sha — the challenger must catch it (OPEN_GAP)"
type: learning
topic: review-approval
source: learnings/1784049960961-approver-clause-gap-under-v0-shadow-relaxed-a-red-.md
---

# [approver/clause-gap] Under v0-shadow-relaxed a red required check does NOT trip ci_green_on_sha — the challenger must catch it (OPEN_GAP)

**Symptom:** On PR #12009 the re-enabled macOS gpu-printing example failed CI on the pinned head (`test-macos-release-clang-aarch64 / test-slang` = FAILURE, exit 255). I initially anticipated the decision would be `CLAUSE_FAIL:ci_green_on_sha`. Wrong: the mounted policy is `v0-shadow-relaxed` with `require_ci_green:false`, so `eval-clauses.py` marks `ci_green_on_sha` = **pass** ("policy does not require CI green") even though combined status is `failure`. All 6 clauses passed; no Step-1 short-circuit.

**Root cause:** The shadow-relaxed policy deliberately disables the CI-green clause (so the approver exercises judgment rather than rubber-stamping CI). A red required check therefore reaches Step 3, where it must be weighed as a challenger gap — it is NOT a mechanical clause fail. The correct reason_code for "re-enabled test is red on the pinned head" under this policy is `OPEN_GAP` (a non-pre-existing 🟡 gap with a *demonstrated* real trigger + real blast radius), landing ABSTAIN_POLICY — not CLAUSE_FAIL:ci_green_on_sha, and not BLOCK (no code-logic bug).

**How to catch it:** Read `clauses.json` before naming a reason_code — don't assume ci_green_on_sha fails just because CI is red. Check `policy_version` / `require_ci_green`. If the clause passes under a relaxed policy, route the CI-red through the challenger.

**Second clause-gap (transferable):** `eval-clauses.py` computes changed paths from `base...commit_sha`. When the PR head is a **master-merge commit**, that diff view surfaces only the second-parent delta — on #12009 it reported "1 file / 65 lines" and MISSED the `tests/expected-example-failure-github.txt` skip-line removal (true net delta = 2 files, per `gh pr diff --name-only`). Non-decision-moving here (neither path protected, within caps) — but on a merge-commit head this is a latent **protected-path blind spot**: a protected file changed by the PR could be invisible to `no_protected_paths`. Fix candidate: have eval-clauses use `gh pr diff --name-only` (PR net delta) rather than base...head for the changed-path set. Until then, on a master-merge head, cross-check changed paths with `gh pr view --json files` before trusting the clause's path list.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784049960961-approver-clause-gap-under-v0-shadow-relaxed-a-red-.md`_
