---
title: "[approver/challenger-ci-gate] Data-submodule bump can turn CI red on UNCHANGED tests — always diff the submodule tree"
type: learning
topic: review-approval
source: learnings/1785426143619-approver-challenger-ci-gate-data-submodule-bump-ca.md
---

# [approver/challenger-ci-gate] Data-submodule bump can turn CI red on UNCHANGED tests — always diff the submodule tree

## Symptom
slangpy#1082 (fallback tier: CodeRabbit + Devin, no production review) had a
clean-ish review doc (0 bugs, Devin found nothing), but CI was **red on 6 of 12
build jobs**. The failing cases were C++ doctests in `tests/sgl/core/test_dds_file.cpp`
throwing "I/O error … No such file" for `bc7-unorm-nonsquare.dds` / `bc7-unorm-3d.dds`
— files the PR never touched in source.

## Root cause
The PR bumped the `data` submodule pointer `4c24c797` → `6ecdf7c`
("Updated bc1 reference data"), and the **new** data commit had **removed** those
two `.dds` fixtures (present in old ref; GitHub contents API 404 in new ref).
`test_dds_file.cpp` (unchanged by the PR) opens them → fail. So a one-line
submodule-pointer move silently broke unrelated tests.

## How to catch it (the class of signal)
When a PR changes a **submodule pointer** (`git diff` shows a `160000` mode entry /
`Subproject commit` hunk), the review doc is blind to whatever changed inside the
submodule. Independently:
1. Check CI conclusions on the head (`gh api repos/<r>/commits/<sha>/check-runs`).
   With the relaxed shadow policy `require_ci_green=false`, the `ci_green_on_sha`
   clause PASSES even when CI is red — it is NOT evidence CI is green. Look at the
   actual check-runs.
2. If red, pull a failed job log and read the error. "No such file" for a test
   fixture + a submodule bump in the diff = the bump removed/moved the fixture.
3. Diff the submodule tree across the two refs (for a GitHub submodule:
   `gh api repos/<data-repo>/contents/<dir>?ref=<old>` vs `?ref=<new>`, or 404-probe
   the specific missing file) to prove attribution.

## Why it's ABSTAIN_POLICY / OPEN_GAP (not BLOCK, not approve)
Real trigger (deterministic on fresh-checkout CI), real blast radius (half of CI),
undermines merge-readiness, and a maintainer must confirm whether the data bump is
intentional/complete. But there's no verified 🔴 *code* bug in the feature, so it's
"human must look", not a hard block. An approver must never approve over red CI it
has tied to the PR's own change — even when the policy clause is relaxed.

## Fix / transferable rule
Treat any submodule-pointer bump as a first-class review surface: check CI, and if
red, attribute the failure to the submodule delta before deciding. A green/clean
review doc does not cover what changed inside a bumped submodule.
Related: [[review-approver-challenger-calibration]] (CI-gate blind spot),
[[slangpy-ci-triage]].

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785426143619-approver-challenger-ci-gate-data-submodule-bump-ca.md`_
