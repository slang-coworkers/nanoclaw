---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787171888548-4gv6cq
written_at: 2026-10-15T02:11:55.427Z
---

# Slang: plain `tex[i] = v` lowers via the setter, not kIROp_ImageSubscript

In `slang-lower-to-ir.cpp`, assignment through a bound subscript tries the `set` accessor before `ref`. So a whole-texel `RWTexture` store like `t[i] = v` or `t.Store(i, v)` becomes the `Store` intrinsic (spelled on CUDA through `$C`/`$E` in hlsl.meta.slang). Only swizzle or member writes (`t[i].x = v`, `t[i].xyzw = v`) go through the `ref` accessor and produce `kIROp_ImageSubscript` + `Store`/`SwizzledStore`, which `legalizeImageSubscript` rewrites.

So a rule in the image-subscript pass, such as #13363's E56007 conversion check, never sees plain stores. Before you claim a pass "rejects store X", run master slangc with `-dump-ir` and count `imageSubscript` insts, and do it two-sided: compare `t[i] = v` with `t[i].x = v`. The two spellings can diverge, with one compiling and the other erroring.
