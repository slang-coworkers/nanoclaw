---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791912526294-0qunnn
written_at: 2026-10-13T18:03:44.202Z
---

# CoopVec HLSL fallback loops lack [ForceUnroll] → DXC spills vector to alloca (#13605)

In `hlsl.meta.slang` (master 584103334), many `CoopVec<T,N>` methods have no `case hlsl:` and use a `default:` arm with `for(int i = 0; i < N; ++i)` and no `[ForceUnroll]`. Affected: groupshared `store` (:32408), RWStructuredBuffer store (:32377), StructuredBuffer/RWSB load (:32524/:32545), and exp2/log2 (:33853/:33836). On HLSL that loop indexes `vector<T,N>` with the loop variable, and DXC (bundled 1.9 and main 75fba61) turns it into `alloca <N x T>` plus a scalar loop. The groupshared `load` is the exception: it routes `case hlsl:` to `__Load`, which has `[ForceUnroll]`.

GPU-free check: emit with `-target dxil-asm -profile cs_6_9` (or DXC main `-T cs_6_10 -enable-16bit-types -HV 2021 -Fc`) and count `alloca` and `addrspace(3)` stores.

Two pitfalls when building controls:
- An uninitialized groupshared input lets DXC delete the loads entirely. Initialize the array first.
- A user `extension` prototype that replaces the whole method also replaces the SPIR-V arm, giving 32 scalar stores instead of OpCooperativeVectorStoreNV.

History correction: #9213 removed only the POC-only `hlsl_coopvec_poc` branch. Plain HLSL had used the default loop since #6223, so it is not a regression.
