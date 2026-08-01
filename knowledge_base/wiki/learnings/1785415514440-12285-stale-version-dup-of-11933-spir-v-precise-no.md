---
title: "#12285 = stale-version dup of #11933 (SPIR-V precise NoContraction) — verify against release-tag boundary"
type: learning
topic: slang-compiler
source: learnings/1785415514440-12285-stale-version-dup-of-11933-spir-v-precise-no.md
---

# #12285 = stale-version dup of #11933 (SPIR-V precise NoContraction) — verify against release-tag boundary

**Issue #12285** ("[Vulkan] precise FMA compensated summation wrong unless correction helper is `[noinline]`") turned out to be a **stale-version report**, already fixed on top-of-tree. The lesson is about the *method* that caught it.

**What it looked like:** reporter (on Slang **2026.12**) had a shader with global `-fp-mode precise` + `-target spirv` where the inlined helper produced wrong results on GB300; SPIR-V had the FADD→Fma→FADD sequence but **0 `NoContraction`** decorations. `[noinline]` fixed it. Very tempting to file as a new "inlining drops NoContraction" bug or fold into the open #12198.

**What it actually was:** direct SPIR-V emit honoring `-fp-mode precise` (emitting `NoContraction`) **did not exist** before PR **#11935** / commit `33f9ed0c` (2026-07-07), which closed **#11933**. That commit first shipped in **v2026.13** (2026-07-08); the reporter's **v2026.12** was cut **2026-06-25**, before it. So in 2026.12 there were *zero* NoContraction decorations regardless of inlining — `[noinline]` "worked" only because the `OpFunction`/`OpFunctionCall` boundary is a driver optimization barrier, not because Slang preserved a decoration.

**How to catch this class fast (the reusable method):**
1. Compile the reporter's *exact* attached repro with the *current* build and count the symptom (here `grep -c NoContraction`). Reporter's 2026.12 capture = 0; my HEAD build = 32 on a byte-identical instruction graph → symptom is fixed.
2. Find the fix commit (`git log --grep`), then use `git merge-base --is-ancestor <commit> <release-tag>` to prove it is NOT in the reporter's version but IS in a later one. Cross-check with `git tag --contains` and the tag dates (`git log --tags --simplify-by-decoration`).
3. Refute the tempting mechanism explicitly. Here fp-mode is **target-scoped**, not function-scoped: the only per-function `IRFloatingPointModeOverrideDecoration` producer in the whole tree is autodiff forcing `Fast` (`slang-ir-autodiff-fwd.cpp`), never `Precise` — so inlining can't drop a precise decoration that was never per-function.

**Verdict shape:** resolve-without-a-PR — ask reporter to re-test on ≥ the fixing release, cite the closed issue + fixing PR + the version boundary, and do **not** dispatch the fixer (no code change to make; dispatching an already-fixed bug risks a duplicate PR). Carry an honest hedge for the part you couldn't verify (their exact GPU/driver runtime result).

**Also useful:** `NoContraction` belongs on the surrounding `OpFAdd`s, not on an already-fused `OpExtInst GLSL.std.450 Fma` (spec-wise not meaningfully applicable to a fused op); the `Fma` comes from the user's `fma()`/`mad()` call — Slang has no mul+add→fma fusion pass. So a precise `fma()`-based Kahan/Neumaier chain relies on NoContraction on the adds only.

Distinct from **#12198** (per-*variable* `precise` **qualifier** in *default* fp-mode, still open) — different root, don't cross-dedup.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785415514440-12285-stale-version-dup-of-11933-spir-v-precise-no.md`_
