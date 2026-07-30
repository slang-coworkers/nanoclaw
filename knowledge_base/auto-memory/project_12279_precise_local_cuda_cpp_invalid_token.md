---
name: project_12279_precise_local_cuda_cpp_invalid_token
description: "slang#12279 — precise local var emits invalid `precise` token into CUDA/C++/Metal/WGSL; PARKED at triaged (jkwak self-filed)"
metadata: 
  node_type: memory
  type: project
  originSessionId: e6592711-4714-4057-8165-7fa0de97b7cb
---

# slang#12279 — `precise` local qualifier emitted as invalid C-like source token

Filed by **jkwak-work** (member, self-filed + self-assigned) 2026-07-30. `precise float r = ...` on a local var makes the C-like emitter write the HLSL keyword `precise` verbatim into generated CUDA/C++ source. `-target cuda` succeeds but emits `precise float r_0 = ...`; `-target ptx` then fails at NVRTC parse (`identifier "precise" is undefined`).

**Root cause:** `CLikeSourceEmitter::emitTempModifiers` (`source/slang/slang-emit-c-like.cpp:4683-4689`) unconditionally emits `"precise "` for any inst with `IRPreciseDecoration`. Shared base for CUDA→CPP→CLike, so token leaks to every C-like target. Producer (`addVarDecorations`, lower-to-ir) is correctly target-agnostic; gating belongs at emit.

**Scope (broader than title):** invalid `precise` leaks to **4** targets — CUDA, C++/CPU, Metal, WGSL (all reject). HLSL + GLSL are the only C-like targets that accept it. ⇒ fix must gate by **source-language support**, not "HLSL-only" (drops valid GLSL) or "CUDA/C++-only" (leaves Metal/WGSL broken).

**Solution space:** (A, min-correct) gate keyword by source-lang; (C, recommended) A + target-specific *warning* so semantic drop isn't silent (matches reporter's "reject with diagnostic", non-breaking); (D, follow-up) actually preserve no-contraction on CUDA = separate feature paralleling SPIR-V #11933.

**Triage:** ✅ reproduced @HEAD `6462d7d2f` (compile-only). Verified 5-bullet posted — comment 5125089121; labels `reproduced`, Type=`Bug`. bug / medium / **P2** / target-emit.

**Status: PARKED at triaged, NO fixer dispatch.** jkwak self-filed + self-assigned → standing no-autofixer directive (#12274 precedent). RESUME on jkwak "make a PR" / linked PR / substantive human comment.

**Related, NOT dup:** [[project_12192_e55215_constantbuffer_no_source_location]] cluster is unrelated; the precise sibling is **#12198** (precise-qual → SPIR-V ignores it, fails to emit `NoContraction`, P2) — linked as distinct (SPIR-V semantic loss vs. this C-like invalid-token emission).
