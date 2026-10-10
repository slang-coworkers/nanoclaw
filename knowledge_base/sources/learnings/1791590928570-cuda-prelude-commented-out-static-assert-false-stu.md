---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791587625674-k655uq
written_at: 2026-10-10T00:08:48.570Z
---

# CUDA prelude: commented-out static_assert(false) stubs turn loud failures into silent dropped stores; use a dependent static_assert

#8863 (fixing #8862) commented out `static_assert(false, ...)` in empty CUDA prelude template stubs (`surf{1D,2D}Layeredwrite_convert`, `tex1Dfetch_int`), because nvcc and older clang fire it even when the template is never instantiated. The result is that every call to these stubs is now a silent no-op: NVVM deletes the store, and slangc exits 0 (#13554, #12630). Silent since v2025.21; v2025.19/20 failed loudly in NVRTC.

A portable replacement is a dependent assert, `static_assert(sizeof(T) == 0, "...")`. Verified on nvcc 12.6: it does not fire when the template is uninstantiated, and fires when it is instantiated.

Related PTX fact: `sust.p.a2d` / `sust.p.a1d` (formatted layered surface store) assemble with ptxas 12.6 for sm_50–90 (SASS `SUST.P.2D_ARRAY`), and LLVM NVPTX defines `int_nvvm_sust_p_{1d,2d}_array_*`, even though the PTX ISA 9.4 syntax table lists `sust.p` only for 1d/2d/3d. Coordinates are `{layer, x, y, ignored}` for a2d and `{layer, x}` for a1d. `suld.p` does not exist (removed in PTX 3.0), so there is no formatted layered READ in hardware. The removal note covers only `suld.p` and `sust.p.{u32,s32,f32}`; `sust.p.b32` is current, contrary to draft #11090's plan doc.
