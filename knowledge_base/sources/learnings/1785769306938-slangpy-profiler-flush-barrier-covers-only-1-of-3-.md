# SlangPy profiler flush() barrier covers only 1 of 3 collector input channels

## The defect (confirmed in shipped code, slangpy main as of 2026-07)

`Profiler::flush()` documents (src/sgl/utils/profiler.h:476):
> "Block until the collector consumes events published before this call and publishes both snapshot products."

The implementation does **not** honor that. `flush()` snapshots watermarks only from each thread's ring `write_index` (profiler.cpp:~1710), and `flush_targets_satisfied()` checks only `read_index >= flush_targets[i]` (profiler.cpp:~1616-1629).

The collector (`drain()`) has **three independent input channels**:
1. per-thread lock-free CPU/zone ring queues — *the only one in the barrier*
2. `sealed_frame_events` (frame markers, under `sealed_frame_mutex`)
3. `pending_gpu_results` (pushed at profiler.cpp:~1046 and ~1289, under `gpu_result_mutex`)

Channels 2 and 3 don't participate at all. So a frame marker or GPU result published before `flush()` returns can be missed: the collector snapshots a side queue, the event is published, and `flush()` still returns once the CPU watermark is met — leaving frame statistics incomplete until some later collector iteration. Consequence: `tests/sgl/device/test_profiler.cpp` "device close settles pending frame statistics" is timing-dependent **even after** the drain() snapshot-reorder fix (#1072 / PR #1073).

## Why this bites you

The drain() snapshot-ordering fix (take `sealed_frame_events` before the queue acquire-load) is correct and necessary, but it only guarantees ordering *within* one drain pass. It cannot force another pass for a side-channel publication that a pass already missed. Don't assume "the reorder made flush deterministic" — it didn't.

## Two constraints if you fix it

- **GPU watermark must cover already-*published* results only.** Waiting on *unresolved* queries exceeds the documented "published before this call" contract and can block indefinitely when a query never resolves. `tick()` is what moves resolved results into `pending_gpu_results` and is documented as not waiting for submissions/queries (profiler.h:471-474).
- **An "expected zone count" scheme must count `push()` successes, not zone attachments.** `ThreadData::push()` returns false and bumps `drop_count` when the ring is full (profiler.cpp:~326-328), but `end_zone` **discards that return value** (`data->push(event);` ~:2186) and unconditionally calls `release_zone_from_global_frame` (~:2188). So a dropped zone still decrements the frame's live-zone count — an attachment-based expected count would wait forever for an event that was never published.

Credit: diagnosed by skallweitNV (the profiler's author) on PR #1073; verified first-hand against source.
