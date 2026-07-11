---
name: project_11982_debugsource_dup_import
description: #11982 duplicate SPIR-V DebugSource for imported module — FIXED via REAL draft PR #12034 (Main-verified), held pending human review/merge
metadata: 
  node_type: memory
  type: project
  originSessionId: fd193fba-2b42-465a-ba93-727cb97c3ef8
---

shader-slang/slang#11982 (pdeayton-nv): imported module emits TWO `DebugSource` records → 3 instead of 2. Not a crash; valid SPIR-V, pure debug-info bloat. Reproduced at ToT (33f9ed0ce).

**Root cause (proven via -dump-ir):** DebugSource is hoistable=true (identical operands auto-dedup), but two producers in `slang-lower-to-ir.cpp` spell the filename differently for a `Type::Normal` file — per-source-file loop (`generateIRForTranslationUnit`) uses `getMostUniqueIdentity()` → **canonical ABSOLUTE** (this is the CU-referenced record), lazy `getOrEmitDebugSource` uses `pathInfo.getName()` → **as-found RELATIVE** (the orphan). Mismatched string operand defeats dedup; the relative one is a dead orphan. ⚠️ NOTE: the triager's ORIGINAL triage had these two accessor→spelling labels REVERSED (said loop→relative, lazy→absolute); corrected 07-10 — verified in `slang-source-loc.cpp` (`getName`→foundPath, `getMostUniqueIdentity`→uniqueIdentity) + emitted asm. Root-cause mechanism + fix shape were right; only the direction label was wrong.

**Fix shape:** unify filename spelling across both producers so hoistable-dedup + link-time clone collapse them; orphan removed. B = SourceFile*-first dedup. C rejected (consumer-side masking). Final direction (author-requested): converge on ABSOLUTE (`getMostUniqueIdentity()`) — see #12034 below.

**⚠️ RETRACTED FABRICATION (07-07):** a "[Fix Report]" claiming draft PR **#11984** (MERGEABLE, Closes #11982) was FABRICATED — it arrived interleaved with corrupted tool-result output (phantom `</parameter>`/`_verify:null` tokens, fake inline invoke blocks, tamper-warnings). The triager's "verification" of #11984 was itself part of that tainted stream, not a clean call. Ground truth via clean self-issued calls: `gh pr view 11984` → "Could not resolve to a PullRequest"; `gh pr list --search 11982 --state all` → empty. **#11984 does not exist and never did.** Triager patched issue comment 4909859975 back to "fix in progress, PR will follow." See [[project_corrupted_turn_taints_verification]].

Adjacent NOT-dup: #11983 (same reporter, DebugFunction wrong CU) — fix alongside. Loose family lead: import/precompiled-module dedup ([[project_10027_vector4_import_abort_pending]], [[project_11771_reflection_dup_global_pending]]) — not confirmed.

**07-10 update:** author pdeayton-nv commented "draft PR ready?" (comment 4931441344). Triager clean-verified NO PR exists (`gh pr list --search 11982` + `--head fix/issue-11982` both empty), answered honestly on GitHub (comment 4931457637, delta reply). Fixer status: analysis complete + fix locked (Approach A one-liner + regression test), but its in-flight Debug build was torn down by a session restart ~2.5 days ago (binaries + baseline -dump-ir never landed; NO code lost — branch fix/issue-11982 + analysis intact). Fixer resyncing master + rebuilding; draft PR ETA ~1hr.

**✅ REAL PR (07-10, Main-verified via `github_get_pull_request` twice — initial + post-flip):** draft PR **#12034** — OPEN, draft=true, author nv-slang-bot[bot], base master / head fix/issue-11982 (HEAD 7debba7743), `Closes #11982`, label `pr: non-breaking`, assignee jkwak-work, reviewers requested jkwak-work + zangold-nv. NOTE: earlier "#11984" was the RETRACTED fabrication — #12034 is the genuine one.

**FINAL fix (author-flipped, Main-verified against rewritten PR body):** pdeayton-nv reviewed #12034 and asked to spell paths ABSOLUTE for downstream consumers. Fix flipped: now edits the LAZY producer `getOrEmitDebugSource()` to canonicalize its emitted operand with `getMostUniqueIdentity()` (absolute), matching the per-source-file loop (which already emitted absolute + drives the CU-referenced record). Both producers now agree on the canonical/absolute spelling → two hoistable IRDebugSource insts collapse at link → orphan gone, surviving record keeps absolute. `SourceFile*` lookup left byte-for-byte (found-path first, identity fallback); only emitted operand + derived path-map key canonicalized. (INITIAL fix before the flip was the reverse — loop→getName — reflecting the reversed accessor labels; superseded.) Test: new `DUP` FileCheck pass (DUP-COUNT-2 + DUP-NOT), 3→2 records both absolute, CU/DebugFunction/DebugGlobalVariable chain intact; -g2/-g3 sweep zero crashes; #line/FromString unaffected. Codex gate PLAN/CODE/OUTPUT green at HEAD. Fixer posted PR-opened comment 4931793823 then author-confirmation 4932084140 (newest); Main/triager did NOT post duplicate.

**CI:** #12034 github.ci_failed is the cosmetic draft-dispatch signature (33 build/test jobs `skipping`, board-sync pass, only wait-for-human-priority/check-ci "fail" by design) — NOT a real failure; real builds run when maintainer readies. Same pattern as [[project_bot_pr_priority_yield_red_run]].

**report_pr_created: ✅ CONFIRMED** — fixer called it for #12034; host confirmed #12034→session mapping; CI-failed webhook already routed into fixer's session as live proof. Future maintainer review comments on #12034 land in fix context, not a cold session.

Canonical thread `gh-issue-shader-slang/slang-11982`. **TERMINAL-for-triage.** Next human action: review → ready → merge #12034 (operator-gated). Reopens ONLY on new substantive human comment. Do NOT double-dispatch to fixer (triager owns the edge). Ready-flip/merge gated.
