---
title: "SGL profiler drain() #1072 fix — snapshot reorder + why its guard tests are probabilistic"
type: learning
topic: misc
source: learnings/1784870556172-sgl-profiler-drain-1072-fix-snapshot-reorder-why-i.md
---

# SGL profiler drain() #1072 fix — snapshot reorder + why its guard tests are probabilistic

**Context:** Reviewing shader-slang/slangpy#1073, which fixes #1072 (profiler collector finalized a frame before consuming its cross-thread zones, dropping them from frame statistics).

**The fix (src/sgl/utils/profiler.cpp, ProfilerImpl::drain()):** reorder two snapshots — snapshot `sealed_frame_events` under `sealed_frame_mutex` BEFORE the per-thread queue drain that acquire-loads each thread's `write_index`. Consume order (zones before frame markers, GPU last) is unchanged. +14/−5, one TU.

**Why sound (the happens-before chain, load-bearing and worth reusing):**
- `push()` release-stores `write_index` (:331) to publish a zone.
- `end_zone` calls `push()` (:2186) THEN `release_zone_from_global_frame` (:2188) whose `global_frame.fetch_sub(acq_rel)` (:710) is sequenced-after the store.
- The acq-rel RMW chain on `global_frame` is a **release sequence**, so every zone-releaser thread synchronizes-with the sealing thread. An intervening RMW-by-another-thread does NOT break a release sequence (C++20); only a plain store would — and the two plain release-stores to global_frame (:660 begin, :734 store-inactive) only happen when the frame is already inactive/sealed, i.e. outside a live frame's release window.
- Seal pushes the marker under `sealed_frame_mutex` (:731-732); drain's lock (:750) acquires that unlock; drain's `write_index.load(acquire)` (:758) is sequenced-after. ⇒ zone store happens-before the load. Old order left a window between the two snapshots where the marker was consumed while the zone was still un-drained.
- Same guarantee closes the GPU empty-frame case: zones drained in the same round set `pending_gpu_count` (:941-942) before the marker triggers `finalize_ready_frames`, which blocks while count!=0 (:846).

**Key review gotcha — the guard tests are probabilistic, and this PR added NONE:** `git diff base..head -- tests/sgl/device/test_profiler.cpp` was byte-identical. The two cited "regression guards" (`test_profiler.cpp:331` cross-thread CPU, `:596` TEST_CASE_GPU device-close) PRE-EXIST on main and run through the background collector thread; they only catch #1072 if the collector happens to drain in the exact race window, so they pass on buggy code most of the time. A green run corroborates, it does not prove — correctness rests on the memory-model argument. A deterministic test would need a white-box hook to pre-seed `sealed_frame_events` + a per-thread queue and call `drain()` directly (the profiler exposes no collector-pause/drain-injection hook today). Verdict given: APPROVE_WITH_NITS (nit = coverage, not a code defect).

**Separate, intentional loss mode (not this race):** a zone dropped because its per-thread ring is full (`push()` returns false, :326-328) is still count-decremented in end_zone, so it can be absent from a finalized frame while `drop_count` increments — pre-existing overflow diagnostics, out of scope.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1784870556172-sgl-profiler-drain-1072-fix-snapshot-reorder-why-i.md`_
