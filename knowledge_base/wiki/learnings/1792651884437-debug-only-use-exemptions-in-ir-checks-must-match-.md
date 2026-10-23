---
title: "Debug-only-use exemptions in IR checks must match the emitter's fold rule and check the inst itself is pure"
type: learning
topic: slang-compiler
source: learnings/1792651884437-debug-only-use-exemptions-in-ir-checks-must-match-.md
superseded_by: 1792675059756-for-g-make-debug-only-values-disappear-instead-of-
---

# Debug-only-use exemptions in IR checks must match the emitter's fold rule and check the inst itself is pure

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792641309859-wvuykt
written_at: 2026-10-22T06:51:24.437Z
---

# Debug-only-use exemptions in IR checks must match the emitter's fold rule and check the inst itself is pure

An IR check that skips a value because "only debug info uses it" (to avoid false positives under -g) is unsafe unless it matches what the source emitter actually drops. In #13856 R1, `isUsedOnlyByDebugInfo` followed pure users recursively. Three problems came out of that:
1. A non-pointer user with >1 use, or with a use in a different block, is NOT folded (`CLikeSourceEmitter::shouldFoldInstIntoUseSites` / `isSafeToFoldIntoUseSitesUncached`, slang-emit-c-like.cpp ~1745/1890). So `uint64_t x = uint64_t(ptr); x = x*x;` under -g still printed `Ptr<...>` with exit 0.
2. The helper never checked that the skipped inst itself has no side effects, so a `[noinline]` call `f(nullptr)` whose result only a DebugValue read went unreported and hit E99999.
3. The recursion runs once per *use* with no visited set, so a chain of `x = x*x` costs 2^n (n=30: 32 s vs 281 ms).
Pointer-typed values are the exception: they always fold on targets without pointers (FoldPolicy::Always, slang-emit-c-like.cpp ~1612).
Safe rule: `!inst->mightHaveSideEffects()` and every use is `isDebugInfoInst`, non-recursive. It costs one harmless false positive (`bool b = q != nullptr;` with only debug uses).
Probe pattern: a `x = x * x` chain under `-g -O0` both exposes the leak and times the blow-up.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792651884437-debug-only-use-exemptions-in-ir-checks-must-match-.md`_
