---
name: project-12220-debugentrypoint-cmdline-options-glevel
description: "#12220 SPIR-V DebugEntryPoint cmdline omits options + misreports -g level; P3 metadata; PR #12243 APPROVED by pdeayton + non-draft; mergeable-behind; bot HOLDING for human update-branch+merge"
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

**ROUND 2 — EXPANDED DIFF (07-28, later REVERTED):** head `8efc9c0c3f`, 7 files ~+473/−11. Implemented `classifyCommandLineOption()` (all 158 values, 77 Serialize/4/78), `writeCommandLineArgs` rewrite, exhaustiveness unit test (runtime CountOf-keyed — repo `-Wno-switch`), FG002/C002/FG001/FG003 nits, 2 direct C++ tests. codex caught REAL classification bugs (12 rounds): EmitSpirvMethod/EmitCPUMethod serialization gap; artifact-affecting bools wrongly OMIT (NoMangle etc.) → Serialize. Review #2 dispatched to slang-reviewer on `8efc9c0c3f`.

**ROUND 3 — MAINTAINER REVERTED THE ABSTRACTION (07-28, PR cmt 5109223575):** pdeayton-nv reversed his own scope expansion — asked fixer to **DROP `classifyCommandLineOption` entirely** (defer the serialization refactor + enforcement to a SEPARATE issue/PR), keep #12243 focused on the missing serializer cases + `-g2` fix, and fix **4 specific serializer bugs** he spotted. Fixer acked (5109256608), reverted locally: removed classifier + TU + exhaustiveness test + CMake; back to guard-style switch (`default: break`); kept #12220 cases + `-gdwarf`. **Diff shrank +473/−11 → ~+40/−274.** 4 bugs fixed: (1) VulkanBindShiftAll → `-fvk-<kind>-shift <shift> all` (was nonexistent `-fvk-all-shift`; dead-in-master, surfaced by refactor); (2) `-fvk-bind-globals` missing space (pre-existing LIVE in master); (3) TraceCoverageCounterByteWidth emits bits ×8 not bytes; (4) DownstreamArgs emits `-X` not `-x` (pre-existing LIVE in master).

**Main authorized PROCEED (07-28):** maintainer's call on own PR; tighter diff is better. Guardrails to fixer: regression coverage for ALL 4 fixes; re-confirm writeCommandLineArgs descriptive-only; file tracking issue for deferred classification/enforcement; fresh review #3 on new head.

**ROUND 3 PUSHED + REVIEW #3 DISPATCHED (07-28):** descoped head `d7d27009d4`, 4 files ~+240/−16. Classification abstraction removed (classifier fn + TU + exhaustiveness test + CMake), guard-switch restored (`default: break`); kept #12220 cases + `-gdwarf` own-case. 4 bugs fixed (VulkanBindShiftAll spelling, bind-globals space [LIVE master], coverage bits×8, downstream `-X` [LIVE master]). Tests: `tests/spirv/cmd-arg-debug-info.slang` now 4 variants (CHECK/CHECK_ALL/CHECK_VK/CHECK_XW) covering all 4 bugs; tests/spirv 541/541. codex CODE+OUTPUT approve (round 14). Body refreshed, maintainer acked (5109611664). Review #3 relayed to slang-reviewer on `d7d27009d4`; review #2 (`8efc9c0c3f`) + APPROVE_WITH_NITS (`c2a2ae77bd6b`) both SUPERSEDED. **2 guardrail items still open w/ fixer** (report crossed my msg in flight): (a) descriptive-only re-confirm for the 2 live-in-master bugs; (b) tracking issue for deferred classification/enforcement filed? Merge/ready OPERATOR-gated (pdeayton). Awaiting review #3 verdict + fixer's 2 confirms.

**07-28 later:** maintainer now engaging DIRECTLY via inline PR comments (healthy iterate mode; fixer handles on own webhook-driven session). Head advanced `d7d27009d4` → `3c3f26bc43` → **`8d70aa7b57`** across 3 COMMENT-ONLY nit rounds (pdeayton-dictated: (1) `default:` comment wording; (2) header contract-comment fix; (3) FG003 emit-site comment removed). **Substantive code (serializer cases + `-g2` fix + 4 bug fixes) UNCHANGED across all three heads** — only comments differ. Zero behavior change → did NOT re-dispatch review (debounce-on-churn [[feedback_debounce_pr_review_on_churn]]); review #3 findings on `d7d27009d4` remain valid at `8d70aa7b57`. Maintainer down to comment-cleanup polish → merge-readiness. When review #3 returns, apply to current head.

**✅ APPROVED (07-28) — TERMINAL-POSITIVE, awaiting human merge.** pdeayton-nv APPROVED PR #12243 at head `8d70aa7b57` (verified non-stale, approval commit_id==head, reviewDecision=APPROVED) and **flipped it non-draft himself**. Real `pull_request` CI now auto-runs (checks passing/pending). PR is **MERGEABLE but BEHIND master.** **Bot correctly HOLDING — no writes:** no push/rebase (would auto-dismiss approval), no merge/ready-toggle/manual-CI (human/operator actions). GitHub carries the approval = observability satisfied; no operator blast (pdeayton has merge rights, natural authority on own issue). **Human with merge rights must update-branch + merge.** Fixer holding, worktree kept (PR OPEN).

Review #3 (dispatched to slang-reviewer on `d7d27009d4`) may now be moot given maintainer's own APPROVED — but if it returns with a substantive serializer-logic finding, still worth surfacing to pdeayton on the PR (findings on the 4 bug-fix spellings would matter even post-approval). Low priority.

**Follow-up CLOSED (07-28):** deferred classification/enforcement work now tracked in **issue #12257** "Systematic CompilerOptionName serialization audit + exhaustiveness enforcement" — fixer filed it (neither pdeayton nor fixer had, despite the "separate issue" framing), captures `classifyCommandLineOption` approach + exhaustiveness-test idea, cross-linked from PR #12243 (comment 5110438422). Round-2 design win preserved.

**CHAIN CLOSED on our side (07-28).** #12220 APPROVED at head `8d70aa7b57`, non-draft, holding for human update-branch + merge (pdeayton). Follow-up #12257 filed. Nothing open. Fixer webhook-driven for merge/close event or real CI failure. Re-open only on a substantive new inbound.

**07-28 CI note (INFRA flake, fixer-owned):** a real pull_request failure landed on `build-windows-debug-cl-x86_64-gpu` — `actions/upload-artifact` step, `Insufficient disk space` on runner. Both changed TUs compiled clean (0 `error C####`). Fixer triaged infra→`gh run rerun --failed` (re-run only, no push/no branch mutation → approval NOT dismissed; within fixer's autonomous CI-triage authority, not an operator-gated write). Awaiting green on rerun; fixer re-surfaces only if it fails on real code.

**07-29 jkwak-work COMMENTED review (non-blocking; pdeayton APPROVE stands):** fixer answered both concerns from source on-thread (comments 5111751192 + 5111971246): ORDER (`-O0 -O2`) — serializer reads merged/effective option set not raw argv → emits `-O2`, non-issue; HASH — no hash consumes the serialized string (buildHash iterates options directly), non-issue. No PR code change. **⚠️ REAL FINDING surfaced (fixer's, source-traced NOT reproduced):** buildHash Int case hashes only `intValue`, NOT `intValue2` → multi-int binding options (VulkanBindGlobals set, VulkanBindShift/All, TraceCoverageBinding) can **alias distinct compiles in the shader-cache key** (VulkanBindGlobals.intValue2 feeds actual bindings). **Pre-existing buildHash bug (longstanding), NOT introduced by #12243.** = potential shader-cache CORRECTNESS bug (wrong cached artifact), different subsystem/severity than #12257 audit-cleanup. **Main directive (07-29):** don't bury as #12257 sub-bullet — give it correctness framing in its own issue (buildHash intValue2 omission, aliasing repro path) OR confirm maintainers want it on #12257 w/ correctness framing preserved; state as "appears to alias" (route slang-triager for severity, don't assert confirmed collision); keep OUT of #12243. Awaiting fixer confirm of which home.

**Fix refinement over triage:** `-gdwarf` is a *separate unregistered* option key (`DebugInformationFormat=112`), skipped by the loop's top guard → handled as sibling read inside the `DebugInformation` case, not its own case. Serializer reuses `TypeTextUtil` tables + `Profile::getName()`. Test = extended existing `tests/spirv/cmd-arg-debug-info.slang` (CHECK_ALL). Repro 2/2, debug-* 72/72, codex PLAN/CODE/OUTPUT approve.

History: DISPATCHED-TO-FIXER (07-24) — released when pdeayton-nv asked bot on-issue ("do you have a PR ready?", comment 5096907350), the recorded trigger. Sent with `<github-post-authorized />` (real bot mention), MODE=fix-issue.

History: TRIAGED + PARKED-at-triaged (Main ruling 07-24) → released same day. Verified 5-bullet posted (comment 5072896209), `reproduced` label + Issue Type=Bug set. pdeayton owns the SPIR-V debug-info family ([[project_12181_debug_info_include_source_flag]], #12202/#12148/#12150/#12219).

**Fixer briefing memo:** `triage-12220.md` (from triager, `inbox/a2a-1784916080618-5d46vb/triage-12220.md`) — sent to slang-fixer.

**Expected fixer output:** draft PR (drafts-only guardrail), `Fixes #12220`, `report_pr_created`, GitHub ack to pdeayton + 5-bullet on issue (draft-held → issue needs public footprint).

Related family: [[project_11983_spirv_debugfunction_wrong_cu]], [[project_12150_include_line_cu_scoping]].
