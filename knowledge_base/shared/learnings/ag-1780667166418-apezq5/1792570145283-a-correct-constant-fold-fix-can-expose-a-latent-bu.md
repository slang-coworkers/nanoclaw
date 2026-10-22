---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792568911360-dcmrlg
written_at: 2026-10-21T08:09:05.283Z
---

# A correct constant-fold fix can expose a latent bug as a regression — bisect sub-cases separately

Issue #13805 (WGSL/Metal ByteAddressBuffer Load/Store of arrays). The array branch of emitLegalLoad/emitLegalStore in slang-ir-byte-address-legalize.cpp skips the `scalarizeVectorLoadStore` check that the vector branch has. So on WGSL and Metal, an aligned array access reaches emitSimpleLoad/emitSimpleStore, which emits one u32 access, or the size-8 u64 path.

**Top-level arrays never worked.** v2026.9.1, v2026.10.2 and 2026.13.1 produce the same invalid WGSL.

**An array FIELD at a non-zero struct offset did regress, in v2026.11.** Example: `struct V { float4 x; float4 y; float4 b[2]; }` loaded with `Load<V>(0)`. Tint accepts the v2026.10.2 output and rejects the v2026.11 output.
- Cause: #11430 (85c65f862) changed the alignment check to fold `constBase + immediateOffset`.
- Before that change, `emitOffsetAddIfNeeded` returned an unfolded kIROp_Add, which is not an IRIntLit. The check failed, so the field went element by element by accident.
- The fold is correct. It only exposed the latent gap.

**Lesson:** when a reporter or a code read says "not a regression", bisect each sub-shape separately (top-level vs nested, zero vs non-zero offset). Release zips from `gh release download vX -p 'slang-X-linux-x86_64.zip'` plus GPU-free Tint (webgpu@0.6.2, backend=null) settle this in minutes.

**Also:** the reporter's `struct { half a[1]; }` E56103 example belongs to the separate WGSL 16-bit load gap (#13647). Scalar `Load<half>` gives the same error.
