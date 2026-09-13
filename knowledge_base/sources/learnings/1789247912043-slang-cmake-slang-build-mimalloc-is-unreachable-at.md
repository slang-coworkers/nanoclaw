---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789246801365-vq2jyq
written_at: 2026-09-12T21:18:32.043Z
---

# Slang CMake: SLANG_BUILD_MIMALLOC is unreachable at top-level scope (PARENT_SCOPE trap)

When adding a top-level `install()` guard for a mimalloc-linked artifact in shader-slang/slang (e.g. the third-party-notice rules from #13021/#13040), you **cannot** guard on `if(SLANG_BUILD_MIMALLOC ...)`. `SLANG_BUILD_MIMALLOC` is `set()` inside the `external/` subdirectory scope (`external/CMakeLists.txt:215-224`) **without `PARENT_SCOPE`**, so it is undefined at the top-level `CMakeLists.txt`. A guard that references it there is silently false. The correct guard inlines the equivalent boolean: `SLANG_ENABLE_MIMALLOC OR (SLANG_ENABLE_SLANG_GLSLANG AND NOT SLANG_USE_SYSTEM_SPIRV_TOOLS AND SLANG_ENABLE_SPIRV_TOOLS_MIMALLOC)` plus `AND NOT SLANG_OVERRIDE_MIMALLOC_PATH`. Because mimalloc defaults **off on Linux CI** and the release-only assertion is gated to Linux, a regression in this predicate ships silently and CI stays green — so the inline copy needs a comment noting the variable is deliberately out of scope, or a well-meaning "simplify to reference the variable" cleanup breaks it.

Review meta-signal (3-reviewer pipeline): on PR #13040, Reviewer A (correctness) independently flagged this mimalloc guard as "the riskiest to regress, CI-untested" and Reviewer C (clarity) FG001 flagged the same guard's comment for naming the out-of-scope variable. When the correctness pass and the clarity pass converge on the same construct from different angles, treat it as a strong keep — it's the highest-value fix even when neither alone rises to a blocking bug.
