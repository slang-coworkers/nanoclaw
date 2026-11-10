---
type: triage
---
# Triage: shader-slang/slang#14432 — slangc -E returns exit code 0 when the preprocessor reports an error
Date: 2026-11-10 | bug | medium | P2 | frontend (preprocessor / compile driver) | Duplicate: no | Regression: no (behavior since #1772, 2021)

## What's broken
`slangc -E` prints a preprocessor error, writes the preprocessed text, and exits 0. Without `-E`, the same input exits -1 (255).
A build script that runs `slangc -E` cannot see the failure.

## Repro (master 72170828a, fresh release build, 2026-11-10)
- `#define POUND_POUND ##` / `Hello POUND_POUND There;` → `slangc t1.slang -E` → E15405, stdout `Hello ## There ;`, **rc=0**
- `#define A(x, x) a x b x c` / `A(,)` → E15408, stdout `a b c`, **rc=0**
- `#error boom` → E15900, rc=0. `#warning w` + `-warnings-as-errors all` → E15901, rc=0.
- The same t1 input with `-target spirv` → rc=255 (-1).
- Precedent: `gcc -E`, `clang -E` and `cpp` all exit 1 for `##` at the start of a macro body and for `#error`, and they still write the preprocessed output.

## Codebase digest (facts, file:line on 72170828a)
- `source/slang/slang-compile-request.cpp:827-831`: `FrontEndCompileRequest::executeActionsInner()` returns `SLANG_OK` on `PreprocessorOutput`
  **before** `if (getSink()->getErrorCount() != 0) return SLANG_FAIL;` at :833-834. **This is the gap.**
- `slang-compile-request.cpp:554-569`: `parseTranslationUnit()` writes the tokens with `_outputPreprocessorTokens` (:201-219) to the stdout writer, then returns.
  The output is therefore already written before any result is decided, so failing the request does not remove it.
- `source/slang/slang-end-to-end-request.cpp:214-217`: `SLANG_RETURN_ON_FAIL(getFrontEndReq()->executeActionsInner())` (non-pass-through only).
  `:219-222` returns `SLANG_OK` on `PreprocessorOutput`. It is reached only when the front end succeeded, or in pass-through mode where the front end does not run.
- `source/slangc/main.cpp:42-48`: `spCompile` failure becomes `SLANG_E_INTERNAL_FAIL`, which maps to exit -1 through `TestToolUtil::getReturnCode` (`source/core/slang-test-tool-util.cpp:11-30`).
- Other users: none. The core-module build (`slang-global-session.cpp:1240`) calls the front end, but never with `PreprocessorOutput`. No tools/unit tests use it.
- History: both returns come from `5fde038b1` (#1772, 2021, "__LINE__/__FILE__"). They were moved in #3598 and #7890. No comment says exit 0 is intended.

## Affected tests (all 29 `-E` directive lines were run on master)
- `tests/preprocessor/preproc-pound-pound-1.slang:2` and `preproc-detail-2.slang:2` `//TEST:SIMPLE(filecheck=CHECK):-E`: filecheck SIMPLE already checks the exit code (#14269, default 0), so these lines need `exit-code=-1`.
  The issue mentions only the `diag=` line 1. On master, `diag=` does not check the exit code (#14266).
- `tests/bugs/preproc-lex-failure-2.slang.expected`: `result code = 0` next to `error 10005: newline in literal`. It becomes `-1` if the lexer error is counted in the sink (the fixer checks this).
- Warning-only `-E` tests (preproc-concat-3 W15503, special-macro-redefine-* W15404, preproc-detail-3 W15401) stay at 0. The other 15 `.expected` tests have empty stderr.
- `docs/generated/tests/` has no `-E` fixtures, so the nightly tree is not affected.
- **PR #14422** (jkwak-work, open, MERGEABLE, fixes #14266) adds `exit-code=0` to the `diag=` line 1 of both tests, and makes `diag=` default to -1 when there is an error annotation.
  Sequencing: if #14422 lands first, the fixer removes those `exit-code=0` (or sets `-1`). If this fix lands first, #14422 must drop them when it rebases. State this in the PR.

## Candidate approaches
### A: Check the error count before the front-end -E early return (recommended)
- Where: `slang-compile-request.cpp:827-834`. Move the `getErrorCount() != 0 → SLANG_FAIL` check above the `PreprocessorOutput` return.
- Behavior change: `-E` with any error-severity diagnostic (including warnings-as-errors) → `SLANG_FAIL` → exit -1. Stdout text and stderr diagnostics do not change. Warnings-only → 0.
- Tradeoffs: one move at the layer that owns the contract ("the front end fails when the sink has errors"). End-to-end :216 already propagates the failure, so :219 can stay as is.
- Risk: low. The only change is the exit code and result of `-E` requests that have errors, plus 3 test updates.
### B: Check the error count at the end-to-end -E return
- Where: `slang-end-to-end-request.cpp:219-222` → `return getSink()->getErrorCount() != 0 ? SLANG_FAIL : SLANG_OK;`
- Behavior change: the same for slangc. It also covers the pass-through path, but `-E` with pass-through does not preprocess anything.
- Tradeoffs: `FrontEndCompileRequest` would still return OK with errors, so the contract stays broken one layer down. Combined with A, the check is dead for non-pass-through requests.
- Risk: low, but it fixes the consumer and not the producer.
### C: Keep exit 0 by design and document it
- Where: `docs/command-line-slangc-reference.md` (-E entry) and the `-E` help text in `slang-options.cpp:1185`.
- Behavior change: none. It only answers the open question with "intentional".
- Tradeoffs: it disagrees with gcc/clang/cpp and with every other slangc mode. No evidence shows the behavior is intended.
- Risk: build scripts stay blind to the failure. This approach is listed only because the maintainer must confirm the open question.

## Recommended path (solution brief)
- **Hypothesis:** `FrontEndCompileRequest::executeActionsInner` returns `SLANG_OK` for `-E` before the sink error check, so the error never becomes a failed result.
- **Files:** `source/slang/slang-compile-request.cpp:827-834`. Tests: `tests/preprocessor/preproc-pound-pound-1.slang:1-2`, `preproc-detail-2.slang:1-2`, `tests/bugs/preproc-lex-failure-2.slang.expected`.
- **Repro:** `printf '#define P ##\nHello P There;\n' > t.slang; slangc t.slang -E; echo $?` → today 0, expected 255 (-1), with stdout still `Hello ## There ;`.
- **Accept when:** (1) E15405, E15408 and `#error` under `-E` exit -1, and the `-E` text is still on stdout. (2) A warning-only `-E` input exits 0.
  (3) The filecheck lines of the two tests get `exit-code=-1`. The `.expected` result code is updated if it changes.
  (4) A new regression test pins exit -1 together with the output text (for example `#error` or E15405 under `-E` with `filecheck` + `exit-code=-1`).
  (5) `slang-test tests/preprocessor/ tests/bugs/` and the full suite pass.
- **Recommended:** A. It is a one-line move at the producer, and the end-to-end path already propagates the failure. B would be a consumer-side duplicate.
- **Behavior chosen for the open question (jkwak-work confirms):** keep the `-E` output, and fail (exit -1) when there is any error. This matches gcc/clang `-E`.

## Sources
- DeepWiki Q1 said the error check runs before the -E early exit. **This is wrong**: the local code at :827-834 shows the opposite. Q2 covered the slang-test `.expected` result-code comparison.
- Related: #14266 / PR #14422 (diag= exit-code check), #14269 / #14215 (filecheck SIMPLE exit-code check), #14292 (same author, same class; not posted on).
- Shared learnings: slang-test exit-code rule (#14269), nightly docs/generated/tests staleness, and the slangc family of "error with exit 0" output modes (`-depfile`, `-reflection-json`).
