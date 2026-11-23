---
type: triage
---
# Triage: shader-slang/slang#14670 — CI: close slang-test coverage gaps (job matrix, skip-lists, disabled tests)
Date: 2026-11-20 | enhancement | medium | P2 | CI | Duplicate: no (related: #13125, #10808, #11988, #10480)

## What's being requested
Maintainer-filed CI-meta tracking issue with a task list: (1) job-matrix rework (suffix renames, 3 new free-runner cpu jobs, gpu-api-only on Windows T4, new sm80 jobs incl. Windows), (2) skip-list/expected-failure hygiene, (3) test-source cleanup (~130 misspelled directives, ~200 fully-disabled files, stale lists, NVAPI, docs-only filter). Three open questions need maintainer/infra decisions.

## Verification of claims (local repo @ 410071448 + DeepWiki cross-check)
- CONFIRMED skip-list-gpu-t4.txt:7-8 removes tests/cooperative-matrix/ + tests/neural/ from ALL t4 jobs (incl. Windows); only sm80 release job runs them on GPU.
- PARTIAL skip-list-debug.txt: 23 neural entries (25 only counting 2 tests/bugs/neural-autodiff-*); header contradiction CONFIRMED (lines 8-9 claim 2 files stay enabled, both ARE listed at :22/:27); stray prose is lines 12-13 (not 13-15) — options.cpp:590-627 turns them into no-op prefixes silently.
- CONFIRMED expected-failure-linux-gpu.txt applies to Windows T4 jobs: ci-slang-test.yml:211-214 has no OS gate (vs :205-207 for the non-GPU linux list); callers ci.yml:730-741, 754-765.
- CONFIRMED unknown-directive silent ignore: slang-test-main.cpp:937-946 strips "DISABLE_" prefix; misspelled DISABLED_TEST/TEST_DISABLED/DISABLED_DIAGNOSTIC_TEST fall to unknown-command branch :1039-1043 ("assume that's ok"). Counts exact: 87 / 38 / 5. Total recognized disables today: 579 (claim ~528, grew); fully-dead files: 201 counting misspellings (claim 200) — 142 if only recognized directives.
- CONFIRMED replayRecord_*: 8 tests, runTest starts `SLANG_IGNORE_TEST;` unconditional (unit-test-replay-record.cpp:170-171; registrations :297-333).
- PARTIAL/REFUTED tests/disabled-tests.txt: 37 entries, but 36 of 37 files EXIST on disk — it is a live registry of intentionally-disabled tests, NOT a stale-path list. Deleting it loses the disable rationale; fix is fixing the files or per-file annotations, not blanket deletion.
- CONFIRMED external/nvapi absent; 30 test files reference nvHLSLExtns.h in expected outputs; the 2 SER tests are diagnostic tests not needing the header at runtime.
- CONFIRMED docs-only-filter/filter.sh:22 treats every *.md as docs-only; tests/literate/*.slang.md (4 files) edits would skip CI.
- CONFIRMED Windows T4 jobs run -api all on paid time (gpu-api-only unset → "all", ci-slang-test.yml:181-191); gpu-api-only input has zero callers today.
- CONFIRMED job-matrix gaps: no linux-debug-x86_64-cpu, no windows-debug/release-x86_64-cpu, no Windows sm80; job ids differ from the issue's proposed names (e.g. test-linux-debug-gcc-x86_64 with no t4 suffix, test-windows-{debug,release}-cl-x86_64-gpu). New jobs need both a caller block in ci.yml ~557-776 AND check-ci.needs (ci.yml:941-985) to gate the merge queue.
- CONFIRMED nightly runs docs/generated/tests (4252 files) Linux CPU-only — no nightly GPU coverage for coop-matrix/neural.
- CONFIRMED "passing tests that are expected to fail" report gated on m_expectedFailedTestCount (test-reporter.cpp:871-888); expected-failure-linux-gpu.txt has just 2 entries (raygen.slang (cuda) at :11); 4 WGPU groupshared entries live in expected-failure-github.txt:18-21.

## Task clusters & readiness
- **Cluster A (bot-actionable repo edits, no new infra):** fix skip-list-debug.txt header/stray lines; OS-gate + split expected-failure lists and prune stale entries; always-print the expected-fail-passing report (test-reporter.cpp gate); warn on unknown *DISABLE* directives + rename the 130 misspellings; narrow docs-only filter for tests/literate; add 3 free-runner cpu jobs + gpu-api-only on Windows T4 + job renames (workflow edits; merge-queue gate changes → maintainer sign-off advisable but no infra needed).
- **Cluster B (maintainer/infra decisions):** Windows SM80 self-hosted runner (label unknown); macOS -metal suffix; debug sm80 + the neural skip-list; NVAPI in checkout (licensing); review/fix/delete the ~200 fully-disabled files (large per-file effort); missing-hardware features (DX12 coop-vector ~35 files, subgroup-partitioned ~20 lines, WGPU half, int64 atomics, Metal ray-query); replayRecord_* intent (may be deliberately parked); disabled-tests.txt disposition (36/37 live — NOT stale).

## Candidate approaches
- **A: Park with readiness report (recommended).** Post verification digest + per-cluster readiness on the issue; Next-action = jkwak-work picks clusters/questions. Matches the issue's own open-questions framing and its self-assignment.
- **B: Hand Cluster A to slang-fixer now.** Fast but premature: the author assigned the issue to himself and the open questions show he intends to sequence the work; a 6-item change batch also touches the merge-queue gate, which deserves his go-ahead.
- **C: Split-triage per checklist item.** Maximal precision, but 15+ sub-chains for one tracking issue is overhead the maintainer didn't ask for.

## Recommended path
A now; on maintainer confirmation (comment on issue), hand the confirmed Cluster-A items to slang-fixer as one batch. Re-check the issue once (~7 days).

## Sources
- Local repo /workspace/agent/slang: tests/skip-list-*.txt, tests/expected-failure-*.txt, ci.yml, ci-slang-test.yml, ci-slang-test-container.yml, tools/slang-test/{slang-test-main.cpp,options.cpp,test-reporter.cpp}, tools/slang-unit-test/unit-test-replay-record.cpp, .github/actions/docs-only-filter/filter.sh
- DeepWiki Q&A: test-harness skip/expected-failure handling + CI reusable-workflow structure (2026-11-20)
- Shared wiki: slang-b-test-harness.md, ci-windows-gpu-test-job-split-and-merge.md
