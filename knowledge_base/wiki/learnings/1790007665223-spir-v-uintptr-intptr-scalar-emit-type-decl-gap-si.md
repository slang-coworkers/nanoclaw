---
title: "SPIR-V UIntPtr/IntPtr scalar emit: type-decl gap + signedness-classifier inconsistency"
type: learning
topic: slang-compiler
source: learnings/1790007665223-spir-v-uintptr-intptr-scalar-emit-type-decl-gap-si.md
---

# SPIR-V UIntPtr/IntPtr scalar emit: type-decl gap + signedness-classifier inconsistency

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790003404077-lxttct
written_at: 2026-09-21T16:21:05.223Z
---

# SPIR-V UIntPtr/IntPtr scalar emit: type-decl gap + signedness-classifier inconsistency

Fixing slang#8480 (runtime `usize_t`/`uintptr_t` crashed SPIR-V emit with "Unhandled global inst: UIntPtr"):

**The fix is at the emit layer, not the producer — a documented exception to the usual "unhandled inst = producer bug" heuristic.** `UIntPtr`/`IntPtr` (usize_t/uintptr_t/intptr_t/size_t/ssize_t) are legitimate pointer-sized integer scalars whose bit width is target-dependent and only known at emit (`getPointerSize(targetReq)*8`). No pre-emit pass lowers them (real pointers use `OpTypePointer`, a separate path). Every other backend maps them at emit. The tell: the SPIR-V **constant** path (`literalBits`/`emitIntConstant` in slang-emit-spirv.cpp) already grouped `PtrType`+`UIntPtrType`, so only the **type-declaration** switch in `emitGlobalInst` was missing the case → the constant emitted fine but its type couldn't be declared, so ONLY a *runtime* value crashed (a constant folds away). Fix = add `case kIROp_UIntPtrType:` to the integer type-decl switch; the existing body works verbatim because `getIntTypeInfo`→`getIntTypeWidth`/`getIntTypeSigned` (slang-ir.cpp) already resolve UIntPtr.

**IntPtr (signed) is NOT a symmetric one-liner — there's a pre-existing signedness-classifier inconsistency.** `getIntTypeSigned` (slang-ir.cpp) treats IntPtr as signed, but `isSignedType` (slang-ir-util.cpp) omits it (falls to default → false). The SPIR-V `emitIntCast` uses `getIntTypeInfo` (sees IntPtr as signed) then calls `getUnsignedTypeFromSignedType`, which `SLANG_RELEASE_ASSERT(isSignedType(type))` → asserts. Plus the value path's `default` emits an IntPtr constant at 32 bits under a 64-bit type → SPIR-V validation error "OpConstant ... says it has 4 words, but found 5". So intptr_t needs isSignedType(IntPtr)=true + getUnsignedTypeFromSignedType case + value-path IntPtr. `getOppositeSignIntTypeOp` already handles IntPtr↔UIntPtr. If a task authorizes "both IntPtr+UIntPtr" as a symmetric type-decl add, verify — IntPtr cascades beyond the type-decl.

**byte-address-buffer.slang VK expected reference was copied from the Metal reference** (`.3.expected.txt` byte-identical to `.2.expected.txt`); after the crash fix the VK leg still mismatches only in the `float4x3` member of a stored struct (pointer/uintptr stores are correct). A test disabled-at-creation may have a reference that was never validated for its disabled target.

**Harness gotcha:** `slang-test <file.slang>` standalone marks SIMPLE `-target spirv` FileCheck tests "ignored" ("FileCheck is not available") — including committed tests (atomic-64bit.slang). Verify via manual emission + `SLANG_RUN_SPIRV_VALIDATION=1`; CI runs the real FileCheck.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790007665223-spir-v-uintptr-intptr-scalar-emit-type-decl-gap-si.md`_
