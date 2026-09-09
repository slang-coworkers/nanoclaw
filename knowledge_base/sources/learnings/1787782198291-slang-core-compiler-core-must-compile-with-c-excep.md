---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787781392590-cyxzlg
written_at: 2026-08-26T22:09:58.291Z
---

# Slang core/compiler-core must compile with C++ exceptions disabled — use the signal mechanism, not bare throw

**Rule:** In `source/core` and `source/compiler-core`, never use bare `throw`. These libs are *designed* to compile with C++ exceptions disabled (`-fno-exceptions -DSLANG_DISABLE_EXCEPTIONS=1`), which sets `SLANG_HAS_EXCEPTIONS 0` (slang.h:313). A raw `throw` under that flag is a hard compile error: `error: exception handling disabled`.

**Why:** `slang-exception.h:9-14` states the intent explicitly — "Exceptions should not generally be used in core/compiler-core, use the 'signal' mechanism". The canonical pattern is `slang-signal.cpp:164-182` `handleSignal`: `#if SLANG_HAS_EXCEPTIONS` it throws, `#else` it does `SLANG_BREAKPOINT(0); exit(-1)` (panic). The `SLANG_UNEXPECTED(msg)` / `SLANG_UNIMPLEMENTED_X` / `SLANG_ASSERT_FAILURE` macros (slang-signal.h) route through it.

**How to apply:** When triaging/fixing a "-fno-exceptions doesn't compile" report, grep `grep -rn "throw " source/core source/compiler-core` for unguarded throws. Fix = a `#if SLANG_HAS_EXCEPTIONS`-guarded `[[noreturn]]` helper that throws when enabled, `SLANG_UNEXPECTED(msg.getBuffer())` when disabled. **Watch for a real catch site** — e.g. `TextFormatException` (slang-token-reader.h) is genuinely caught at `slang-ir-spirv-snippet.cpp:318` for recovery, so the throw path MUST be preserved when exceptions are on; don't unconditionally reroute to the signal mechanism. Validate by compiling a patched copy BOTH with and without the flags.

**Verification trick:** you can prove a header-only fix compiles under both configs without touching the repo — copy the header to /tmp, patch it, force-include it against `-Isource/core -Iinclude -Isource -Iexternal/unordered_dense/include`, compile `-x c++ /dev/null`, once with `-fno-exceptions -DSLANG_DISABLE_EXCEPTIONS=1` and once default. Both must exit 0.

**Env aside:** the `gh` CLI may report the token "invalid" when it's actually a GitHub App installation token (`/user` returns 403 "Resource not accessible by integration"). Repo-scoped writes (labels, GraphQL updateIssue for Issue Type, issue comments) still work via `curl -H "Authorization: Bearer $GH_TOKEN"`. Discovered on #12779.
