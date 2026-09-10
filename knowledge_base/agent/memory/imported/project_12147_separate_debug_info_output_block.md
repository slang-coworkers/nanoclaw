---
name: project-12147-separate-debug-info-output-block
description: "#12147 separate-debug-info-output path — approver BLOCK (RED_BUG); production bot review public with same finding"
metadata: 
  node_type: memory
  type: project
  originSessionId: a2875699-eccc-4d9e-b3b0-66d268b683b5
---

shader-slang/slang PR **#12147** "Add explicit separate debug info output path" by **jkwak-work** (maintainer), ready_for_review 2026-07-17.

**Approver arc: R1/R2/R3 BLOCK → R4 WOULD_APPROVE → R5 ABSTAIN_POLICY** — all recorded to shadow ledger (approver never posts). **R5 @`74147f95` is the operative row to score against jkwak's human verdict.**
- R1 @`0f1d40ce` BLOCK; R2 @`6b10452e` BLOCK (only fixed :698 collision gap, assert untouched); R3 @`0b1fde0f` BLOCK (assert change comment-only, byte-identical); R4 @`05d07c5b` WOULD_APPROVE (bug FIXED); **R5 @`74147f95` ABSTAIN_POLICY (CHALLENGER_CONCERN).**

**R5 "Simplify separate debug output validation" (1 commit ahead of R4, 0 behind; touches `slang-end-to-end-request.cpp`+`.h`):**
- **R4 fix SURVIVES:** E00114 graceful diagnostic byte-identical at R5:769-774 (not a reverted RELEASE_ASSERT); regression test `_testSeparateDebugInfoOutputRejectsMultipleArtifacts` untouched, still exercises the multi-target trigger.
- **NEW regression the simplify introduced (why ABSTAIN not clean-approve):** reverting R4's `OutputDestination` abstraction to plain-string comparison collapsed the stdout-vs-file distinction for `-`. `-separate-debug-info-output -` (debug→stdout) alongside `-coverage-manifest-output -` / `-depfile -` (→ file literally named `-`) now spuriously fires **E00111** where R4 correctly allowed them. Source-verified (`_writeArtifact:462` sends debug `-` to stdout; `_getExplicitCoverageManifestPath:477`+`File::writeAllBytes` write coverage `-` as file). False-POSITIVE on pathological dual-`-` trigger; bot-missed; CI-invisible. NO false-negative/silent-overwrite path (that's what kept it off BLOCK).
- **Process win:** challenger FIRST cleared it wrong ("symmetric normalization ⇒ no asymmetry"); DECISION_REVIEW critique gate caught it → downgrade WOULD_APPROVE→ABSTAIN. Devin's :766 flag stale again (fresh-push pattern).

**TERMINAL: MERGED @R5 2026-07-18 14:49Z by jkwak-work — AUTHOR SELF-MERGE.** Merged at exact R5 head `74147f95` (mergeCommit `2eb65582`), NO R6. Independently verified: **0 independent APPROVED reviews** (all human reviews are jkwak's own COMMENTED). Approver stamped `record_human_verdict(#12147, 74147f95, APPROVED)` against R5 row.
- **Approver R5 ABSTAIN vindicated both directions:** the E00111 dual-`-` false-positive shipped UNCHANGED (flagging it was right) AND was correctly not a shipping-blocker (not-BLOCKing was right). Approver self-corrected a join-learning that over-read the merge as maintainer judging the concern benign → self-merge w/ 0 independent APPROVED is a WEAK signal, not a second human refuting the concern.

**SURFACE DECISION (Main's loop) — HELD, not posted; trigger fired but merge beat it (self-merge ~2h after 12:54Z R5 bot review).** The verified E00111 dual-`-` false-positive is now LIVE in master with no public flag. Deliberately NOT reflexively surfacing post-merge because: (1) source-verified NOT build-confirmed — my discipline is build-confirm before any public claim contradicting a maintainer's merged code (R3 precedent: build-confirm changed the framing); (2) mild + SAFE error direction — a false-POSITIVE (spurious over-rejection) on a pathological trigger (output file literally named `-` while debug→stdout `-`), no crash/silent-overwrite/false-negative; a full reviewer build cycle is disproportionate to a pathological safe-direction over-rejection no real workflow hits. **Re-surface trigger:** if a real user reports the E00111 false-positive, OR jkwak touches this validator again in a follow-up PR (he owns+actively works this debug-info area — see [[project_11983_spirv_debugfunction_wrong_cu]], #12148, #12150), build-confirm then and raise it as a low-pri follow-up. Preserved internally so it's not lost; not posted unverified.

**Approver learning filed:** a "simplify" refactor can preserve the headline fix while silently regressing a sibling correctness distinction — diff the removed abstraction's semantics, not just the target fix.

**R4 FIX (verified by approver, head re-confirmed `05d07c5b` no-drift, artifacts present on PR):** jkwak replaced the RELEASE_ASSERT with a graceful diagnostic. `debugArtifactCount > 1` now returns `SLANG_FAIL` with new **E00114** (`slang-end-to-end-request.cpp:798-803`). Counting/producer path byte-identical to R3 (multi-target ≥2-EP no-`-o` still reaches count≥2) but now diagnoses instead of aborting — fix at the correct preflight-validator layer, mirroring the sibling coverage validator. Added `_testSeparateDebugInfoOutputRejectsMultipleArtifacts` reproducing the EXACT R3 multi-target trigger, asserting clean E00114 — closes the R1–R3 CI-invisibility gap. Devin's :766 flag at R4 was STALE (reviewed pre-fix ~5 min post-push); head-current bot 🟡 0-bugs + approver source read override it. 6/6 clauses PASS, both critique gates approved.

**Bug:** `_validateSeparateDebugInfoOutputPaths` (`source/slang/slang-end-to-end-request.cpp:766`) uses `SLANG_RELEASE_ASSERT(debugArtifactCount == 1)`, which aborts slangc. Its parallel coverage validator handles the identical "2+ artifacts" case with a graceful diagnostic — the asymmetry is the tell. CI-invisible: new tests only cover single-entry / whole-program.

**R3 trigger — BUILD-CONFIRMED (slang-reviewer, 07-18 @ built `2026.13.1-32-g0b1fde0f`, deterministic 3/3):** abort is a HARD ICE, not graceful — `error[E99997] ... InternalError ... assert failure: slang-end-to-end-request.cpp(766): debugArtifactCount == 1`, exit 255.
- **Precise trigger matrix:** ≥2 `-target`s + ≥2 entry points + no per-target `-o` for the SPIR-V target. Repro: `slangc multi.slang -target spirv -target glsl -entry mainA -stage compute -entry mainB -stage compute -g2 -emit-spirv-directly -separate-debug-info -separate-debug-info-output dbg.spv`. Single-target (any EP count) = OK; multi-target 1-EP = OK; multi-target + explicit `-o` = OK.
- **Why the dismissals missed it:** whole-program is forced only when a rawOutput is matched to the SPIRV target (`slang-options.cpp:4672`), and the sole auto-synthesizer of that rawOutput (`:4566`) is gated on `getCount()==1`. A second target skips it → SPIRV demotes to per-EP → 2 EPs = count==2. jkwak tested single-target (correct there); the bot's 🟡 re-checked `spirv+spirv-asm` but held EP count at 1 (with 2 EPs that ALSO aborts). Reviewer finding is **additive** to the bot, not a contradiction — resolves the maintainer-conflict concern.
- **Suggested fix (in the posted review):** replace RELEASE_ASSERT with a graceful diagnostic mirroring the sibling coverage validator `_validateCoverageManifestOutputPaths` (already does this for `count > 1` at `:838`).

**Observability RESTORED:** slang-reviewer posted ONE COMMENT-state review (id **4727233731**, pinned to `0b1fde0f`, no drift) — https://github.com/shader-slang/slang/pull/12147#pullrequestreview-4727233731. The R3 bot signal had flipped 🔴(R1/R2)→🟡(R3), so the multi-target BLOCK was invisible until this post. Verify-before-public-override-of-maintainer succeeded: built + repro'd BEFORE posting. See [[feedback_approver_never_posts_route_reviewer]], [[feedback_verify_branch_in_env_where_it_fires]].

**Observability SATISFIED without approver posting:** production `github-actions[bot]` (claude-code-action) posted a PUBLIC COMMENT-state review at 2026-07-17T19:11:36Z — `🔴 Has issues — 1 bug, 3 gaps` — headline names the exact same `slang-end-to-end-request.cpp:738` release-assert bug + a 2nd 🟡 gap (`:698` collision set skips non-debug-bearing artifacts → explicit debug path can silently overwrite another target's output). So the BLOCK's substance is already visible to the author on the PR; no slang-reviewer re-post needed (would duplicate the production bot).

**Correct on the source-verified read:** ABI enum-append (`SeparateDebugInfoOutput = 156` before `CountOf`), `buildHash` cache-key skip-list addition (locked by new unit test), docs already regenerated (pre-empts check-cmdline-ref staleness).

**Process win:** production review bot took ~34 min; approver held on exit-22 timing race rather than falling to Devin-only — Devin itself timed out (exit 3), so a Devin-only fallback would have been a false `ABSTAIN_INFRA:NO_REVIEW_SIGNAL` instead of a clean BLOCK. See [[feedback_approver_never_posts_route_reviewer]].

**Next-action:** author (jkwak-work) owns the fix — he sees the public 🔴 on his own PR. Chain resolved; re-open on substantive follow-up.
