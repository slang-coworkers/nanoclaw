---
title: "slang maintainer handoff — verify on-PR state against internal verdicts"
type: learning
topic: slang-compiler
source: learnings/1779622726384-slang-maintainer-handoff-verify-on-pr-state-agains.md
---

# slang maintainer handoff — verify on-PR state against internal verdicts

# Slang maintainer handoff — internal "APPROVE-clean" ≠ on-PR state

When parent (slang-reviewer / orchestrator) hands off a PR as "APPROVE-clean per round N for maintainer review", the reviewer's verdict is internal-only — it is **not** visible on GitHub. Always reconcile against PR state before treating a maintainer handoff as merge-ready.

## Concrete checks to run on every handoff

```bash
gh pr view <N> --repo shader-slang/slang --json isDraft,mergeable,mergeStateStatus,reviewDecision,milestone,labels,latestReviews
```

Then assert:

1. **`isDraft: false`** — Drafts have CI skipped on shader-slang/slang. Every workflow shows `skipping`. A "ready for maintainer review" PR in Draft state has had **zero CI on the latest commit**.
2. **`reviewDecision: APPROVED`** — `REVIEW_REQUIRED` means no code-owner has approved. The on-PR reviews from `github-actions` (the `claude-pr-review` bot) are typically `COMMENTED`, not `APPROVED`, regardless of internal verdict.
3. **`mergeStateStatus`** ≠ `BLOCKED`.
4. **CI rollup non-empty** — `gh pr checks <N>`. If every check is `skipping`, treat as never-CI'd.
5. **Milestone & labels** — usually mirrored from the linked issue. Frequently dropped on the PR side; flag as a polish item before merge.

## Why this matters

Parent's editorial filter ("dispositioned bot's r4 findings as drift") may be correct, but the next maintainer reading the PR cold sees:

- N stale unresolved review threads from the bot
- Latest review marked 🟡 / 🔴 (never APPROVED)
- Draft badge
- Empty CI rollup

If those are all addressable but unmarked, ask the fixer/parent to resolve threads on GitHub (one-line dispositions are fine), flip to ready, and let CI run. Maintainer review of a Draft PR with all-skipping CI is fundamentally premature — the build/test gate has not been observed.

## Discrepancy patterns to watch

- Parent's commit count / file count vs `gh pr view --json files` — small drift is normal but flag.
- Parent's "addressed in HEAD" claim vs threads still posted *after* HEAD's commit timestamp on the same SHA. Compare `comment.createdAt` against `commit.authoredDate`.

## Reference

- Pattern surfaced on PR #11265 (Volatile RT builtins, fix for #10528) on 2026-05-24. Parent reported APPROVE-clean; on-PR state was Draft + REVIEW_REQUIRED + 🟡 latest bot review + 15 unresolved threads + zero CI.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1779622726384-slang-maintainer-handoff-verify-on-pr-state-agains.md`_
