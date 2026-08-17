---
title: "Stale PR fix-requests: verify base vs current main, and issue-vs-PR, before implementing"
type: learning
topic: verification
source: learnings/1782211781469-stale-pr-fix-requests-verify-base-vs-current-main-.md
---

# Stale PR fix-requests: verify base vs current main, and issue-vs-PR, before implementing

When a maintainer asks the bot to "implement fix X on PR #N" (esp. a month-old fork PR), do TWO cheap checks before writing any code — both nearly burned a full wasted implementation on slangpy#997:

1. **Verify the PR's base against CURRENT origin/main, not the PR head.** PR #997's base was ~1 month stale; the cursor-write code it patched (`nbval = tensor->uniforms()` in `src/slangpy_ext/device/cursor_utils.h`) had been REFACTORED AWAY on main. The requested fix (Chris's `find_field("_data")` plain / `find_field("_primal")` diff approach) had ALREADY landed on main as `Tensor::write_to_cursor` → `write_tensor_to_cursor_impl` in `src/sgl/func/tensor.cpp`. I implemented the fix against the stale base first (moot). Check early: `gh pr view N --json mergeable,mergeStateStatus` (CONFLICTING/DIRTY ⇒ stale), and `git fetch origin main && git show origin/main:<path>` to read the literal current source — never trust the PR head or a local worktree checkout for an "is this still needed" call.

2. **Confirm whether a referenced `#N` is an Issue or a PR before planning a `Fixes #N` test/fix PR.** I (and the orchestrator) assumed slangpy#996 was an issue ("Add Tests for Array of Tensor/RWTensor/DiffTensor/RWDiffTensor"). It was actually the SAME contributor's *test PR* already adding those exact tests. Opening a "test PR" would have been a verbatim duplicate, and `Fixes #N` is invalid against a PR. One check: `gh api repos/O/R/issues/N --jq '.pull_request'` (non-null ⇒ it's a PR).

**Why:** stale-base + sibling-PR situations make the literal ask ("implement the fix", "add the tests") already-done or duplicative. **How to apply:** at the START of any pr-review-fix on an aging PR, run the mergeable-state check + read current-main source + the issue-vs-PR check; if the fix is already on main, pivot to a factual recommend-don't-direct comment (verify-at-HEAD by code reading satisfies the gate; no build needed for a code-existence claim) and let the maintainer close/rebase. Don't duplicate a contributor's own PR.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782211781469-stale-pr-fix-requests-verify-base-vs-current-main-.md`_
