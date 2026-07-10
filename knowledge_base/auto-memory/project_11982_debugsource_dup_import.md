---
name: project_11982_debugsource_dup_import
description: #11982 duplicate SPIR-V DebugSource for imported module — TRIAGED, fix IN PROGRESS (no PR yet; #11984 was a fabricated claim, retracted)
metadata: 
  node_type: memory
  type: project
  originSessionId: fd193fba-2b42-465a-ba93-727cb97c3ef8
---

shader-slang/slang#11982 (pdeayton-nv): imported module emits TWO `DebugSource` records → 3 instead of 2. Not a crash; valid SPIR-V, pure debug-info bloat. Reproduced at ToT (33f9ed0ce).

**Root cause (triager, proven via -dump-ir):** DebugSource is hoistable=true (identical operands auto-dedup), but two producers in `slang-lower-to-ir.cpp` spell the filename differently — per-file loop (~L15302) uses `getMostUniqueIdentity()` (relative), lazy `getOrEmitDebugSource` (~L9536) uses `pathInfo.getName()` (absolute). Mismatched string operand defeats dedup; the relative one is a dead orphan.

**Recommended fix (A):** unify filename spelling across both producers so hoistable-dedup collapses them (keep CU-referenced absolute spelling; orphan removed). B = SourceFile*-first dedup. C rejected (consumer-side masking).

**⚠️ RETRACTED FABRICATION (07-07):** a "[Fix Report]" claiming draft PR **#11984** (MERGEABLE, Closes #11982) was FABRICATED — it arrived interleaved with corrupted tool-result output (phantom `</parameter>`/`_verify:null` tokens, fake inline invoke blocks, tamper-warnings). The triager's "verification" of #11984 was itself part of that tainted stream, not a clean call. Ground truth via clean self-issued calls: `gh pr view 11984` → "Could not resolve to a PullRequest"; `gh pr list --search 11982 --state all` → empty. **#11984 does not exist and never did.** Triager patched issue comment 4909859975 back to "fix in progress, PR will follow." See [[project_corrupted_turn_taints_verification]].

**REAL state:** TRIAGED (reproduced@ToT 33f9ed0ce, root-caused, Type=Bug + `reproduced` set, verdict posted) → handed to slang-fixer → fixer building Debug slangc (~200/1170) for baseline -dump-ir, then implements Approach A (per-source-file loop → `getName()` so hoistable dedup collapses the orphan) + regression test, then opens a REAL draft PR. Fixer will `gh pr list --search 11982` for collisions first, then call `report_pr_created` with the REAL number. `report_pr_created` question is MOOT until a real PR exists.

Adjacent NOT-dup: #11983 (same reporter, DebugFunction wrong CU) — fix alongside. Loose family lead: import/precompiled-module dedup ([[project_10027_vector4_import_abort_pending]], [[project_11771_reflection_dup_global_pending]]) — not confirmed.

**07-10 update:** author pdeayton-nv commented "draft PR ready?" (comment 4931441344). Triager clean-verified NO PR exists (`gh pr list --search 11982` + `--head fix/issue-11982` both empty), answered honestly on GitHub (comment 4931457637, delta reply). Fixer status: analysis complete + fix locked (Approach A one-liner + regression test), but its in-flight Debug build was torn down by a session restart ~2.5 days ago (binaries + baseline -dump-ir never landed; NO code lost — branch fix/issue-11982 + analysis intact). Fixer resyncing master + rebuilding; draft PR ETA ~1hr.

Canonical thread `gh-issue-shader-slang/slang-11982`. Chain OPEN, awaiting fixer's REAL [Fix Report] w/ clean-verified real PR number (triager will verify + forward up). Verify `report_pr_created` when the real PR lands. Do NOT double-dispatch to fixer (triager owns the edge). Ready-flip/merge gated.
