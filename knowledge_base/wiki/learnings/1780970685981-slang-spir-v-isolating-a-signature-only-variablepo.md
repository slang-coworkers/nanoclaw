---
title: "slang SPIR-V: isolating a signature-only VariablePointers cap repro (avoid value-site self-declare)"
type: learning
topic: slang-compiler
source: learnings/1780970685981-slang-spir-v-isolating-a-signature-only-variablepo.md
---

# slang SPIR-V: isolating a signature-only VariablePointers cap repro (avoid value-site self-declare)

When writing a SPIR-V codegen repro for "capability declared from value sites but not from a function signature" (e.g. #11518, `SPV_KHR_variable_pointers`/`VariablePointers` for Workgroup pointers), the hard part is constructing a case where NO value site declares the cap, so only the surviving signature does.

In `slang-emit-spirv.cpp`, `requireVariableBufferCapabilityIfNeeded(IRInst* type)` is called from var/phi/call/get-element/get-offset-ptr/load sites; it declares the cap iff `as<IRPtrTypeBase>(type)` succeeds AND the address space is GroupShared/StorageBuffer. Crucial subtleties that make a naive repro accidentally PASS (hiding the bug):
- A groupshared `OpVariable` does NOT self-declare: `emitVar` passes the variable's *value* type (e.g. `float`), not its pointer type.
- A scalar `OpLoad`/`OpStore` of a scalar pointer does NOT declare it: the result is the scalar, not a pointer.
- BUT member access (`ptr.value1`), subscript (`ptr[i]`), and pointer arithmetic (`ptr + x`) all emit an access-chain / get-offset-ptr whose RESULT is a Workgroup pointer → that value site DOES declare the cap → hides the signature bug. This is why the pre-existing `tests/language-feature/pointer/ptr-to-groupshared*.slang` and `tests/spirv/address-space-specialize.slang` (which have `%_ptr_Workgroup` params but access-chain in the body) never caught it.

Working repro shape: `[noinline] float readScalar(Ptr<float, Access::ReadWrite, AddressSpace::GroupShared> p) { return *p; }` called with `__getAddress(gs)` of a SCALAR groupshared global. `*p` (core.meta.slang `operator*` → `Ref`) lowers to a direct load with no access-chain; whole-var address emits no element-ptr. `[noinline]` keeps the param in the emitted `OpTypeFunction` (general/TypeInlining passes don't force-inline plain pointer params; only Ref/Borrow/String/ForceInline do).

Verify FAIL-without-fix cheaply: `git stash push -- source/slang/slang-emit-spirv.cpp` then incremental rebuild (`cmake --build --preset debug --target slang-test`, ~minutes vs ~20min full) and re-run; `git stash pop` + rebuild to restore. FileCheck ordered checks work since SPIR-V module order is Capabilities → Extensions → … → OpTypePointer → OpTypeFunction; disassembly uses friendly names like `%_ptr_Workgroup_float`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780970685981-slang-spir-v-isolating-a-signature-only-variablepo.md`_
