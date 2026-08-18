---
title: "[approver/clause-gap] board-sync unpinned-uses finding gets a zizmor ref-pin exception, not an SHA pin — and the fix stays under .github/**"
type: learning
topic: review-approval
source: learnings/1785514070974-approver-clause-gap-board-sync-unpinned-uses-findi.md
---

# [approver/clause-gap] board-sync unpinned-uses finding gets a zizmor ref-pin exception, not an SHA pin — and the fix stays under .github/**

## Symptom
On board-sync onboarding PRs (slangpy#1084, slang-rhi#804, and companions), CodeRabbit/zizmor flag `unpinned-uses` (Major/potential_issue): the thin callers invoke `shader-slang/slang/.github/workflows/pr-board-sync.yml@master` — a **mutable branch** — while forwarding `SLANG_PR_BOT_TOKEN`. When the author pushes a revision "addressing" it, do NOT expect the `@master` ref to become an immutable `@<40-hex-sha>`.

## Root cause / what actually happens
Observed on slangpy#1084 rev2 (`e6e506fe6fdc`): the author kept all `pr-board-sync.yml@master` refs unchanged and instead added `.github/zizmor.yml` declaring a `ref-pin` policy **exception** for `shader-slang/slang/*` (+ `actions/*`, `github/*`, `dependabot/*`), with the comment "@master by design … silence zizmor/CodeRabbit unpinned-uses nags." So the finding is resolved as a **deliberate policy decision to accept the mutable ref** (trusting slang's `master` as a same-org first-party reusable workflow), not a code fix. This is the expected/idiomatic resolution for org-internal automation refs — defensible, but explicitly a human maintainer's call.

## How to catch it (and why the verdict doesn't move)
Two consequences for the approver:
1. The `unpinned-uses` finding does not "clear" on the next revision in the way a bug-fix would — it's converted to a suppressed, intentional exception. Don't treat the disappearance of the CodeRabbit nag as the code being hardened; check whether a `.github/zizmor.yml` (or `.coderabbit.yaml`) exception was added instead.
2. The exception file ITSELF lives under `.github/**`, so it counts toward `no_protected_paths` — the clause still FAILs (now on N+1 files), the outcome is still ABSTAIN_POLICY:CLAUSE_FAIL:no_protected_paths, short-circuiting before verdict/challenger. See [[approver-clause-gap-workflow-only-pr-with-clean-review-is-still-protected-path-abstain]] for the base rule.

## Fix / calibration
For board-sync onboarding revisions: expect the same protected-path ABSTAIN every push. Note in the challenger/report WHAT the push changed (SHA pin vs. zizmor exception vs. new caller) so the human sign-off has the delta, but the decision class is fixed. Also: on `synchronize`, a prior head's human review (e.g. ccummingsNV "nothing dodgy stands out - LGTM") is auto-DISMISSED by the push — stamp it on the prior revision's ledger row via record_human_verdict before deciding the new head.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785514070974-approver-clause-gap-board-sync-unpinned-uses-findi.md`_
