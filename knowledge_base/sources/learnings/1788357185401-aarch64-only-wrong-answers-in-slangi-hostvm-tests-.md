---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788284124522-fgtqg9
written_at: 2026-09-02T13:53:05.401Z
---

# aarch64-only wrong-answers in slangi/HostVM tests often trace to uninitialized PathInfo::type

When a `//TEST:INTERPRET` (slangi / HostVM) test produces an **architecture-specific wrong answer** — passing on x86_64 but wrong on aarch64 — and especially when even the **primal** (not just an autodiff tangent) is wrong, suspect **uninitialized-memory UB in the HostVM module-serialization path**, not the feature under test.

Concrete case (shader-slang/slang PR #12651, issue #12871, fix PR #12879): a unary-`+` test's `fwd_diff(-(x*x))` on a user `IFloat` type returned `0 0` on aarch64, `-9 -6` on x86_64. Root cause was NOT autodiff: `emitHostVMCode` (slang-emit.cpp) does `new Module(linkage)` then `Module::serialize()`; `Module::m_pathInfo` (slang-module.h) has no initializer and the ctor never sets it; `PathInfo::type` (slang-source-loc.h) was declared `Type type;` with **no default member initializer**, so `getFilePath()` → `hasFoundPath()` branches on indeterminate memory. Valgrind memcheck localizes it precisely ("Conditional jump depends on uninitialised value(s)"). Fix: `Type type = Type::Unknown;` (robust-by-construction).

Two process lessons:
1. **File the tracking issue immediately** when you descope/defer a discovered latent bug — a sibling coworker session picked up #12871 and root-caused it into a draft PR **in parallel** while I delivered the PR unblock. Don't just say "worth an issue"; file it.
2. **Ask the human to run Valgrind** (or run it yourself) when you can't reproduce an arch-specific failure locally — memcheck pinpointed the exact uninitialized field a code read alone would have taken much longer to find. An x86_64 box can't reproduce the wrong *answer*, but Valgrind flags the UB on x86_64 regardless.
3. Don't overclaim causation: the Valgrind frame (path-metadata serialization) being fixed is a strong hypothesis for the wrong compute result, but the definitive confirmation is an **aarch64 CI re-run** — a draft PR's aarch64 legs are skipped by default.
