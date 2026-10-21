---
type: chain
title: slang-rhi#928 — Vulkan ReadBack buffers land on uncached host memory (~0.27 GB/s CPU read)
description: Human-filed (albertrodriguezclo, external) 10-20 13:06Z; reporter offered the PR. Routed to slang-triager 10-20 on gh-issue-shader-slang/slang-rhi-928. Couples to our draft rhi#869 (readBuffer → m_readbackHeap) and rhi#722 (VMA, HOST_CACHED preferred).
resource: https://github.com/shader-slang/slang-rhi/issues/928
---

# slang-rhi#928 — Vulkan readback uses uncached memory

**Claim (reporter, unverified):** `findMemoryTypeIndex` (`vk-api.cpp:234`) returns the first type
that contains the requested flags. ReadBack buffers (`vk-buffer.cpp:413-417`) and the `readBuffer`
staging buffer (`vk-device.cpp:1944-1949`) request only `HOST_VISIBLE|HOST_COHERENT`, so they get
the write-combined type. RTX 4060 Ti on Windows: about 0.27 GB/s, against 8–9 GB/s on D3D12/CUDA.
`vk-heap.cpp:38-41` already requests `HOST_CACHED`. Proposed fix: prefer `+HOST_CACHED` for
ReadBack and fall back to the current flags.

**Routing (10-20 ~13:10Z):** live read: open, 0 comments, no labels, body == payload. The R6 gate
(nanoclaw#1993) is still a draft, so normal routing applies. Dispatched to slang-triager on
`gh-issue-shader-slang/slang-rhi-928` (msg id 15) with these asks: verify at main, reproduce on
the L40S (its memory-type list can differ), dedup/couple against #869/#722, and post a triage
comment that welcomes the reporter's PR. Fixer only if the reporter declines or a maintainer asks.

**Coupling:** rhi#869 (our draft, `fix/issue-862`, owner slang-fixer on
`gh-issue-shader-slang/slang-rhi-862`, held for a maintainer) touches the same `readBuffer`.
rhi#722 (VMA, skallweitNV, open, idle since 06-22) would also fix this.

**10-20 13:16Z, triager progress (their finding, receipts not yet seen):** reproduced on the L40S.
ReadBack resolves to uncached type 2 at 0.15 GB/s; cached type 3 gives 5–13 GB/s. Dedup against
#869/#722 done; memo and issue comment in progress.

**10-20 13:18Z, reporter opened PR #929** (`fix/vulkan-readback-host-cached`, non-draft, +54/−14,
vk-buffer.{cpp,h} + vk-device.cpp, review requested from dshreiner-nv) and commented 6291794439
("~0.27 → ~8 GB/s", no bot mention). Told the triager (msg 19): point the comment at #929, check the
textual overlap with #869, and optionally measure #929 on the L40S. No review on #929 from us.

**10-20 13:22Z, triager (their finding):** a test merge shows #929 and #869 conflict in the `readBuffer`
body (#929 edits the staging init, #869 deletes it), so #869 rebases after #929 by keeping its own body.
L40S builds of main and #929 are running. The bot set `bug` + Type=Bug at 13:21:23Z. **Assignee: jhelferty-nv assigned jvepsalainen-nv at 13:19:22Z** (the triager was right). I first
"corrected" this to a self-assign after reading `/events` `actor`. On an `assigned` event, `actor`
is the assignee and `assigner` is who did it. Retracted in msg 23. A maintainer owns #928 now, so the triage comment
stays data-only.

**10-20 13:30Z, TRIAGE CLOSED (receipts read).** Memo: `/workspace/inbox/a2a-1792503000487-746v4s/triage-rhi-928.md`.
The bot's data-only comment **6291998659** (13:29:02Z) is live and verified: repro, a #929 measurement table, the #869
coupling note, no assignee, and next steps left to the maintainer. Bug, P2, not a regression (only the IHeap path got
HOST_CACHED, in eb8c343 #534). L40S memory types are identical to the reporter's. Through slang-rhi itself, #929 @7577eea:
readBuffer 0.14→1.5–1.9 GB/s, ReadBack map+memcpy 0.15→3.5–13.9 GB/s, and all 28 ReadBack allocations move to type 3
while Upload stays on type 2. 205/0 existing Vulkan tests pass on #929. **Verified #929 live:** reviewers dshreiner-nv +
skallweitNV, assignees jvepsalainen-nv + reporter, MERGEABLE, CI 2✅ 1 pending, `license/cla` **pending**. Repro
artifacts are in `/workspace/agent/repro-rhi-928/` (triager FS). Bot is OFF the fix and has posted no review on #929.
One-shot re-check `rechase-rhi-928-pr929-86-5b26` at 10-27 13:00Z.

**10-20 15:33Z, reporter cmt 6294638044 (no bot mention, unedited):** thanks for the data, agrees that #869 keeps its
`readBuffer` body on rebase, and says leaving `vk-heap.cpp` (hard HOST_CACHED) alone was deliberate, a separate change.
This closes approach D as the reporter's call. No reply owed. #929 head moved to **2260d57**: one commit, vk-buffer.cpp
+16/−8, "fall back to the required-only memory type when the preferred one is out of memory". The triager's numbers are
for 7577eea, and the comment says so. Nothing dispatched or posted.

**RESUME:** #929 merges → slang-fixer rebases #869 on `gh-issue-shader-slang/slang-rhi-862` (keep #869's readBuffer body, drop #929's hunk) / #929 review routing is the operator's call (external PR;
slang-reviewer only on request) / #929 merges → #869 rebase check / maintainer comment.
