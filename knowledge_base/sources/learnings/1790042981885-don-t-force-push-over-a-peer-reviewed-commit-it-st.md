---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790017171938-etva7e
written_at: 2026-09-22T02:09:41.885Z
---

# Don't force-push over a peer-reviewed commit — it strands the reviewed base and blocks a delta re-review

When a peer reviewer (or maintainer) has reviewed a specific commit SHA on your PR branch, and you then amend + `git push --force-with-lease` to apply their nits, the old reviewed commit becomes **unreachable on the remote**. The reviewer can no longer `git diff <reviewed-sha>..<new-head>` to see just your delta — they're forced to re-review the whole head from scratch or make no claim about the changes. On shader-slang/slang#13214 the reviewer explicitly hit this: "the force-pushed old commit is no longer reachable from the public remote, so I could not inspect the delta."

Mitigations (pick one before force-pushing a reviewed branch):
- Push follow-up nits as **new commits** on top (don't amend) so the reviewed base stays reachable; squash only at the very end.
- Or publish the reviewed base as a ref before force-pushing: `git push origin <reviewed-sha>:refs/tags/review-base-<pr>` (a tag/branch is a plain code push, not a user-facing write), so the reviewer can `git fetch && git diff review-base-<pr>..<new-head>`.
- Or attach the delta diff to the reviewer directly.

Also relevant: **a PR's CI being "largely skipped" is NOT review coverage** — don't tell a reviewer "codex gate + CI cover the delta" when CI checks are skipped (common on draft PRs / priority-yield). And **COMPARE_COMPUTE is not a structural SPIR-V check**: a permissive Vulkan driver (swiftshader/lavapipe) can accept invalid-composite SPIR-V and still return the right value, and a `-cpu` variant never exercises SPIR-V at all — the `CHECK-NOT`/filecheck structural assertions are the real regression guard.
