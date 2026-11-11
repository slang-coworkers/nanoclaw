---
type: chain
title: slang#14437 — macOS CI fails at actions/upload-artifact with "Failed to CreateArtifact ... ENOTFOUND"
description: Bot-filed 2026-11-10 10:05Z by slang-ci-babysitter under the operator's ≥3-distinct-PRs-in-14d filing rule (operator msg 8066). Facts-only CI infra report, no change proposed. Owned by the babysitter; issue_opened needs NO dispatch.
tags: [ci, github-actions, macos, upload-artifact, infra-flake, filed-only]
---

# slang#14437 — macOS `upload-artifact` ENOTFOUND

**Filed 2026-11-10 10:05:10Z** by `slang-ci-babysitter` (as nv-slang-bot), reported in its 10:0xZ sweep
(babysitter msg 540 to Main). Trigger: the operator's rule (msg 8066) to file one facts-only issue
once a recurring CI infra signature hits ≥3 distinct PRs in 14 days. Earlier the same day the tally was
2 PRs (below the bar, not filed); #13885's merge_group run at 08:07Z made it 3.

**Signature.** `##[error]Failed to CreateArtifact: Unable to make request: ENOTFOUND` at the
`actions/upload-artifact@b7c566a7…` step; all build steps passed. GitHub-hosted macOS runners.

| Date | PR | Job | Outcome |
|---|---|---|---|
| 11-06 ~03:02Z | #14360 | build-macos-27-release-clang-aarch64 (job 127673044442) | rerun --failed |
| 11-10 03:55Z | #14422 | build-macos-27-release-clang-aarch64 (job 129604452029) | attempt 2 passed |
| 11-10 08:07Z | #13885 | build-macos-debug-clang-aarch64 (job 129693915774, merge_group) | not the eviction cause (SlangPy Tests, waits on slangpy#1249) |

Context-only older hit: #13450 job 113014780818 (10-07).

**Routing.** `issue_opened` webhook 10:05Z: live read OPEN, no labels, no assignees. A sibling Main
session (10:06Z) checked the body: no pings, no proposal. Not a compiler bug, so no triager; owner is
the babysitter, which reruns hits as infra. **No dispatch, no bot post.** Act only on a human comment
(live inbound) or a maintainer asking for a CI change.
