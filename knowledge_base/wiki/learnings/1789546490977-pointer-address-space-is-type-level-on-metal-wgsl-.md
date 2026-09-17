---
title: "Pointer address space is type-level on Metal/WGSL but pass-inferred on SPIR-V"
type: learning
topic: slang-compiler
source: learnings/1789546490977-pointer-address-space-is-type-level-on-metal-wgsl-.md
---

# Pointer address space is type-level on Metal/WGSL but pass-inferred on SPIR-V

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786539184926-uximgs
written_at: 2026-09-16T08:14:50.977Z
---

# Pointer address space is type-level on Metal/WGSL but pass-inferred on SPIR-V

When reasoning about "can this pointer situation happen on target X" in Slang, remember the address-space model differs by target:

- **SPIR-V:** source `int*` is address-space-agnostic; the concrete storage class (Function/StorageBuffer/Workgroup/PhysicalStorageBuffer) is assigned LATER by the `specializeAddressSpace` IR pass. So a function returning pointers in two different address spaces is only detectable in/after that pass (that's what E58005 `conflicting-return-pointer-storage-classes` catches, and E58004 catches non-returnable classes).
- **Metal / WGSL:** a pointer's address space is PART OF ITS TYPE (`Ptr<T, Access, AddressSpace.Device|GroupShared|..., Layout>`). So the SAME conflict (e.g. returning a `uniform int*` device pointer on one path and `__getAddress(groupshared)` threadgroup pointer on another) is a plain **type mismatch — E30019** — reported in semantic checking, BEFORE the address-space pass. It never reaches the pass.

Consequences verified empirically (built slangc, 2026-09):
- Metal DOES allow functions that return pointers (a `uniform int*` passthrough compiles; a same-address-space return compiles). Pointers are NOT unavailable on Metal/WGSL.
- `__getAddress` is the spelled-out form of `&` and is available on Metal (see tests/metal/metal-pointer-params.slang, pointer-in-buffer-getaddress.slang). `__getAddress` of a **function-local** is rejected with **E31160** ("cannot take the address of a function-local variable on this target"); `__getAddress` on a structured-buffer subscript `buf[i]` is a pre-existing frontend limitation on ALL targets (issue #10841).
- `&gShared` (groupshared) in a Metal/WGSL/GLSL compute entry point can give **E36107** ("unavailable features in entry point") — but that is context-specific, NOT a general "pointers unavailable". Do not generalize one E36107 into "no pointers on this target."

META-LESSON (a maintainer pushed hard on this): treat any "X cannot reach Y" claim in code/PR comments as needing a **citation or a failing repro**, never prose. A plausible unreachability argument that hasn't been run is exactly where reviews stall. If you must state unreachability, name the exact diagnostic that enforces it (with a test), or weaken the claim to "not attempted; covered by construction."

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789546490977-pointer-address-space-is-type-level-on-metal-wgsl-.md`_
