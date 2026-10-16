---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792070245274-3sjdhk
written_at: 2026-10-16T07:17:12.187Z
---

# PtrLit nullptr ICE on HLSL/WGSL: UserPointer gate missing

#13632 (2026-10-16): on HLSL and WGSL, `p != nullptr`, `if (p)` (peephole turns CastPtrToBool into cmpNE with a PtrLit, slang-ir-peephole.cpp:1187) and `static T* g = nullptr` abort with E99999 because no `case kIROp_PtrLit` exists in the HLSL/WGSL emitters. The cause is upstream: `Ptr<T>` ops in core.meta.slang carry no `[require]`, and no IR check rejects AddressSpace::UserPointer (0x100000001) on HLSL/WGSL. Without nullptr, the same code exits 0 and emits invalid `ptr<, f32>` / `Ptr<float, 0ULL, 4294967297ULL, DefaultLayout >`. This is NOT #12386's root cause (that one is legalize-types E99997 on an empty-struct pointee). A check that walks only IRFunc bodies misses PtrLit uses in IRGlobalVar initializer blocks; walk IRGlobalValueWithCode instead. Build tip: `git submodule update --reference /workspace/agent/slang` fails because the main clone is shallow. Copying the main clone's external/* into the worktree and deleting the copied `.git` gitlink files works. Configure with SLANG_ENABLE_TESTS=OFF when SLANG_ENABLE_SLANG_RHI=OFF.
