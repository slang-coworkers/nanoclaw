---
title: "A LAUNCH-TIME GUARD CANNOT SEE A MID-RUN MUTATION — don't edit the tree while a build or A/B arm depending on it is running (ninja won't re-plan already-scheduled targets)"
type: learning
topic: ci-tooling
source: learnings/1786042843245-a-launch-time-guard-cannot-see-a-mid-run-mutation-.md
---

# A LAUNCH-TIME GUARD CANNOT SEE A MID-RUN MUTATION — don't edit the tree while a build or A/B arm depending on it is running (ninja won't re-plan already-scheduled targets)

## What happened

Running the treatment arm of a controlled A/B (baseline binary vs patched binary, same suite), I
edited a header — `slang-check-impl.h` — to trim a verbose comment, **while the build was at
~176/281 targets**.

Ninja computes its build plan up front. It does **not** re-scan dependencies for targets already
scheduled, so objects compiled before the edit see the old header and objects after see the new one.
The resulting binary is built from **two different versions of one header**, and nothing reports it.
On an A/B arm, that silently corrupts the very comparison the arm exists to make.

## The rule

**Don't mutate the tree while any build or measurement depending on it is running.** I already
observed this for *rebuilds* — I twice refused to rebuild during the baseline arm because it would
swap the binary mid-run — and failed to generalise it to *edits*. **The rule is about the tree, not
the build command.**

And the structural point, which is the transferable half:

⭐ **A launch-time guard cannot protect against a mid-run mutation.** My harness asserted
`HEAD == <expected sha>` and "both hook sites present in source" *before* starting — both passed, and
both were blind to a change made five minutes later. Guards that validate preconditions do not
validate invariants. If you need the latter, you need either a post-run re-check (compare `HEAD` and
`git diff --stat` again at completion, and treat any difference as invalidating) or a copy of the tree
the run owns exclusively (a dedicated worktree per arm).

## Recovering without a 25-minute rebuild

Don't assume the damage is harmless — measure whether the edit could change behaviour:

```bash
# stash the edit so the tree matches what the build's guards asserted
git stash push -m "reapply after the arm" -- <file>

# how many objects were compiled after the edit?
find build -name "*.o" -newermt "<edit timestamp>" | wc -l

# PROVE the change was comment-only: count changed lines that are NOT comments
git stash show -p stash@{0} | grep '^[+-]' | grep -v '^[+-][+-]' | grep -cvE '^[+-]\s*//'
# 0  =>  functionally identical to a clean build; the run stays valid
```

A non-zero count means the run is void and must be restarted. Zero means the mixed-header build is
functionally identical and the measurement stands — but that is a *measured* conclusion, not the
default. "It was only a comment" is exactly the kind of plausible reasoning that should be checked
rather than trusted, and the check is one command.

Reapply the stashed edit afterwards and re-run the formatter, since the version that passed the
format check was the edited one.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786042843245-a-launch-time-guard-cannot-see-a-mid-run-mutation-.md`_
