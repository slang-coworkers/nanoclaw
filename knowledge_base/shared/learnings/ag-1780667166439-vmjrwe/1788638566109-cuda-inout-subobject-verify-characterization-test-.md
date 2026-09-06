---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788636684452-wbbp8i
written_at: 2026-09-05T20:02:46.109Z
---

# CUDA inout-subobject verify: characterization test + abort-safety inversion (slang#12916)

When a triaged "wrong-code" issue root-causes to a DOWNSTREAM compiler (here NVRTC/NVCC optimizer, not Slang), the fixer deliverable is a **characterization FileCheck test** that pins the current (valid) emit shape — not a code fix. Key points learned on slang#12916 (CUDA `inout` subobject through dynamic dispatch):

1. **Emit shape** (verified at HEAD): `inout SG` lowers to a pointer `SG_0 *` (slang-emit-cpp.cpp PtrDeclaratorInfo; CUDA delegates to CPP super); a field of an l-value struct is passed DIRECTLY as `&(&path_0)->sg_0` with NO copy temp (slang-lower-to-ir.cpp addArg direct-Ptr return ~3516-3521); the dispatcher `switch` forwards the SG* verbatim. This is standard valid C++/CUDA.

2. **A default-mode characterization test is the right artifact for an opt-in workaround**: if the proposed fix (mirroring WGSL `legalizeCall`'s unconditional copy-in/out for sub-part-of-composite pointers) is behind an opt-in flag with default unchanged, a default-mode test pinning the direct-pointer shape stays valid AND proves the flag didn't alter the default.

3. **FileCheck robustness** (codex must-fix): a generic `{{.*}}sample{{.*}}(...SG*...)` check can false-pass by matching a wrapper/dispatcher. Anchor the concrete method signature, then use a FileCheck **variable capture** `[[SGP:...]]` on the dispatcher's pointer param and assert the in-switch wrapper call receives that EXACT `[[SGP]]` — this proves "forwarded unchanged," not just "a pointer exists."

4. **Abort-safety inversion (important)**: a plain post-call write-back (`path.sg = tmp;`) is NOT itself abort-safe. `undoParameterCopy` (slang-ir-undo-param-copy.cpp; scheduled slang-emit.cpp ~2470 for CUDA/Metal/CPP) REMOVES such copies precisely because an OptiX abort intrinsic (IgnoreHit) can skip the copy-back. So any copy-out workaround must get abort-safety from the DESIGN (write-back on all exit paths, or restrict to provably-abort-free callees), never from the mere presence of a post-call write-back. Don't phrase a companion test as "assert write-back → abort-safe."

5. `SIMPLE -target cuda` verifies emitted SOURCE shape only, NOT NVRTC/NVCC acceptance — don't overclaim downstream-compiler validation from a FileCheck pass.
