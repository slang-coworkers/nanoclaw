---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786741912327-dm6372
written_at: 2026-08-15T05:40:58.436Z
---

# Prelude free-functions taking Vector must sit OUTSIDE SLANG_PRELUDE_NAMESPACE (torch anon-ns trap)

When adding a free function in `prelude/slang-cpp-scalar-intrinsics.h` (or any prelude header that opens `namespace SLANG_PRELUDE_NAMESPACE {}`) whose signature names `Vector<T,N>`, put the function — and any `Vector` forward-declaration it needs — **at global scope, OUTSIDE the `SLANG_PRELUDE_NAMESPACE` block**, matching where the real `Vector` lives.

**Why:** `prelude/slang-cpp-types-core.h` defines `Vector` at the *includer's* scope (it has NO `namespace SLANG_PRELUDE_NAMESPACE` wrapper of its own). The three preludes that include scalar-intrinsics.h all leave it effectively global: `slang-cpp-prelude.h`/`slang-cpp-host-prelude.h` leave `SLANG_PRELUDE_NAMESPACE` UNDEFINED (the `#ifdef` guard is off → no namespace), and `slang-torch-prelude.h` `#define SLANG_PRELUDE_NAMESPACE` to EMPTY (so `namespace SLANG_PRELUDE_NAMESPACE {` becomes `namespace {` — anonymous). If you forward-declare `Vector` INSIDE that block, under torch it becomes an anonymous-namespace `Vector` DISTINCT from the real global `Vector` → unqualified `Vector` is AMBIGUOUS → breaks generated PyTorch C++. A plain debug build won't catch it: the device/host builds leave the macro undefined so everything is global and matches.

**Verify across all 3 configs** with the real headers before trusting a build:
- device: `g++ -I prelude` a TU including `slang-cpp-prelude.h` (undefined macro).
- torch: define `SLANG_PRELUDE_NAMESPACE` empty, include `slang-cpp-scalar-intrinsics.h` then `slang-cpp-types-core.h`, reference unqualified `Vector` — must be unambiguous.
- The NON-empty-namespace consumers (`tools/slang-test/slang-test-main.cpp` = `CPPPrelude`, `tools/gfx/cpu/cpu-base.h` = `slang_prelude`) do NOT include scalar-intrinsics.h — they go through `slang-cpp-types.h`, which includes only `slang-cpp-types-core.h`. So scalar-intrinsics.h is never compiled under a named namespace; global-scope helpers are safe there.

Scalar `<prefix>_min`-style helpers the body calls stay INSIDE the namespace block; unqualified lookup from the global-scope function still reaches anonymous-namespace members, so calls resolve. (From shader-slang/slang#11075 / PR #12249, caught by codex CODE_REVIEW.)
