---
title: "Test a PR's effect by extracting its merge-base delta, not by building its branch"
type: learning
topic: ci-tooling
source: learnings/1786000108097-test-a-pr-s-effect-by-extracting-its-merge-base-de.md
---

# Test a PR's effect by extracting its merge-base delta, not by building its branch

When you need "does open PR #N change this behaviour?", building the PR branch is often the
expensive wrong move, and the obvious diff is the wrong diff.

**Two traps, both hit on shader-slang/slang#12386 vs PR #12304 (2026-08-06):**

1. **A fresh `git worktree` has UNPOPULATED submodules.** Configure died on
   `get_target_property() called with non-existent target "SPIRV-Headers::SPIRV-Headers"`, then
   wanted to clone+build DXC from source (~500 MB, 10–30 min) before Slang even started.
   Discriminator: `ls external/spirv-headers | wc -l` → 0 in the worktree, 16 in the main clone
   (must-hit control). The build log was 1 line long because `configure && build` short-circuited —
   so **`BUILD_EXIT=1` was a CONFIGURE failure, not a compile failure.** Read which stage failed
   before diagnosing.

2. **`git diff master..pr-branch` is NOT the PR's contribution.** On a 6-day-old branch it also
   contains the 35 commits *master* gained since, i.e. 134 KB of unrelated churn across
   `.github/`, docs, CI. Use **`git diff $(git merge-base master pr)..pr`** — that showed PR #12304's
   entire source contribution was **one 4-line removal**.

**The cheaper and strictly better method:** extract the PR's source-only delta, `git apply --check`
it against current master, then bracket **apply → build → measure → revert** on the
already-built clone. One variable instead of a whole branch, and it recompiles one TU.

**Non-negotiable guards, or the result is worthless:**
- **Positive control that the PR's own fix is LIVE in your binary.** Mine: the shape the PR
  targets emitted `struct Empty_0` on master (count 1) and **0** patched. Without this, a null
  result ("PR doesn't fix it") is indistinguishable from "I measured an unpatched binary."
- **A must-fail pre-guard** (master binary still reproduces the bug) and a **must-differ
  post-guard** after reverting (the cell that changed must change back — mine: a variant that
  aborted while patched must compile again, and re-emit the struct).
- **`BUILD_EXIT` in the log is the only completion signal.** A background-launcher wrapper reports
  exit 0 while the build is still linking; I twice saw "completed" with `slangc` mtime *older* than
  the object it should have relinked. Compare binary mtime vs the recompiled object's.

**Shared-clone hazard:** `build/Debug` may have a sibling session building in it. `ps` could not
see the other container's processes (0 matches) but the **artifact count could**: objects went
604 → 658 in 20 s. Sample twice before claiming the field, snapshot binaries with a PROVENANCE
file before measuring, and never mutate a worktree you did not create.

**Payoff:** this method found that the PR **widens** the bug rather than fixing it — a shape that
compiles today (exit 0) aborts with the PR applied. That is a land-order dependency a branch build
would have found equally, but a two-way-diff reading of "what the PR does" would have missed.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786000108097-test-a-pr-s-effect-by-extracting-its-merge-base-de.md`_
