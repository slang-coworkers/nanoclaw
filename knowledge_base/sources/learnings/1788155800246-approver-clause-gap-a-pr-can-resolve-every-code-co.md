---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788065699290-u7npmh
written_at: 2026-08-31T05:56:40.246Z
---

# [approver/clause-gap] A PR can resolve every code concern yet stay un-approvable on the size cap — 3× ABSTAIN with the reason migrating each revision

**PR:** shader-slang/slang#12830, three synchronize revisions, all ABSTAIN_POLICY but for DIFFERENT reasons — the reason migrated as the author fixed things:
- R1 (41872045): ABSTAIN CLAUSE_FAIL:ci_green_on_sha — CI red from a verified SIGSEGV (isSlang202cOrLater dereffed a null m_module on the reflection path).
- R2 (2e2484d9): null-deref FIXED (stored language version). ABSTAIN CLAUSE_FAIL:tier_eligible (539 > 400) — and a NEW primary-review 🔴 appeared (SLANG_RELEASE_ASSERT(module) abort on module-less callers).
- R3 (2c465113): R2 🔴 ADDRESSED via a guarded factory `SharedSemanticsContext::createForOptionalModule` (if module -> module ctor else languageVersion ctor); all module-less callers (reflection specialization, LSP signature help) routed through it. CI green. But the diff GREW to ~1101 lines. ABSTAIN CLAUSE_FAIL:tier_eligible again.

**Transferable lessons:**
1. **A clean-code PR can remain un-auto-approvable purely on the size cap.** Across R1→R3 the author fixed the SIGSEGV, fixed the follow-on abort 🔴, and got CI green — yet every revision abstained, because fixes + regression coverage kept inflating the diff (255 → 539 → 1101 lines). When abstaining on tier_eligible, say plainly in the report that the CODE concerns are resolved and the abstain is size-only — otherwise a reader misreads three ABSTAINs as "still broken." The remedy (a human reviewer, or the author splitting the PR) is different from a code fix.
2. **Verify "prior 🔴 addressed" by enumerating the callers, not by trusting the fix commit message.** R3's "Harden overload cleanup contracts" added `createForOptionalModule`; I confirmed by grepping every `new SharedSemanticsContext(` and every `createForOptionalModule` call site and checking each raw module-ctor call was either guarded (`if(entryPointModule)`) or the languageVersion ctor. That enumeration is what lets you state "no nullable module reaches SLANG_RELEASE_ASSERT(module)" with confidence.
3. **A guarded factory is the right shape for an optional-module context.** The clean fix for "some ad hoc checking ops (reflection, LSP) have no primary module" is a factory that branches on nullability into two ctors (one asserts module non-null, one asserts a known language version) — not a null-check scattered at each call site. Recognize this as the correct resolution, not a nit.
4. **Harvest can go stale between revisions when the bot review lags a fast-moving PR.** R3's harvest was exit 10 (bot review one commit behind head, pending_bot None) → Devin-only tier. When commits land faster than the review bot posts, expect stale harvests; the Devin-only fallback + your own source read carry the decision.
