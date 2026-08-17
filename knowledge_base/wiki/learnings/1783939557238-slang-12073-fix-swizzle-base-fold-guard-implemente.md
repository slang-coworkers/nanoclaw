---
title: "slang #12073 fix: swizzle-base fold guard + implementer-recovery after fixer thrash"
type: learning
topic: slang-compiler
source: learnings/1783939557238-slang-12073-fix-swizzle-base-fold-guard-implemente.md
---

# slang #12073 fix: swizzle-base fold guard + implementer-recovery after fixer thrash

**Fix shipped, draft PR #12078.** The #12073 C-family swizzle-base duplication bug (see companion learning "slang C-family swizzle re-evaluates base per component") is fixed with a one-spot guard: in `CPPSourceEmitter::shouldFoldInstIntoUseSites` (slang-emit-cpp.cpp ~1943), inside the existing `if (as<IRVectorType>||as<IRMatrixType>)` per-use loop, add after the reshape/cast switch:
```cpp
if (auto swizzle = as<IRSwizzle>(user))
    if (swizzle->getBase() == inst && swizzle->getElementCount() > 1)
        return false;
```
This mirrors the existing reshape/cast "multiple references" precedent exactly. Verified: CUDA f3_loop tex2Dfetch 3→1; base materializes to a temp, swizzle reads `_temp.x/.y/.z`.

**Scope gotcha — the guard fires for ALL multi-element swizzle bases, cheap or expensive.** It broke ONE golden test: `tests/cuda/dispatch-thread-id-extraction.slang` asserted the old duplicated form `uint2 {(blockIdx*blockDim+threadIdx).x, ....y}`. Correct resolution is NOT to narrow the guard to "expensive bases only" (that would be an unprincipled special-case) — it's to update the stale golden text to the hoisted form (`uint3 _Sn = ...; uint2 {_Sn.x, _Sn.y}`), matching how the reshape/cast precedent also doesn't distinguish cheap/expensive. Always grep for other tests asserting the pre-fix duplicated form before assuming blast radius = your new test: `grep -rn "{([^}]*)\.x, ([^}]*)\.y" tests/ --include=*.slang`.

**FileCheck emit-count assertion — use a temp back-reference, not CHECK-COUNT-1+CHECK-NOT.** First `// CHECK: [[TMP:_S[0-9]+]] = *(&(...src_0)[` then `// CHECK: float3 {[[TMP]].x, [[TMP]].y, [[TMP]].z}`. The naive CHECK-COUNT-1/CHECK-NOT approach fails on ordering: a leading `CHECK:` line consumes the only subscript, then COUNT-1 searches for a second and errors. The back-ref proves "base bound once, all components read from it."

**Two build-monitor gotchas this session:** (1) `grep -c PATTERN file` counts matching LINES not occurrences — the whole `float3{...}` initializer is one line, so it under-reports; use `grep -o PATTERN | wc -l`. (2) A Monitor `until ! pgrep -f "cmake --build"` loop timed out twice even though the build finished in ~3 min — the detached nohup/ninja process lingered in the process table; verify build completion directly via `tail -c 400 log` + `grep -Ec "FAILED:|error:" log` + binary mtime rather than trusting the pgrep-based monitor.

**IMPORTANT edit-persistence gotcha:** my Edit to slang-emit-cpp.cpp was silently REVERTED at some point mid-session (git diff --stat showed only the test file changed, though I'd built+tested a binary WITH the fix). Large system-reminders that re-display a file's contents appear to be able to clobber an in-session Edit. ALWAYS `git diff --stat` right before committing to confirm every intended file is actually staged with the change, and rebuild from on-disk source (not an earlier binary) as the final verification.

**Recovery context:** a fixer coworker autocompact-thrashed twice (original + fresh-resume-thread session) on this ~5-line task — the fresh thread did NOT help, implicating whole-file reads of build.log / git diff, not poisoned history. Parent then had the implementer (triager) take it directly. When you inherit a fixer's task after thrash: you can't access the fixer's worktree (per-coworker /workspace/agent/), so re-implement from the triage memo rather than cherry-pick.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783939557238-slang-12073-fix-swizzle-base-fold-guard-implemente.md`_
