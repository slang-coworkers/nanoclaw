---
title: "Slang cannot minify/obfuscate-locals its own source text (emit-slang is a stub; text emit is post-preprocess)"
type: learning
topic: slang-compiler
source: learnings/1785581285717-slang-cannot-minify-obfuscate-locals-its-own-sourc.md
---

# Slang cannot minify/obfuscate-locals its own source text (emit-slang is a stub; text emit is post-preprocess)

Triaging shader-slang/slang#12313 (requesting a `-minify`/`-obfuscate-locals` mode that ships Slang *source* to a JIT client, renaming only locals while preserving public/reflected names + un-expanded `#if`/`#define`). Verified @ master HEAD 4d8fa2e9d:

1. **Slang has NO Slang-source text target.** `source/slang/slang-emit-slang.cpp:6` (`emitSlangDeclarationsForEntryPoints`) is an empty stub (`SLANG_UNUSED(...); return SLANG_OK;`). No `SLANG_SLANG_SOURCE` in the CodeGenTarget enum (include/slang.h:683-728). Text output is HLSL/GLSL/Metal/WGSL/C/C++/CUDA only.

2. **`-obfuscate` mangles ALL linkage names, incl. public/reflected.** `addLinkageDecoration` (slang-lower-to-ir.cpp:1522-1540): `if (m_obfuscateCode && !isFromCoreModule(decl))` → `getHashedName(mangledName)` for EVERY decl. No public/reflection carve-out. (Core module excluded because it's compiled once without obfuscation.)

   ⛔⛔ **RETRACTED 2026-08-07 — the second half of this item was FALSE and is struck: ~~"so it genuinely breaks `findParameterByName`"~~.** The linkage-name hashing above is real, but it does **NOT** break name-based reflection. Measured at HEAD `7dc8091a6`, independently on two edges: `-reflection-json` is **byte-identical** with and without `-obfuscate`, every parameter name present, guilty control absent — while the emitted HLSL loses all names, proving obfuscation was active in the same run. **Obfuscation is IR-level; reflection vends from AST-level data** (`docs/user-guide/a1-03-obfuscation.md`: *"With the `-obfuscate` option we strip the AST…"*). Also: **`findParameterByName` is not a Slang API** — zero hits in `include/` and `source/`; it is a test helper at `tools/slang-unit-test/unit-test-std140-matrix-element-stride.cpp:17`, a name inherited from the reporter's prose and never grepped.

   **How the error was made, because that part is reusable:** reading that layer A (IR) mangles a name and concluding an API at layer B (reflection) fails is an **inference across architectural layers** — no amount of layer-A source reading can confirm it. Note this file's own header says *"Verified @ master HEAD"*: a source read, published as verification. Full post-mortem in the learning *"A hedge beside an overclaim is inert — and re-test claims when a new mechanism lands."* **Items 1, 3, 4 and 5 were independently re-confirmed and still stand.**

3. **The load-bearing architectural tension:** renaming ONLY locals needs parsed+checked scope/visibility info, which only exists AFTER preprocessing collapses source to one permutation; but preserving un-expanded `#if`/`#define` requires NOT preprocessing. You cannot have both in Slang's pipeline — this is the same wall 3rd-party minifiers hit, and why a naive compiler token pass fails too. Text emit is post-IR (slang-emit.cpp:2746), so comments/whitespace/preprocessor/import are already gone by emit time.

4. **Public/local boundary DOES exist** if a source-emit path were built: `DeclVisibility{Private,Internal,Public,Default=Internal}` (slang-ast-support-types.h:1896), `getDeclVisibility` (slang-check-decl.cpp:21256), `-no-mangle`→ExternCppModifier (slang-check-decl.cpp:2905).

5. **Intended path for the underlying IP-protection goal = precompiled `.slang-module` binary IR** (see closed #10065, same use case). Blocker for #12313's OP: runtime preprocessor permutations they say prevent offline precompile.

Triage disposition: feature-request/med/P2-P3, design proposal → PARK awaiting maintainer scope decision, NO fixer forward (no pre-authorized actionable fix; candidates are either architecturally unsound or a large new emitter subsystem).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785581285717-slang-cannot-minify-obfuscate-locals-its-own-sourc.md`_
