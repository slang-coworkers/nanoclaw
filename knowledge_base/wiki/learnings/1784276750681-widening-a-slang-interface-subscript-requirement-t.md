---
title: "Widening a Slang interface subscript requirement to generic cascades beyond stdlib (11990)"
type: learning
topic: slang-compiler
source: learnings/1784276750681-widening-a-slang-interface-subscript-requirement-t.md
---

# Widening a Slang interface subscript requirement to generic cascades beyond stdlib (11990)

Widening the `IArray`/`IRWArray` `__subscript(int index)` requirement (core.meta.slang) to `__generic<TIndex : __BuiltinIntegerType> __subscript(TIndex index)` does NOT stay a stdlib-only change, even when you follow csyonghe's advice to "declare the conforming method directly on Array/vector/matrix instead of relying on witness synthesis." That advice is correct for the three magic types (they compile clean in isolation with the requirement left at `int`), but widening the *requirement itself* cascades:

1. Core-module bootstrap CRASH: `SLANG_ASSERT(foundParent)` at slang-ast-builder.h:430, malformed `Member(RWStructuredBuffer, get)`. Cause: RWStructuredBuffer satisfies IRWArray via a bare **generic `ref` subscript**; widening the req makes its synthesized get/set wrapper form a bad decl-ref for the accessor nested under the GenericDecl-wrapped subscript. Fix: extend the decl-ref normalization special-case at slang-ast-builder.h:396 with a `case ASTNodeType::GenericDecl:` that unwraps `Member(Lookup(w, GenericDecl[SubscriptDecl]), get/set/ref)` (and accept RefAccessorDecl, not just Getter/Setter).
2. E38105 on every OTHER explicit non-generic conformer: CoopMat + CoopVec have explicit `__subscript(int index)` and `: IArray<T>`, so they must be widened to match too (plus their internal `__indexRead`/`__indexRef` helpers → E30019).
3. TERMINAL blocker E39999: CoopVec's autodiff `fwd_diff/bwd_diff(CoopVec<T,N>::__subscript::get/set)` registrations become ambiguous — resolution finds two identical generic candidates (CoopVec's own subscript + the inherited IArray generic subscript). Old identical `int` sigs resolved fine; both-generic makes the derivative-name resolver report distinct ambiguous candidates. Needs overload-resolution disambiguation (own shadows identically-signatured inherited-interface member) or a CoopVec autodiff-reg restructure — an autodiff design call.

Reusable debugging technique: the Debug `slang-bootstrap` has NO try/catch (main.cpp `#ifndef _DEBUG`), so an uncaught `Slang::InternalError` from a core-module check hits `terminate` with NO message. To surface the assert reason, flip `if (false)`→`if (true)` at slang-signal.cpp:~119 (handleSignal) to fprintf `g_lastSignalMessage` to stderr, then `cmake --build --preset debug --target slang-bootstrap` (a ~1-3 min incremental relink — you do NOT need a full 20-min build to iterate on core/hlsl.meta.slang) and re-run `slang-bootstrap -compile-core-module -archive-type riff-lz4 -save-core-module /tmp/x.bin`. Revert before committing. No gdb/lldb in-container (only addr2line).

Key non-cascade fact: adding an explicit `__subscript` to Array/vector/matrix has NO blast radius on direct `arr[i]` indexing — visitIndexExpr (slang-check-expr.cpp:3579-3594) hard-routes those base types to CheckSimpleSubscriptExpr and never consults `__subscript` members; the explicit member only participates in interface-conformance.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784276750681-widening-a-slang-interface-subscript-requirement-t.md`_
