---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786526532474-xl28xi
written_at: 2026-08-12T10:06:37.320Z
---

# Pack-query __first/__last cast crash: two-layer witness gap (First/Last SubtypeWitness)

shader-slang/slang#12494: `__first(args)`/`__last(args)` on `expand each T args` crash slangc SIGSEGV (exit 139) when the result is cast to a concrete type via a `where`-clause witness (reported: `where T == int`). Debug build asserts `slang-lower-to-ir.cpp:7252 !"unhandled"` in `emitCastToConcreteSuperTypeRec`; Release derefs the returned nullptr.

ROOT: `__first`/`__last` produce a `FirstSubtypeWitness`/`LastSubtypeWitness` (slang-check-inheritance.cpp:2197-2205). TWO lowering consumers don't know these witnesses:
1. `isTypeEqualityWitness` (slang-ast-val.h:1352) recurses through Each/TypePack/Expand/TrimFirst/TrimLast but omits First/Last -> the `where T==int` no-op cast isn't recognized as type-equality (checked at slang-lower-to-ir.cpp:7288).
2. Falls into `emitCastToConcreteSuperTypeRec` (slang-lower-to-ir.cpp:7214) which only handles Declared/Transitive witnesses -> unhandled else -> nullptr.

TWO SUB-CASES, both crash at :7252, need fixes at BOTH layers: (1) type-equality flavor (`where T==int`, pattern witness is equality) fixed by adding First/Last to isTypeEqualityWitness; (2) SIBLING found during triage — `__first` result upcast to a real struct base (`struct Derived:Base`, `where T==Derived`, fn returns Base) has a Declared inheritance pattern witness = a genuine field-extraction upcast that needs handling IN emitCastToConcreteSuperTypeRec. Non-generic Derived->Base return-upcast compiles fine, proving the residual is a real defect not out-of-scope.

PRECEDENT worth reusing: the `ExpandSubtypeWitness` case in isTypeEqualityWitness was added by PR #8736 ("[Differentiable] variadic"), which is ALSO what fixed the identical !"unhandled" crash in #6856 (`return (expand...)`); #6856's closing PR #10629 was TEST-ONLY (+13/-0). So "add the missing pack-witness case to isTypeEqualityWitness" is the blessed, precedented mechanism, and the safe no-op reasoning holds because `__first` already lowers to kIROp_ExtractFirstFromPack (element 0 selected BEFORE the cast) — the cast is representation-only.

METHOD note: addr2line on a Release SIGSEGV gave an inlined-return-address MIS-HIT (`visitVectorExpressionType:2850`) — DISCARDED in favor of the stale-but-source-matching Debug slangi assert line, which is authoritative for "which function". Always cross-check an addr2line attribution against a debug-assert signal for inlined C++.
