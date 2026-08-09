---
name: project_12431_12432_unit_test_assert_empty_output
description: "slang#12431/#12432 — duplicate pair (47s apart, bot-filed) on unit-test asserts reporting empty stdout/stderr. Complaint REAL, but BOTH suggested fixes are inoperable: Slang::Exception has no what() and no std::exception base; getLastSignalMessage() is hidden in 3 separate static-core copies. Routed to live triager on #12431; #12432 recommended for close."
metadata:
  node_type: memory
  type: project
  originSessionId: 1eeebc25-4a20-4d12-99f0-c47b6ee02c1a
---

# slang#12431 / #12432 — unit-test assert failures report empty stdout/stderr

Two issues filed **47 s apart** by `nv-slang-bot[bot]` (#12431 13:26:22Z, #12432 13:27:09Z, 2026-08-08),
same defect, same three code sites, same headline remedy. Classic shared-identity double-post per
[[feedback_a_shared_bot_identity_makes_duplicate_posts_invisible]]: neither body references the other,
both `created == updated` ⇒ two sibling sessions blind to each other. Sessions:
`sess-1786195584742-u46f0t` (#12431) and `sess-1786195632503-h0ff9f` (#12432), both agent group
`main`. A **slang-triager session was already live on #12431** (`sess-1786195986451-yo24g4`, 13:33) ⇒
dispatching a second triage on #12432 would have manufactured two differing public verdicts.

## The complaint is real and correctly located

Verified at HEAD `716ec597fc9c` (clone 0 behind origin/master). `tools/test-server/test-server-main.cpp:573-580`
`catch (...) { testReporter.m_failCount++; }` writes nothing to `m_buf`, and `m_buf` is the only
output channel (`result.stdError = ...getUnownedSlice()`, :589 — line-exact). A failing
`SLANG_CHECK` *does* self-describe (`[Failed]:` + file:line at :720-721, line-exact), so absence of a
`[Failed]:` line really is the signal that an exception escaped. slang-test's catch at 5783-5789 is
also line-exact. #12432's claimed catch lines are off by one (573-580, not 572-579).

## ⛔ BOTH suggested fixes are inoperable — this is the finding

1. ⭐⭐⭐ **#12432's `exception.what()` can never fire for any Slang assert.** `Slang::Exception` does
   **not** derive from `std::exception` and there is **no `what()` anywhere in the hierarchy** —
   it is a standalone class with a `String Message` member (`source/core/slang-exception.h:41-52`);
   grep for `what()` and for a `std::exception` base both return nothing, and `<exception>` is not
   included. `handleSignal` throws `InternalError` / `AbortCompilationException` /
   `InvalidOperationException` (`slang-signal.cpp:163-172`), all deriving from it. A
   `catch (const std::exception&)` clause cannot match. Correct form: `catch (const Slang::Exception& e)`
   reading `e.Message`.
2. ⭐⭐⭐ **`getLastSignalMessage()` reads a different copy than the one written.** MEASURED on the
   existing `build/Release` tree:
   - `libcore.a` is a static archive (`!<arch>`), holding `B Slang::g_lastSignalMessage` +
     `T Slang::getLastSignalMessage()`.
   - `libslang.so` **and** `libslang-compiler.so` each carry their own `b g_lastSignalMessage` /
     `t getLastSignalMessage()` — **lowercase = local/hidden**.
     `nm -D --defined-only libslang.so | grep -c getLastSignalMessage` → **0**. Only
     `T slang_getLastInternalErrorMessage` is dynamically exported.
   - `tools/CMakeLists.txt:241-247` test-server `LINK_WITH_PRIVATE core compiler-core slang`;
     `slang-unit-test` is a **MODULE** (:394+) also linking `core` + `slang`, dlopen'd at runtime
     (`test-server-main.cpp:382-405`: `loadSharedLibrary` → `findFuncByName` → `getModuleFunc()`).
   ⇒ **THREE independent thread-locals** (test-server exe, dlopen'd unit-test module, libslang.so).
   An assert inside libslang writes libslang's copy; the harness reads its own. Same cross-library
   visibility class as **PR #11910** (the PR) fixing **issue #11912** (`cd1e9bc99`) — I wrote
   "PR #11910 / #11912" conflating the two nouns; both are real, mechanism unaffected — which fixed
   exactly this for exception typeinfo in this very test suite — and `slang-exception.h`'s own comment block documents the pattern
   (`SLANG_EXCEPTION_TYPE_VISIBLE`), which `slang-signal.h` does **not** use.

⛔ **CORRECTION TO MY OWN REASON (peer refutation, then confirmed by me).** I wrote *"any executable
that links libcore.a gets another copy"* — **false**. Static-archive linking is **per-object
selective**: an object is pulled in only if some TU references a symbol it defines. MEASURED
counterexample: `slangc` has `LINK_WITH_PRIVATE core slang` yet
`nm -C build/Release/bin/slangc | grep -ci lastSignalMessage` → **0** (881 symbols present, 690
`Slang::` ⇒ core IS linked, not stripped). The three-copy conclusion **still holds for test-server**,
but the deciding fact is the `SLANG_ASSERT` at `test-server-main.cpp:569`, which expands to
`::Slang::handleAssert` (`slang-common.h:364`) and pulls `slang-signal.cpp.o` in.
⭐⭐ **Right conclusion, adjacent reason** — the pattern from
[[feedback_a_shared_bot_identity_makes_duplicate_posts_invisible]]. And the corollary is sharper than
the original claim: **adding the proposed `getLastSignalMessage()` call would itself pull the object
into a link that lacks it, creating the very always-empty copy the fix tries to read.**

⭐⭐⭐ **AN EXPORTED ACCESSOR ALREADY EXISTS — this changes the remedy.**
`slang_getLastInternalErrorMessage()` (`slang-api.cpp:349-352`, `include/slang.h:5984`) IS dynamically
exported (`T` in `libslang.so`) and reads **libslang's** copy. Per-case verdict:

| assert fires in | bare `Slang::getLastSignalMessage()` from test-server | `slang_getLastInternalErrorMessage()` |
|---|---|---|
| (a) libslang.so — **incl. the 6 `replayStreamRejects*` tests** | **empty** | **works** |
| (b) the dlopen'd unit-test module | **empty** | empty |
| (c) core statically linked into test-server | works | empty |

⇒ **The fix as literally written in both issues fails on the very tests that motivate it.** Case (a)
verified: the test does `ReplayStream stream(nullptr, 1)` whose ctor is deliberately `SLANG_API` +
out-of-line so it runs in the owning module (`replay-stream.h:52-62`), and 27 `ReplayStream` symbols
are exported from `libslang.so`; the module's extra sources do **not** include `replay-stream.cpp`.
Case (b) is reachable by **neither** accessor available to test-server.

✅ **The codebase already shows the right idiom, and it needs no thread-local and no visibility
change:** `unit-test-replay-stream-decoder.cpp:51-54` does `catch (const InternalError& e)` and reads
**`e.Message`**. The exception object carries the text across the boundary (that is what PR #11910
made work); the thread-local is only a fallback for `catch (...)`.

⚠️ **Scope label: source- and symbol-verified, NOT execution-verified.** No probe binary was run, and
`build/Release/bin/` holds only `slangc` — no `test-server`/`slang-test`/`slang-unit-test-tool` exist
on this tree, so the three-copy count is CMake+symbol-derived, not directly measured.

## Three more corrections

3. **`g_lastSignalMessage` is never cleared** — one write site (`slang-signal.cpp:155`). A throw that
   bypasses `handleSignal` (**`TextFormatException`**) makes the accessor report a **stale earlier
   assert** as the cause — worse than empty output. It is also `thread_local` while a live registered
   test (`persistentCacheStress`) fires `SLANG_CHECK` on a worker thread.
   ⛔ **I originally also named `AbortTestException` here — REFUTED by the triager, confirmed by me at
   source: it CANNOT reach these catch-alls.** `SLANG_UNIT_TEST` wraps every test body in its own
   `catch (AbortTestException&) {}` in the generated wrapper (`tools/unit-test/slang-unit-test.h:88-99`),
   so `SLANG_CHECK_ABORT` / `SLANG_IGNORE_TEST` throws are swallowed one frame inside the test.
   `TextFormatException` still carries the finding, so the **conclusion stands on a smaller example
   set** — but I cited an unreachable path as evidence. See
   [[feedback_a_supporting_example_list_is_a_set_of_separate_claims]].
4. **Both issues' "0 callers" is a scoped negative published as global.** Grep was `tools/`;
   `source/slang/slang-api.cpp:351` is a real caller exposing it as the **public API**
   `slang_getLastInternalErrorMessage()` (`include/slang.h:5984`) ⇒ its contract is a public-surface
   concern. Cf. [[feedback_published_negative_env_claims_need_rederivation]].
5. **#12431's one-liner double-counts.** `TestReporter::message()` self-increments `m_failCount`
   (:681-689), so it must *replace* the `m_failCount++` at :579, not sit beside it. Its nullptr worry
   is unfounded — `String::getBuffer()` → `getData()` returns `""`, never nullptr
   (`slang-string.h:470,651`).

## ⭐ Mine, absent from both bodies

`_executeUnitTest` (521-599) **never assigns `result.stdOut` and installs no writer at all** — the
`StringWriter`/`StdWriters` stdout capture lives entirely in the separate `_executeTool` (600+, :636-661).
So `standard output = {}` for a unit test is not a lost message; that path has **no stdout wiring**.
An `m_buf`-only fix leaves half the reported symptom standing. Function boundaries confirmed by awk.

## Disposition

Corrected legs routed to the **live triager on #12431** (canonical thread
`gh-issue-shader-slang/slang-12431`). **#12432 recommended for close in favor of #12431**, never
closed by me — szihs standing **policy** rule, *recommend never close*
([[feedback_github_writes_operator_authorized]]). ⛔ Not "hook-enforced": I wrote that here and it is
unsupported — measured 41 hook entries / 25 event types on my edge with no close gate. Cite policy.
No fixer dispatched. **Recommended fix shape (strongest evidence): typed `catch (const Slang::Exception& e)`
reading `e.Message`** — the idiom already live at `unit-test-replay-stream-decoder.cpp:51-54`, boundary-safe
via PR #11910's exported typeinfo, immune to both the staleness and the thread_local/three-copy problems,
and it needs no visibility change. Keep a `catch (...)` fallback after it. Choosing between that and the
accessor routes is still a maintainer call, and the stdout-wiring gap widens scope beyond a one-liner.

RESUME: any non-bot comment on either issue.
