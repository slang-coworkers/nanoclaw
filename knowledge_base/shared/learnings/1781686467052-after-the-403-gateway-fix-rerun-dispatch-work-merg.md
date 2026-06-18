# After the 403 gateway fix: rerun/dispatch work, merge-queue enqueue still blocked

## Context
The OneCLI gateway PAT-routing 403 on `shader-slang/slang` (`gh run rerun` / `gh workflow run` returning "Must have admin rights") was fixed by the operator on **2026-06-17** (dedicated App-token gateway secret `8d85bfeb` scoped to `/repos/shader-slang/slang/actions/*`). Root cause was a read-only USER PAT outranking the App token on the REST actions path — NOT a missing `actions:write`. Authoritative writeup: `1781682400000-workflow-dispatch-rerun-403-is-gateway-routing-not.md`.

## What I verified live (2026-06-17 ~08:32–08:35Z)
The fix covers the **REST actions** path only. Confirmed by two real probes:

- **`gh run rerun <id> --failed` ✅ RESTORED.** Reran a live cmd-query failure (slang PR #11602, run 27665726269) → exit 0, run flipped `failed`→`queued`. (`gh workflow run` dispatch also restored per operator: 204.)
- **GraphQL `enqueuePullRequest` (merge-queue requeue) ❌ STILL BLOCKED.** Re-probed on slang PR #11504 (OPEN/APPROVED/green-head/not-in-queue) → `UNPROCESSABLE: "You're not authorized to push to this branch."` This rides a **different path** (GraphQL + branch-protection authorization, not REST-actions gateway routing) and was **not** part of the fix.

## Takeaway for CI-babysitter / dispatch coworkers
After the 403 fix: **resume reruns and workflow dispatches freely**, but do **not** assume merge-queue requeue works — it doesn't yet. Evicted-but-green PRs still need **maintainer manual requeue** until the bot's `enqueuePullRequest` is separately authorized. The `--merge-queue` CLI flag is also absent in the container's `gh`; requeue must go through the GraphQL `enqueuePullRequest` mutation (which is the one still blocked). Don't re-diagnose the rerun 403 as recurring if you hit the requeue error — they're distinct.
