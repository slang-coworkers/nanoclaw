---
name: project_12313_minify_local_obfuscation_source_target
description: "slang#12313 — -minify/-obfuscate-locals feature request; HELD maintainer design decision"
metadata: 
  node_type: memory
  type: project
  originSessionId: fbf7712f-eef0-4bbd-b66c-f0f6a48b6d8d
---

# slang#12313 — Add `-minify` / `-obfuscate-locals` (lightweight text obfuscation for JIT pipelines)

feature-request/enhancement · P2–P3 · front-end (lexer/preprocessor/emit) + CLI · author j8asic (external CONTRIBUTOR) · verified @ master HEAD `4d8fa2e9d`.

**The ask:** text-output obfuscation mode that (1) strips comments/whitespace but PRESERVES `#if`/`#define`/`import`, (2) renames ONLY local/internal/non-public identifiers → `_v1`, (3) leaves public globals/cbuffers/ParameterBlocks/tex-sampler bindings intact so host reflection (`findParameterByName`) keeps working. Existing `-obfuscate` too aggressive.

**Triage findings (VERIFIED by source read):**
- `-obfuscate` complaint legit: `addLinkageDecoration` (slang-lower-to-ir.cpp:1522-1540) hashes EVERY non-core linkage name → `_Sh<hash>`, no public/reflected carve-out. Breaks reflection as OP claims.
- Slang has NO Slang-source text target: `slang-emit-slang.cpp:6` is an empty stub; no `SLANG_SLANG_SOURCE` in target enum (include/slang.h). Text = HLSL/GLSL/Metal/WGSL/C/C++/CUDA only.
- Text emit is POST-IR: by emit time comments/whitespace/un-expanded `#if`/`#define`/`import` are GONE, one permutation baked in.
- Public/local boundary EXISTS: `DeclVisibility{Private,Internal,Public}`, `getDeclVisibility` (slang-check-decl.cpp:21256).

**LOAD-BEARING TENSION (why no small fix):** renaming only locals (req#2) needs parsed+checked scope info → only exists AFTER preprocessing collapses to one variant; preserving un-expanded `#if` (req#1) requires NOT preprocessing. Can't have both from Slang's pipeline. Same wall 3rd-party minifiers hit.

**Approaches:** A = token-level pre-preprocess minifier (only shape preserving permutations, but unsound/over-conservative, HIGH risk); B = complete slang-emit-slang stub + visibility-keyed preservation (clean split but emits ONE resolved permutation, defeats JIT-permutation goal, large); C = precompiled `.slang-module` (exists today, cf. closed #10065 same IP-protection goal, but OP can't precompile due to permutation explosion).

**State:** TRIAGED → HELD for maintainer design decision (not a bug, no small correct fix). Verdict comment POSTED on issue (nv-slang-bot, comment 5151087614) with 3 open design questions for maintainers:
1. Should Slang emit Slang source as first-class text target (complete stub + ABI target)?
2. Is robust local-only source minifier feasible in-architecture, or is intended path precompiled modules (#10065)?
3. Is reflection-preserving `-obfuscate` (exclude public/reflected decls) a smaller separately-useful feature?

Caveat noted publicly: triager couldn't set native Issue Type=Feature (GraphQL token limitation). No PR. RESUME on maintainer comment / fresh substantive human reply. Related: closed #10065.
