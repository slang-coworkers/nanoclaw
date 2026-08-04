---
name: project_8306_embed_core_glsl_module_slang_dll
description: "slang#8306 — embedding core+GLSL binaries in slang.dll. Triaged 08-04 after 17d: jkwak-work's 'might be resolved' hypothesis REFUTED, both defects live at HEAD 546ad18f7 (Main-verified at source). (1) GLSL has no direct embedded-blob check; (2) EMBED_CORE_MODULE_SOURCE=OFF is a plain null deref, and CMake only rejects BOTH options off. Verdict posted (cmt 5173187857), maintainer design call open, no fixer."
metadata:
  node_type: memory
  type: project
  originSessionId: main-2026-08-04
---

## State

- **slang#8306** *"Embedding core + GLSL binaries inside slang.dll does not appear to work"* — open, assignee `jkwak-work`, labels `Dev Reviewed` + `cmake`, Type=Feature (all pre-existing, untouched).
- **jkwak-work 07-18:** *"This might be resolved. @nv-slang-bot, can you triage this?"* → **17 days unanswered** (see [[project_8306_8785_triager_session_never_produced_a_turn]] for the silence).
- **Triaged + posted 08-04 00:28Z**, comment **`5173187857`** — Main-verified as a **fresh** comment (jkwak's `5011352094` was the last; no prior bot comment). Classification: feature + bug / medium / **P2** / build-system + core-module loading. No `reproduced` label — correctly withheld, since this is source-verified rather than re-run.

## ⭐ The maintainer's hypothesis was REFUTED — both halves still present at HEAD `546ad18f7`

**Main independently verified all three load-bearing claims at that exact SHA:**

1. **`CMakeLists.txt:504-509` only rejects BOTH options off:**
   ```cmake
   if(NOT SLANG_EMBED_CORE_MODULE AND NOT SLANG_EMBED_CORE_MODULE_SOURCE)
       message(SEND_ERROR "One of SLANG_EMBED_CORE_MODULE and SLANG_EMBED_CORE_MODULE_SOURCE must be enabled")
   ```
   ⇒ the reporter's `EMBED=ON + SOURCE=OFF` **configures cleanly, then crashes at runtime**. Confirmed verbatim.
2. **The getters return an unset `ComPtr` when the macro is off** — `source/slang-core-module/slang-embedded-core-module-source.cpp`: `getCoreLibraryCode` (`:342`), `getHLSLLibraryCode` (`:355`), `getAutodiffLibraryCode` (`:369`), `getGLSLLibraryCode` (`:384`), each body wrapped in `#if SLANG_EMBED_CORE_MODULE_SOURCE` with a bare `return <member>;` outside it.
3. **The consumer dereferences unchecked** — `slang-global-session.cpp:392-397`: **four** `->getBufferPointer()` calls with no null test:
   ```cpp
   case slang::BuiltinModuleName::Core:
       sb << (const char*)getCoreLibraryCode()->getBufferPointer()
          << (const char*)getHLSLLibraryCode()->getBufferPointer()
          << (const char*)getAutodiffLibraryCode()->getBufferPointer();
   case slang::BuiltinModuleName::GLSL:
       sb << (const char*)getGLSLLibraryCode()->getBufferPointer();
   ```
   ⇒ **a plain null deref**, not a subtle loading bug. And `slangc` sets `enableGLSL=true` (`slangc/main.cpp:93`), so the GLSL path reaches it.

**Defect (1) — GLSL never gets a direct blob check.** Core module loads the embedded blob directly at `slang-api.cpp:181-187`; GLSL at `:215-236` goes DLL → cache → **recompile-from-source** with no equivalent check. The generated header is compiled only into the separate `slang-glsl-module` library, reachable via `slang_getEmbeddedModule()` *inside* that DLL — which is why `slang-glsl-module.bin` regenerates.

## Next action — maintainer design call, no fixer dispatched

Three options posed on the issue: **(a)** null-check + diagnostic instead of crash; **(b)** reject `EMBED=ON + SOURCE=OFF` at configure time if unsupported; **(c)** the real feature — give GLSL a direct embedded-blob path mirroring the core module. (a)/(b) are small; **(c) is the actual ask and a structural decision.**

**Correctly no fixer:** jkwak is assignee, there is no "make a PR" request, and the patch shape depends on his (b)-vs-(c) answer. Dispatching now would guess the design.

⭐**Triager stated its limit publicly rather than hedging:** no Windows STATIC/MinSizeRel build available, so this is **source-level verification, not a repro re-run** — and it said so in the comment. Also read the source directly rather than trusting a subagent paraphrase, which is the [[feedback_never_relay_a_verdict_not_in_hand]] discipline applied to its own tooling.

## RESUME

jkwak-work's answer on (b) vs (c) → then a fixer for the chosen shape. Or a fresh human comment.
