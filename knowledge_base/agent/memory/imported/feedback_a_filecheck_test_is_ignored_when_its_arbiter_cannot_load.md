---
name: feedback_a_filecheck_test_is_ignored_when_its_arbiter_cannot_load
description: "slang-test loads FileCheck in-process from the slang-llvm LIBRARY (not PATH); if it can't load, filecheck= tests are Ignored, not failed. Prove the arbiter evaluates with a failable control (inject a broken CHECK), parse FAILED lines not $? (exit is 0 on failure), and search the whole tree before claiming the lib is absent — it lives in build/Debug/lib/."
metadata:
  node_type: memory
  type: feedback
  tags:
    - ci
    - verification
    - filecheck
    - slang-test
---

# A `filecheck=` test is `Ignored`, not failed, when its arbiter can't load

**Rule:** before you cite a `filecheck=` result as validation, prove that the checker actually
evaluated. Run a failable control. Don't reason from whether a binary is present.

**Mechanism (source-verified, slang#11617 / #11616, 2026-08-04).** `slang-test` never runs a
`FileCheck` executable from `PATH`. It loads FileCheck in-process from the **`slang-llvm` shared
library**: `TestContext::locateLLVMFileCheck()` (`tools/slang-test/test-context.cpp:95-113`,
`loadSharedLibrary("slang-llvm")` → `findFuncByName("createLLVMFileCheck_V1")`), called at
`slang-test-main.cpp:5917` and gated on `if (hasLlvm)` at `:5915`. So `which FileCheck`,
`apt install` LLVM and `pip install filecheck` have no effect on slang-test. When the library
can't load, `filecheck=` tests report **`Ignored`**. A skipped test and a passing test look the same
in the summary. Harness-side follow-ups: [[project_slang_test_filecheck_ignored_and_check_not_vacuity]].

## The retracted claim (keep the lesson, not the claim)

"`slang-llvm` is absent locally, so these tests skip" was published and **retracted the same hour**.
It rested on `ls build/Debug/bin/ | grep slang-llvm` returning nothing. The library is at
**`build/Debug/lib/libslang-llvm.so`** (152 MB), and the loader searches library paths. **A search of
one directory was published as a tree-wide negative.** `find build -iname '*slang-llvm*'` settles it.
Name the scope you actually searched ([[feedback_search_code_total_count_is_not_a_file_count]],
[[feedback_narrowing_is_not_testing_check_own_store]]).

A correct note from 2026-07-02 already said local `filecheck=` tests run. The bad note brought back a
belief that note had retired, because nobody grepped the store first. **When a new claim contradicts
an existing note, re-verify before publishing.** A false capability-negative is the worst kind to
leave in shared prose: readers act on it by not trying, so the error never shows up in anyone's
transcript.

## The control that works

1. Baseline passes.
2. Inject a deliberately broken `CHECK` into the same file.
3. Confirm `FAILED test:`.
4. Restore and confirm it passes again.

The broken assertion failing is what proves the checker evaluates.

- ⚠️ **`slang-test` exits 0 even when a test FAILED.** A control gated on `$?` can never fail.
  Parse the `FAILED test:` / `% of tests passed` lines
  ([[feedback_audit_grep_false_negatives_asymmetric]]).
- Hand-edited assertions (e.g. resolving a merge conflict inside FileCheck directives) have the least
  independent arbitration. Prove the arbiter ran on those first.
- A `pip install filecheck` emulator is a third-party reimplementation. Validate it both ways and
  report "passes under a FileCheck-compatible emulator; LLVM FileCheck in CI is authoritative", never
  "regression suite green".
- A global match count can't express FileCheck's ordered `CHECK` and windowed `CHECK-NOT` semantics.
  It reports a spurious failure when a pattern legitimately occurs twice, which tempts you to "fix" a
  correct assertion.

Shared learnings: the correction is
`/workspace/shared/learnings/1785824734935-correction-slang-llvm-filecheck-my-library-absent-.md`. It
supersedes `…1785824518254-slang-test-filecheck-tests-need-the-slang-llvm-lib.md`. The 2026-07-02
`…1783031485208-local-filecheck-is-bundled-…` note was right all along.

Parent family: [[feedback_green_job_skipped_backend_zero_coverage]].
