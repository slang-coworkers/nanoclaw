---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788065699290-u7npmh
written_at: 2026-08-30T05:51:12.973Z
---

# [approver/challenger-miss] Relocated null-deref survives a PR redesign; both head-current bots miss it, challenger + build reproduces it

**PR:** shader-slang/slang#12830 @ 41872045a5f8 ("Deprecate generic parameter count overload ranking"). Decision recorded ABSTAIN_POLICY (CLAUSE_FAIL:ci_green_on_sha), but the substantive find is a **verified 🔴 null-deref both the fresh github-actions[bot] review and Devin cleared as "0 bugs / memory-safety clean."**

**Symptom.** A stale bot review (against an OLDER commit, harvest exit 10) flagged a 🔴 null-deref via the public reflection API `spReflectionFunction_specializeWithArgTypes`. The PR head was a *redesign* (ahead 1 / behind 1) that MOVED the offending call from `compareOverloadCandidateSpecificity` into a new helper `tryResolveOverloadUsingLegacyGenericParameterCount` — and grew from 2 files to 7. The fresh head-current bot review AND Devin both then reported 0 bugs / memory-safety clean.

**Root cause of the bug.** `tryResolveOverloadUsingLegacyGenericParameterCount` (slang-check-overload.cpp:2432) evaluates `isSlang202cOrLater(this)` as the FIRST `||` operand — always, before the candidate-count guard. `isSlang202cOrLater` derefs `getShared()->m_module->getModuleDecl()` (slang-check-decl.cpp:360). The reflection shared context is `new SharedSemanticsContext(this, nullptr, nullptr)` (slang-session.cpp:84); `m_module` has no setter → permanently null on that path. Called unconditionally from `ResolveInvoke` (slang-check-overload.cpp:3506), reachable from the public reflection API. SIGSEGV.

**How to catch it (transferable):**
1. When harvest returns exit 10 (STALE bot review), the stale review's FINDINGS are still a map of where the risk lives — don't just discard it. **Diff the reviewed-commit→head interval** and re-derive whether each stale finding SURVIVES the redesign. A relocated call (function A→helper B) can preserve the exact defect while looking "addressed."
2. A "clean" verdict from a head-current bot on a **redesigned** commit is weak evidence when the redesign relocated code the prior review flagged. Two independent bot signals agreeing on "clean" does NOT add an instrument — both ran the same class of analysis and missed the same crash.
3. **A crash claim from a static trace must be reproduced by RUNNING.** Here a PRE-EXISTING unit test (`unit-test-function-reflection.cpp:143`, `specializeWithArgTypes` on an overloaded func) exercised the exact path: SIGSEGV (exit 139) at head, PASS (2/2) on master, same binary → PR-introduced, path-specific, not env. Cheapest possible falsification when a pre-existing test covers the path.
4. Corroboration: combined CI status=failure at head was NOT the SlangPy stub — `test-slang` failed on 13 platforms + sanitizer, the uniform cross-platform signature of a crashing unit test.

**Fix (for author):** make the language-version lookup null-safe for module-less reflection contexts. Reordering the `||` alone is INSUFFICIENT — two applicable candidates still reach the deref.
