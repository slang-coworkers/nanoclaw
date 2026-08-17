---
title: "slang-test -v failure ignored in parallel + capability discovery (#12177); CI parses discovery output"
type: learning
topic: slang-compiler
source: learnings/1784656410724-slang-test-v-failure-ignored-in-parallel-capabilit.md
---

# slang-test -v failure ignored in parallel + capability discovery (#12177); CI parses discovery output

**#12177**: `slang-test -v failure` still prints passing tests in parallel and always prints backend/render-API discovery. Two independent root causes, both CONFIRMED by code inspection @6a244fee2 in `tools/slang-test`:

1. **Worker-reporter config drift (recurring class — same as #11911).** The single-run main reporter sets its config inline (`slang-test-main.cpp:6048-6050`: `m_dumpOutputOnFailure`, `m_verbosity = options.verbosity`, `m_hideIgnored`), but `runTestsInParallel`'s per-worker `TestReporter` (`slang-test-main.cpp:5395-5396`) only calls `init(...)` and sets NONE of them → keeps ctor default `VerbosityLevel::Info` (`test-reporter.h:145`). Passing-test gate is `if (m_verbosity < VerbosityLevel::Info)` at `test-reporter.cpp:407`. `TestReporter::init(outputMode, expectedFailureList, isSubReporter)` deliberately does NOT carry verbosity; there is no `setVerbosity`. Principled fix: fold the config into `init` so main + worker configure through one path (kills the drift class). `VerbosityLevel` = `{Failure, Info, Verbose}` (`options.h:47-52`), default Info.

2. **Ungated discovery output.** `Supported backends:` block (`slang-test-main.cpp:5850-5878`) and `_getAvailableRenderApiFlags()`'s `Check <api>: …` prints (`:1592-1601`, `:1635-1647`) write via raw `StdWriters::getOut()` with no verbosity guard.

**LOAD-BEARING GOTCHA for any fix:** CI depends on this output — `.github/actions/common-test-setup/action.yml:94` greps `'Supported backends: '`. CI runs at DEFAULT verbosity (never `-v failure`), so gate discovery on `verbosity >= VerbosityLevel::Info` (suppress only under Failure). An unconditional suppression would silently break CI backend detection.

Harness is monolithic → no committed `.slang` regression for slang-test's own stdout; verify behaviorally.

Routing note: filed AND self-assigned by maintainer jkwak-work → parked at triaged per `no-autofixer-jkwak-self-filed`; no bot PR.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784656410724-slang-test-v-failure-ignored-in-parallel-capabilit.md`_
