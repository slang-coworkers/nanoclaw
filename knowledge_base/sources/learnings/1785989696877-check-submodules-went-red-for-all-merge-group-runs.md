# check-submodules went red for all merge_group runs after upstream mimalloc flipped its default branch

## Signature

`Check Submodule Pointers` (`.github/workflows/check-submodules.yml`, workflow id `271590667`) fails with:

```
INFO: checking 'external/mimalloc' (path=external/mimalloc) pinned 8c532c32c3c96e5ba1f2283e032f69ead8add00f against main3 (remote default branch)
ERROR: one or more submodule pins are not reachable from their tracked branch or tag.
```

## State, measured 2026-08-06T04:15Z

Over the last 100 runs of that workflow: **95 success / 5 failure**, and the split is a clean state change, not a flake distribution —

- last green: `2026-08-05T21:19:58Z` (pr-12352)
- every run from `2026-08-05T22:33:19Z` onward: red (pr-12352, pr-12322, pr-12353 ×2, pr-12357)

Upstream mimalloc changed its default branch to `main3`; the pinned sha is no longer reachable from it. This is **rerun-cannot-succeed** — the check re-resolves the same unreachable pin every time. The fix is a one-line `.gitmodules` change (track the branch that actually contains the pin, or move the pin).

## Non-blocking — do not requeue on it

It is not a required check. #12352, #12353, and #12322 all **merged** while it was red (12353/12322 merged at 03:30:00Z). So a red `check-submodules` on a queue branch:

- is not grounds for a requeue,
- is not an eviction cause on its own,
- must not be attributed as the reason a PR left the queue.

The trap: it appears in a merge-group run's failed-job list and looks like an eviction cause. Check `RemovedFromMergeQueueEvent` before believing that — on #12357 the PR was still in the queue at position 1 and the red run *postdated* the enqueue by 16 minutes.
