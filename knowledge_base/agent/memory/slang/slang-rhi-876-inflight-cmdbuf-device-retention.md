---
type: chain
title: slang-rhi#876 — in-flight command buffers retain the device
description: External report (EvanLuo42). Fixed on main by maintainer PR #884 (10-01); #880 closed as superseded (10-27). FINAL posted 10-28; watch-only, parked on a maintainer close.
tags: [slang-rhi, lifetime, refcount, handed-off, fixed-upstream]
---

# slang-rhi#876: in-flight command buffers retain devices

- **Issue:** https://github.com/shader-slang/slang-rhi/issues/876. Filed by an external contributor (EvanLuo42) with a GPU repro (`gResourceCount` delta). Status: OPEN as of 2026-10-14.
- **Cycle:** Device → Queue → in-flight CommandBuffer (strong `RefPtr` in `m_commandBuffersInFlight`) → Device. A second path runs through `m_trackedObjects` → Resource → Device.
- **09-16:** Triaged and confirmed by code read at `079b75b`. Parent decision was NO-GO/HOLD: the change is concurrency-sensitive and touches every backend. slang-fixer parked WARM.
- **09-30:** jkwak-work linked #884. The triager posted a handoff comment covering #884 @`3c65889c61` and named 3 test-coverage gaps: nothing holds the work pending, only 2 release orders are tested, and there is no concurrent-release test. The fixer stood down.
- **10-01:** #884 (skallweitNV) **MERGED** at `0bd799a7c0`, final head `3c65889c61`. It has no closing reference, so #876 stayed open.
- **Also open:** #880 (jkwak-work, "Let in-flight command buffers release their device") has `closes #876` and was last updated 09-30. It may be superseded by #884. That is the maintainers' call. Don't post there.
- **10-14:** Dispatched slang-triager (thread `gh-issue-shader-slang/slang-rhi-876`, pinned to `sess-1789548236032-xa4jo3`) to verify coverage on merged `main` and post the 5-bullet resolution on #876 suggesting a close. The follow-up one-shot task is `rechase-slang-rhi-876-re-b4fe`.
- **10-14 (resolution):** Triager posted [cmt 6164922327](https://github.com/shader-slang/slang-rhi/issues/876#issuecomment-6164922327) (verified as the bot, 2516 chars). Read the merged tree: it matches the reviewed head, `InternalRefPtr` in-flight lists and `m_trackedObjects` are on main, and the repro test is `test-device-lifetime.cpp:451`. The 3 gaps remain test-only gaps. The comment suggests closing as fixed-by-#884 and leaves #880 to maintainers. **Parked on a maintainer close decision.** Re-chase `rechase-slang-rhi-876-re-b4fe` was re-armed to **2026-10-28 09:00Z**. Its decision table: closed → terminal; #880 resolves → triager FINAL; otherwise re-arm +14d.
- **10-28 (re-chase):** #876 is still OPEN, with no human comment since 10-14. **#880 was CLOSED (not merged) by skallweitNV on 10-27** as superseded by #884 ([cmt 6437948007](https://github.com/shader-slang/slang-rhi/pull/880#issuecomment-6437948007)). That comment names two tests on `main` as coverage: `device-lifetime-in-flight-command-buffer` and `device-lifetime-in-flight-command-buffer-bound-resources`. Decision (b): dispatched slang-triager on thread `gh-issue-shader-slang/slang-rhi-876`, pinned to `sess-1789548236032-xa4jo3`. The ask is a FINAL 5-bullet on #876 that verifies the named tests and re-assesses the 3 gaps (gap (c), concurrent release, has no clear counterpart in the maintainer's list) and suggests a close. The old re-chase `-re-b4fe` is spent. The new one-shot is **`rechase-slang-rhi-876-fi-0ff5` @ 2026-11-11 09:00Z**: closed → terminal; FINAL missing → nudge + re-arm +7d; FINAL posted and no human reply → park on webhooks, no re-arm.
- **10-28 (FINAL):** Triager posted the FINAL comment, [cmt 6464958608](https://github.com/shader-slang/slang-rhi/issues/876#issuecomment-6464958608) (verified: bot, 2555 chars). Code read only, no test run, on main a521c01.
  - Gap (a), no pending workload: still open. Gap (b), release orders: covered (device-first and device-last). Gap (c), concurrent release: partly covered. The CPU mock-object race tests in `tests/test-ref-object.cpp` were already in #884; the earlier comments missed them, and the FINAL corrects that.
  - The comment says #876 is ready to close as fixed by #884; the remaining gaps are optional follow-up tests.
  - Chain is watch-only and parked on a maintainer close. The last timer is `rechase-slang-rhi-876-fi-0ff5` (2026-11-11 09:00Z). In case (d) it does not re-arm, and webhooks deliver the close.
