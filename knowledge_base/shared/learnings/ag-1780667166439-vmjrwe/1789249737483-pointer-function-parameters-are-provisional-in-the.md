---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788273857996-jsrk1t
written_at: 2026-09-12T21:48:57.483Z
---

# Pointer function parameters are provisional in the specialize-address-space pre-pass

When writing a reconcile/analysis step that runs *inside* `specializeAddressSpace` (slang-ir-specialize-address-space.cpp) **before the main dataflow**, do NOT read a pointer **function parameter's** declared address space and treat it as authoritative.

Why: `specializeFunc` rewrites a callee's pointer-parameter address spaces from the *actual argument* address spaces when its callers are specialized — and that runs *after* an early pre-pass (e.g. a slot-reconcile pass gated on `if (sink)`). So at pre-pass time a parameter's surface pointee (`int*` → `Device`/PhysicalStorageBuffer) is only **provisional**. Reading it causes a false positive: a `[noinline]` helper whose `int*` parameter is passed a descriptor-backed `StorageBuffer` element pointer (`&buf[j]`) gets specialized to `StorageBuffer`, so merging it with another element pointer is *consistent*, but the pre-pass sees the provisional `Device` type and wrongly reports `inconsistent-pointer-address-space` (E58003).

Key facts:
- `kIROp_Param` covers BOTH phi values (non-entry block parameters) AND function parameters (entry-block parameters). Distinguish via `block != code->getFirstBlock()`. But for a pre-pass that runs before specialization, treat BOTH as unresolved (return `AddressSpace::Generic`) — a phi is resolved later by propagation, a function param by call specialization. Let the slot's *concrete* writes drive reconciliation via the join.
- A `kIROp_CastIntToPtr` (integer→pointer, e.g. `(int*)0x1000`) is a *direct* physical value whose type IS authoritative — conflicts against it ARE detectable in the pre-pass. Only *parameters* are provisional.
- Genuine cross-function conflicts through a physical parameter, and a specialized parameter's `-g` debug backing var (which keeps the old pointee after specialization), need reconciliation AFTER call specialization — a separate, larger piece of work. Don't claim they "always error": SPIR-V validation is opt-in (`SLANG_RUN_SPIRV_VALIDATION=1`), so without it the compiler can silently emit ill-typed SPIR-V.

Meta: codex CODE_REVIEW caught this across two rounds (first the over-broad "Generic for all params missed a real conflict", then the "honoring entry-param created a false positive"). Adversarial second-opinion review on address-space/parameter code pays off — the pass-ordering interaction is easy to miss. Context: PR #12592 / issue #12581.
