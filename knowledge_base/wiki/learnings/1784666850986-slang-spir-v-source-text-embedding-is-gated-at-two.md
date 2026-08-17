---
title: "slang SPIR-V source-text embedding is gated at TWO layers (producer + consumer), both keyed on -g level (#12181)"
type: learning
topic: slang-compiler
source: learnings/1784666850986-slang-spir-v-source-text-embedding-is-gated-at-two.md
---

# slang SPIR-V source-text embedding is gated at TWO layers (producer + consumer), both keyed on -g level (#12181)

For shader-slang/slang, whether the shader INPUT SOURCE TEXT is embedded in SPIR-V (via the NonSemantic `DebugSource`/`DebugSourceContinued` path) is decided **twice**, both keyed purely on the `-g` debug level — there is NO single hook. Verified @HEAD cbabb7bde:

1. **Producer (IR gen)** — `source/slang/slang-lower-to-ir.cpp:15425-15436`. `if (debugInfoLevel != None) { emitDebugSource(path, (level >= Standard) ? source->getContent() : UnownedStringSlice(), ...) }`. So at **-g0 no `IRDebugSource` inst is generated at all**; at **-g1 it exists but with EMPTY content**; only **-g2/-g3 stuff the source text in**. `DebugCompilationUnit` only at >= Standard (:15443).
2. **Consumer (SPIR-V emit)** — `source/slang/slang-emit-spirv.cpp:2164` in `processDebugGlobalInst`, `case kIROp_DebugSource`: `if (debugLevel == Minimal)` emits the filename `OpString` and returns; only `level > Minimal` falls through to the full-source path.

**Consequence for triage/fixes:** a feature to "embed source at a lower -g level / behind a flag" (e.g. #12181's `-debug-info-include-source`) CANNOT be done by flipping the emit gate alone — at -g1 the content was already dropped upstream, and at -g0 there's no `IRDebugSource` at all. Must thread the toggle through BOTH layers. The **-g0-with-source** case is the tricky one: the `SPV_KHR_non_semantic_info` extension + a `DebugCompilationUnit`/`DebugSource` scope don't exist at -g0, so the module must be re-made spirv-val-clean (likely emit a minimal DebugCompilationUnit alongside DebugSource).

**Don't confuse** the plain `OpSource Slang 1` at `slang-emit-spirv.cpp:12083` — that's language/version only, not source text (relatedly, it and OpName bypass -g0 gating; see learning 1782145409789).

**Adding a new bool CLI flag** (the clean pattern): append `CompilerOptionName::DebugInfoIncludeSource=157` before `CountOf` in `include/slang.h` (append-only ⇒ `pr: non-breaking`, don't add a new SlangDebugInfoLevel), register in `source/slang/slang-options.cpp` mirroring `-separate-debug-info` / `OptionKind::EmitSeparateDebug` (table ~:950, parse handler ~:4017 `optionSet.set(..., true)`, read via getBoolOption). Test trap: the "-g2 embedded-source FileCheck self-match" (learning 1781176200581) — a CHECK-NOT literal that also appears in an embedded //CHECK line falsely matches the embedded source copy; use quotes/@LINE-relative. Disasm needs slang-glslang (build/*/lib) via LD_LIBRARY_PATH + -target spirv-asm, or emit binary -emit-spirv-directly and grep raw bytes.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784666850986-slang-spir-v-source-text-embedding-is-gated-at-two.md`_
