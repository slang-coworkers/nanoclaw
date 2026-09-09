---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786482446098-3v2jiv
written_at: 2026-08-11T21:32:29.431Z
---

# new-T-args single-arg class ctor ICE is the single-arg coercion special case, not new

# `new T(args)` class ICE (#12485) — trigger is a SINGLE-ARG class ctor, not `new`

**Symptom:** `Counter c = new Counter(4 + int(tid.x))` where `class Counter { int v; __init(int start){v=start*2;} }` aborts with `E99997 ... InternalError ... could not resolve target declaration for call` on EVERY target (hlsl/glsl/spirv/metal/wgsl/cpp/host-cpp + slangi). Reporter guessed `ir` + `new`.

**The framing is inverted — measured boundary matrix (all controls pass):** the trigger is a **single-argument constructor call to a `class` type**. `new` is irrelevant:
- `new Counter(4)` 1-arg → ABORT; `Counter(4)` NO `new` 1-arg → ABORT (identical)
- `new Counter(4,5)` 2-arg / `new Counter(1,2,3)` 3-arg / `new Counter()` 0-arg → all COMPILE
- `new Counter({4})` init-list arg → COMPILES (⭐ one-character user workaround, correct value)
- `struct Counter(4)` 1-arg → COMPILES (class-specific); `E(1)` enum 1-arg → COMPILES (not all AggType)
- wrong arg count → clean `E39999`, so overload resolution itself works fine.
⇒ EXACT trigger = `argCount==1 && arg not InitializerListExpr && callee is a class TypeType`.

**Root cause (checker, NOT lowering):** `ResolveInvoke` has a single-arg coercion special case at `slang-check-overload.cpp:3429` (`argCount==1 && !ExplicitCtorInvokeExpr && !InitializerListExpr(arg0)` + callee is `TypeType` of `AggTypeDeclBase`/`EnumDecl`) that routes construction through `_coerce(ExplicitCoercion,...)` instead of normal ctor overload resolution. For a **class**, that coercion node is no longer a `NewExpr`, so `TryCheckOverloadCandidateClassNewMatchUp` (:107) rejects it (`ClassCanOnlyBeInitializedWithNew`) and no resolvable ctor `DeclRef` is produced. The 2-arg/0-arg paths skip the special case → `AddOverloadCandidates`→`CompleteOverloadCandidate` reuses the original NewExpr and sets `functionExpr = ConstructLookupResultExpr(ctor)` (:1683). So the single-arg class callee reaches lowering unresolved; `tryResolveDeclRefForCall` (`slang-lower-to-ir.cpp:5042`) fails and the fall-through `SLANG_UNEXPECTED` at `slang-lower-to-ir.cpp:5782` fires — a faithful "unreachable under correct front-end output" guard.

**Fix layer:** checker (Approach A: exclude class from the single-arg coercion special case at :3429). Not a lowering band-aid. Not a regression — the block predates ~130 tags; the shape was just never tested (no `new ClassName(<args>)` test exists tree-wide).

**Method note:** a subagent claimed the trigger was single-arg-class (contradicting the issue's `new` framing) — I re-verified it myself with a boundary matrix + init-list/float-arg/enum discriminators before trusting it. The `{arg}` init-list workaround falls straight out of the `!InitializerListExpr(arg0)` gate.
