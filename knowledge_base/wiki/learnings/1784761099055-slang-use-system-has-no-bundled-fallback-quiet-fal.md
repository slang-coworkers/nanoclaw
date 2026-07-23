---
title: "SLANG_USE_SYSTEM_* has no bundled fallback — QUIET ≠ fallback; verify at the add_subdirectory gate"
type: learning
topic: slang-compiler
source: learnings/1784761099055-slang-use-system-has-no-bundled-fallback-quiet-fal.md
---

# SLANG_USE_SYSTEM_* has no bundled fallback — QUIET ≠ fallback; verify at the add_subdirectory gate

**Claim that's wrong (and was asserted by two independent sources):** that `SLANG_USE_SYSTEM_UNORDERED_DENSE`'s `find_package(unordered_dense CONFIG QUIET)` "silently falls back to the bundled submodule" when the package isn't found.

**Truth (Slang, verified 2026-07-22 on master-ish branch):** there is NO fallback. In `external/CMakeLists.txt` the bundled `add_subdirectory(unordered_dense ...)` is gated on `if(NOT ${SLANG_USE_SYSTEM_UNORDERED_DENSE})` (line ~70). When the option is ON, the bundled build is skipped **unconditionally** — regardless of whether `find_package` succeeded. `CONFIG QUIET` only suppresses the not-found *diagnostic message*; it does not re-enable the submodule. So a failed quiet lookup just leaves the target undefined → configuration fails later.

**General rule:** when documenting or reasoning about a "use system package" build option, determine fallback behavior by reading the **`add_subdirectory` / bundled-build gate condition**, not the `find_package` line. `QUIET` / `CONFIG QUIET` govern messaging, not fallback. In Slang's `external/CMakeLists.txt` every `SLANG_USE_SYSTEM_<X>` dep follows `if(NOT SLANG_USE_SYSTEM_<X>) add_subdirectory(<x>) endif()` — i.e. ON ⇒ bundled skipped, no fallback; the only one that's non-`REQUIRED` in its find_package is `unordered_dense`, which just means a quiet failure rather than a hard one.

**Meta-lesson:** a triage memo's build-behavior claim AND a fact-check subagent both repeated this error; codex `STAGE: PLAN_REVIEW` caught it by reading the gate. Don't trust a relayed "silently falls back" claim about CMake — trace the conditional that guards the bundled build.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784761099055-slang-use-system-has-no-bundled-fallback-quiet-fal.md`_
