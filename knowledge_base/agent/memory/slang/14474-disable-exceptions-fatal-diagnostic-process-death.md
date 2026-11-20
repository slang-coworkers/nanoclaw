---
type: project
title: "slang#14474 — SLANG_DISABLE_EXCEPTIONS: fatal diagnostics kill the embedding process"
description: "Human (lujinwangnv) 11-16, explicit triage-and-fix ask. PR #14501 (AbortCompilationEscape setjmp/longjmp, 7 recovery boundaries) RESTING on maintainer review @ 55ef7859e; full dated log in the _history sibling."
---

# slang#14474 — exceptions-disabled build: fatal diagnostic → handleSignal() breakpoint/exit, no failure return

- Filed 2026-11-16 06:42Z by lujinwangnv (human); explicit bot request verbatim:
  "@nv-slang-bot please triage and fix this." (issue comment 6864244931).

## Core claim

With `SLANG_DISABLE_EXCEPTIONS=1`, a user-caused fatal compilation diagnostic
(undefined identifier in an imported module → `fatal error[E40003]: compilation
ceased`) reaches the non-exception branch of `handleSignal()`, which does
`SLANG_BREAKPOINT(0)` (STATUS_BREAKPOINT 0x80000003 on Windows) and/or
`exit(InternalCompilerError)`. The embedding process dies; `loadModule` never
returns. Exceptions-enabled build returns `module=nullptr` + diagnostics and
the host stays alive (author's Expected Behavior). Scope: SLANG_NO_THROW API
boundary recovery, runtime behavior only — author explicitly separates the
SLANG_DISABLE_EXCEPTIONS *build* failures tracked in #12779.

Repro: bad.slang (undefined ident) + main.slang (`import bad;`) + repro.cpp
using `session->loadModule("main", diagnostics)`, built
`-DSLANG_DISABLE_EXCEPTIONS=1` (vs2022 preset; GCC/Clang path gives SIGILL).
Version v2026.22, Windows reported; Linux L40S box verified with
`-DSLANG_DISABLE_EXCEPTIONS=1`.

## Relations

- #14448 (g-whiz, 11-10): AbortCompilationException escaping SLANG_NO_THROW
  `getLayout`/`findAndCheckEntryPoint` — same exception-family, different side
  (exceptions *enabled*, leak past boundary; draft PR #14450).
- #12779: SLANG_DISABLE_EXCEPTIONS *build* failures (referenced by author;
  explicitly out of scope here). #12782 (exceptions-disabled core, merged
  09-29) is the related unblock path for the CI lane.

## Current state (2026-11-17; full dated log → [[14474-disable-exceptions-fatal-diagnostic-process-death_history.md]])

- **PR #14501 RESTING on maintainer review, webhook-driven only** (head
  55ef7859e, 10+ commits: AbortCompilationEscape setjmp/longjmp mechanism,
  SLANG_EXCEPTION_TRY_RECOVERY macro layer, recovery at 7 boundaries —
  loadModule, loadModuleFromBlob, loadParsedModule, loadSerializedModule,
  link, getTargetArtifact, compile — plus state restoration: import list,
  loaded-module caches, operation-mutex locks). Verified: no-exc repro exits
  255 via diagnostics (was SIGILL 132), output byte-identical to the
  exceptions build; default build unchanged (1083/1083, 688/688 both configs).
- Triage (07:25Z): bug/high/P2, frontend, NOT a regression, not a dup of
  #14448. Approach A (setjmp/longjmp at existing SLANG_EXCEPTION_TRY
  boundaries) implemented; **Approach B** (standard-clean early-return
  restructure of the imported-module error path) is the follow-up path.
- **Parked in front of the maintainer** (any reply routes to the fixer via the
  #14501 pr-mapping, sess-1794813961882-jk0msz): concern #2 — accept the
  documented longjmp UB trade-off vs pursue restructure; (a) mirrored
  reraiseAbortCompilation change in the no-enclosing-boundary tail; (b)
  break-only-under-debugger proposal; per-abort leak acceptance.
- **Human-apply item**: no-exc CI lane YAML ready-to-apply at PR cmt 6920727925
  (bot token cannot push `.github/workflows/`, #14037 pattern).
- **READY-FLIP PENDING** — weekly maintainer list, no per-PR ask.
- jkwak-work's direction (comment out the `SLANG_BREAKPOINT` in handleSignal's
  no-exc fallback) applied at 55ef7859e: defined −2 exit code instead of
  SIGILL/STATUS_BREAKPOINT. Supersedes original triage acceptance criterion 4
  ("internal errors still trap").
- Worktree wt-slang-14474 retained until the PR resolves.

**New dated entries go to the `_history` sibling, not here** — this record
holds current state only.
