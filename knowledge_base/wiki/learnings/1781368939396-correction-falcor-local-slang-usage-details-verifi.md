---
title: "Correction: FALCOR_LOCAL_SLANG usage details (verified in PR #11602)"
type: learning
topic: verification
source: learnings/1781368939396-correction-falcor-local-slang-usage-details-verifi.md
---

# Correction: FALCOR_LOCAL_SLANG usage details (verified in PR #11602)

Corrects two points in the earlier learning "Public Falcor has FALCOR_LOCAL_SLANG CMake hook for a custom Slang build". The fixer for shader-slang/slang#11601 verified these against the LIVE public Falcor + Slang sources while implementing draft PR #11602 (`extras/falcor.sh`), which is more authoritative than the DeepWiki-derived triage memo:

1. **`FALCOR_LOCAL_SLANG_BUILD_DIR` is RELATIVE and PER-CONFIG, not absolute.** It is a path relative to `FALCOR_LOCAL_SLANG_DIR`, e.g. `build/Release` — Falcor resolves `$FALCOR_LOCAL_SLANG_DIR/$FALCOR_LOCAL_SLANG_BUILD_DIR/lib` to find the Slang import libs. So for a local Slang at `$ROOT` built Release, pass `-DFALCOR_LOCAL_SLANG_DIR=$ROOT -DFALCOR_LOCAL_SLANG_BUILD_DIR=build/Release` (NOT `=$ROOT/build`). This is also what makes Debug/Release variant mixing clean — point BUILD_DIR at `build/<cfg>`.

2. **For the clone+build + FALCOR_LOCAL_SLANG model, Slang must be built with gfx ENABLED** (Falcor imports `slang-gfx`). The CI functional flag set that includes `SLANG_ENABLE_GFX=0` (from `.github/workflows/falcor-test.yml`) is valid ONLY for CI's copy-Slang-into-a-prebuilt-Falcor model, where Falcor was already built against a gfx-providing Slang. Do NOT carry `SLANG_ENABLE_GFX=0` into a script that builds Falcor from source against the local Slang — Falcor's link step needs `slang-gfx`.

Also confirmed by the fixer: the script went **Linux-first**, exposes `--slang-config`/`--falcor-config` independently for variant mixing, and keeps `install` as a re-run of Falcor's `deploy_dependencies` (with a plain-copy fallback) for refreshing binaries after a Slang-only rebuild. Falcor end-to-end can't be validated without a GPU/toolchain; correctness rests on shfmt/prettier/`bash -n`/smoke tests + reasoning.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1781368939396-correction-falcor-local-slang-usage-details-verifi.md`_
