---
name: project_12212_capgen_exit_code_silent_success
description: "#12212 slang-capability-generator exits 0 + writes files despite emitting error diagnostics — tooling root-cause that let #12211 pass CI"
metadata: 
  node_type: memory
  type: project
  originSessionId: 85a75214-19c9-4511-8daf-67acc8796737
---

**#12212** — `slang-capability-generator` emits `error`-severity diagnostics via `m_sink->diagnose(...)` but returns exit status **0** AND writes output files anyway. Ninja/CMake key off process status → invalid `.capdef` definitions pass CI. Filed by **jkwak-work** (maintainer) 07-24.

**Root cause (verified in source by triager):** `CapabilityDefParser::validateInternalAtomExternalAtomPair()` returns `void` (capability-generator-main.cpp:410); `parseDefs()` calls it then unconditionally `return SLANG_OK` (:600); `main()` writes files then `return 0` (:1447-1469).

**Classification (triager):** bug/build-correctness/high/**P1**. EMPIRICALLY REPRODUCED @HEAD 15ada68aa (invalid capdef → 3× error 20007 incl. live `_GLSL_latest`/`_sm_latest` pair, exit 0, 4 files written). **NOT a regression** — blame → 2024, latent tooling gap. Applied `reproduced`; Type=Bug (human-set); `regression` deliberately NOT applied. Verified 5-bullet posted (comment 5069250551). CI run cited: actions/runs/29669108809.

**Cross-link:** #12212 is the tooling ROOT-CAUSE of [[project_12211_capdef_latest_atom_internal_pair_regr]] — the exit-0 bug is *why* #12211's invalid capdef passed the full GitHub CI matrix (Linux+Windows).

**LANDING-ORDER — DISSOLVED (verified 07-24 via GitHub receipts).** Fixer flagged at 11:39Z that #12212's fix makes the generator FAIL on capdef errors, so it would red-light full-build CI while master still carried #12211's error-20007s. That coupling **no longer applies**: jkwak's own **PR #12213** (`Fixes #12211`, Approach A public aliases) **MERGED 14:13:58Z** → #12211 CLOSED → master capdef clean → **#12217 builds green standalone**. PR #12217 body states "no remaining landing-order dependency." (My earlier "#12211 must land first" note to fixer was stale; fixer reconciled correctly.)

**Fix — draft PR #12217** `Fix #12212: fail slang-capability-generator on capdef errors` (nv-slang-bot, head `fix/issue-12212`, base master, `Closes #12212`, `pr: non-breaking`, +138/−1, 2 files, reviewer jkwak-work). `parseDefs()` returns `SLANG_FAIL` on `getErrorCount()>0` BEFORE header writes (main's guard blocks them); `main()` returns `sink.getErrorCount() ? 1 : 0` as defensive catch-all; warnings (e.g. `warning 7` doc-path) stay non-fatal. New slang-unit-test subprocess test: invalid capdef → asserts error 20007 + nonzero exit + no output files; valid-capdef control exits 0 + writes. Fixer revert drill: pre-fix exit 0 + 3 files → post-fix exit 1 + none; full build exit 0; real capdef still clean; codex CODE/PLAN/OUTPUT approve. Triager independently verified diff + PR metadata. Note: DeepWiki wrongly claimed generator returns 1 on validation failure — source + repro authoritative.

**✅ SHIPPED & MERGED (07-27 VERIFIED via receipts).** PR #12217 **MERGED by jkwak-work** — `state: closed`, `merged_at: 2026-07-27T19:14:52Z`, base master (fixer reports merge commit `f282bdf9c0`). Issue #12212 auto-closed COMPLETED via `Closes #12212`. **Approved earlier** (review 4789249566, 16:26Z): jkwak un-drafted, merged master into branch himself (`64f759501c`), verified independently — reverted #12213 + ninja build → intended `error 20007` on `_GLSL_latest`/`_sm_latest` → `ninja: build stopped`, confirming the generator now fails the build on capdef errors. Fixer's hunk intact at merged head. Guardrails held throughout (NO push after approval — would auto-dismiss; NO force-push over jkwak's master-merge; merge stayed maintainer-gated, jkwak merged himself). Worktree `wt-slang-12212` + sentinel cleaned up. **CHAIN COMPLETE.**

**Chain:** Main → slang-triager (07-24, reproduced+posted+resolution) → slang-fixer (thread `gh-issue-shader-slang/slang-12212`, memo triage-12212.md; opened #12217). Merge OPERATOR-gated per standing rules.
