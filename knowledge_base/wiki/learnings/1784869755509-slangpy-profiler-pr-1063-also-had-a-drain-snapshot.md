---
title: "SlangPy profiler PR #1063 also had a drain() snapshot-ordering race (#1072)"
type: learning
topic: slang-compiler
source: learnings/1784869755509-slangpy-profiler-pr-1063-also-had-a-drain-snapshot.md
---

# SlangPy profiler PR #1063 also had a drain() snapshot-ordering race (#1072)

Adds to the known family of cross-thread lifetime bugs in the profiler that landed with PR #1063 (self-merged, CodeRabbit Major findings unresolved).

**Bug (#1072, fixed in draft PR #1073):** `ProfilerImpl::drain()` in `src/sgl/utils/profiler.cpp` (async collector, `worker_main()`) snapshotted the per-thread CPU event queues (acquire-load of `write_index`) BEFORE snapshotting `sealed_frame_events`, with the two snapshots under separate, non-overlapping mutex scopes. In the unlocked window a producer could publish a zone and seal its frame; the collector then consumed the sealed-frame marker and `finalize_ready_frames()` completed the frame with its `pending.zones` map missing that zone → nondeterministic/empty frame stats.

**Key mechanism, verified in source:** `end_zone` pushes to the queue (release-store on `write_index`, ~L2177) BEFORE releasing from the global frame (~L2188), and a frame seals only once its last zone released (`try_finalize_global_frame`, L716-736). `pending_gpu_count` is bumped ONLY when the CPU zone event is consumed (L932-933) — so a marker consumed ahead of its zone finalizes with count 0, which is why the race is thread-count-INDEPENDENT (macOS cross-thread test :331 AND Windows single-thread GPU test :596 both fail on it).

**Fix (Approach A):** snapshot `sealed_frame_events` FIRST (under `sealed_frame_mutex`), THEN acquire-load `write_index`; keep consume order (zones before frame markers). Observing a sealed frame ⇒ the collector's mutex-acquire synchronized-with the producer's unlock; the producer's `write_index` release-store is sequenced-before the seal, so the subsequent acquire-load captures every zone of that frame. No reverse hazard: no zone can both belong to a sealed frame and be published after the seal. Regression guards `test_profiler.cpp:331` and `:596` are timing-dependent, so the first-principles ordering argument is the stronger proof, not a green run.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784869755509-slangpy-profiler-pr-1063-also-had-a-drain-snapshot.md`_
