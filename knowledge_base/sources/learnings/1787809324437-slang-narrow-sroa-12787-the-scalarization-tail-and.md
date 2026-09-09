---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787808713024-hadbul
written_at: 2026-08-27T05:42:04.437Z
---

# slang narrow-SROA (#12787) — the scalarization tail and escape analysis already exist

Planning #12787 (promote small non-escaping fixed local arrays after specialize/unroll) — two firsthand findings at ToT c1cffad25 that a "just enable eliminateAddressInsts" framing misses, both of which shrink the work:

1. **The scalarization tail is already free — no new folding code.** Once a local array is rewritten to `makeArray`/`updateElement` SSA values (which `slang-ir-addr-inst-elimination.cpp:storeValue` :41-73 already produces via `emitUpdateElement`), existing peephole folds it to scalars: `slang-ir-peephole.cpp:957-1003` folds a constant-index `UpdateElement`-over-`MakeArray` into a rebuilt `MakeArray`; :1004-1014 folds a full `updateElement` chain into one `MakeArray`; `tryFoldElementExtractFromUpdateInst` (:954) folds `GetElement`-from-`UpdateElement`. So the reporter's "no residual getElementPtr+store" acceptance criterion is met by machinery that already exists + DCE. Approach C (a bespoke SROA pass) would reinvent this.

2. **The non-escaping analysis already exists**, inlined in `isPromotableVar` (`slang-ir-ssa.cpp:478-573`): `if (u == &storeInst->val) return false` (:539) is the address-taken guard, and the exhaustive `default: return false` (:518) rejects any unknown use. There is NO named `isEscaping`/`addressIsTaken` helper — mirror this logic in the candidate filter (or extract a shared helper).

3. **Reads-through-chains are already general; only PARTIAL STORES are missing.** `processBlock` already handles `load(getElementPtr(var,i))` symbolically via `asPromotableVarAccessChain`+`applyAccessChain` (:1207-1232) with no constant-index requirement. The gap is strictly store-terminated chains — `allUsesLeadToLoads` (:116-148, NOT :100-130 as some notes say) rejects a `Store` user at its `default:` :123-124. So "constant-index" is a profitability/scope gate, not a correctness requirement.

4. **eliminateAddressInsts is autodiff-coupled ONLY by its diagnostic.** Sole caller is `slang-ir-autodiff-fwd.cpp:2433`. The mechanics are general; the only coupling is that its per-use `default:` arm emits `UnsupportedUseOfLValueForAutoDiff` (:184) and continues (always returns SLANG_OK — it doesn't abort). General reuse = make that arm *skip the var* instead of erroring.

5. **Acceptance test: assert on TARGET output, not raw -dump-ir.** The canonical raw-IR FileCheck test `tests/ir/loop.slang` is `//TEST_DISABLED` because dumped IR "is not very stable with codegen changes." Use `-target cuda`/`spirv-asm` + `CHECK-NOT:` (precedent: tests/spirv/descriptor-heap-rw-struct-buffer-load.slang, tests/bugs/gh-9931.slang).

Reusable gate ingredients: size cap `kMaxArraySizeToUnroll=32` (slang-ir-lower-buffer-element-type.cpp:462); element-type predicate `isSimpleDataType` (slang-ir-util.h:225) + `!isResourceType`/`!isOpaqueType` (:206-207); const-index via `as<IRIntLit>(gep->getOperand(1))` (IRGetElementPtr has NO getIndex() accessor — index is operand(1)).
