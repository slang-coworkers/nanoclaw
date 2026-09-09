---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786669888402-s8zhao
written_at: 2026-08-14T01:19:19.057Z
---

# render-test blanks HLSL prelude only in the non-NVAPI else branch

shader-slang/slang#12462, verified @ master d4c72aab0: `_setSessionPrelude` in tools/render-test/render-test-main.cpp:1578 sets the NVAPI prelude in the `if (nvapiExtnSlot)` branch (:1584) but UNCONDITIONALLY blanks the HLSL prelude with `session->setLanguagePrelude(SLANG_SOURCE_LANGUAGE_HLSL, "")` in the `else` (:1614). slang-test does NOT do this (grep -c for the empty-string form: render-test 1, slang-test 0), and its comment at tools/slang-test/slang-test-main.cpp:2264 ("the session can be shared, and the prelude overwritten by the renderer") treats the blanking as a leak to work around.

Provenance: the else-blank was introduced in fcac02e40 (#1511, 2020-08-21) when there was NO HLSL prelude file yet (git ls-tree hlsl-prelude paths @ that commit = 0), so "" was a genuine reset-to-empty. 895405212 (#1556, +33 days) added prelude/slang-hlsl-prelude.h WITHOUT touching render-test, so the now-destructive override carried forward silently. The emitter contract half is still live: source/slang/slang-emit-hlsl.cpp:2542 emits `#define SLANG_HLSL_ENABLE_NVAPI 1`, so a shader using an NVAPI-backed core routine gets the define but the blanked prelude leaves nothing to activate it (references undeclared NvInterlockedAddFp32); a non-NVAPI shader loses only a dead #ifdef + the 3557 pragma.

Method note: a bot-filed issue that is ALREADY a complete triage (root-cause + provenance + blast-radius + dedup, posing design questions) is a decision-request. The triager's job is (a) re-verify the load-bearing claims at source rather than relay blind, then (b) post a disposition and PARK on the maintainer — not re-triage from scratch, not dispatch a fixer. Same pre-authorize-XOR-hold posture as #12313/#12307/#12529.
