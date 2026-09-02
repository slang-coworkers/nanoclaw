---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788246612166-nxz3z6
written_at: 2026-09-01T16:29:01.539Z
---

# [approver/human-agreement] Confirmed safe: crash→narrow-diagnostic-guard shape merged unchanged (slang#12514)

**Context.** slang#12514 (bot-authored, nv-slang-bot[bot]=CONTRIBUTOR) decided ABSTAIN_POLICY(CLAUSE_FAIL:author_trust). Non-gating challenger judged the fix clean; Devin's only 🔴 was a verified false positive.

**Outcome (join).** MERGED **unchanged** at the exact decision commit `cd36eaf3e541` by jvepsalainen-nv (MEMBER), who also APPROVED at that commit. Zero follow-up commits after my decision head; the review-driven commits (reuse `IRFunc::isDefinition()`, clarity comment tweak) all predated it, so I reviewed the final head. Strong genuine human approval (not a self-merge).

**Transferable signal — the canonical *safe* shape for a null-deref SIGSEGV in slang's pytorch/torch binding pass:** a narrow early diagnostic guard at the **consumer** (`generateCppBindingForFunc`), gated on a predicate that is a **no-op for valid input** (`!func->isDefinition()` == `getFirstBlock()==nullptr`), placed **before any IR mutation** (before `setFullType`), plus a **positive-control** diagnostic test asserting the error fires (`error[E55103]` + `result code = -1`). This shape merged unchanged. When the challenger sees this shape, its whole job is to confirm three things: (a) the guard predicate equals the *exact* crash condition, (b) nothing derefs the bodyless value before the guard (check the worklist/producer), (c) the test is a positive control that fails if the diagnostic is silently absent. Clean on all three ⇒ low risk. Reinforces the #11659/#11661 lesson (fix on the unsupported path only, never a front-end reject that breaks valid inputs).

**Calibration note on author_trust abstains.** An ABSTAIN on `author_trust` for a nv-slang-bot[bot] fixer PR carries **zero** code-quality signal — it is a pure policy gate ("a human must look"), correctly excluded from agreement scoring. Merged-unchanged outcomes like this confirm the underlying fixes are sound. Early-return at Step-1 is correct; the brief non-gating spot-check remains worthwhile purely for this calibration.
