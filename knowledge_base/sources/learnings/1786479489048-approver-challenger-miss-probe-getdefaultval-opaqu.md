---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786477844138-bpkgpn
written_at: 2026-08-11T20:18:09.048Z
---

# [approver/challenger-miss-probe] getDefaultVal opaque-kind divert is incremental — check AggTypeDecl siblings

**Context:** slang PR #12435 (fknfilewalker) "Fix two sources of invalid SPIR-V from types resolved during specialization". Decided ABSTAIN_POLICY:OPEN_GAP @ dfb67f7358b3 (2026-08-11). All 3 reviewers (claude-code-action, CodeRabbit, Devin) found 0 bugs; the deciding signal was a 🟡 completeness gap the primary review raised and I confirmed from source.

**Symptom:** `getDefaultVal(Type*)` in `slang-lower-to-ir.cpp` (~:6702-6745) handles `DeclRefType` with an `else if` chain: `EnumDecl` → `InterfaceDecl` → (new) `AssocTypeDecl` → general `AggTypeDecl` (which builds a member-wise `makeStruct`). An opaque type with no `VarDecl` members produces a ZERO-operand `makeStruct`; once specialization resolves it to a scalar, the emitter yields `OpConstantComposite %scalar` with no constituents → spirv-val rejects. The fix diverts `AssocTypeDecl` to `emitDefaultConstruct` (peephole folds to a concrete zero later), matching the `InterfaceDecl` branch added alone in #9421.

**Root cause / class:** This divert is applied ONE opaque kind at a time. In the AST hierarchy (`slang-ast-decl.h`), `InterfaceDecl`, `AssocTypeDecl`, `ThisTypeDecl`, and `GlobalGenericParamDecl` are ALL `AggTypeDecl` subclasses. So fixing one leaves its untreated siblings (here `ThisTypeDecl`, `GlobalGenericParamDecl`) falling through to the same zero-operand `makeStruct`. Ordinary `GenericTypeParamDecl` is `SimpleTypeDecl` (NOT `AggTypeDecl`), so it already takes the safe fall-through — the residual blast radius is bounded to the two niche opaque kinds.

**How to catch it (transferable probe):** When a fix adds an `else if (declRef.as<X>())` divert inside a type-kind dispatch that has a catch-all aggregate/struct branch, DON'T judge it on the single kind. Pull the base-class hierarchy for X (e.g. `grep -nE "class \w+ : public" slang-ast-decl.h`) and enumerate every SIBLING subclass of the same base that is NOT diverted before the catch-all. Each undiverted sibling is a candidate for the SAME bug. Then check ordering: `getDefaultVal` runs at AST→IR lowering, BEFORE IR specialization — so the "unknown until specialization" precondition holds for a global `type_param`-typed field there too. deepwiki claimed the siblings were "specialized earlier"; that contradicted the verified lowering-time ordering — treat deepwiki as heuristic, settle ordering from source.

**Bar applied:** plausible real trigger + same invalid-SPIR-V blast radius + gap undermines the PR's stated purpose ("fix THE sources") ⇒ conservative-lean OPEN_GAP, not a clear. The changed lines are correct (not a BLOCK); the concern is completeness. Awaiting human join to calibrate whether maintainers consider the sibling coverage in-scope.
