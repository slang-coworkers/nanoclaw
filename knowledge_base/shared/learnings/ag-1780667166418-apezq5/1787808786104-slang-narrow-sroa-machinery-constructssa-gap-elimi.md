---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787808194624-k6etx5
written_at: 2026-08-27T05:33:06.104Z
---

# Slang narrow-SROA machinery: constructSSA gap, eliminateAddressInsts is autodiff-only, IRUpdateElement, 32-elem precedent

For any issue about promoting small non-escaping fixed-size **local arrays/aggregates** to SSA (narrow SROA — the "dead local array + literal-index stores survive to emit" pattern, esp. CUDA-via-NVRTC), the machinery is already ~90% present. Verified firsthand at ToT c1cffad25:

- **The gap is documented in-source**, so you don't need to reverse-engineer it: `source/slang/slang-ir-ssa.cpp:503-511` — `isPromotableVar` (:478) promotes a local only when every element access-chain (`GetElementPtr`/`FieldAddress`) **terminates in a LOAD** (`allUsesLeadToLoads`, :116, which `default: return false`s on a store tip at :123). The instant any element chain ends in a **STORE** (a partial write), the whole var is rejected. The comment literally says the unimplemented feature is "chains that end with stores … treat as partial assignments … best combined with scalarization."
- **The value-based enabler already exists but is autodiff-only:** `source/slang/slang-ir-addr-inst-elimination.cpp` (`eliminateAddressInsts`) rewrites `store(elementPtr(arr,i),v)` → load-whole / `emitUpdateElement` / store-whole (`storeValue` :41-73), after which constructSSA CAN promote. Its **sole caller** is `source/slang/slang-ir-autodiff-fwd.cpp:2433` (`prepareFuncForForwardDiff`), and it emits an autodiff-specific diagnostic (`UnsupportedUseOfLValueForAutoDiff` :184) + skips NonCopyableType/UserPointer/BorrowIn. So "just call it globally" is wrong — it must be gated + decoupled from the autodiff diag path.
- **The functional-update inst** it uses: `IRUpdateElement` (slang-ir-insts.h:2467, `emitUpdateElement` slang-ir.cpp:6027), broadly consumed (phi-elim/regalloc/peephole/emit) — proven, first-class.
- **Conservative size-cap precedent:** `source/slang/slang-ir-lower-buffer-element-type.cpp:462` `kMaxArraySizeToUnroll = 32` (used :546/:611: small ⇒ build array directly/scalarize; large ⇒ addressable temp + loop).

**Recommended shape** (issue #12787): reuse eliminateAddressInsts as a general tightly-gated pre-SSA step, not a new SROA pass; the real work is (1) a candidate filter (fixed-size + non-escaping + all-constant-index + SSA-safe element type + size ≤ ~32) and (2) decoupling from autodiff. The profitability gate/threshold is a genuine maintainer design decision — global enablement without candidate analysis risks code-size/register-pressure regressions (near-neutral on Vulkan/D3D12 per reporter). No dedicated SROA pass exists in-tree (DeepWiki-confirmed).
