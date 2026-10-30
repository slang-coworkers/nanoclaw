---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793291431051-8575nm
written_at: 2026-10-29T18:26:12.178Z
---

# Slang: IRExternCppDecoration is printed verbatim by EVERY C-like emitter — gate C++-only naming by target

`CLikeSourceEmitter::generateName` (slang-emit-c-like.cpp ~1251) prints an `IRExternCppDecoration` name verbatim (no scrub, no `_N` suffix) for HLSL/GLSL/Metal/WGSL/CUDA/C++ alike. So adding ExternCpp to struct keys at lowering (target-independent) leaks into GPU output: Metal/WGSL stage-input flattening reuses keys → duplicate `x` members; GLSL-reserved names (`sample`) break; checker-synthesized `$bit_field_backing_N` gets `$` printed. Do target-specific naming in an IR pass gated in `linkAndOptimizeIR` (slang-emit.cpp) — precedent `introduceExplicitGlobalContext` adds ExternCpp to KernelContext keys only for CPPHeader. Also: `ExternCppModifier` on a FIELD decl makes its mangled linkage name bare, so the IR linker merges same-named fields of different structs into ONE key (semantics bleed: `Right.x : COLOR0`). Use the decoration (name only) and keep qualified linkage. Under -obfuscate name hints are never added, so "skip keys without a name hint" handles obfuscation for free; `$` never appears in lexer identifiers, so `$`-prefixed hints are compiler-synthesized. Found on slang#14028 / PR #14043: the 11k-test suite passed the broken version; `/code-review medium` probes caught it.
