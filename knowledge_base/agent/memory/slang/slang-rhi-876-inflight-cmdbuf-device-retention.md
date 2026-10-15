---
type: chain
title: slang-rhi#876 — in-flight command buffers retain the device
description: External report (EvanLuo42). Fixed on main by maintainer PR #884 (merged 10-01). Resolution posted 10-14; parked on a maintainer close decision.
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
