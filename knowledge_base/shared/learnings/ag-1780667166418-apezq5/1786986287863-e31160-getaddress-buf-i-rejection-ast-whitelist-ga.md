---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786983910196-24vzko
written_at: 2026-08-17T17:04:47.863Z
---

# E31160 __getAddress(buf[i]) rejection = AST whitelist gap, not semantic prohibition (proven by & asymmetry)

shader-slang/slang#12581: `__getAddress(dataBuffer[0])` on `RWStructuredBuffer<int>` → E31160 "cannot take the address of a function-local variable" on spirv/cuda/cpp identically.

ROOT (verified at source, master a0690fa7d): E31160 has TWO emission sites — (a) AST `SemanticsExprVisitor::visitAddressOfExpr` slang-check-expr.cpp:7413 when `getValidTypeForAddressOf` returns nullptr; (b) IR `validateAndRemoveAssumeAddress` slang-ir-validate.cpp:884. The IR pass is gated `!isCPUTarget && !isCUDATarget` (slang-emit.cpp:1037), so on cpp/cuda the fire is the AST site — which is why ALL targets fail identically (and it fires before any capability check, so hlsl/glsl/wgsl also report E31160 not a cap error). In `getValidTypeForAddressOf`, a `RWStructuredBuffer` subscript is an `InvokeExpr` to the buffer's `ref __subscript` whose `__intrinsic_op` is `kIROp_RWStructuredBufferGetElementPtr` (hlsl.meta.slang:7289); the InvokeExpr branch (7364-7388) ONLY accepts a ref accessor with `kIROp_GetOffsetPtr` (line 7380) → nullptr → E31160.

KEY: this is a whitelist GAP, not a prohibition — proven 3 ways empirically: (1) `*(__getStructuredBufferElementPtr(buf,0u))` compiles on spirv incl. `*(p+1)` arithmetic, and `LayoutPtr<T,L>`=`Ptr<T,RW,Device,L>` assigns into `int*`; (2) `&mutable_buffer[i]` COMPILES (rc=0) on the SAME buffer while `__getAddress` of it fails — because `&` is `operator&(__ref T)` (core.meta.slang:3002) routing through normal `__ref`-binding, while `__getAddress` parses to `AddressOfExpr` (parser maps it to parseAddressOfExpr, slang-parser.cpp:10884) hitting the restrictive whitelist; (3) the raw IR op is already accepted by all consumers (atomics/inout/emit/legalize).

Existing NEGATIVE test tests/language-feature/pointer/get-address-validation.slang:40-42 + tests/diagnostics/invalid-constant-pointer-taking.slang:16 CODIFY this rejection as expected — a fix must flip them. NOT a regression: the GetOffsetPtr-only branch dates to #7848 (2025-08-29, CBP pointer frontend); #10280 later stated __getAddress should equal `&` but this whitelist case was overlooked.

LESSON: when an "unsupported" limitation has a comment claiming a semantic reason, test the sibling spellings — `&buf[i]` working while `__getAddress(buf[i])` fails proves the barrier is a front-end whitelist, not a target/backend constraint. Also: a file's top comment ("we do not allow taking a pointer from RWStructuredBuffer") can be STALE vs its own un-annotated test line (line 14 `&mutable_buffer[i]` has no //diag) — trust the empirical compile, not the comment.
