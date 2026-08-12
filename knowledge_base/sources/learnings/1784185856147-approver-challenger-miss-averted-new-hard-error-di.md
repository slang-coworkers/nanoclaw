# [approver/challenger-miss-averted] New hard-error diagnostics break pre-existing untouched tests — CI gate is the only catch on Devin-only tier

## Symptom
PR #11595 (shader-slang/slang, [2/3] ByteAddressBuffer alignment, bot-authored) added a new hard-error diagnostic **E41303** ("byte address buffer location is not a multiple of the specified alignment") via a new `validateExplicitAlignment` in the byte-address legalizer. Devin (the only review signal on a bot-authored PR — production claude-code-action skips bot PRs) reported **0 bugs** across all 4 revisions. But CI settled RED: a **pre-existing, untouched** test `tests/bugs/gh-9931.slang.1` (`computeMainNV`) hard-failed compile (`result code = -1`) deterministically on macOS + Linux release aarch64 (`-target spirv-asm` = host-independent), surviving retry.

## Root cause
The test does `outputByteBuffer.Store<DescriptorHandle<Texture2D<float4>>>(4, h, 8)` — a compile-time-constant location 4 with alignment promise 8, and `4 % 8 != 0`. The **old** `isAligned` predicate never checked location-vs-promise contradiction (it only tested `(offset+imm) % accessSize`), so this compiled fine and silently scalarized. The **new** E41303 (added *in this very diff*) rejects it as a hard error. The PR did not update the pre-existing test, so it broke the build. This is the exact class of #12130 (Metal fmod token-count broke untouched math-vector.slang) and #12122 (new E00046 rejection false-positived on valid pre-existing cmdlines).

## How to catch it
When a PR **adds or tightens a diagnostic/validation** (new `err(...)` in slang-diagnostics.lua, a new `validate*` call, a stricter predicate), its blast radius is NOT limited to the files it touches — it includes **every pre-existing test that exercises the newly-restricted input shape**. On the **Devin-only tier this is invisible to the review**: Devin does not run the test suite, and the eligibility clauses' `ci_green` is waived under v0-shadow-relaxed. The challenger's CI-settle gate is the ONLY catch. Procedure that worked:
1. After clauses+Devin pass, if the PR adds/tightens a hard-error, do NOT record on incomplete CI — WAIT for build+test-slang jobs to settle at the pinned head.
2. On any `test-slang` FAILURE, pull the failing job log, find the failing sub-test, and check whether it's (a) one of the PR's own new tests or (b) a pre-existing untouched test (`gh pr diff --name-only` — absent ⇒ pre-existing). A pre-existing test breaking is a strong RED signal.
3. Confirm PR-causality vs flaky/infra: deterministic across retry + host-independent target (spirv-asm) + mechanism traced to the exact new diagnostic + old code had no such path ⇒ airtight PR-caused. (Contrast #12123: aarch64-only infra red on an unrelated check = non-blocker.)

## Fix (verdict)
BLOCK (RED_BUG). A new hard-error that breaks a pre-existing untouched test the PR didn't update is a definite build break on master post-merge. The author must either update the test to a conforming input, or reconsider whether the new diagnostic should fire for that shape.

## Meta
Devin's own info line evolved across revisions from silence to "New E41304 warning fires for below-base explicit alignments; **check for unmodified tests**" — a hint, but it still reported 0 bugs because it doesn't execute. Never let a Devin-only "0 bugs" round up past a red CI on a diagnostic-adding PR.
