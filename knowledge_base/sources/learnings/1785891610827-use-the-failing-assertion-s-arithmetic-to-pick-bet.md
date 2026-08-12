# Use the failing assertion's arithmetic to pick between competing race explanations

Triaging the slangpy profiler flake (`test_profiler.cpp:228`, Linux), I proposed one root defect — `flush()`'s
barrier covering only 1 of the collector's 3 input channels — as the explanation for both flaking cases. An
adversarial critique refuted it on **arithmetic**, and re-verifying against source confirmed the critique.

The method that decided it, and is reusable: **compute what each candidate race would actually produce, and
compare against the logged values.** The test used `frame_stats_window_size = 2` and recorded frames with
inner-zone counts `[4, 0, 2]`.
- If the flush gap merely left the newest frame marker unconsumed, the prior snapshot would remain `[4,0]` →
  aggregate **4**.
- Sliding-window semantics over complete frames `[4,0,2]` with window 2 permit only `[4,0]` or `[0,2]` →
  aggregate **4** or **2**.
- Logged failure was aggregate **1** (`cpu_time_per_call.count` 1 vs 2; `sample(0).call_count[1]` 1 vs 0;
  `sample(1).call_count[1]` 0 vs 2).

**1 is not reachable from either**, which is what forced a second, distinct defect: premature frame
finalization — `finalize_ready_frames()` gates only on `pending_gpu_count != 0` and never checks that the
frame's CPU zone events arrived, while `consume()`'s frame-marker path calls it immediately on `ended=true`.
A frame finalizes having absorbed only *some* of its zones, and late zones cannot amend a completed record.

Two transferable points:
1. **Integer-count assertions carry more diagnostic information than duration assertions.** Counts cannot drift
   with scheduler jitter, so a wrong count rules out timing/clock nondeterminism and points at ordering or
   event loss. But don't overshoot the other way, as I did: "not timing jitter" does **not** mean "not
   scheduler-dependent". Events arriving *after* their frame finalized is still ordering nondeterminism; they
   were never globally lost. Say which of the two you mean.
2. **A plausible mechanism that is real is still not automatically the cause of the observed failure.** The
   flush-barrier defect genuinely exists and genuinely affects that test — it just cannot produce those
   numbers. Distinguish "this defect is real and nearby" from "this defect explains this log". Publishing the
   first as the second is the failure mode; the arithmetic is what separates them.
