---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787566215385-r2xn7k
written_at: 2026-08-24T15:28:01.811Z
---

# slang getDefaultVal on AssocTypeDecl built an empty IRMakeStruct — the #12132 producer

## slang#12708 — the concrete producer of analyzeMakeStruct's positional OOB (#12132)

`AssocTypeDecl : public AggTypeDecl` (slang-ast-decl.h:567). In `getDefaultVal(Type*)`
(slang-lower-to-ir.cpp), `T.Assoc x = {}` therefore fell into the `AggTypeDecl` branch, which builds
an `IRMakeStruct` by iterating `getMembersOfType<VarDecl>`. An associated-type decl has NO concrete
fields → `emitMakeStruct(irType, 0, nullptr)` = **zero-operand IRMakeStruct** over the opaque
`IRAssociatedType`. After dynamic-dispatch type-flow specialization resolves the assoc type to a
concrete (non-empty) struct, `analyzeMakeStruct` (slang-ir-typeflow-specialize.cpp) iterates the
resolved struct's fields and reads `getOperand(i)` positionally, unbounded → OOB (Debug asserts
`slang-ir.h(711): index < getOperandCount()`, Release AV). This is exactly the latent OOB #12132
predicted and asked for a producer for.

### Fix pattern (principled, producer-side)
Add `else if (declRef.as<AssocTypeDecl>()) return LoweredValInfo::simple(getBuilder()->emitDefaultConstruct(irType));`
BEFORE the `AggTypeDecl` branch, mirroring the sibling `InterfaceDecl` case that is already there.
Key fact: `emitDefaultConstruct(IRType*)` switches on the IR type; for an opaque type (associated
type, interface) NO case matches, so it falls through to the `fallback` path emitting a single
`kIROp_DefaultConstruct` (slang-ir.cpp ~4308) — a resolvable representation type-flow specialization
handles normally. So for opaque types `emitDefaultConstruct` == `emitDefaultConstructRaw`, but the
former is preferred (mirrors the sibling, folds if the type is ever concrete).

### The consumer assert should be EXACT ==, not min-bound
`SLANG_RELEASE_ASSERT(makeStruct->getOperandCount() == fieldCount)`. Exact parity is provably safe:
struct inheritance lowers the base as a LEADING `IRStructField` (slang-lower-to-ir.cpp ~12616) AND
`getDefaultVal` supplies a matching base operand — so operand==field parity holds even with a base.
A `min()`-bound would silently mask a future under-supplying producer (the "silent impossible-shape"
red flag). `IRStructType::getFields()` has no getCount(), so pre-count in a first loop.

### Watch-out
`visitDefaultConstructExpr` lowers directly via `emitDefaultConstruct` and does NOT route through
`getDefaultVal(Type*)` — so an explicit default-construct never built the empty MakeStruct; only
`= {}` (visitInitializerListExpr, empty list) and uninitialized field/var
(`getDefaultVal(DeclRef<VarDeclBase>)`) funnel through the fixed helper. When claiming "covers every
default-init path," verify which paths actually reach the helper.
