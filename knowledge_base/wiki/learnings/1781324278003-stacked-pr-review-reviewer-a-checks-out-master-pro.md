---
title: "Stacked-PR review: Reviewer A checks out master, producing predictable false positives + a missed-drop; coordinator must self-verify against the real base/head"
type: learning
topic: review-process
source: learnings/1781324278003-stacked-pr-review-reviewer-a-checks-out-master-pro.md
---

# Stacked-PR review: Reviewer A checks out master, producing predictable false positives + a missed-drop; coordinator must self-verify against the real base/head

When `/slang-pr-review` runs on a STACKED PR (base = a lower slice's branch, not master), the runner scripts (`slang-pr-review-runner/compose-and-run.sh` and `slang-clarity-review-runner/run-clarity.sh`, both `pr` mode) do `git checkout origin/master` and rely on `gh pr diff <N>` for the changeset.

**Consequence:** `gh pr diff` scopes the diff CORRECTLY (only the slice's hunks, vs the PR's GitHub base) — but the working tree is `master`, missing the lower slices. Reviewers A and C therefore read surrounding code / hunk-context / doc text from master, which generates two predictable failure modes:

1. **False-positive 🔴s** where a "stale reference / missing symbol / runtime error" is reasoned from master code that a lower slice already changed. Observed on #11596 (Slice 3 of 4): a phantom `.elementSize` build-break and a phantom runtime-41300 on `float3`/`Load3Aligned` — both because slice 2 had refactored the predicate to `isWideAccessAligned`. Reviewer A's REVIEW.md Rules 1/4 made it self-aware enough to DROP them, but a weaker pass would have shipped them.

2. **A genuinely-correct finding DROPPED** because Reviewer A cannot fetch the PR-head tree (Bash/gh/curl/WebFetch are permission-blocked in its session) to confirm. On #11596, A dropped a real doc-staleness finding (`Load3Aligned` doc "multiple of 12" now wrong, body forwards alignment 4) under Rule 4 "unverified state" — while Reviewer C KEPT it as its top finding. The A↔C disagreement was only resolvable by the coordinator.

**Coordinator action that works:** before/while the reviewers run, fetch the stacked base+head into explicit refs (`git fetch --depth 50 origin 'base:refs/remotes/origin/base' 'head:refs/remotes/origin/head'`) and self-verify the stacked-context-sensitive items (new stable-name id, module-version bump, any repurposed diagnostic field, any doc the body changed) via `git show <ref>:<path>` / `git diff base..head`. Then in the combined report's coordinator-adjudication preamble: (a) confirm the dropped 🔴s are truly false, (b) RESOLVE A↔C disagreements with the head verification, (c) list verified load-bearing facts so higher-bar asks aren't re-litigated. This turns "two reviewers disagree" into a decided verdict.

Also: isolate Reviewer C in a `git worktree add --detach` with `REPO_ROOT=<wt>` so it doesn't race Reviewer A's `git checkout origin/master` on the shared `/workspace/agent/slang` checkout; `rm -f /workspace/agent/slang/tmp/pr-diff.patch` before A; remove the worktree at the end. Devin (Reviewer B) on a DRAFT PR is typically inconclusive (analysis still "Generating", body echoes the PR description) — report it as a weak signal, not a pass.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1781324278003-stacked-pr-review-reviewer-a-checks-out-master-pro.md`_
