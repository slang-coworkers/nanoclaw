---
title: "Two accuracy traps when reviewing -fno-exceptions try/catch guard PRs (#12779 series)"
type: learning
topic: review-process
source: learnings/1790224226872-two-accuracy-traps-when-reviewing-fno-exceptions-t.md
---

# Two accuracy traps when reviewing -fno-exceptions try/catch guard PRs (#12779 series)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790179506903-37do9e
written_at: 2026-09-24T04:30:26.872Z
---

# Two accuracy traps when reviewing -fno-exceptions try/catch guard PRs (#12779 series)

Reviewing shader-slang/slang#13244 (SLANG_EXCEPTION_TRY macro + `#if SLANG_HAS_EXCEPTIONS`-guarded catch), an independent codex OUTPUT_REVIEW caught two overstatements that both the PR author AND the first-pass review made. These recur across the #12779 exception-guarding series, so flag them:

1. **"byte-for-byte / byte-equivalent exceptions-ON build" is wrong for a change that adds/removes preprocessor `#if` lines.** The inserted `#if SLANG_HAS_EXCEPTIONS` / `#endif` directive lines shift every subsequent `__LINE__`, which is baked into `SLANG_RELEASE_ASSERT` (→ `handleAssert(__LINE__)`, source/core/slang-common.h:374) and into debug line tables. So the compiled *compiler* artifact and its assertion-diagnostic line numbers are NOT byte-identical. The emitted *shader* output is unchanged and normal control flow is unchanged. Correct phrasing: "behaviorally equivalent; only source-location/debug metadata shifts" — never "byte-identical."

2. **"the removed catch is unreachable under -fno-exceptions" ≠ "dropping it loses nothing."** True that the guarded catch bodies are unreachable (the TU no longer raises Slang exceptions). But the graceful RECOVERY those catches provided — nice diagnostics, null/`SLANG_FAIL` fallback returns, language-server survival — IS intentionally forfeited in that (unshipped) config. Also: a Slang abort *terminates in handleSignal()* — don't write "→ exit(-1)" unconditionally, because `SLANG_BREAKPOINT(0)` precedes `exit(-1)` and is `__builtin_trap()` on GCC (may trap first), and a `catch (...)` also nominally caught NON-Slang exceptions (e.g. slang-end-to-end-request.cpp) that never route through handleSignal at all. So "unreachable," not "lossless"; "terminates in handleSignal," not "exit(-1)."

Both are comment/PR-description precision, non-blocking for the mechanical code — but state them accurately. Also note: these live in the base module's exception path (source/core), and the -fno-exceptions build has no CI yet (SLANG_HAS_EXCEPTIONS is 1 unless SLANG_DISABLE_EXCEPTIONS is defined — include/slang.h:313), so the disabled branch gets zero regression coverage until #12779 lands the CMake option + compile job.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1790224226872-two-accuracy-traps-when-reviewing-fno-exceptions-t.md`_
