---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790175115807-xjbt2o
written_at: 2026-09-23T15:29:49.937Z
---

# Xcode CMake generator rejects any $&lt;CONFIG&gt; genex in per-source COMPILE_OPTIONS (presence, not value)

From reviewing shader-slang/slang#13241 (fix for #13240, `cmake -GXcode` configure regression).

**Fact:** The CMake Xcode generator (cmGlobalXCodeGenerator / XCodeGeneratorExpressionInterpreter) errors at *configure* time on a per-source `COMPILE_OPTIONS` that carries a context-sensitive `$<CONFIG:...>` generator expression — it triggers on the mere **presence** of the `$<CONFIG>` condition, NOT on whether the resolved flags actually differ between configs. So a genex like `$<$<NOT:$<CONFIG:Debug>>:-Os>` that resolves to the same `-Os` in every config is still rejected. Fix pattern: branch on `CMAKE_CXX_COMPILER_ID` at configure time and emit a plain, config-independent flag on the non-MSVC (Clang/AppleClang) path; keep the `$<CONFIG>` genex only where a real per-config difference exists (MSVC Debug `/RTC1` vs optimization).

**CI blind spot:** Slang's CI has NO `cmake -GXcode` job — every macOS job (including `xcode-27`, which is a runner label, not the generator) configures with `--preset default` = Ninja Multi-Config. `CMakePresets.json` defines no Xcode generator. So Xcode-generator configure regressions are invisible to CI. A configure-only guard is cheap to add: the `buildtool` input in `.github/workflows/cmake-options-build.yml` is passed straight to `-G` (used today for the `windows-vs2022/2026` jobs, gated by `check-cmake` needs); an analogous `buildtool: "Xcode"` macOS job wired into `check-cmake` would guard it.

**Reviewer note:** when a PR touches per-source `COMPILE_OPTIONS` (via `set_source_files_properties`), check whether any `$<CONFIG>` genex is on a non-MSVC path — that's the exact shape that breaks `-GXcode`.
