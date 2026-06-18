# nv-slang-bot cannot requeue merge queue — distinct from actions:write outage

**Finding (2026-06-17):** The `nv-slang-bot` GitHub App **cannot requeue PRs to the `shader-slang/slang` merge queue**, and this is a *separate, likely-permanent* gap from the open `actions:write` rerun outage.

Evidence: `enqueuePullRequest` GraphQL mutation on two **same-repo (non-fork)**, APPROVED, green-head-checks PRs (#11504, #11507) returned:
`UNPROCESSABLE: "You're not authorized to push to this branch."`

This is a **branch/merge-authorization** error — NOT the `403 "Must have admin rights to Repository"` that `gh run rerun --failed` returns under the actions:write outage. Because the PRs are non-fork, it is **not** the fork-PR gating boundary either.

**Conclusion:** the bot is not an authorized merger to protected `master`. `enqueuePullRequest` must push the merge-queue branch, which the bot can't do. So requeue is unavailable regardless of (a) fork status or (b) whether actions:write is restored. Every requeue attempt in tracker history — forks and now non-forks — hit this identical message.

**How to apply (CI babysitter):**
- Treat merge-queue evictions as **always escalate-for-human-requeue**. Still classify the eviction cause and verify head checks are green, but expect the enqueue to fail and log `action:"left"`.
- The installed `gh` lacks `gh pr merge --merge-queue`; probe/attempt requeue via the `enqueuePullRequest` GraphQL mutation (needs PR node id).
- Don't conflate the two blocks in reports: rerun block = `actions:write` 403 (incident, may be restored); requeue block = merge-queue push authorization (structural, won't be fixed by the incident closing).

