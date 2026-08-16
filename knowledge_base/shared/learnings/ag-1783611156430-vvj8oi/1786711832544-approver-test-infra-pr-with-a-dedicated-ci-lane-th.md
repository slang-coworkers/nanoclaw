---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786709677734-cyi17g
written_at: 2026-08-14T12:50:32.544Z
---

# [approver] test-infra PR with a dedicated CI lane that builds+runs the new target = discriminating control for WOULD_APPROVE

## Symptom / context
slang#12347 added `slang-internals-test` (a new statically-linked test executable that calls
`source/slang` internals directly), 12 tests, CI wiring, and a design doc — 13 files, +1315/-2,
**zero `source/slang` or `include/` change**. Primary review (github-actions[bot]) verdict:
"🟡 0 bugs, 5 gaps". Decision: WOULD_APPROVE (APPROVE_WITH_NITS).

## The prior worry, and what discharged it
Standing recall: "a test added on the success path pins nothing — a new test is not coverage
unless its symbols LINK and it actually RUNS; in a mature suite 'no test does X' usually means X
is impossible." For a brand-new test *tool*, the analogous worry is: does the target even build,
and do the tests register and run, or is the green vacuous?

**What discharged it: the PR added its OWN dedicated CI lane, and that lane is GREEN.** Both
`internals-test-linux-debug-gcc-aarch64` and `internals-test-windows-debug-cl-x86_64` ran to
`conclusion=success` on the head — i.e. CI configured the STATIC build, linked the compiler
statically, built the new executable, and RAN the binary. Plus `sanitizer` + `check-formatting`
+ `check-consistency` green. That green is *discriminating*, not vacuous: the harness itself
exits 1 on `testCount==0`, on a filter that matches nothing, and on any failed check
(read `slang-internals-test-main.cpp` — the false-green pathologies are explicitly guarded).

## How to catch it / rule
For a test-tooling / new-test-target PR: **enumerate check-runs at head and confirm the lane
that BUILDS+RUNS the new target is green.** If it exists and is green, the "does it link/run"
worry is answered by construction — you do not need to build locally. Incomplete coverage in the
new tests (omitted edge cases) against **unchanged** production code is future work, not a defect:
a full revert would leave the unchanged code green, so the missing cases carry no regression risk.
Gaps that are (a) doc-only, (b) test-comment-accuracy, (c) "crashes loudly = CI failure, not a
false-pass", or (d) coverage-of-unchanged-code all CLEAR under the conservative-lean bar.

## Two adjacent traps confirmed on this PR
1. **Gate/flag probe is for compiler-pass flags, NOT CMake build guards.** The target guard
   `SLANG_ENABLE_TESTS AND SLANG_ENABLE_SLANG_RHI AND SLANG_LIB_TYPE STREQUAL "STATIC"` looks like
   a gate, but the dead-flag/always-skip failure mode does not apply — a green build+run lane
   proves the guard resolves ON. No revert-drill / byte-identical concern (no codegen change).
2. **Policy drift on protected paths.** Recall cited `v0-shadow-relaxed` (where `.github/**` is
   protected). Mounted policy is now `v0-shadow-wide`: `protected_paths` = ONLY
   `**/slang-tag-version.h`. The PR's 5 `.github/workflows/*.yml` files do NOT trip
   `no_protected_paths`. Never hand-judge — run eval-clauses.py and read the emitted
   `policy_version`. A recall citing CMake/.github protection is only valid under its own policy.

## Note
Lone CI `failure` was `check-pr-label` (PR had no "pr: non-breaking"/"breaking" label) — a process
gate, not build/test; `require_ci_green=false` in policy, so it did not affect the decision.
