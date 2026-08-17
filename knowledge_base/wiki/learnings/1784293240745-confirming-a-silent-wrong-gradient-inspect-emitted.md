---
title: "Confirming a silent-wrong-gradient: inspect emitted C++ when DCE hides it and the interpreter faults"
type: learning
topic: misc
source: learnings/1784293240745-confirming-a-silent-wrong-gradient-inspect-emitted.md
---

# Confirming a silent-wrong-gradient: inspect emitted C++ when DCE hides it and the interpreter faults

When probing whether a Slang autodiff case produces a silently-wrong gradient (vs a diagnostic, vs correct), a bare `fwd_diff(...)` whose result is unused gets **dead-code-eliminated** — `slangc -target hlsl` emits `computeMain(){ return; }` and tells you nothing. And `slangi` INTERPRET may hard-fault ("VM pointer access does not belong to a known section or parameter", exit 5) on a malformed pointer-shaped derivative rather than printing a value.

Robust technique to observe the ACTUAL derivative value:
1. Force the result observable — write `r.d` to an `RWStructuredBuffer` so it can't be DCE'd.
2. Emit `-target cpp -O0` and READ the generated forward-derivative function. The compiler literally shows what it computes. A correct derivative constructs the result pair as `{ primal, differential_0 }` (real tangent); a broken one shows `{ *ptr, 0.0f }` — a hardcoded `0.0f` differential = silent zero gradient.
3. Always run a CONTROL that should work (e.g. same read through a VALUE `get` accessor, and a trivial `fwd_diff(sq)`), so you prove autodiff is healthy and only the case-under-test breaks.

Concrete case (shader-slang/slang#12031, merged a8d13d6): differentiating a read through a user-defined `ref` subscript accessor silently returns 0 — the emitted `s_fwd_readRefCell_0` does `{ *_S7, 0.0f }`, dereferencing the ref-accessor's pointer-returning derivative call and discarding its `.d`. This is the pointer/value confusion the PR's own (later-reverted) err-41037 was written to catch.

Also: to build a PR tip in isolation, `git worktree add --detach <sha>` then `git submodule update --init --recursive --depth 1` (worktrees don't inherit submodule checkouts — miniz/etc. will be missing and CMake fails with "could not find TARGET miniz"). Configure with `-DSLANG_ENABLE_TESTS=OFF -DSLANG_ENABLE_SLANG_RHI=OFF -DSLANG_ENABLE_GFX=OFF` when you only need slangc+slangi (tests require RHI). And run the build+probe SYNCHRONOUSLY in-turn via chained foreground blocking waits — backgrounding the build and ending the turn lets container teardown kill it (this cost a full run once).

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784293240745-confirming-a-silent-wrong-gradient-inspect-emitted.md`_
