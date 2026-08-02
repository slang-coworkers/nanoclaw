---
title: "Slang cannot minify/obfuscate-locals its own source text (emit-slang is a stub; text emit is post-preprocess)"
type: learning
topic: slang-compiler
source: learnings/1785581285717-slang-cannot-minify-obfuscate-locals-its-own-sourc.md
---

# Slang cannot minify/obfuscate-locals its own source text (emit-slang is a stub; text emit is post-preprocess)

Triaging shader-slang/slang#12313 (requesting a `-minify`/`-obfuscate-locals` mode that ships Slang *source* to a JIT client, renaming only locals while preserving public/reflected names + un-expanded `#if`/`#define`). Verified @ master HEAD 4d8fa2e9d:

1. **Slang has NO Slang-source text target.** `source/slang/slang-emit-slang.cpp:6` (`emitSlangDeclarationsForEntryPoints`) is an empty stub (`SLANG_UNUSED(...); return SLANG_OK;`). No `SLANG_SLANG_SOURCE` in the CodeGenTarget enum (include/slang.h:683-728). Text output is HLSL/GLSL/Metal/WGSL/C/C++/CUDA only.

2. **`-obfuscate` mangles ALL linkage names, incl. public/reflected.** `addLinkageDecoration` (slang-lower-to-ir.cpp:1522-1540): `if (m_obfuscateCode && !isFromCoreModule(decl))` → `getHashedName(mangledName)` for EVERY decl. No public/reflection carve-out — so it genuinely breaks `findParameterByName`. (Core module excluded because it's compiled once without obfuscation.)

3. **The load-bearing architectural tension:** renaming ONLY locals needs parsed+checked scope/visibility info, which only exists AFTER preprocessing collapses source to one permutation; but preserving un-expanded `#if`/`#define` requires NOT preprocessing. You cannot have both in Slang's pipeline — this is the same wall 3rd-party minifiers hit, and why a naive compiler token pass fails too. Text emit is post-IR (slang-emit.cpp:2746), so comments/whitespace/preprocessor/import are already gone by emit time.

4. **Public/local boundary DOES exist** if a source-emit path were built: `DeclVisibility{Private,Internal,Public,Default=Internal}` (slang-ast-support-types.h:1896), `getDeclVisibility` (slang-check-decl.cpp:21256), `-no-mangle`→ExternCppModifier (slang-check-decl.cpp:2905).

5. **Intended path for the underlying IP-protection goal = precompiled `.slang-module` binary IR** (see closed #10065, same use case). Blocker for #12313's OP: runtime preprocessor permutations they say prevent offline precompile.

Triage disposition: feature-request/med/P2-P3, design proposal → PARK awaiting maintainer scope decision, NO fixer forward (no pre-authorized actionable fix; candidates are either architecturally unsound or a large new emitter subsystem).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785581285717-slang-cannot-minify-obfuscate-locals-its-own-sourc.md`_
