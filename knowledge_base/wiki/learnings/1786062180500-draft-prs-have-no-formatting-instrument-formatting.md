---
title: "Draft PRs have NO formatting instrument — formatting.sh false-greens locally and check-formatting skips remotely"
type: learning
topic: misc
source: learnings/1786062180500-draft-prs-have-no-formatting-instrument-formatting.md
---

# Draft PRs have NO formatting instrument — formatting.sh false-greens locally and check-formatting skips remotely

Found on shader-slang/slang#12414 (2026-08-07). Two independent formatting instruments, **both
silent**, which reads exactly like "formatting is fine". It is not — it is *unmeasured*.

## The two silences

**1. Local: `extras/formatting.sh` exits 0 when it cannot run.**
```
$ ./extras/formatting.sh --check-only --cpp
found git 2.39.5, required at least 1.8
This script needs clang-format, but it isn't in $PATH
$ echo $?
0
```
`clang-format` is absent from the agent container, so the C++ arm never runs — and the script still
exits 0. A declined run is byte-indistinguishable from a clean run if you only check `$?`.

**Proof-of-run for the C++ arm is the version line, not the exit code**: require
`found clang-format 17.x, required [17, 18)` in the output. No line ⇒ nothing was checked.
(Version gate is half-open, max **exclusive** ⇒ 17.x only; repo docs saying "17-18" are wrong.)

**2. Remote: `check-formatting` is `skipped` on a draft PR.**
```
gh api "repos/<o>/<r>/commits/<FULL_SHA>/check-runs?per_page=100" \
  --jq '.check_runs[]|select(.name|test("[Ff]ormat"))|"\(.conclusion//.status)\t\(.name)"'
# => skipped   check-formatting
```
Draft PRs don't run it. So for a draft, **neither** instrument has an opinion.

## What to do

- Report formatting as **UNVERIFIED**, never "clean", when either instrument was silent. Put it in
  the PR body so a reviewer isn't misled by the absence of a red mark.
- Hand-check what you can and say exactly what that covered — for me: no tabs introduced, all added
  lines ≤100 columns. That is *not* equivalent to clang-format.
- The remedy is in the check's own name: once the PR is marked ready and the check runs, comment
  **`/format`** to auto-fix.
- Don't chase a local install to manufacture a green; the pin matters (9 of 1489 files differ between
  clang-format 17 and 18), so a wrong version is worse than an honest "unverified".

## Companion trap found the same day: a false-zero SHA query

```
gh api "repos/<o>/<r>/actions/runs?head_sha=4881fffa60"          # → total_count: 0
gh api "repos/<o>/<r>/actions/runs?head_sha=4881fffa60eff…4fc3"  # → total_count: 11
```
An **abbreviated** SHA returns `0` **silently** — not an error. Always pass the full 40-char SHA.
Same family as any path- or filter-scoped query: it cannot distinguish "nothing matches" from "your
filter was malformed", so a zero from a hand-typed filter is never evidence of absence.

## The generalisation

All three of these — the exiting-0 formatter, the skipped check, the truncated-SHA query — produce
**output formatted identically whether or not they measured the thing**. Before trusting any green or
any zero, ask: *what would this print if it had measured nothing at all?* If the answer matches what
you're looking at, you have no measurement. Require an **affirmative marker** (a version line, a
non-skipped conclusion, a nonzero count you can reconcile) rather than the absence of a complaint.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786062180500-draft-prs-have-no-formatting-instrument-formatting.md`_
