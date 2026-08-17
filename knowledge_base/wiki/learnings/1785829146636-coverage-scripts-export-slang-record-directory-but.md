---
title: "Coverage scripts export SLANG_RECORD_DIRECTORY but nothing reads it — recordings land in .slang-replays and cleanup no-ops"
type: learning
topic: slang-compiler
source: learnings/1785829146636-coverage-scripts-export-slang-record-directory-but.md
---

# Coverage scripts export SLANG_RECORD_DIRECTORY but nothing reads it — recordings land in .slang-replays and cleanup no-ops

## Summary

`tools/coverage/run-coverage.sh:105` and `tools/coverage/run-coverage-windows.ps1:232` export
`SLANG_RECORD_DIRECTORY` to point the record pass at a temp dir. **The Slang source never reads that
variable.** Recordings go to the default `.slang-replays/<timestamp>/` instead, and the script's
`rm -rf "$RECORD_DIR"` cleanup removes an empty directory while the real recordings stay in the workspace.

Verified at shader-slang/slang master `0864e60e6` by direct source read (2026-08-04, triaging #10480).

## Evidence

The **exhaustive** set of `SLANG_RECORD*` env vars the source reads — `grep -rn 'SLANG_RECORD[A-Z_]*' source/ tools/ --include='*.cpp' --include='*.h'`:

- `SLANG_RECORD_LOG` — `source/slang-record-replay/replay-context.cpp:35`
- `SLANG_RECORD_LAYER` — `replay-context.cpp:47`
- `SLANG_RECORD_PATH` — `replay-context.cpp:365`

`grep -rn 'SLANG_RECORD_DIRECTORY'` tree-wide hits **only** 5 script lines (`run-coverage.sh:105,111`;
`run-coverage-windows.ps1:230,232,264`) and **zero** lines in `source/`.

Path resolution traced in `ReplayContext::setupRecordingMirror()` (`replay-context.cpp:360`):
checks `SLANG_RECORD_PATH` at `:365`; unset → falls through to `:376`
`Path::combine(m_replayDirectory, timestamp)` with `m_replayDirectory = ".slang-replays"`
(`replay-context.h:791`, assigned `replay-context.cpp:314`).

## How to apply

- **The correct variable is `SLANG_RECORD_PATH`.** If you write CI/scripting that needs to *find* a
  recording afterwards (e.g. to feed `slang-replay -r <path>`), use `SLANG_RECORD_PATH` — copying the
  existing coverage-script pattern gives you an empty directory and a silently-passing job.
- Harmless for the coverage job's actual purpose (it wants `.profraw`, not the recording), which is
  exactly why it went unnoticed — **an unused env var produces no error, so nothing downstream
  misbehaves to reveal it.** Same shape as the general rule that a wrong mechanism riding a correct
  outcome draws no pushback.
- Note `SLANG_RECORD_PATH` is used *directly* as the folder (no timestamp appended), so parallel
  writers to one explicit path collide — cf. the known replay-folder collision race (#12214).

## Method lesson: search CLOSED siblings, not just open duplicates

While triaging #10480 ("Add CI job for record-and-replay regression testing"), a dedup pass for open
duplicates came back clean and *was* correct — but it missed the two most load-bearing neighbours,
both closed/merged:

- **#10478** "Add replay unit tests to CI with process isolation" — CLOSED/completed 2026-05-08
- **PR #11086** "Unskip replay tests in CI" — MERGED 2026-05-08 (`76932d295`, closes #10478), which
  deleted the `SLANG_IGNORE_TEST` from the `REPLAY_TEST` macro in `unit-test-replay-common.h` but left
  `unit-test-replay-record.cpp:170`'s unconditional ignore in place.

Those two reframed the verdict: the issue's remaining scope is precisely *the slice the merged PR left
behind*, and that PR is a merged precedent for the same removal — which de-risks the recommendation far
more than any fresh argument could. **A closed sibling can supply both the scope boundary and the
precedent; "no open duplicate" is not the end of dedup.** Search `search/issues` with `--state all` /
no state filter and read the closed hits' bodies, not just their titles.

Related: also verify whether disabled tests report `Ignored` vs `Fail` before treating an
expected-failure-list entry as a live false signal — reclassification fires only on `Fail`
(`tools/slang-test/test-reporter.cpp:168-169`, `:878-879`), so entries for `Ignored` tests are inert.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785829146636-coverage-scripts-export-slang-record-directory-but.md`_
