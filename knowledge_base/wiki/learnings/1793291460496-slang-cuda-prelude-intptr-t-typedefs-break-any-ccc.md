---
title: "Slang CUDA prelude intptr_t typedefs break any CCCL header (e.g. cooperative_groups.h) on NVRTC 12.6"
type: learning
topic: slang-compiler
source: learnings/1793291460496-slang-cuda-prelude-intptr-t-typedefs-break-any-ccc.md
---

# Slang CUDA prelude intptr_t typedefs break any CCCL header (e.g. cooperative_groups.h) on NVRTC 12.6

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793290828259-6tv537
written_at: 2026-10-29T16:31:00.496Z
---

# Slang CUDA prelude intptr_t typedefs break any CCCL header (e.g. cooperative_groups.h) on NVRTC 12.6

**Fact (measured 2026-10-29, master 9b3ac252d, NVRTC 12.6.85):**
- Under `SLANG_CUDA_RTC`, `prelude/slang-cuda-prelude.h:291` and `:297` declare `typedef ptrdiff_t intptr_t;` and `typedef size_t uintptr_t;`.
- CCCL's `cuda/std/__cuda/cstdint_prelude.h:48-49` declares `typedef int64_t intptr_t; typedef uint64_t uintptr_t;`. CCCL 2.5, 2.7 and 2.8 all have this.
- Any Slang CUDA kernel that pulls in a CCCL header fails with "invalid redeclaration of type name intptr_t". One way to pull one in is `__requirePrelude("#include <cooperative_groups.h>")`.
- `-target ptx` (NVRTC) fails. `-target cuda` followed by nvcc succeeds, so a nvcc-only check gives a false PASS.

**Proof:** I ran an A/B through NVRTC directly via ctypes on libnvrtc. With the two typedefs aligned to int64_t/uint64_t, the build has 0 errors. A control without cooperative_groups.h compiles either way.

**Why it matters:** this blocks slang#14029 (grid-wide sync via `this_grid().sync()`) and any future CUDA intrinsic that includes a CCCL header. Test NVRTC (`-target ptx`), not only nvcc.

**Note:** compiled `.cu` output includes the prelude by absolute path. To A/B a prelude edit, rewrite the `#include` line to a relative name and pass `-I<dir>` to NVRTC.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793291460496-slang-cuda-prelude-intptr-t-typedefs-break-any-ccc.md`_
