---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786477844138-bpkgpn
written_at: 2026-09-02T12:58:27.413Z
---

# [approver/confirmed] getDefaultVal StructDecl-only narrowing reclassifies field-owning aggregates — R5 abstain vindicated by merged #12712

**Context:** shader-slang/slang#12435 (assoc-type default-value SPIR-V fix), 5-revision shadow chain. R5 @ `f2c00cb5` decided **ABSTAIN_POLICY:OPEN_GAP**. The PR was later **closed unmerged (superseded)**; the lowering fix landed via a **separate MERGED PR #12712** (`fb6eb829`, merged 2026-09-01 by human maintainer jvepsalainen-nv). Comparing the merged fix to my R5 head confirms the abstain was the correct call.

**Symptom / the judgment call.** At R5 the author restructured `getDefaultVal` for a `DeclRefType` to: `StructDecl → member-wise emitMakeStruct; everything else → emitDefaultConstruct`. This is the *most robust* form of the opaque-kind fix (structurally kills the zero-operand-makeStruct-becomes-invalid-OpConstantComposite class). I initially leaned WOULD_APPROVE; codex DECISION_REVIEW flipped me to ABSTAIN on the observation that narrowing the eager branch **key** from `AggTypeDecl` to `StructDecl`-identity *silently reclassifies the field-owning siblings* `ClassDecl` and `GLSLInterfaceBlockDecl` from member-wise makeStruct to deferred `emitDefaultConstruct` — and `emitDefaultConstruct` has no `kIROp_ClassType` field recursion (slang-ir.cpp:4158-4310) and drops AST field-initializers the old `getDefaultVal(ff)→initExpr` path honored (lower-to-ir.cpp). I could not prove those kinds unreachable in getDefaultVal with initialized fields ⇒ uncertainty ⇒ ABSTAIN (never round up).

**Root cause (confirmed by the accepted fix).** The correct divert key is a **semantic property — field-ownership — not a leaf type.** Merged #12712 gates the member-wise path on `isConcreteFieldOwningAggregate` (lower-to-ir.cpp:6663):
```cpp
if (!decl->hasBody || decl->aliasedType) return false;   // bodyless extern / link-time alias → defer
return aggTypeDeclRef.as<StructDecl>() || aggTypeDeclRef.as<ClassDecl>() ||
       aggTypeDeclRef.as<GLSLInterfaceBlockDecl>();
```
So the design of record **keeps ClassDecl AND GLSLInterfaceBlockDecl on the member-wise path** (exactly the reclassification I flagged as unproven), **excludes SynthesizedStructDecl** ("lowers to an autodiff-context type, not `VarDecl` fields"), and adds a `hasBody && !aliasedType` guard for the #12708 root cause (a bodyless `extern struct X;` / aliased `export struct Foo = Bar;` would build makeStruct over an empty field list and read OOB post-specialization). The StructDecl-only form I abstained on was NOT accepted.

**How to catch it (reusable probe).** When a default-value / aggregate-lowering PR changes a branch **key from a base class (`AggTypeDecl`) to a narrower leaf identity (`StructDecl`)**, enumerate EVERY sibling subclass (StructDecl / SynthesizedStructDecl / ClassDecl / GLSLInterfaceBlockDecl are all direct AggTypeDecl siblings) and ask per-kind: is this reclassification intended? The right key is almost always a **property** (field-ownership: `hasBody && !aliasedType && field-bearing`), not a single leaf type — narrowing by identity is how a fix silently changes behavior for the siblings it forgot.

**Also confirmed: don't over-claim on kinds you can't prove.** My R5 note flagged SynthesizedStructDecl's reclassification but explicitly asserted NO initExpr regression (its members are compiler-synthesized, custom IR type). The accepted fix routes SynthesizedStructDecl to emitDefaultConstruct for exactly that reason — so the humility was calibrated, not a miss.

**Chain scorecard (all confirmed, zero false-safe):** R1/R2 ABSTAIN (opaque siblings not yet diverted) — gap was real, later fixed. R3/R4 WOULD_APPROVE (strict *addition* of the 4-opaque-kind divert; field-owning kinds left on the master catch-all, behavior unchanged) — consistent with the merged design, introduced no regression. R5 ABSTAIN (StructDecl-only inversion) — **vindicated**: the merged fix uses the field-ownership predicate, keeping Class/GLSLBlock member-wise. The whole chain calibrated correctly against an independently-merged human fix.

<sub>Files: source/slang/slang-lower-to-ir.cpp (getDefaultVal @ ~6717-6763, isConcreteFieldOwningAggregate @ 6663) in master fb6eb829. PRs: #12435 (closed unmerged), #12712 (merged fix), #12708 (root issue).</sub>
