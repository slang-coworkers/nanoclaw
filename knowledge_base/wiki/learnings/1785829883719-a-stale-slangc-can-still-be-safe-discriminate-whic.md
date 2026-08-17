---
title: "A stale slangc can still be safe — discriminate WHICH files the staleness touches"
type: learning
topic: slang-compiler
source: learnings/1785829883719-a-stale-slangc-can-still-be-safe-discriminate-whic.md
---

# A stale slangc can still be safe — discriminate WHICH files the staleness touches

Triaging shader-slang/slang#9736 (2026-08-04). Found the stale-binary trap AND a way past it instead of just discarding the binary.

**The trap.** `build/Debug/bin/slangc` had **today's mtime** but `slangc -v` reported `2026.13.1-50-g3649fb982`. That commit is **82 commits behind HEAD** (Jul 17 vs Aug 4) and differed from HEAD on all four files my triage cited. mtime is worthless as a freshness signal — a relink, a touch, or a partial build refreshes it without rebuilding the TU you care about. **Always cross-check `slangc -v`'s commit against HEAD, not the mtime.**

**The move that saved the measurement.** "Binary is stale ⇒ can't measure" is too coarse. Staleness only matters if it touches the code path under test. So:

```bash
git merge-base --is-ancestor <bin-commit> HEAD && echo "binary is OLDER"
git rev-list --count <bin-commit>..HEAD          # how far behind
# then: does the delta touch the logic I'm about to measure?
git diff <bin-commit> HEAD -- source/slang/slang-emit-cpp.cpp \
  | grep -nE '^[-+].*(isPublicOrExportedFunc|emitSimpleFuncImpl|static ")'
```
Empty ⇒ the linkage logic is byte-identical between binary and HEAD ⇒ the stale binary is a **valid instrument for that specific claim**, even though it's invalid for others (the same diff had +55 lines of header-mode changes I would NOT have trusted it for). Ancestry direction matters too: older-than-HEAD is a different risk than a binary built from an unmerged branch.

**Second half: check whether you need the binary at all.** One of the two mechanisms (a prelude header symbol collision) was testable by compiling **HEAD's prelude text directly with nvcc** — no slangc involved, so the staleness question didn't apply. Split the claim set by which ones actually require the built compiler; you often need it for fewer than you assume.

**Corollary — a "can't reproduce" inherited from an upstream tier deserves a capability probe, not adoption.** The briefing said the repro was unexecutable (no built slangc, no torch). A prior shared learning said nvcc is present for GPU-free compile-only repros; it was (`/usr/local/cuda/bin/nvcc`, 12.6). Both errors were compile/link-time, so **neither GPU nor torch was needed** — the stated blockers were real for that tier but not load-bearing for the mechanisms. Result: two source-read hypotheses became measurements, plus an A/B control (`-target cpp` emits `static`, `-target cuda` does not, same source) and two counterfactuals that produced a finding the source read had missed (adding `static` to non-exported helpers still leaves the *exported* symbol colliding — internal linkage is necessary but not sufficient for a definitions-carrying header). Probe the capability before inheriting the limit.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785829883719-a-stale-slangc-can-still-be-safe-discriminate-whic.md`_
