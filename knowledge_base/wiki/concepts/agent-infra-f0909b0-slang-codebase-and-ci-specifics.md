---
title: "Slang Codebase and CI Specifics: Test Isolation, Diagnostics, Perf, and Verification"
type: concept
group: agent-infra
tags: [slang, render-test, filecheck, vcpkg, merge-queue, record-replay, compile-perf, diagnostics]
source_count: 7
---

## TL;DR

Concrete, load-bearing facts about the Slang compiler codebase and its CI that repeatedly
tripped agents. Most are "the environment/data lies about the code" — verify against ground
truth, not appearance or docs.

- **`slang-test` shares one `GlobalSession` across tests** (esp. under `-use-test-server`), so a
  `-cpu` COMPARE_COMPUTE render-test that blanks the HLSL prelude poisons a later `-target hlsl`
  test on the same session. The HLSL-prelude "leak" (#12462/#12442) is CPU-reproducible on Linux
  with a single-file two-directive repro; FileCheck the regex `#include "{{.*}}nvHLSLExtns.h"`
  (absolute-path override), and the flag is `-nvapi-slot`.
- **A code-reading subagent can read a STALE local `main`** (dozens of commits behind origin) and
  return confidently-wrong "this doesn't exist" facts that are internally consistent with a past
  tree. Cut the worktree from `origin/main`, check `git rev-list --count main..origin/main` after
  a fetch; smaller line numbers ⇒ an older tree. Positive-control DeepWiki claims.
- **A vcpkg overlay-removability question can be settled STATICALLY** — compare the overlay's
  `portfile.cmake` REF + applied patches against the built-in port at the pinned submodule commit;
  matching REFs + extra patches ⇒ NOT redundant at that pin. No crashpad-scale build needed.
- **`merge_queue.failure:1` can be a same-run GPU-flake auto-retry, not a stall** — check the
  failing run for a `retry-on-gpu-failure` job with `conclusion:success`, then re-check
  `commits/{sha}/status` (likely already `success`). Treat as "investigate before alarm."
- **A coverage task can be a bug hunt** — a `static std::atomic<int> s_liveCount` on an in-test
  COM object is a deterministic, sanitizer-independent leak assert. record-replay `createSession`
  leaked a ref on the registered-FS-reuse arm.
- **"benchview" ≠ the existing compile-perf gh-pages dashboard** — the gh-pages dashboard is live;
  benchview is a separate, not-yet-wired backend (design-only as of 2026-09-08).
- **Module-write diagnostics: all FOUR extensions** (`.slang-module`, `.slang-lib`, `.zip`,
  `.dir`) map to `ContainerFormat::SlangModule`; gate CLI-only diagnostics on
  `m_isCommandLineCompile` INSIDE the hook; codes render zero-padded (`88 → E00088`).

## Synthesis

### Test isolation and shared-session poisoning

The render-test HLSL-prelude bug is the sharpest codebase-specific isolation trap. `slang-test`
shares one `GlobalSession` across the tests it runs (especially under `-use-test-server`), and
render-test's `_setSessionPrelude` runs for EVERY invocation including a `-cpu` COMPARE_COMPUTE
test — its non-NVAPI branch blanked the HLSL prelude, so a later `-target hlsl` slangc test on the
same session emits no prelude ([render-test HLSL-prelude leak is CPU-reproducible](../learnings/1787030106338-render-test-hlsl-prelude-leak-is-cpu-reproducible-.md)).
The "leak" framing (#12442) and the "blanks the prelude" bug (#12462) look GPU/Windows-only but the
symptom is fully CPU-reproducible on Linux: put both directives in ONE `.slang` file (they run in
order on the same session), and FileCheck the regex `#include "{{.*}}nvHLSLExtns.h"` — a bare
`#include "nvHLSLExtns.h"` misses the absolute-path override that both render-test and slang-test
install via `getIncludePath`. The CLI flag is `-nvapi-slot` (not `-nvapi-extn-slot`; C++ field
`nvapiExtnSlot`).

### Ground truth beats a stale checkout and a doc

A code-reading subagent dispatched to "verify file:line claims firsthand" can read a stale local
`main` (measured 59 commits behind origin) and return confidently-wrong "this function/flag/file
doesn't exist" facts that are internally consistent because they match a real *past* tree — they
matched `git show <post-refactor-commit>^:tools/ci.py` exactly ([a code-reading subagent can read a stale local main](../learnings/1787227434639-a-code-reading-subagent-can-read-a-stale-local-mai.md)).
Before dispatching such a subagent, ensure the checkout is at `origin/main`: `git fetch origin`,
cut the worktree from `origin/main`, check `git rev-list --count main..origin/main`, and verify
against the fresh worktree HEAD. A useful discriminator: consistently *smaller* line numbers than
another source imply a shorter (older) tree, not that the other source "drifted." The same task's
bonus finding also warns against trusting a doc over a positive control — DeepWiki claimed pytest's
`.pytest_cache` lives under `--basetemp` and is wiped; in fact `--basetemp` and `.pytest_cache` are
independent dirs, so a two-stage `-n auto` → `-n 0 --lf` retry works even with `--basetemp` set.

Relatedly, some questions can be answered statically without an expensive build. A vcpkg
overlay-removability question ("can we drop overlay X because the built-in port now suffices?") is
answerable from the filesystem: compare the overlay's `portfile.cmake` against the built-in
`external/vcpkg/ports/<port>/portfile.cmake` at the pinned submodule commit — if the upstream REFs
match and the overlay applies patches the built-in lacks, the overlay is NOT redundant at that pin
(its whole functional delta is those patches) ([static REF+patch diff can settle a vcpkg overlay-removability question](../learnings/1787228997352-static-ref-patch-diff-can-settle-a-vcpkg-overlay-r.md)).
Corroborating cross-checks that need no build: a patch the overlay's README omits but its
`portfile.cmake` reveals, and the maintainer's own vcpkg-bump PR modifying-but-not-deleting the
overlay. Removability against a *newer* pin still needs a real build, but "removable at the current
pin" can be conclusively ruled out from the filesystem alone.

### CI-health reading and coverage-as-bug-hunt

A nonzero `merge_queue.failure` count can be a same-run auto-remediation, not a stall.
shader-slang/slang has a built-in `retry-on-gpu-failure` job that detects GPU-health-check failures
and dispatches a retry which succeeds — so a run that failed `test-falcor` / a GPU test can already
have self-healed, with `commits/{sha}/status` flipped back to `success` and the PR returned to the
normal `mergeable_state:blocked` resting state ([merge-queue failure:1 can be a same-run GPU-flake auto-retry](../learnings/1787581056199-merge-queue-failure-1-can-be-a-same-run-gpu-flake-.md)).
Before escalating, check the failing run's job list for a `retry-on-gpu-failure` job with
`conclusion:success` and re-check the commit status directly — treat `merge_queue.failure:1` as
"investigate before alarm."

A requested-coverage task can turn into a real bug hunt: writing coverage for slang#12470 surfaced
an actual reference leak in `GlobalSessionProxy::createSession`, which `addRef`'d
`desc.fileSystem` unconditionally before branching on `isInterfaceRegistered` — but the balancing
`release()` (via `tryWrap()`'s ownership transfer) only runs on the not-yet-registered branch, so
passing the same custom `ISlangFileSystem` twice leaked one ref ([record-replay createSession leaked a ref on registered-FS reuse](../learnings/1788252612832-record-replay-createsession-leaked-a-ref-on-regist.md)).
The reusable technique is a `static std::atomic<int> s_liveCount` on a minimal in-test COM object
(incremented in ctor, decremented in dtor): drop every owner, null your own pointer, assert
`s_liveCount==0` — a deterministic, sanitizer-independent leak assert that catches leaks in a plain
Debug run where LSan isn't wired. To reach the record-replay registered arm, call `createSession`
twice with the same FS object (handles are assigned in creation order, so playback re-derives the
same handle and routes the second call through `default:`). General lesson: when a triager flags
an "unmeasured arm whose failure mode a leak-net can't catch," treat the coverage task as
potentially a bug hunt — the missing test often exists because the arm was wrong.

### Perf-initiative vocabulary and module-write diagnostics

Two triage-facing facts. First, "benchview" is NOT the existing compile-perf dashboard. What is
implemented today is the `tools/compile-perf/` microbenchmark suite → nightly workflow →
`shader-slang/slang-compile-perf` repo → the gh-pages dashboard at
`shader-slang.org/slang-compile-perf/`; "benchview" is a SEPARATE, not-yet-wired BenchView
DB/backend the initiative is standing up, appearing in the repo only as design-analogy comments as
of 2026-09-08 ([slang perf: "benchview" != the existing compile-perf gh-pages dashboard](../learnings/1788881905309-slang-perf-benchview-the-existing-compile-perf-gh-.md)).
When triaging perf-initiative issues (epic #12941 + children), split "verify data publishing" by
which dashboard is meant — the existing gh-pages (publishing now) vs benchview (gated on the
implementing twin landing the publish path).

Second, adding a diagnostic to the CLI module-write path has several non-obvious gotchas
([slang module-container diagnostics: hook scope, extensions, warning-disable id vs name](../learnings/1788903544418-slang-module-container-diagnostics-hook-scope-all-.md)).
All FOUR extensions map to `ContainerFormat::SlangModule`: `.slang-module`, `.slang-lib`, `.zip`,
AND `.dir` — grep test producers across all four and use extension-neutral wording.
`maybeCreateContainer()` runs for the programmatic API too (only the file *write* is gated on
`m_isCommandLineCompile`), so gate CLI-only diagnostics on `m_isCommandLineCompile` INSIDE the hook
or you trip API embedders' warnings-as-errors; `slang-bootstrap` builds the bundled modules in
command-line mode, so suppress the diagnostic in the standard-modules gen commands.
`-warnings-disable` accepts a numeric id (unknown id silently ignored — safe across versions, use
in CMake) OR a name (unknown name errors E31111 — self-documenting, use in tests); diagnostic codes
render zero-padded to 5 digits (`88 → warning[E00088]`), so FileCheck the bracketed code, not a
bare `CHECK: warning 88`; and `-no-codegen` is a debug path that swallows escalated errors (returns
`SLANG_OK` without the sink-error check).

**Source learnings (7):**
- [render-test HLSL-prelude leak is CPU-reproducible via shared test-server session](../learnings/1787030106338-render-test-hlsl-prelude-leak-is-cpu-reproducible-.md) — one shared GlobalSession lets a `-cpu` test poison a later `-target hlsl` test; single-file two-directive repro; flag is `-nvapi-slot`.
- [A code-reading subagent can read a stale local main — cut the worktree from origin first](../learnings/1787227434639-a-code-reading-subagent-can-read-a-stale-local-mai.md) — stale-tree facts are internally consistent; `git rev-list --count main..origin/main`; smaller line numbers ⇒ older tree; positive-control DeepWiki.
- [Static REF+patch diff can settle a vcpkg overlay-removability question without a build](../learnings/1787228997352-static-ref-patch-diff-can-settle-a-vcpkg-overlay-r.md) — matching REFs + extra patches ⇒ not redundant at that pin; corroborate with README omission and the bump PR not deleting the overlay.
- [Merge-queue failure:1 can be a same-run GPU-flake auto-retry, not a stall](../learnings/1787581056199-merge-queue-failure-1-can-be-a-same-run-gpu-flake-.md) — check for a `retry-on-gpu-failure` job with `conclusion:success` then re-check `commits/{sha}/status`; investigate before alarm.
- [Record-replay createSession leaked a ref on registered-FS reuse; live-count stub catches it](../learnings/1788252612832-record-replay-createsession-leaked-a-ref-on-regist.md) — `s_liveCount` COM stub is a sanitizer-independent leak assert; call createSession twice with the same FS to hit the registered arm; a coverage task can be a bug hunt.
- [Slang perf: "benchview" != the existing compile-perf gh-pages dashboard](../learnings/1788881905309-slang-perf-benchview-the-existing-compile-perf-gh-.md) — gh-pages dashboard is live; benchview is a separate, design-only backend; split "verify publishing" by which is meant.
- [Slang module-container diagnostics: hook scope, all 4 extensions, warning-disable id vs name](../learnings/1788903544418-slang-module-container-diagnostics-hook-scope-all-.md) — 4 extensions map to SlangModule; gate CLI diagnostics on `m_isCommandLineCompile` inside the hook; codes render zero-padded (E00088).
