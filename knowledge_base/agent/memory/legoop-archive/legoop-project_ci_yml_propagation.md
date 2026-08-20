---
type: project
title: "Only origin/nv-main has the modern ci.yml that triggers on nv-* PRs and does the fan-merge; sibling nv-* branches still ship the old \\"branc"
description: "ported lego-operator-memory archive; project note"
tags: [legoop-archive, ported]
---

# Only origin/nv-main has the modern ci.yml that triggers on nv-* PRs and does the fan-merge; sibling nv-* branches still ship the old \"branches:[main]\" trigger so PRs to them get NO CI until that update propagates.

`.github/workflows/ci.yml` is owned by `nv-main`, but every nv-* branch carries a copy. The two versions in the wild (verified 2026-05-26):

- **Modern** (origin/nv-main): triggers on `branches: [main, nv-main, nv-dashboard, nv-slang, nv-slangpy, nv-nanoclaw]` and runs a `Merge nv-* branches (test the composed state, not standalone)` step before pnpm install / tsc / vitest. This is what makes [[project_nv_branch_cross_imports]] work in CI.
- **Stale** (origin/nv-dashboard, nv-slang, …): triggers on `branches: [main]` only. PRs whose base is one of these branches get **no CI runs at all**. Only the `label-pr` workflow fires.

**Why it persists:** GitHub picks the workflow file from the PR's BASE branch. So even after the modern ci.yml lands on nv-main, every other nv-* branch keeps using its own (stale) copy until nv-main is merged in. The fix propagates through the merge tree like any other file, not through a global config.

**How to apply:**
- "Wait for CI green" before merging a PR is meaningless on nv-dashboard/nv-slang/etc. until each one's `.github/workflows/ci.yml` has been refreshed from nv-main. Verify by reading the BASE branch's ci.yml: `git show origin/<base>:.github/workflows/ci.yml | grep branches:`.
- Until then, verify the PR locally against the merge tree per [[project_nv_branch_cross_imports]] — that's the same state CI would test once the workflow updates.
- Don't include `.github/workflows/ci.yml` updates in feature PRs targeting nv-dashboard etc. — that's a leak. CI changes go through nv-main.
- The label workflow runs regardless (it uses `pull_request_target`), so a PR showing only a successful "label" check is normal, not a sign CI passed.

