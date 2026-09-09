---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787351755313-z0n93t
written_at: 2026-08-21T23:24:04.407Z
---

# CoopVec ICoopElement conditional-conformance refactor (#12411)

Relaxing a Slang core-module generic struct's element bound while keeping arithmetic behavior (csyonghe's design for #12411): `struct CoopVec<T:__BuiltinArithmeticType,let N:int> : IArray<T>, IArithmetic` → `struct CoopVec<T:ICoopElement,...> : IArray<T>` + `extension<T:__BuiltinArithmeticType,let N:int> CoopVec<T,N> : IArithmetic {...}`.

Key facts (verified at master 6a009a7f97):
- Slang type-checks core-module generic method BODIES **eagerly** against the declared constraint (confirmed via DeepWiki). So EVERY member whose body uses `+ - * / % != < >` on T, or calls a helper bound on `__BuiltinArithmeticType` (coopVecMatMul*, __int_to_float_cast/__real_cast/__int_cast, etc.), MUST move to the extension — leaving it in the ICoopElement struct fails the bootstrap core-module compile.
- STAYS in the ICoopElement struct: `__init(T)/__init(int)/__init(This)`, `fill`, `replicate`, subscript/getCount/__indexRead/__indexRef (the IArray surface — returns T via GetElement intrinsic, no arithmetic), ALL `store`/`load`/`storeAny`/`loadAny`/`__Load` families (their bodies only index or call BARE-generic helpers like __elemToByteOffset<T>/__byteToElemOffset<T>/__getStructuredBufferPtr<T,L> which have NO arithmetic bound; naming RWStructuredBuffer<T,L> in a signature does NOT force an arithmetic bound since its element type is unconstrained). `__mutMin/Max/Clamp/__Store` have `static_assert(false)`-only bodies so they type-check under any T (can stay or move — no eager op on T).
- MOVES: equals/lessThan/lessThanOrEquals, add/sub/mul/div/mod/neg + their __pure*/__mut*, __mutScalarMul, copyFrom (uses casts), __init<U>(CoopVec<U,N>) (calls copyFrom), matMulAccum*/matMulAddAccum* (call coopVecMatMul* + `this + ...`). The matMul members sit inside a fiddle `${ for(buffer...) }$ ... ${ } $}` loop — move the WHOLE wrapper as a block.
- An extension's `IArithmetic` conformance CAN be satisfied by `__init(int)`/`__init(This)` declared on the ORIGINAL struct body (not repeated in the extension) — DeepWiki-confirmed. So don't duplicate the ctors.
- The FP-differentiable extensions (`extension CoopVec<T:__BuiltinFloatingPointType,N>`) still compile because `__BuiltinFloatingPointType : __BuiltinRealType : __BuiltinSignedArithmeticType : __BuiltinArithmeticType : ...ICoopElement` — they see the moved arithmetic methods.
- jkwak wants `coopVecLoad` as TWO overloads (one `__BuiltinArithmeticType`, one `ICoopElement`), NOT a single relaxed bound — the more-constrained overload stays the specialized match for arithmetic types; BFloat16 matches only the ICoopElement one. The static `CoopVec.load` is element-agnostic so both forward to it.

Technique: this is a ~500-line block relocation; do it with a content-ASSERTED Python transform (assert every boundary line's exact text before slicing) — a boundary error costs a 20-min core-module build. Verify brace-delta unchanged vs `git show origin/master:file` (literal braces in intrinsic strings make raw delta nonzero but STABLE).
