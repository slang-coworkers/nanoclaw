---
name: project-12220-debugentrypoint-cmdline-options-glevel
description: "#12220 SPIR-V DebugEntryPoint cmdline omits options + misreports -g level; P3 metadata; PARKED-at-triaged (pdeayton owns family)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0ae21c89-e125-4e07-9f11-c77bed5e326c
---

# #12220 — SPIR-V DebugEntryPoint command-line string wrong

**Filed** 2026-07-24 by **pdeayton-nv** (member; self-filed, NOT self-assigned). shader-slang/slang.

`NonSemantic.Shader.DebugInfo.100` `DebugEntryPoint` synthesizes a command-line-args OpString that (a) **misreports debug level** (`-g2` for a `-g3` compile) and (b) **drops supplied options** (`-lang`, `-profile`, `-gdwarf`, `-minimum-slang-optimization`, `-line-directive-mode`). Metadata-accuracy only — reporter confirms it does NOT change the options used for the actual compilation.

**Class:** bug / **low / P3** / target-emit (SPIR-V) + shared CompilerOptionSet serializer. Reproduced @HEAD `5281ccc66` (byte-for-byte).

**Two roots (triager-found, verify before fixing):**
1. Hardcoded `sb << " -g2";` at `slang-emit-spirv.cpp:3968` — never reads `getDebugInfoLevel()` (which exists).
2. `writeCommandLineArgs` (`slang-compiler-options.cpp:44-180`) is a switch with **no default** → unlisted option kinds silently skipped. Serializer shared with CPU/LLVM path (`slang-emit-llvm.cpp:726`); module-cache hashing uses separate `buildHash`, so a fix won't disturb digests. Prior art: #6108/PR#6114 touched this same fn.

**Fix (Approach A):** serialize the missing options incl `-g<level>`+`-gdwarf`; delete the emit-site `-g2`.

**State:** **DRAFT PR #12243 → APPROVE_WITH_NITS, back with fixer for nit-fixes** (07-27). Fixer implemented Approach A, opened draft PR #12243 (`fix/issue-12220` @ `4e81212f76`, base master `f282bdf9c0`). Both guardrails confirmed: `report_pr_created` called (PR mapped to fixer session; future webhooks route there), issue #12220 carries 5-bullet footprint (comment 5097519068). Ack to pdeayton = comment 5096950677. CI webhook = benign draft workflow_dispatch priority-yield ([[project_bot_pr_priority_yield_red_run]]).

**Review (3-reviewer, relayed via Main — fixer lacks direct reviewer edge, #12231 strand):** **APPROVE_WITH_NITS**, 0 bugs / 2 gaps / 0 questions, diff_hash `c2a2ae77bd6b`. A(correctness)=0 bugs/2 test gaps; B(Devin)=clean; C(clarity)=6 advisory (1 notable). Fix judged correct; blast-radius re-verified from source (`buildHash` bypasses `writeCommandLineArgs`; LLVM/CPU caller descriptive-only; `DebugInformationFormat` closed enum). Report file `combined-review-12243.md` (from `inbox/a2a-1785193904257-m3cg1r/`) relayed to fixer on thread w/ `in_reply_to=30`. **Nits to address:** FG002 (format-read nested in level case violates producer invariant — assert or decouple; the one to act on), C002 (unstated `writeCommandLineArgs` contract + inconsistent default-guards), test-robustness (unanchored `CHECK_ALL-NOT: -g2` scans to EOF → false-fail on embedded source; `-SAME` chain pins incidental insertion order), FG001/FG003 comment nits. Awaiting fixer's pushed fixes + updated 5-bullet. **Merge/ready OPERATOR-gated** (human marks ready & merges, not bot).

NOTE on thread routing: fixer thread has multiple unresponded inbounds → sends must carry explicit `in_reply_to=<seq>` (host refuses bare thread send).

**SCOPE EXPANSION (07-27, maintainer-directed):** pdeayton-nv commented on PR (comment 5097961143) asking for MORE than the nits — a **systematic audit of all 158 `CompilerOptionName` values**: classify each (Serialize / RepresentedElsewhere / Omit), update serializer, add enforcement so new options can't be silently skipped (systematic form of Reviewer C's C001). Fixer acked on-PR (5097994294). **Main authorized PROCEED** (07-27; legit maintainer redirect on own PR; safety nets hold): guardrails = enforcement mechanism MUST land; conservative judgment calls → documented-omission over guessed serialization + classification table in PR body for pdeayton; LLVM/CPU path stays descriptive-only; **fresh re-review required on push**.

**EXPANDED DIFF PUSHED + FRESH RE-REVIEW #2 DISPATCHED (07-28):** head `8efc9c0c3f`, 7 files ~+473/−11 (was +62/−1). Implemented: `classifyCommandLineOption()` (all 158 values, split 77 Serialize/4/78 per PR body), `writeCommandLineArgs` rewrite, exhaustiveness unit test `commandLineOptionClassificationIsExhaustive` (runtime CountOf-keyed — repo builds `-Wno-switch` so no compile tripwire), FG002 (format own case), C002 (contract+guards), FG001/FG003, test-anchoring, + 2 direct C++ tests on `writeCommandLineArgs` (FG002 round-trip + `-g2` negative). **codex caught REAL classification bugs, not nits** (12 rounds): EmitSpirvMethod/EmitCPUMethod serialization gap (both bool + derived key marked RepresentedElsewhere → nothing emitted; now enum→flag); artifact-affecting bools wrongly OMIT (NoMangle, No-HLSL-binding/packing, LoopInversion, TrackLiveness, EnableExperimentalPasses, EmbedDownstreamIR, LLVM triple/cpu/features, AllowGLSL, PassThrough) → moved Serialize. Prior APPROVE_WITH_NITS (`c2a2ae77bd6b`) **SUPERSEDED**. Fresh review relayed to slang-reviewer (focus: judgment-call boundary, EmitSpirvMethod/CPUMethod, wider LLVM/CPU blast radius, enforcement-test actually enforces). Awaiting verdict #2 → relay to fixer. Merge/ready OPERATOR-gated (pdeayton).

**Fix refinement over triage:** `-gdwarf` is a *separate unregistered* option key (`DebugInformationFormat=112`), skipped by the loop's top guard → handled as sibling read inside the `DebugInformation` case, not its own case. Serializer reuses `TypeTextUtil` tables + `Profile::getName()`. Test = extended existing `tests/spirv/cmd-arg-debug-info.slang` (CHECK_ALL). Repro 2/2, debug-* 72/72, codex PLAN/CODE/OUTPUT approve.

History: DISPATCHED-TO-FIXER (07-24) — released when pdeayton-nv asked bot on-issue ("do you have a PR ready?", comment 5096907350), the recorded trigger. Sent with `<github-post-authorized />` (real bot mention), MODE=fix-issue.

History: TRIAGED + PARKED-at-triaged (Main ruling 07-24) → released same day. Verified 5-bullet posted (comment 5072896209), `reproduced` label + Issue Type=Bug set. pdeayton owns the SPIR-V debug-info family ([[project_12181_debug_info_include_source_flag]], #12202/#12148/#12150/#12219).

**Fixer briefing memo:** `triage-12220.md` (from triager, `inbox/a2a-1784916080618-5d46vb/triage-12220.md`) — sent to slang-fixer.

**Expected fixer output:** draft PR (drafts-only guardrail), `Fixes #12220`, `report_pr_created`, GitHub ack to pdeayton + 5-bullet on issue (draft-held → issue needs public footprint).

Related family: [[project_11983_spirv_debugfunction_wrong_cu]], [[project_12150_include_line_cu_scoping]].
