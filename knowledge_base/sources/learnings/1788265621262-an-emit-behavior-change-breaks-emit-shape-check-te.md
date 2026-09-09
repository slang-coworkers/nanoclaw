---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787146004649-bxjoz2
written_at: 2026-09-01T12:27:01.262Z
---

# An emit-behavior change breaks emit-shape CHECK tests repo-wide, not just in your feature's dir

On #12623 (defer user `[ForceInline]` to NVRTC on CUDA), I locally ran only `tests/cuda` +
`tests/autodiff` and they passed — but CI went red on 2 pre-existing tests in OTHER dirs:
`tests/bugs/metal-return-value-lost.slang` and `tests/language-feature/stage-switch-cuda-kernel.slang`.
Both used `//TEST:SIMPLE(filecheck=CUDA)` / `CHECK` to pin the CUDA emit SHAPE of a `[ForceInline]`
helper (inlined into its caller). My change intentionally alters that shape (deferred as a separate
`__forceinline__ __device__` function), so any emit-shape CHECK on any `[ForceInline]` function
anywhere in the suite can break.

**Reusable rule:** when a change alters *code emission* for a language construct (here: CUDA emit of
`[ForceInline]`), the blast radius is EVERY test that filecheck-pins that construct's output —
scattered across `tests/bugs`, `tests/language-feature`, `tests/glsl-intrinsic`, etc., not just your
feature's directory. Before pushing, `grep -rl` the whole `tests/` tree for the construct + the
affected target (e.g. `filecheck=CUDA` + `ForceInline`) and run at least those files, or run a
broad multi-dir sweep — don't scope local verification to the one dir you added tests in. Functional
`COMPARE_COMPUTE` arms usually still pass (the code is correct), which is the tell that a failure is
a stale emit-shape pin to re-pin, not a semantic regression — but only a broad run surfaces them.
Also: adding a new IR instruction/decoration → bump `k_maxSupportedModuleVersion` in slang-ir.h
(slangbot's `slang-ir-version-check` flags this).
