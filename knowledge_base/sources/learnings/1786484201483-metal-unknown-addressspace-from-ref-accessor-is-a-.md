---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786482506369-2d1v6h
written_at: 2026-08-11T21:36:41.483Z
---

# Metal 'Unknown addressspace' from ref accessor is a lower-to-ir return-value bug, not the addr-space pass

shader-slang/slang#12487: a property `[mutating] ref` accessor aborts Metal emit with `Unknown addressspace encountered`. This looks like another member of the address-space-seeding family (#11969/#12015 fragment out-param, #11981/#12014 export out/inout param — those ARE addr-space-pass bugs), but it is NOT. It is a single upstream lower-to-ir producer bug.

ROOT CAUSE (verified at source, master cad86b5d3): in `source/slang/slang-lower-to-ir.cpp`, a `RefAccessorDecl`'s function TYPE is correctly set to `getPtrType(...)` at :4801-4805, but `visitReturnStmt` (:8837) has NO ref-accessor special case. `return _v;` takes the ordinary path :8874 `lowerRValueExpr` → :8881 `emitReturn(getSimpleVal(...))`, and `getSimpleVal` LOADS the pointer. So the emitted helper body is `get_field_addr; load; return_val(value)` — byte-identical to the `get` accessor — returning `Int` while the func type says `Ptr(Int)`. (`set` returns void and IS special-cased at :4790; `ref` was forgotten. `int` is copyable so the `maybeAddReturnDestinationParam` non-copyable path at :4238 does not fire.)

ONE root, four target symptoms (all measured, no GPU — metal/spirv emit are compile-time):
- Metal: returned value is Int (addr space Generic) ⇒ the return-pointer fixup in slang-ir-specialize-address-space.cpp:289-314 (fires only when the returned value's addr space != Generic) never assigns a space to the Ptr(Int) return ⇒ emitter default: canary slang-emit-metal.cpp:1397. NOTE the helper's PARAM *does* get ThreadLocal via call-site specialization, so "func was never seeded" is FALSE — the gap is the RETURN, not the param.
- SPIR-V: definition legalized to value-return (`OpTypeFunction %int`) but call site pointer-returns (`OpFunctionCall %_ptr_Function_int` + OpStore) ⇒ invalid module (validation error).
- HLSL/GLSL/WGSL: emit `Ptr<int> f(...){ return this._v; }` / `-> ptr<function,i32> { return (*this)._v; }` = type-mismatched reference helper; `f(c)=13` writes through a value copy = LOST WRITE. "Compiles cleanly" = "did not abort", NOT correct.

DEDUP: this is the Metal facet of the pre-existing OPEN #9636 ("struct property/__subscript ref() produces invalid code") — #9636's repro reproduces the identical Metal abort AND the identical SPIR-V validation error. One fix should close both.

FIX (recommended): in visitReturnStmt, when context->funcDecl is a RefAccessorDecl, return the ADDRESS (the l-value LoweredValInfo::Ptr) rather than getSimpleVal (which loads). One producer-side change fixes all targets. Rejected: defaulting the still-Generic return pointer in the Metal addr-space pass — masks the mismatch, fixes only Metal.

REUSABLE TRIAGE LESSON: for a Metal "Unknown addressspace" abort, don't assume the addr-space seeding family. Dump IR and check whether the offending function's body RETURN matches its declared pointer-return type. If the body loads-and-returns a value while the type says Ptr, the bug is in return-statement lowering upstream, and the same mismatch will show up as an invalid SPIR-V module and silently-wrong HLSL/GLSL/WGSL — a strong signal it is one producer bug across all targets, not a Metal-emitter issue.
