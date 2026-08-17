---
title: "Precompiled-SPIRV link: proving target-code PROVENANCE, and Slang validates the wrong buffer"
type: learning
topic: slang-compiler
source: learnings/1785957170037-precompiled-spirv-link-proving-target-code-provena.md
---

# Precompiled-SPIRV link: proving target-code PROVENANCE, and Slang validates the wrong buffer

Measured 2026-08-05 on shader-slang/slang @ master `b0e43d657` while re-scrubbing #6520.

## 1. "exit 0 + same op counts" does NOT prove precompiled code was used
Linking an entry point against N modules built with `-target spirv -embed-downstream-ir -incomplete-library` succeeds, and the output has the same `OpFMul`/`OpFAdd` counts as a plain non-precompiled build. That is **semantic similarity, not provenance** — it cannot distinguish "the precompiled blob was linked in" from "the front end silently recompiled from source". Two cheap discriminators that DO settle it:

- **Positive:** disassemble the **pre-link** module. It has **`OpFMul` = 0** plus one `OpDecorate ... LinkageAttributes "<mangled>" Import` per imported function. Since the bodies are absent before linking, arithmetic in the final artifact can only have come from the embedded blobs.
- **Negative:** corrupt ~24 bytes *inside* one embedded SPIR-V blob (find the `0x07230203` magic in the `.slang-module`, overwrite past the 5-word header). The link then fails with `SPIRV-TOOLS: Failed to build module 8 out of 17`. Proof of consumption. Restore and re-link as the control.
- Presence check for a blob at all: count the SPIR-V magic `bytes([0x03,0x02,0x23,0x07])` in the `.slang-module` — 1 with `-embed-downstream-ir`, **0** in a front-end-only module (`slangc f.slang -o f.slang-module`, no `-target`). Good cheap A/B.

## 2. Slang runs SPIR-V validation on the PRE-LINK buffer (unfiled defect)
With `SLANG_RUN_SPIRV_VALIDATION=1`, a precompiled-link compile fails: *"Capability Linkage is not allowed by Vulkan 1.4 specification"*, exit 255 — **even though the shipped artifact is valid** (final capability list is `Shader` only; zero `OpCapability Linkage` / `LinkageAttributes` / `Import`).

Mechanism, `source/slang/slang-emit.cpp`: the natively-emitted pre-link module is added to `spirvFiles` at **:3350**; linking produces a separate `linkedArtifact` which replaces `artifact` at **:3426**; but **:3429-3437** calls `compiler->validate(...)` on the original `spirv` buffer, never on the linked result. The pre-link module *legitimately* carries `OpCapability Linkage` + `Import` decorations so SPIRV-Tools can resolve them — so validating it is simply the wrong target.

Don't write this off as a harness quirk: enabling a supported option makes a valid compile fail. Corroboration that it's long-standing — **every** in-tree `tests/library/precompiled-*` SPIR-V test passes `-skip-spirv-validation`. Dedup at the time: unfiled (`Capability Linkage in:body` → 6 hits, all closed and unrelated).

Also observed in the corruption cell: **the link can fail while slangc still exits 0** and writes no output file. Silent-success shape; worth its own look.

## 3. `tools/compile-perf` `module_link` is FRONT-END only
Its setup runs a bare `slangc <f> -o <f>.slang-module` (`tools/compile-perf/bench.py:191-192`) — no `-target`, no `-embed-downstream-ir`. `git grep -- '-embed-downstream-ir' HEAD -- tools/` returns **zero**. So it measures module read + `linkIR`, and does **not** cover embedded-target-code precompilation. Don't cite it as covering that axis.

## 4. Instrument traps hit
- **`grep -r` under `tools/compile-perf` is inflated by untracked `__pycache__/*.pyc`** — a raw recursive grep reported 1596 "precompil" hits where the tracked reality is 4 files. Scope with `git grep ... HEAD -- <path>` when the claim is about the repo's contents.
- Documented precompilation limits are quotable from `source/slang/slang-compiler-tu.cpp:54-89`: "no target languages allow generics to be precompiled"; DXIL rejects `StructuredBuffer`/`Matrix` in a library interface. API is `IModulePrecompileService_Experimental` (`include/slang.h:5679-5708`), explicitly "experimental and not thread-safe since it mutates the module".

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785957170037-precompiled-spirv-link-proving-target-code-provena.md`_
