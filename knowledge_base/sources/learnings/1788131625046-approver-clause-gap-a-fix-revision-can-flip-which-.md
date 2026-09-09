---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788065699290-u7npmh
written_at: 2026-08-30T23:13:45.046Z
---

# [approver/clause-gap] A fix revision can flip WHICH Step-1 clause fails; verify the prior crash via CI-green on the exact test, and watch for a cascading new assert

**PR:** shader-slang/slang#12830 revision 2 @ 2e2484d93dd6 (synchronize after my R1 ABSTAIN over a verified SIGSEGV). Recorded ABSTAIN_POLICY again, but on a DIFFERENT clause.

**What happened.** R1 (41872045) abstained on CLAUSE_FAIL:ci_green_on_sha (CI red from a null-deref I'd reproduced). R2 fixed the deref (isSlang202cOrLater now reads a stored getShared()->getLanguageVersion() instead of dereferencing m_module->getModuleDecl(); reflection ctor passes the version directly). CI went fully green. But the revision GREW (fix + added test coverage + formatting = 539 lines), so R2 abstained on a NEW Step-1 clause: CLAUSE_FAIL:tier_eligible (539 > cap 400).

**Transferable lessons:**
1. **Re-run the FULL procedure per revision — don't assume the prior blocker is the current one.** The failing Step-1 clause moved from ci_green_on_sha (R1) to tier_eligible (R2). A fix that resolves the R1 blocker can trip a different clause (size cap) because fixes + regression coverage inflate the diff. Read the fresh clause summary every time.
2. **Verify a "prior crash is fixed" claim via CI-green on the EXACT previously-crashing test — no local rebuild needed.** At R2, test-slang was green on all platforms; the pre-existing unit-test-function-reflection.cpp:143 that SIGSEGV'd at R1 is part of that suite, so CI-green on all platforms is stronger + cheaper proof than a local rebuild. (Contrast R1, where I DID need a local build because CI hadn't run.)
3. **eval-clauses reads the review-doc's embedded commit_id — synthesize the doc BEFORE running clauses**, or commit_match records UNEVALUABLE (a spurious infra abstain). Staging order matters: harvest → synthesize review-doc.md → eval-clauses.
4. **A fix commonly cascades into a new issue.** Here the fix added `SLANG_RELEASE_ASSERT(module)` to the module-taking ctor; the fresh primary review flagged it as a new 🔴 (abort on module-less callers). SLANG_RELEASE_ASSERT fires in RELEASE builds too — an abort regression, not just debug. When a fix relocates/guards a null path, check whether the guard is a hard assert and whether every caller satisfies it. (I spot-checked the main entry-point caller = guarded, so the bot's "three unconverted callers" looked over-claimed; but Step-1 tier_eligible already settled ABSTAIN so I didn't exhaustively adjudicate — flagged for the human.)
5. **Don't over-invest once Step 1 settles it** (reinforced from R1): tier_eligible fail = ABSTAIN, full stop. I ran Devin + a light plausibility grep for the human note, but did not rebuild or fully chase the new 🔴 — correct scoping.
