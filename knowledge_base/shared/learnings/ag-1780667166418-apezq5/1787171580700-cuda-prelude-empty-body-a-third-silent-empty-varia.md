---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787171052043-isgnta
written_at: 2026-08-19T20:33:00.700Z
---

# CUDA prelude empty-body: a THIRD silent-empty variant (case-present-but-stub) — #12630 Texture1D.Load

Refines the CUDA/PTX empty-prelude family (prior: #12274 case-LESS switch → silent empty; #12277 case-present + un-instantiated template → LOUD "referenced but not defined").

**Third variant, #12630 (Texture1D.Load):** the `__target_switch` `case cuda:` in `source/slang/hlsl.meta.slang` (~L4560) IS present and maps 1D `Load` → `tex1Dfetch_int<T>`, but the prelude *template body itself is an empty stub* (`prelude/slang-cuda-prelude.h:6103-6110` — no asm, no return; comment "1D is not supported via PTX"). Because the case exists, the catch-all `static_assert(false,...)` at `hlsl.meta.slang:4567` never fires → SILENT empty kernel (exit 0, PTX `ret;`), same symptom as #12274 but a different mechanism (stub body, not absent case). Discriminator table now: case-LESS → silent-empty (#12274); case-present + empty STUB body → silent-empty (#12630); case-present + declared-but-never-INSTANTIATED template → loud undefined-symbol (#12277).

**Two non-obvious facts that shaped triage:**
1. The #12274/#12289 fix (drop unsupported target from a TYPE-level `[require(...)]` → E36107) does NOT transfer when 1D/2D/3D share ONE type + ONE `[require(...cuda...)]` — dropping `cuda` kills working 2D/3D. The local analog is a per-CASE `static_assert(false,...)` inside the 1D arm, mirroring the existing `half` guard at `hlsl.meta.slang:4543`.
2. A full 1D PTX impl (`tex.level.1d.v4`) already exists in-tree walled behind `#if 0` at `prelude/slang-cuda-prelude.h:6112-6147`, contradicting the "not supported via PTX" comment — so "implement" is un-gate-and-GPU-validate, not write-from-scratch. `docs/cuda-target.md:133` is stale/backwards ("Load is only supported for Texture1D").

**Repro is compile-only (no GPU needed for the SILENT-EMPTY symptom):** `slangc tex1d.slang -target ptx -entry computeMain -stage compute -o x.ptx` → grep body for `ret;`; `-target cuda` → grep emitted `.cu` for `tex1Dfetch_int<...>`. The IMPLEMENT direction (does PTX tex.level.1d fetch correctly at runtime) DOES need GPU — that's the A-vs-B decision gate.
