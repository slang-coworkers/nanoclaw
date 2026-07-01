---
title: "deepwiki-can-miss-files-in-large-or-vendored-codebases-cross-check-source"
type: learning
topic: misc
source: learnings/1779621016571-deepwiki-can-miss-files-in-large-or-vendored-codeb.md
---

# deepwiki-can-miss-files-in-large-or-vendored-codebases-cross-check-source

# DeepWiki responses can miss files in large or vendored codebases — cross-check by reading source directly before declaring a contradiction

**Concrete instance (PR #11265, Dec 2026 round 3 → round 4 reversal):**

In round 3 I asked DeepWiki on `KhronosGroup/glslang`: "Does the GlslangToSpv translator add Volatile to subgroup builtins in raytracing stages?" DeepWiki answered authoritatively: "No — Volatile is added only when GLSL `volatile` qualifier is present or coherentFlags.volatil is set." Based on that I flagged a Slang test (`builtin-volatile-via-glsl.slang`) as "premise contradicts glslang behavior" and asked the fixer to attach a passing log.

**The fixer found the file DeepWiki missed:** `glslang/MachineIndependent/Initialize.cpp` lines 7004-7042 declare a `rtSubgroupDecls` string of GLSL builtin declarations marked `in volatile uvec4 gl_SubgroupEqMask;` etc., and append it to `stageBuiltins[EShLangRayGen|Intersect|ClosestHit|Miss|Callable]`. AnyHit gets the non-volatile `subgroupDecls` (line 7038-7039 with explicit comment "No volatile qualifier on these builtins in any-hit"). RayTmaxKHR is similar at line 7115 (`in volatile float gl_RayTmaxEXT;`).

The mechanism is *upstream of* `TranslateMemoryDecoration` / `TranslateBuiltInDecoration` — glslang injects the `volatile` keyword into the parsed-builtin declarations *before* SPIR-V generation. By the time `TranslateMemoryDecoration` runs, `qualifier.isVolatile()` is already true for these stages. DeepWiki's answer described the late-stage mechanism correctly but missed the early-stage source-text injection.

**Verified by direct fetch:** `curl https://raw.githubusercontent.com/KhronosGroup/glslang/<pinned-sha>/glslang/MachineIndependent/Initialize.cpp` at the SHA Slang pins (`d1f52c89`), then grep for `rtSubgroupDecls`. Three minutes of work would have caught the gap.

**Apply when:**
- You're about to flag a "contradiction" between a code claim and DeepWiki's understanding of an external/vendored repo. **First read the actual source at the exact submodule SHA.** Submodule-pinned versions can differ from `main`/HEAD that DeepWiki indexes.
- The codebase you're querying has `Initialize.cpp` / `Builtins.cpp` / similar bulk-declaration files. These often define string literals containing the actual semantic content (GLSL builtin declarations, AST default modifiers) that DeepWiki's RAG indexing may chunk away from the declaration sites a question asks about.
- DeepWiki gives an answer that's surprisingly clean / definite about a "no, X doesn't do Y" claim. Before acting on it: identify the file you'd expect to contain the X→Y rule and read that file directly.

**Concrete heuristic:** If your hypothesis says "this test should fail" but the author claims "I ran it and it passes 5/5," the prior probability the author is wrong is low. Re-investigate before pushing back. Empirical reality > model-of-the-codebase.

**Supersedes / refines:** `slang-via-glsl-test-premise-verify-with-downstream-tool` — that learning's *process* (verify downstream behavior before approving a test that pins it) is still right, but its empirical claim about glslang was wrong. Always verify by direct source-read at the pinned SHA, not by DeepWiki alone.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1779621016571-deepwiki-can-miss-files-in-large-or-vendored-codeb.md`_
