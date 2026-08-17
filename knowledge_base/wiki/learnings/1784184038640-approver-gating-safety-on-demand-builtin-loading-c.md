---
title: "[approver/gating-safety] On-demand builtin loading can widen a null-deref surface when a fix swaps decl-owned state for context-owned state"
type: learning
topic: review-approval
source: learnings/1784184038640-approver-gating-safety-on-demand-builtin-loading-c.md
---

# [approver/gating-safety] On-demand builtin loading can widen a null-deref surface when a fix swaps decl-owned state for context-owned state

**Symptom:** slang#12136 ("Load autodiff builtins on demand") splits diff.meta.slang into a lazily-loaded supplement. As a pre-existing-ownership fix it also changed `translateFwdDerivativeAttributeToAD2` from `getModuleDecl(funcDecl)->addMember(...)` to `visitor->getShared()->getModule()->getModuleDecl()->addMember(...)`. CodeRabbit flagged a 🔴 null-deref: `getShared()->getModule()` is null in ad-hoc contexts (reflection, LS signature-help, `ComponentType::specialize`).

**Root cause / the transferable class:** When a change moves a synthesized artifact from being owned by *the decl's own module* (derived by walking `funcDecl`'s parent chain → non-null for any module-resident decl) to being owned by *the current semantic context's primary module* (`SharedSemanticsContext::m_module`, declared `= nullptr`, doc-commented "optional"), it introduces a NEW independent null source. The func can have an owning module while the context's `m_module` is null — exactly the ad-hoc/reflection case. Slang's own de-facto invariant is contextual: `slang-check-expr.cpp:350-351` guards `getShared()->getModule()` before deref (expression-level checks that can run module-less), while decl-header synthesis paths (`slang-check-decl.cpp:9062` backward-deriv, and the new `:19215` fwd-deriv) bare-deref, assuming decl-checking always has a module.

**How to catch it (the challenger question):** For any autodiff/builtin "load on demand" or ownership-relocation change, ask: (1) does the new code key on `getShared()->getModule()` (nullable) where the old keyed on the decl's own module (non-null)? (2) Is there a guard precedent in the same file for the identical expression? (mismatch = smell.) (3) Can the consuming visitor run in a null-module context? For Slang: `SemanticsDeclDifferentialAttributesVisitor` runs at `DeclCheckState::ReadyForLookup`, and `shouldSkipChecking` only skips at `>= DefinitionChecked` — so it is NEVER skipped at ReadyForLookup even in the LS; lookup can force `ensureDecl(fn, ReadyForLookup)`. The UNRESOLVED precondition (needs a built repro to settle): is the referenced decorated fn checked FRESH in the null-module context (visitor runs → deref) or already-checked (ensureDecl no-ops → safe)?

**Fix / decision:** Static reachability was genuinely contested across 5 independent traces and unresolvable without a repro → fallback-tier + uncertainty ⇒ ABSTAIN_POLICY:CHALLENGER_CONCERN, NOT BLOCK (never BLOCK on an unverified crash) and NOT WOULD_APPROVE (a doc 🔴 can't be upgraded by investigation). The concrete maintainer next-action: a one-line guard mirroring the `:350` precedent (and ideally the pre-existing bare twin `:9062`). Relates to [[the .autodiff gating-predicate learning from #11474]] — both are "autodiff machinery assumes a shape that a narrower/lazier path can violate."

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784184038640-approver-gating-safety-on-demand-builtin-loading-c.md`_
