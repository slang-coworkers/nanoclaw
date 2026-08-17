---
title: "[approver/confirmed] Protected-path-only board-sync onboarding PR → ABSTAIN_POLICY was correctly calibrated (merged unchanged)"
type: learning
topic: review-approval
source: learnings/1785536628434-approver-confirmed-protected-path-only-board-sync-.md
---

# [approver/confirmed] Protected-path-only board-sync onboarding PR → ABSTAIN_POLICY was correctly calibrated (merged unchanged)

**Category:** approver calibration confirmation (not a failure bucket — the skill's `pr_merged` guidance invites a short "this shape was safe for reason Z" note when the call matched the outcome).

**Signal class (transferable):** A PR whose *entire* changed-paths set is confined to `.github/**` — thin caller workflows that onboard a repo to a shared reusable workflow (e.g. `uses: shader-slang/slang/.github/workflows/pr-board-sync.yml@master`, `permissions: {}`, one org secret), plus a linter config (`.github/zizmor.yml`) and a scheduled sweep caller. The `no_protected_paths` clause FAILs → `ABSTAIN_POLICY`, short-circuiting before the challenger.

**Outcome (calibration):** slangpy-samples#57, three revisions (R0 `7faf66b86e64` 5 callers → R1 `b20c12ef7131` +zizmor.yml → R2 `df17e0f266ef` +pr-sweep-nightly.yml), all `ABSTAIN_POLICY:no_protected_paths`. Maintainer jkwak-work APPROVED at R2; author merged at **exactly** the R2 decision commit `df17e0f266ef` with **zero follow-up commits** between my read and the shipped merge. Expected-agreement shape: abstain-deferred-to-human → human-approved-and-merged-unmodified.

**How to catch it / what it means for the next review:**
- Do NOT be tempted to upgrade this shape to `WOULD_APPROVE` just because the review signal is clean (here: no bot review to harvest — production skips this class; Devin ran head-current with 0 bugs, only non-blocking flags like "empty `permissions:{}` relies on reusable-workflow PAT" = documented template design). The protected-path gate is correct precisely because a clean automated read does NOT substitute for a maintainer's eyes on CI/workflow YAML, and `nv-slang-bot` lacks the GitHub App `workflows` permission to push these anyway.
- The abstain is the *win* on this shape, not a coverage loss: the human approved without changing a line, confirming the deferral cost nothing and the gate added the right friction.
- Each `synchronize` that only adds more `.github/**` files stays in the same early-return; re-verify the changed-paths set every revision, but a non-protected path appearing is the only thing that would flip it to the full challenger.

Links to existing concepts: review-approver-decision-procedure (protected-path clause → ABSTAIN_POLICY short-circuit), ci-build-tooling (bot cannot push .github/workflows/).

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785536628434-approver-confirmed-protected-path-only-board-sync-.md`_
