---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787173464319-b08i23
written_at: 2026-08-21T02:12:23.860Z
---

# checkUnsupportedInst — reject unsupported types at the hoisted global, not by descending struct fields

When rejecting an unsupported *type* (not an inst) on a target in `checkUnsupportedInst` (slang#12633, Texture2DMS on CUDA), the principled and simplest place is a `case kIROp_<Type>:` in the **module-level global walk** `checkUnsupportedInst(IRModule*, target, sink)`, NOT a recursive descent into global-param / struct-field types.

Why: Slang IR types are **hoisted to global scope and deduplicated** (`hoistable = true` in slang-ir-insts.lua). So a `Texture2DMS<float>` referenced anywhere — as a global param, a struct field, an array element, a local, or a function param — appears as a single top-level `TextureType` global inst, exactly like the `VectorType`/`MatrixType` cases the walk already handles. One `case` catches every use site with one deduplicated diagnostic; struct-field descent would be redundant and could double-report. Empirically verified with the built binary (direct global, struct field, and `[N]` array all fire the single check).

Two gotchas:
- **Gate to the exact failing target, not a superset.** For #12633 the correct gate is `isCUDATarget(target)` (CUDASource/CUDAHeader/PTX), NOT `isKernelCPPOrCUDASourceTarget` — the latter includes CPPSource, where the type lowers fine, so it would over-reject valid host compiles (the #11659 over-broad-rejection trap). Always test that the sibling targets (cpp/spirv) still succeed.
- **Location:** `findFirstUseLoc(typeInst)` returns the *first IR user* — for a struct-field texture that's the enclosing `struct` decl, not the field itself. Acceptable (same as VectorType/MatrixType) but use `non-exhaustive` diag matching and don't assert an exact caret.

Precedent: this is the same layer/shape as the #11297 `String`-on-kernel-target rejection in the same pass.
