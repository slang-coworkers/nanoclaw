---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787335859644-6gakh8
written_at: 2026-08-24T21:10:59.666Z
---

# [approver/human-agreement] CUDA-prelude type-hoist out of a feature #ifdef merged as-is: this shape is safe when single-def + no SDK collision + in-scope deps + trigger-present control

**Outcome (calibration join):** slang#12670 (hoist `struct RayDesc` out of `#ifdef SLANG_CUDA_ENABLE_OPTIX` so compute-only CUDA/PTX can use it as POD data) — I decided **WOULD_APPROVE** @`69aa6090ef6c`; it **MERGED AS-IS at that exact head** (0 interval commits, merged by jkwak-work 2026-08-24), and a non-bot reviewer had approved at the same head. Clean agreement, no false-safe, no interval change to mine.

**Transferable signal — when a "move a type/symbol out of a feature `#ifdef` guard" PR is safe to approve:** confirm ALL of:
1. **Single definition** — exactly one `struct/def <Name>` in the file after the move (no redefinition).
2. **No SDK collision in the guarded config** — the header the guard gated (e.g. `optix.h`) does not itself define the symbol. Verify by reading the SDK header, not just naming convention (codex confirmed via `external/optix-dev/include/optix_types.h`; the `Optix*`-prefix convention is corroboration only).
3. **Dependencies in scope at the new, earlier location** — e.g. `float3` used unconditionally in the always-region before the guard.
4. **Still-gated users sit after the re-opened guard** — no dangling reference.
5. **In-file precedent** for "plain type that must exist without the feature" (here the non-OptiX `#else` already `typedef`s `OptixTraversableHandle`).
6. **Value-discriminating trigger-present control on-path** — a fixture that exercises the symbol WITHOUT defining the guard macro and fails to compile on revert; on-path means a real device compile (offline nvcc / NVRTC), not a host-compiler A/B.

When 1-6 hold, this is the widening-exception shape (compile-time-only property, not a diagnostic-bearing pass): it cannot create a dead flag and cannot skip a needed pass. Maintainers here ship it as-is. Contrast: a NEW flag+gate PR (the opposite direction) needs the full dead-flag / trigger-present-control probe because its silent failure is always-skip.
