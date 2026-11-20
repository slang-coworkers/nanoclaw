---
type: triage
---
# Triage: shader-slang/slang#14559 — slang-test: add a `targets=` option for COMPARE_COMPUTE tests
Date: 2026-11-17 | Category: feature-request (test-infra enhancement) | Severity: low | Priority: P2 normal | Component: tools/slang-test (test harness, not compiler pipeline) | Duplicate: no

## What's being requested
A `targets=` option on `//TEST:COMPARE_COMPUTE`-family lines so one line expands to one test per GPU backend
(`vk,metal,cpu,...`, `all`, `all-wgpu`, `-name` removal). Scope: COMPARE_COMPUTE, COMPARE_COMPUTE_EX,
COMPARE_RENDER_COMPUTE, HLSL_COMPUTE. Expansion at gather time so requirements / missing-backend skip /
retries / dry-run need no change. Out of scope: SIMPLE (per-target output differs → per-target FileCheck prefix).

## Repro / demand
N/A (feature). Demand verified: ~130 test files have 2+ COMPARE_COMPUTE* lines; 73 files have near-duplicate
lines differing only in backend/SPIR-V-mode flags (tests/autodiff/property-accessor-1.slang:1-3 x3 backends,
tests/autodiff/existential-generic-interface-backward.slang:4-5 -cpu/-vk,
tests/cross-compile/fmod.slang:7-8 via-glsl/direct cross-check).

## Codebase digest (verified on master, tools/slang-test/slang-test-main.cpp)
- `_gatherTestsForFile` :591 (named anchor ✓) — per TEST line, `_gatherTestOptions` :427 → `_parseCommandArguments`
  :347 (named anchor ✓) → one `TestDetails` appended :775.
- Option parsing splits the paren list on `,` (:368) then first `=`; keys: filecheck=, filecheck-buffer=, exit-code=, diag=.
  **Hazard:** `targets=vk,metal` arrives as `targets=vk` + bare `metal` segment — proposal's "bare segment continues
  the list" rule is the correct, minimal handling; no delimiter change needed.
- Dispatch table :6219-6248: all four in-scope commands present (+ SIMPLE/EX). Command options are a generic
  Dictionary :114 — `targets=` must be validated per-command (error on SIMPLE etc.).
- Naming: output stem `<file>.<N>` from list index :6822-6827; display name already appends `(<api>)` from
  usedRenderApiFlags :6849-6870 → proposed `foo.slang.2 (metal)` suffix comes for free (each variant carries an
  explicit api arg).
- Skip-on-missing-backend: per-test requirement collection then `_canIgnore` :6551 → Ignored. One TestDetails per
  target inherits this unchanged (collect-then-filter flow — confirmed by DeepWiki as the constraint to respect).
- Precedent: `_calcSynthesizedTests` :6351 (via `-synthesizedTestApi`, options.cpp:449) already clones tests per
  missing API; synthesized clones EXCLUDE tests with explicit api → no double-expansion interaction.
- `filecheck-buffer` consumed in `runComputeComparisonImpl` :5158-5161 — buffer is target-independent, shared
  prefix across variants OK (matches proposal). `.expected.txt` path: variants get distinct indices → distinct
  stems, no collision.

## Candidate approaches
### A: Gather-time expansion in `_gatherTestsForFile` (the proposal's design) — RECOMMENDED
- Where: slang-test-main.cpp:591 / `_gatherTestOptions` :427 / `_parseCommandArguments` :347; expand after option
  parse, append one TestDetails per target (api arg appended to TestOptions.args).
- Delta: one new target-name→render-args table (vk, vk-via-glsl, dx12, metal, cuda, cpu, wgpu, llvm + part-of-all
  flag), bare-continuation list parsing, `all`/`-name`/`all-<name>` semantics, per-command validation,
  ` (target)` display tag, unknown-target error.
- Tradeoffs: touches only gather path; requirements/_canIgnore/retry/dry-run untouched; ~73 files can be
  simplified later opportunistically. Risk: expected-failure-list keys and subtest indices shift for any test
  converted to `targets=` (opt-in, new tests only — acceptable).
### B: Extend the global synthesized-test machinery (`-synthesizedTestApi`) instead of a per-line option
- Where: :6351, options.cpp:449.
- Delta: zero new parsing, but invocation-time + global — cannot express a per-line committed backend matrix;
  wrong granularity, big blast radius (all eligible tests). Rejected: does not satisfy the ask.
### C: Macro/placeholder templating of TEST lines (reuse substitution :555)
- More magic, no advantage over A. Rejected.

## Recommended path (solution brief)
Approach A. Parse `targets=` in `_parseCommandArguments` with bare-segment continuation; expand in the TEST branch
of `_gatherTestsForFile` (:740-776) into N TestDetails, each with the target's api arg appended and a target tag
for the display name (or rely on usedRenderApiFlags suffix :6849). Validate `targets=` only for the four commands
(:6219 table) — error otherwise and on unknown target names. Tests: -dry-run for all/all-<name>/explicit lists;
a cpu-target run (no GPU needed); error paths. Rebuild slang-test and run the touched test files plus a
`-dry-run` sanity pass; assert nonzero run counts (an inert `targets=` spelling would silently pass — see
verification-discipline lesson).

## Open micro-decisions for the maintainer
1. Comma/bare-continuation (as proposed) vs. a different list delimiter (space/`;`).
2. Are SPIR-V-mode variants (`vk-via-glsl`, `-emit-spirv-directly`) target names in the table, or plain per-line flags?
3. Exact membership of `all` (is `llvm` in `all`? is `dx12` gated by host?).

## Sources
Local read of tools/slang-test/slang-test-main.cpp (subagent digests, file:line above); DeepWiki "Test Framework
Architecture" Q&A (collect-then-filter constraint, naming/expected-output collision risks); shared-learnings
concept pages slang-a/b-test-harness + learning 1780314391657 (synthesized subtest machinery, #11384);
gh duplicate search (none). Issue state 2026-11-17: no labels, no comments, Type blank, author jkwak-work
self-assigned (core team).
