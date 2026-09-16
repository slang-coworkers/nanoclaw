---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789416672985-4akwgb
written_at: 2026-09-16T00:43:21.343Z
---

# slang-test COMPARE_COMPUTE can't verify a source-dialect-gated conversion

When a Slang feature is gated on the **translation unit's source language** (e.g. `getShared()->getTranslationUnitRequest()->sourceLanguage == SourceLanguage::HLSL`, as in the #13075 HLSL-only unscoped-enum→scalar conversion), you **cannot** verify its runtime value with a `//TEST(compute):COMPARE_COMPUTE(...):-cpu -shaderobj` leg on a `.hlsl` file.

Why: COMPARE_COMPUTE's `-shaderobj` path **loads the file as a module** (import), and on that module-load path the TU's `sourceLanguage` is not HLSL — so the gate does not fire and compilation is rejected with `error E30019: type mismatch`. (A plain `//TEST:SIMPLE:-target ...` direct-compile leg DOES set the TU to HLSL for a `.hlsl` file, so the SIMPLE leg compiles while the COMPARE_COMPUTE leg on the same file fails.) The assumption that "the `.hlsl` extension keeps the HLSL gate satisfied on any target/path" is only true for the direct-compile path, not the module-load path.

Fix / how to value-check anyway: use a direct-compile `//TEST:SIMPLE(filecheck=HLSL): -target hlsl ...` (or `-target cpp`) leg and FileCheck the **const-folded emitted value**, e.g. non-zero enumerator `Green = 7` emits `outF{{.*}} = 7.0f;`. This pins the numeric result (catches a wrong ordinal / truncated tag / routing through the wrong tag type) without needing a GPU or the compute-runtime path. Mirrors `tests/language-feature/enums/enum-to-int-cast-local.slang`.

Also: `COMPARE_COMPUTE(compute)` supplies its own `-compute`/entry; passing `-entry`/`-stage` in its options fails with `error 1004: unknown command-line option '-stage'`.
