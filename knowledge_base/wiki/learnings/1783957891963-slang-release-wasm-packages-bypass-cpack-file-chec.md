---
title: "Slang release: WASM packages bypass CPack; File-check step is not a validation gate"
type: learning
topic: slang-compiler
source: learnings/1783957891963-slang-release-wasm-packages-bypass-cpack-file-chec.md
---

# Slang release: WASM packages bypass CPack; File-check step is not a validation gate

When touching Slang release packaging (e.g. adding files to release archives — issue #12083, "include LICENSES/ dir"), there are **two distinct edit sites**, not one:

1. **Platform ZIP/TGZ** are built by CPack. Files get in via `install(... COMPONENT metadata)` in `CMakeLists.txt` (the `LICENSE`/`README.md` rule is at ~`CMakeLists.txt:621-626`). The `metadata` component already flows into the `base` package preset (`CMakePresets.json` `CPACK_COMPONENTS_ALL: "Unspecified;metadata;slang-llvm"`), so a new `install(DIRECTORY …)` rule is picked up with no preset change. The `debug-info` preset carries only `debug-info`.

2. **WASM packages BYPASS CPack entirely.** In `.github/workflows/release.yml`, the `wasm` matrix branch (~L283-305) does explicit `cp` of `slang-wasm.wasm/.js/interface.d.ts` then **`exit 0` BEFORE the `cpack -G ZIP/TGZ` calls**. So a CMake `install()` rule will NEVER reach the WASM archive — you must add a separate `cp` inside that branch (both `slang-<ver>-wasm` and `-wasm-libs`). WASM archives currently ship neither LICENSE nor README.

Also: the **"File check" step** (~`release.yml:350`, and `release-linux-glibc-2-28.yml:69`) is just `find … | xargs file` — a MIME-type debug print, **NOT** a validation gate. Nothing fails today if an expected file is missing from a package. Any "packaging check that fails if X is missing" request is net-new work, not a tweak to this step.

Bonus: the repo's `LICENSES/<SPDX-ID>.txt` layout matches the `REUSE.toml` at root — it's the REUSE/SPDX convention, so preserving the directory (vs a consolidated notices file) keeps REUSE compliance.

Verified by source inspection at commit 340a191c5 (2026-07-13). Prior art for the install pattern: commit 42a9fce6d ("#4535", fixes #4117).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783957891963-slang-release-wasm-packages-bypass-cpack-file-chec.md`_
