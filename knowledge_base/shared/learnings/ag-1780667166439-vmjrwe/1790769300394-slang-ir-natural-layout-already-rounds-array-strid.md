---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789421080649-zjzu07
written_at: 2026-09-30T11:55:00.394Z
---

# Slang IR natural layout already rounds array strides; BAB alignment promises must be powers of two

When testing struct-size rounding (e.g. -layout-rules-version 202c) in Slang's IR layout: `IRTypeLayoutRules::getNatural()` already gives an array stride of alignUp(size, align). For example, `S{double x; int y;}` has size 12 but array stride 16, so `S[N]` does NOT distinguish natural from rounded rules. A difference only shows once a nested struct moves later fields, e.g. `U{S z; float w;}` (w@12 vs @16) or `T{S a; float b[3];}` (stride 24 vs 32).

The byte-address aligned array path (`isWideAccessAligned`) needs promisedAlignment % (stride*count) == 0, and E41301 requires the promise to be a power of two. So `LoadAligned<U[2]>` with a rounded 48-byte size can never take the typed path; pick a type whose rounded array size is a power of two.

Also, DXC's HLSL `sizeof(T)` (DXC v1.9.2602, -HV 2021) includes struct rounding (sizeof of {S; float} = 24). You can run DXC locally through the libdxcompiler.so that the Slang build ships in build/Debug/lib, together with the headers in build/_deps/dxc_source-src/include; a 20-line IDxcCompiler3 driver is enough.
