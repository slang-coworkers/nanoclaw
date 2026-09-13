---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788159548024-otpjyl
written_at: 2026-09-12T15:00:46.267Z
---

# Exposing a source/slang internal for slang-static-unit-test: check for the anonymous namespace, not just `static`

When exposing an internal `source/slang` function so `slang-static-unit-test` can link against it (the `eliminateDeadCode`/#12347 pattern), a triage memo that says "drop the `static`" is often insufficient. Many `slang-ir-*.cpp` files wrap ALL their file-local helpers in a single large **anonymous namespace** (e.g. `slang-ir-coverage-instrument.cpp` spans lines 17–1706), and functions inside it may carry a redundant `static` too. An anonymous-namespace symbol has **internal linkage regardless of `static`**, so removing the keyword alone does NOT make it linkable from the test executable.

Fix that matches these files' own convention: **relocate the function's definition out of the anonymous namespace to `namespace Slang` scope** (that's where the file's public entry points already live, after the anon ns closes), drop `static`, and declare it in the header. It can still call the still-file-local helpers (anon-ns names remain visible in the enclosing namespace for the rest of the TU). Verify by grepping for `} // anonymous namespace` and confirming the target is above it before editing.

Also, always read the *merged* source — PR line numbers drift after merge (the #12845 memo's lines were off by ~+50/+13 vs the merged tree), and the analysis may have been refactored (a `sawNormalExit` loop had become `everyReachablePathCanExit`).

Env notes for the STATIC unit-test target: it only builds with `-DSLANG_LIB_TYPE=STATIC -DSLANG_ENABLE_SLANG_RHI=ON -DSLANG_ENABLE_TESTS=ON` (the default preset is SHARED, so the target doesn't exist there). New `.cpp` files in `tools/slang-static-unit-test/` are auto-globbed by `slang_glob_sources` (CONFIGURE_DEPENDS) — no CMake edit needed. `clang-format-17` for `extras/formatting.sh` lives at `/usr/lib/llvm-17/bin` (not on PATH by default; prepend it, and pass `--no-version-check`).

Testing a cycle-break / memoized analysis for ORDER-independence needs an ASYMMETRIC fixture: a symmetric mutually-recursive pair fails identically in both traversal orders, so it only catches "the optimistic guess is unsound," not the order-dependent cache poisoning. Make one partner unconditionally may-not-return (e.g. `Abort` after the recursive call) and the other may-not-return only through the recursion, then run BOTH caller regions through ONE analysis pass with the order reversed and require both to split in both orders.
