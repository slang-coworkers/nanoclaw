---
name: project_12181_debug_info_include_source_flag
description: "#12181 new CLI arg -debug-info-include-source — RE-OPENED, held for jkwak design call"
metadata: 
  node_type: memory
  type: project
  originSessionId: 8867d2d3-8352-4103-bb95-c3d97312a6b4
---

# #12181 — Add CLI arg `-debug-info-include-source`

Maintainer **jkwak-work** (MEMBER) filed AND self-assigned; **no "make a PR" ask** → per no-autofixer-on-self-filed convention, **PARKED at triaged**, fixer NOT dispatched. Verdict posted as issue comment **5038880083**.

**Ask:** embed shader source *text* in SPIR-V independently of `-g` level. Empirically @HEAD cbabb7bde: `-g0` none · `-g1` filename+line only (the gap) · `-g2/-g3` full source. Also wants source at `-g0` when flag explicitly set.

**Classification:** feature/enhancement · low · P3 · SPIR-V debug-info emit + CLI options + public ABI. `pr: non-breaking` (append-only enum).

**Recommended solution (triager memo):** new orthogonal bool flag `CompilerOptionName::DebugInfoIncludeSource=157`, mirror `-separate-debug-info` pattern. KEY: "embed source?" decision is DUPLICATED across two level-keyed layers — producer `slang-lower-to-ir.cpp:15425-15436` (g0 = no IRDebugSource; g1 = empty content) AND consumer `slang-emit-spirv.cpp:2164`. Emit-only one-liner insufficient; must thread flag through BOTH. Open unknown: g0-with-flag spirv-val well-formedness (needs NonSemantic ext + minimal DebugCompilationUnit scaffolding absent at g0).

**Files:** include/slang.h:1239-1249 · source/slang/slang-options.cpp:950/4017 · source/slang/slang-lower-to-ir.cpp:15425 · source/slang/slang-emit-spirv.cpp:2164

**Cluster:** SPIR-V debug-info — [[project_12147_separate_debug_info_output_block]] (mirrors that flag pattern), [[project_12148...]]/DebugFunction CU, [[project_11682_g0_spirv_debug_info_scope_fork]] (-g0 scope).

## RE-OPEN (07-22) — jkwak design question, answered with spirv-asm receipts
jkwak commented (**5040455960**, real `@nv-slang-test` mention): does embedding source require `SPV_KHR_non_semantic_info`? If so, `-g0`+new-option should **error**.

Triager posted verified reply (**5040498822**):
- **YES as Slang emits today:** embedded source binds to module *only* via NonSemantic `DebugSource` (`%1 OpString "<src>"` → `OpExtInst … DebugSource`), needs `SPV_KHR_non_semantic_info`. Core `OpSource Slang 1` carries language+version only (emit site `slang-emit-spirv.cpp:12083`).
- **Broader than his -g0 framing:** `-g1` today emits ZERO extensions (core OpSource + OpLine), so the option pulls the ext into `-g1` too — property of *how we embed*, not the debug level.
- **Key correction:** SPIR-V spec gives core `OpSource` *optional* File+Source operands (+`OpSourceContinued`) → source CAN embed with no ext; Slang just doesn't wire that path. Ext dependency is an **implementation choice, not spec necessity.**
- **-g0 options (maintainer's call):** (a) **error** on -g0+option — cleanest but contradicts his original "embed at -g0" note (tension surfaced); (b) implicit NonSemantic scaffolding+ext at -g0 — avoid; (c) embed via core OpSource Source operand (no ext) — only way -g0 stays minimal AND source-carrying, larger change. **Recommended (a)** if OK reversing note, else (c).

## DECISION (07-22, comment 5048509806) — jkwak picked hybrid (a)+(c); FIXER DISPATCH AUTHORIZED
jkwak's exact spec:
1. `-g0` + `-debug-info-include-source` → **error** (conflicting request). [= option (a)]
2. `-gX` X≥2 → keep current behavior (source via NonSemantic); new option **effectively ignored** (source already emitted).
3. `-g1` + option → emit source with **core `OpSource` syntax** so it does NOT rely on NonSemantic, even when final SPIR-V may still use NonSemantic elsewhere. [= option (c), scoped to -g1]

**Orch authorized fixer dispatch** (concrete maintainer spec = sanctioned go-ahead). Triager dispatches slang-fixer on canonical thread. Implementation notes (from triager memo): new flag `CompilerOptionName::DebugInfoIncludeSource=157` (append-only, non-breaking); thread through BOTH producer `slang-lower-to-ir.cpp:15425` + consumer `slang-emit-spirv.cpp:2164`; the -g1 case needs the currently-unwired **core OpSource File+Source operand path** (+`OpSourceContinued`), NOT the NonSemantic DebugSource path. Core OpSource emit site `slang-emit-spirv.cpp:12083`.

**Guardrails:** drafts-only (fixer produces DRAFT PR, holds; no ready-flip/merge without operator gate); fixer MUST call `report_pr_created`; PR desc carries 5-bullet + `Fixes #12181`; draft-held ⇒ triager/fixer ALSO posts 5-bullet on issue (draft-held PR requires issue comment).

**State:** OPEN, fixer dispatch in flight.

## 07-22 status-share + fixer-idle blocker
- jkwak asked for update on issue (comment 5052591363, `@nv-slang-bot`). Triager posted honest in-flight status (**5052618172**): design locked to 3-part spec; fix implemented across 4 layers (flag 157, -g0 error, producer content-carry, consumer core-OpSource reusing DebugSource OpString); building/validating locally; 3 behavior checks pending; draft PR to follow. Verified NO PR up yet (gh search empty) → did NOT overpromise.
- **False-blocker RESOLVED:** fixer looked idle (build-shell reaped w/o BUILD_EXIT echo) but session was alive + progressing. Orch decision was nudge-not-restart; triager confirmed healthy before any restart. **DO NOT restart** (would lose built worktree).
- **Build FINISHED 1182/1182; all 3 behaviors verified on real binary:** (1) -g0+opt → error **E57007**; (2) -g1+opt → core `OpSource` w/ embedded source, File-id reuses filename OpString (no dup), zero NonSemantic dep for source; (3) plain -g1 byte-unchanged, -g2 keeps NonSemantic.
- **Remaining pre-PR:** slang-test + FileCheck self-match immunity + formatting + codex CODE_REVIEW → draft PR + report_pr_created. Triager edits status comment 5052618172 in place when PR# lands, forwards [Triage Resolution]. Status comment accurate; no GitHub re-post until draft PR up.

## 07-23 — DRAFT PR #12202 UP + independently verified
- **PR #12202** DRAFT/OPEN, branch `fix/issue-12181`→master, `closingIssuesReferences=[12181]` (Fixes real), labels `pr: non-breaking` + `pr: new feature`. `report_pr_created` fired (webhooks route to fixer). codex PLAN+CODE+OUTPUT approved.
- **Files match 3-part spec exactly:** `include/slang.h` +7 (flag `DebugInfoIncludeSource`) · `slang-diagnostics.lua` +6 (**E57007** g0-conflict error) · `slang-emit-spirv.cpp` +86 (core-`OpSource` File+Source path) · `slang-lower-to-ir.cpp` +8 (producer content-carry at g1) · `slang-options.cpp` +19 (CLI wiring) · +5 regression tests (g0/g1/g2/continued-overflow/utf8-boundary).
- jkwak status comment **5052618172** edited in place → "held in draft PR #12202" (visibility gap closed).
- **State:** OPEN, held in draft. Fixer dispatching peer review to slang-reviewer, then formal [Fix Report] → triager forwards [Triage Resolution]. **Merge = maintainer + OPERATOR-gated** (drafts-only; no ready-flip/merge without operator gate). Await jkwak review of #12202.

## 07-23 23:53Z — jkwak DESIGN CHANGE applied: emit ALL sources; head `ca5a4518f0b638`, CI running NOT yet green
- **jkwak review (design, not just nits):** questioned emitting only the primary source — "shouldn't we include all sources? … we shouldn't try to find an alternative source at all — doesn't match -g2/-g3." Fixer agreed + verified g2/g3 emit one NonSemantic DebugSource per file (incl `#include`'d). **Redesign:** `emitSource` now iterates EVERY `IRDebugSource` and emits one core `OpSource` (File+Source +OpSourceContinued) per file with content — **removes the m_defaultDebugSource / first-find / fallback logic entirely** (simpler, matches g2/g3). Multiple `OpSource` is valid SPIR-V (verified `SLANG_RUN_SPIRV_VALIDATION=1`). +trimmed 3 comments per terse-comment nits.
- Rebased to ToT (picked up merged #12170). Fixer local: all 7 tests pass under both Slang+Unknown envs; SPIR-V-validated; clang-format clean; codex OUTPUT_REVIEW re-approved; replied to jkwak's 2 threads; PR body refreshed.
- **Main verified push landed BY BRANCH** (head `ca5a4518f0b638aeed0e4149bb876ca6840ab5c8`) + **CI queued 23:51:14Z on that head** (14 runs). **Verdict NOT in hand — CI in flight** ([[feedback_never_relay_a_verdict_not_in_hand]]). This is now a slightly larger diff (removed fallback path) → the earlier CRLF/eol=lf fix + aarch64 env-token fix carry forward on the rebased tree. Resume trigger: fixer CI-green report, CI red, or further jkwak/csyonghe review. Merge operator-gated.

## 07-23 22:27Z — FIX PUSHED head `4d26ce93f877` (verified on branch); CI running, NOT yet green
- Fixer pushed both jkwak asks in one commit: (1) **rebase-to-ToT** (includes merged #12201 — which also made `DebugInfoLevel::None` the explicit default, consistent w/ behavior-1; doc regen no-diff); (2) **CRLF fix** `eol=lf` in `.gitattributes` on the utf8-boundary fixture. Fixer local-verified: CRLF copy reproduces exact `:977:15` failure, LF passes; all 7 test files pass on rebased tree; build clean; codex OUTPUT_REVIEW re-approved (declined a doc-trailing-space must-fix with evidence — required generated output `check-cmdline-ref` diffs against; codex agreed).
- **Main verified push landed BY BRANCH** (head `4d26ce93f877ce60ed5e4519097ed5a14082823b`, not just reported SHA) + **CI queued 22:26:12Z on that head** (9 runs registered). **Verdict NOT in hand — CI in flight; hold fleet-learning until green** ([[feedback_never_relay_a_verdict_not_in_hand]]).
- **NEW: `csyonghe` requested as reviewer** on #12202 (in `requested_reviewers`) — 2nd reviewer beyond jkwak. Chain still awaits formal approve + merge (operator-gated). Resume trigger: fixer's CI-green report, CI red again, or csyonghe review.

## 07-23 22:12Z — ROOT-CAUSED (CRLF, not platform emit); fix APPLIED, await CI-green
- **Fixer root cause (+ jkwak flagged same):** **CRLF checkout on Windows**, NOT platform-dependent emit. The `.slang` fixture has no `eol` git-attribute → Windows runner checks it out CRLF; the test byte-positions a 2-byte code point (`é`) to straddle the 65535-byte SPIR-V string-split EXACTLY, and the ~977 `\n`→`\r\n` conversions above the marker push `é` ~977 bytes past 65535 → lands in `OpSource` head instead of at the `OpSourceContinued` boundary → `CHECK-DAG: OpSourceContinued "é` misses. (Consistent with log's `actual-output:1:1 scanning from here` + "possible intended match" at a comment line.)
- **Fix APPLIED (not yet verified green):** pinned the byte-exact fixture to LF in `.gitattributes` — `tests/spirv/debug-info-include-source-utf8-boundary.slang text eol=lf` (matches existing `*.sh text eol=lf` precedent → identical byte layout all platforms). Folded into the rebase-to-ToT jkwak asked for (**includes #12201 — scope-flag RESOLVED:** #12201 confirmed MERGED 22:06:40Z commit `b629210213`, so picking it up in a rebase-to-ToT is legit, NOT a scope-merge of an unmerged PR). RHI/`computeTrivialVulkan` reds = separate device-flakes, cleared.
- **State:** fixer rebuilding + re-running CI, will report when green. **Verdict NOT in hand — root cause ≠ verified fix** (hold per [[feedback_never_relay_a_verdict_not_in_hand]]). Fleet-learning candidate (byte-exact fixtures need `eol=lf` on Windows) HELD until CI-green. Resume trigger: fixer's green report OR CI comes back red again. No re-nudge.

## 07-23 22:10Z — REAL x86_64 Windows-CL test failure (NOT a flake; fixer's 19:50Z "infra flake" read was WRONG)
- **Verified from post-rerun job log (run 30033260546 `run_attempt=2`, head `7367c4d2c7`, jobs 89315937458 debug / 89315937625 release):** `FAILED test: 'tests/spirv/debug-info-include-source-utf8-boundary.slang'` — the PR's OWN new test — `CHECK-DAG: expected string not found in input` at `utf8-boundary.slang:977:15`. Log shows `failed(pending retry)` → retried → still `FAILED` = **reproduces on retry, NOT a flake.** Final tally `99% of tests passed (11313/11314)` = exactly **1 real test failure**, not the "11319/0-failed harness infra" the fixer reported at 19:50Z (that was an earlier/different run, or misread). Fails on BOTH `test-windows-debug-cl-x86_64-gpu` + `test-windows-release-cl-x86_64-gpu`; check-ci derivative.
- **Distinct from the 18:21Z aarch64 env-token issue (that was fixed).** This is **x86_64 Windows-CL specific** on the utf8-boundary case → a different, real bug (platform-dependent UTF-8 boundary emit OR a too-strict CHECK-DAG on Windows). Babysitter flagged it (msg 44) as PR-owned FileCheck mismatch on its own test, correctly NOT a rerun class; fixer must fix.
- **Routing:** corrected the fixer on canonical thread with the log receipts (its 19:50Z flake-classification on the 3 Windows reds was wrong for the test-slang pair — the SPIR-V/RHI-harness reasoning doesn't hold when its OWN utf8-boundary test deterministically fails). Fixer owns #12202 webhook/CI. State: `REVIEW_REQUIRED`/`BEHIND`, real red on head. Chain ACTIVE — await fixer root-cause+fix.

## 07-23 18:21Z — aarch64 failures ROOT-CAUSED + FIXED (env-token, NOT golden-shift); head 7367c4d2c7
- **Fixer root cause (verified, head confirmed `7367c4d2c7`):** NOT platform-dependent emit, NOT a golden-shift on the PR's own tests (the babysitter's + my 18:10Z framing was wrong). It's an **env-dependent disassembly token** — aarch64 CI `test-slang` jobs export `SLANG_USE_SPV_SOURCE_LANGUAGE_UNKNOWN=1` (swiftshader workaround, `ci-slang-test.yml:124/236`); x86_64 jobs don't. So `OpSource` disassembles as `OpSource Unknown 1 …` on aarch64 vs `OpSource Slang 1 …` on x86_64; the new tests' CHECK lines hardcoded `Slang`.
- **Fix (test-only, 5 CHECK lines g1/g2/continued/utf8/include):** `OpSource {{Slang|Unknown}} 1 …`. Fixer reproduced the exact aarch64 failure locally via the env var, verified all 7 test files pass under BOTH `Slang` (default) and `Unknown` (aarch64-sim). No source/C++ change → behavior identical; pattern-relax only. Fixer saved the signature as a fleet learning (deterministic + aarch64-only + all test-slang + x86_64-green = env token, not arch bug).
- **State:** back to `REVIEW_REQUIRED`/BLOCKED awaiting jkwak review+merge (merge OPERATOR-gated). Fixer watching CI re-run on new head; "nothing needs routing." Chain rests with fixer.

## 07-23 18:10Z — BACK IN ITERATION: new head + 4 aarch64 test-slang failures (memory corrected)
- **State moved off "review-clean/await merge."** Fixer force-pushed/squashed head `9daad58f9c → 90e4b5fa14` at 17:38:30Z (single commit "Add -debug-info-include-source to embed source in SPIR-V at -g1"; likely folding jkwak's inline rename `emitCoreOpSource`→`emitOpSource` + review items). PR now `REVIEW_REQUIRED` / `mergeStateStatus=BLOCKED`.
- **CI babysitter 18:05Z flagged (verified):** 4 deterministic `test-slang` failures on the new head — `test-macos-debug-clang-aarch64`, `test-macos-release-clang-aarch64`, `test-linux-debug-gcc-aarch64`, `test-linux-release-gcc-aarch64`. x86_64 all green (19 pass), 11 checks still pending. Babysitter classified as **aarch64 golden/CHECK mismatch on the PR's OWN new `debug-info-include-source-*.slang` tests → owned/in-fix, NOT a rerun class** (rerun can't clear a shifted golden). aarch64-specific SPIR-V debug-info output CHECK diffs are a known class on this repo.
- **Routing:** fixer owns the #12202 webhook session + CI watch (report_pr_created fired). Surfaced the 4 failing jobs to slang-fixer on canonical thread as a light confirm (NOT re-dispatch, NOT restart — fixer just pushed, mid-iteration). Fixer decides: update CHECKs / fix platform-dependent output. **Chain is ACTIVE-ITERATION, not resting.** Await fixer.

## 07-23 [Triage Resolution] — FIXED, review-clean, awaiting maintainer merge (SUPERSEDED by 18:10Z entry above — new head reopened CI)
- **#12202 NON-DRAFT/OPEN** @head 9daad58f9c, MERGEABLE, `Closes #12181`. **jkwak-work flipped it ready HIMSELF** (ReadyForReviewEvent actor=jkwak 16:37Z, NOT bot → drafts-only guardrail HELD, fixer never flipped/merged). `reviewDecision=REVIEW_REQUIRED` / `mergeStateStatus=BLOCKED` = awaiting jkwak's formal CODEOWNERS approve + merge.
- **Review addressed:** slang-reviewer REQUEST_CHANGES → fully resolved. Reviewer A 1 bug (UTF-8 forward-progress hang +regression test) + 5 gaps (2nd IRDebugSource producer / non-SPIR-V target scope → new **E00021** warning / chunking dedup / test coverage / help wording); Reviewer C 11 clarity items; Devin clean; codex PLAN+CODE+OUTPUT re-approved. jkwak inline: helper rename `emitCoreOpSource`→`emitOpSource`. Real `check-formatting` CI red root-caused (ephemeral clang-format no-op'd earlier runs) + fixed.
- **Tests:** 7 `tests/spirv/debug-info-include-source-*` pass (g0-error/g1-core-OpSource/g2-no-op/continued-overflow/utf8-boundary/+[shader]/#include/-g3); SPIR-V-validated; revert-drill each meaningful; full CI matrix running.
- **Next human action:** jkwak formal review + merge (approval ≠ merge-auth; neither triager nor fixer merges). Issue status comment 5052618172 stays "held in draft", triager refreshes → "merged" at close-out (merge = refresh trigger). Fixer owns webhook session + CI watch / further review comments. **Chain rests awaiting maintainer merge.**

## 07-23 aarch64 test-slang CI red — root-caused + fixed by fixer autonomously (test-only)
- **Root cause:** env-dependent `OpSource` disassembly token — aarch64 CI sets `SLANG_USE_SPV_SOURCE_LANGUAGE_UNKNOWN=1` → OpSource emits `Unknown` vs `Slang` elsewhere. Behavior identical; only the FileCheck expectation differed.
- **Fix:** test-only `{{Slang|Unknown}}` FileCheck pattern, pushed **7367c4d2c7**, verified locally under both env settings, CI re-running. NOT a code-behavior change.
- Transient/resolved, NOT escalation-worthy — fixer-owned CI handling. Escalation trigger = aarch64 re-run comes back RED again (genuine/unresolved).
