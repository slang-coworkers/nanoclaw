---
title: "Slang DISABLE_TEST internals + line-shift trap when reviewing test quarantines"
type: learning
topic: slang-compiler
source: learnings/1789174804261-slang-disable-test-internals-line-shift-trap-when-.md
---

# Slang DISABLE_TEST internals + line-shift trap when reviewing test quarantines

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789173617125-f6uaz3
written_at: 2026-09-12T01:00:04.261Z
---

# Slang DISABLE_TEST internals + line-shift trap when reviewing test quarantines

When reviewing a PR that quarantines a slang-test by flipping `//TEST:X` → `//DISABLE_TEST:X`:

- **`DISABLE_TEST` is first-class, not just "an unrecognized comment".** `tools/slang-test/slang-test-main.cpp` (`_gatherTestsForFile`): a `DISABLE_` command prefix sets `testDetails.options.isEnabled = false` and strips the prefix so the command becomes `TEST` and the *rest of the directive is still parsed* (so the directive line must remain syntactically valid). `_canIgnore()` returns true when `isEnabled == false`. Net effect: the test is **gathered but ignored** → discovery shows "1 ignored", NOT "0 tests / test vanished". A PR body claiming "0/0 runnable, 1 ignored" is therefore precise, not loose. Documented at `tools/slang-test/README.md:111`. `//TEST_IGNORE_FILE` is the coarser alternative (clears ALL tests in the file).

- **Line-number preservation matters for SPVDB/debugger tests.** These tests embed commands like `// SPVDB-CMD: break <file>.slang 18` that map to a physical shader line. Flipping the directive **in place** (same line) preserves the mapping → re-enable is a clean one-line revert. This creates a real reviewer disagreement trap: a clarity reviewer may (reasonably) suggest moving a disable-rationale comment from EOF up next to the directive to match convention — but inserting comment lines *above* the shader body shifts every line below and **desyncs the `break N` mapping**. So "co-locate the comment" and "preserve line numbers for clean reversibility" are in tension for line-sensitive tests. Surface both; don't assume the convention-based clarity nit is free.

- **Over-broad-disable is the substantive correctness gap to look for.** `//DISABLE_TEST` is a source-level global disable (all platforms/configs), but a flaky abort is often config/OS-specific (e.g. macOS-aarch64 Debug only; asserts compile out under NDEBUG so Release never hits them). The repo has a crash-safe, scoped alternative already in use: `-skip-list tests/skip-list-debug.txt` in `ci-slang-test.yml` (excludes at *discovery* time, so it survives a crashing test, unlike `-expected-failure-list`). Flag global-disable-vs-scoped-skip as a 🟡 coverage gap, but note that a global disable is defensible for an *urgent* merge-queue unblock if the PR body documents the cross-platform coverage cost.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789174804261-slang-disable-test-internals-line-shift-trap-when-.md`_
