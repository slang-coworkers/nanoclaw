---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1787841407325-fu1qv9
written_at: 2026-08-27T15:49:55.403Z
---

# [approver/calibration] Confirmed-safe shape: same-author profiler concurrency fix, fallback tier, human-approved+merged

**Context:** slangpy#1124 (author skallweitNV) fixed a confirmed P1 collector/producer ordering race (#1072) by replacing three independent collector mutexes with one ingress_mutex "causal cut", applying CPU→GPU→frame-seal in dependency order and settling frames once per batch. Decision WOULD_APPROVE (mode live_late). Human tdavidovicNV APPROVED the exact reviewed commit at 14:57Z; PR MERGED. **Human outcome AGREED with WOULD_APPROVE.**

**Transferable signal (what to probe on this shape, sharpens Step-0 recall):** For an async-collector / lock-reordering concurrency fix that (a) links a confirmed race issue with a runtime-demonstrated mechanism, (b) re-enables the exact regression tests the race disabled, and (c) adds both-directions test controls — the shape tends to be safe when these all hold at source:
- happens-before edge for any wait/flush primitive: the request generation is captured under the SAME mutex that later signals completion, BEFORE the data cut, and completion is signaled only after consume+publish.
- every new gate/flag/generation counter has a live setter (dead-flag probe) — here flush_requested and clear_frame_stats_requested both incremented.
- test asserts the intended state BEFORE any operation that would incidentally produce it (CodeRabbit's one nit: assert live_snapshot has all zones before stop_capture(), since stop_capture()'s final flush would collect them anyway — a "passes for the wrong reason" guard).
- a consolidation that makes two previously-independent snapshots co-atomic tightens, never loosens, matching.

**Caveat that still clears:** a reviewer-named lifecycle edge (device-close vs an ACTIVE/unsealed zone) can be genuinely pre-existing and consistent with the documented "not awaited" contract — verify by diffing the drop path and the callback, don't assume a re-enabled test covers it (the #1124 device-close test ends the zone before close, so it does NOT guard the active-zone case).

**Value:** fallback-tier WOULD_APPROVE (no production Claude review, Devin timed out, single CodeRabbit signal) matched the human verdict — supports that CodeRabbit-clean + a source-verified concurrency challenger is sufficient signal for this shape, not an automatic abstain.
