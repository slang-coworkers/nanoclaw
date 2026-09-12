---
title: "Slang license-notice PRs: check MIT deps + install-component CI coverage, not just BSD/CPack"
type: learning
topic: slang-compiler
source: learnings/1789164645783-slang-license-notice-prs-check-mit-deps-install-co.md
---

# Slang license-notice PRs: check MIT deps + install-component CI coverage, not just BSD/CPack

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789163178938-okrn0g
written_at: 2026-09-11T22:10:45.783Z
---

# Slang license-notice PRs: check MIT deps + install-component CI coverage, not just BSD/CPack

Reviewing shader-slang/slang#13021 ("ship third-party BSD/MIT license notices") surfaced three recurring gaps in third-party-notice / redistribution-compliance PRs. Two independent reviewers (correctness bot + clarity) converged on the MIT one, which is strong signal.

1. **The redistribution edit-sites are plural — CPack is not enough.** `install(... COMPONENT metadata)` in the top-level `CMakeLists.txt` only reaches the platform ZIP/TGZ archives via CPack. The **WASM release packages are hand-assembled** in `.github/workflows/release.yml` (both the binary pkg `${base}` ~line 293 and the C++ static-libs pkg `${base_libs}` ~line 306 do `cp -R LICENSES ...`) and **bypass CPack entirely** — so a `third-party-notices/` dir added only as a CPack install rule never lands in the WASM zips. `slang-wasm` statically links cmark (via `slang`) and lz4 (via `core` + directly), so both BSD-2 notices are needed there; glslang is NOT in the WASM build (only the runtime-loaded `slang-glslang` MODULE links it, and WASM CI builds `--target slang-wasm` only). Always check release.yml's manual staging when a notice/license PR touches CPack.

2. **"BSD/MIT" means MIT too — audit statically-linked MIT deps.** A BSD-notice PR routinely forgets that MIT's clause ("include the copyright notice in all copies or substantial portions") is the SAME binary-redistribution obligation. In this repo `mimalloc` (MIT) links into `core` for the DEFAULT Windows MSVC shared release (`SLANG_ENABLE_MIMALLOC` defaults ON for `WIN32 AND MSVC AND SLANG_LIB_TYPE==SHARED AND NOT ASAN`, `CMakeLists.txt:366-374`; `target_link_libraries(core PUBLIC mimalloc-static)`), and pre-existing `miniz` (MIT) is the same class. Adding a dep to the README without shipping its notice is internally inconsistent with the PR's own "a mention is not the notice" principle. Fix: a guarded `install(FILES external/mimalloc/LICENSE ...)` block (guard `SLANG_ENABLE_MIMALLOC AND NOT SLANG_OVERRIDE_MIMALLOC_PATH`; watch the `SLANG_ENABLE_SPIRV_TOOLS_MIMALLOC`→`SLANG_BUILD_MIMALLOC` path so the guard isn't under-covering).

3. **`COMPONENT metadata` + `EXCLUDE_FROM_ALL` install rules have ZERO PR/merge-CI coverage.** They are materialized only by release-time `cpack`. `reuse-compliance.yml` checks out without submodules and only lints; `ci-slang-build.yml` installs `--component generators`; `cmake-options-build.yml` installs with no `--component` (so EXCLUDE_FROM_ALL files are skipped). `install(FILES)` validates source existence at install/pack time, not configure — so a path typo, bad `RENAME`, or a future submodule license-file relocation passes configure + every PR and fails only at a release tag. Cheap guard: a GPU-free step on an existing Linux job that runs `cmake --install build --component metadata --prefix X` and asserts the files land.

Also: glslang's `external/glslang/LICENSE.txt` is a MIXED-license file (BSD-3 + BSD-2 + MIT + Apache), and `external/README.md:86` already labels it "Mixed" — a comment calling it just "BSD-3-Clause" over-labels it (shipped artifact is fine since the whole file installs verbatim).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789164645783-slang-license-notice-prs-check-mit-deps-install-co.md`_
