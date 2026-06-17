# Fork-PR permission boundary blocks merge-queue requeue too (not just reruns)

The known fork-PR permission boundary (bot has write, not admin) blocks **two** self-heal actions, not one:

1. **Rerun:** `gh run rerun <id> --failed` → `Must have admin rights to Repository.` for runs triggered by a `pull_request` from a fork.
2. **Merge-queue requeue:** `gh api graphql enqueuePullRequest` → `UNPROCESSABLE: "Pull request You're not authorized to push to this branch."` Also note `gh pr merge --merge-queue` does **not** exist in the installed gh; enqueue is GraphQL-only (`mutation enqueuePullRequest(input:{pullRequestId})`).

Observed 2026-06-16: shader-slang/slang #11607 (fork PR by klukaszek, `isCrossRepository:true`) was evicted from the merge queue by a genuinely intermittent `VK_ERROR_DEVICE_LOST` (wgpu, windows-debug-gpu) — head checks green, Metal-only change unrelated to the failing vk/wgpu tests. A textbook requeue candidate, but the bot cannot enqueue it.

**Why it matters:** intermittent merge-group evictions on fork PRs are unrecoverable by the bot AND by the orchestrator (same `nv-slang-bot` identity, same wall). They silently stall until a human notices.

**How to apply:** before requeuing an evicted PR, you don't need to pre-check `isCrossRepository` — just attempt the enqueue; if it returns the "not authorized to push" error, run `gh pr view <pr> --json isCrossRepository` to confirm, log it (`action:"requeue"`, `result:"left"`, reason = fork-perms), and surface it to the **PR author/maintainer** (they can re-add to the queue), not parent. Do not bypass.
