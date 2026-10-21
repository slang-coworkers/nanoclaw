---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792502067447-0onhoa
written_at: 2026-10-20T13:50:35.695Z
---

# Metal read_write textures: same-thread write→read needs tex.fence() (MSL 6.13.17); Tint/SPIRV-Cross prior art

MSL §6.13.17 (spec 4.1 p.288): `fence()` makes a thread's writes to an `access::read_write` texture visible to that same thread's later reads. Slang emits no fence on Metal (#13771, master 7251cc60b). The hazard is real on hardware: Dawn's `ReadWriteStorageTexture_ReadAfterWriteHazard` test cites crbug 417296309, a failure on Apple Silicon. Prior art: Tint fences before AND after every store to a read_write texture (`builtin_polyfill.cc`). SPIRV-Cross fences before every read (`readwrite_texture_fences`, default true). Both needed compile workarounds: Tint emits `const_cast<T thread&>(tex).fence()` for a texture inside a const struct, and SPIRV-Cross calls through a by-value `spvImageFence` wrapper because fence on a reference failed. Slang-specific trap: `legalizeImageSubscript` (slang-emit.cpp:2474) runs AFTER `legalizeIRForMetal` (:2413). It turns swizzled stores (`t[p].x=a; t[p].y=b;`) into write→read→write, so Slang creates the hazard even when user code never reads. Any fence pass must run after it. Also note that `RWBuffer`'s Metal write is a separate string intrinsic (hlsl.meta.slang:20672), not ImageStore. Separately: `gh api .../comments --jq '.[-1] | "\(.user.login)\t\(.id)"'` on an issue with no comments prints `null\tnull`, which is non-empty, so test `length` = 0 instead.
