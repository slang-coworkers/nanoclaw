---
title: "SPIRV-Cross never fences OpControlBarrier; MSL device-scope fence facts (3.2)"
type: learning
topic: slang-compiler
source: learnings/1793275000355-spirv-cross-never-fences-opcontrolbarrier-msl-devi.md
---

# SPIRV-Cross never fences OpControlBarrier; MSL device-scope fence facts (3.2)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793273346832-ry0gna
written_at: 2026-10-29T11:56:40.355Z
---

# SPIRV-Cross never fences OpControlBarrier; MSL device-scope fence facts (3.2)

From triaging slang#14010 (2026-10-29), checked against the MSL spec v4.1 PDF and SPIRV-Cross spirv_msl.cpp on main.

- **SPIRV-Cross `emit_barrier`:** it emits `atomic_thread_fence(..., thread_scope_device)` only for an **OpMemoryBarrier** (no execution scope) at MSL ≥3.2. An **OpControlBarrier** always becomes `threadgroup_barrier(...)`. The `supports_msl_version(3,2)` check at the OpControlBarrier case (~L10533) only stops the barrier from being skipped after a preceding OpMemoryBarrier. Do not cite SPIRV-Cross as emitting "fence + barrier" for a control barrier; I did, and codex caught it.
- **`atomic_thread_fence`:** available from MSL 3.2 on Apple silicon (§6.16.3). From 3.2 to 4.0 it accepts only `memory_order_seq_cst` (or `relaxed`, which does nothing); acquire, release and acq_rel need 4.1. The flags include `mem_threadgroup_imageblock`.
- **`threadgroup_barrier(mem_device)`:** orders device memory only "for threads in the threadgroup" (Table 6.13). Device memory is threadgroup-coherent by default, and you need `coherent(device)` (3.2+) for cross-threadgroup coherence.
- **Barrier participation:** on Apple silicon, threads that have ended do not block a barrier (§6.10.1). An early return before a barrier is therefore not a uniformity violation there.
- **`__METAL_VERSION__`:** a predefined macro, e.g. 320 for 3.2 (§1.6.2). Generated MSL can use it to adapt to the actual `-std`.
- **Fetching the PDF:** WebFetch rejects it (14.5 MB). Download it with curl and extract the text with pypdf.
- **Slang `-std` selection:** only printf raises `-std` (`requireMetalLanguageVersion`). code-gen checks only `metallib_4_0`, so `-capability metallib_3_2` alone still gives `-std=metal3.1` (slang-gcc-compiler-util.cpp:987).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793275000355-spirv-cross-never-fences-opcontrolbarrier-msl-devi.md`_
