---
type: project
name: project_14010_metal_device_memory_barrier_scope
description: "slang#14010 (albertrodriguezclo, external, 10-29 11:27Z): on Metal, DeviceMemoryBarrier/AllMemoryBarrier (+WithGroupSync) lower to threadgroup_barrier, so cross-threadgroup publish patterns read stale data; globallycoherent is dropped on Metal. Triaged 11:56Z bug/high/P2 (Approach A); Reporter opened own fix PR #14011 at 12:05Z; bot chain stood down and CLOSED 14:16Z (deferral comment 6498983498)."
---

# slang#14010: Metal device-scope memory barriers lower to `threadgroup_barrier`

**Report (10-29 11:27Z, CONTRIBUTOR, same reporter as #13771).** `hlsl.meta.slang` maps
`DeviceMemoryBarrier`, `AllMemoryBarrier` and their `WithGroupSync` forms to
`threadgroup_barrier(mem_device|mem_threadgroup|mem_texture|...)` on Metal. That has threadgroup
scope only, and it is an execution barrier, so it is UB in divergent flow. A bottom-up tree refit
repro on an Apple M4 gives about 69k wrong parents out of 21M. Replacing the barrier with
`atomic_thread_fence(..., memory_order_seq_cst, thread_scope_device)` (MSL 3.2) gives 0 wrong.
The Metal emitter also has no `kCoherent` handling (`globallycoherent` → plain `device T*`;
MSL 3.2 has `coherent(device)`). Reporter cites #13084, #13082, #13771, #13409.

**Routing (10-29).** Main webhook session `sess-1793273267945-ag15h1`. Live check before dispatch
(11:3xZ): open, 0 comments, no assignee, no timeline events, `updated_at == created_at`, and no
session on the thread besides mine. Forwarded to slang-triager on
`gh-issue-shader-slang/slang-14010`. Related chain: [[project_13771_metal_rwtexture_fence]]
(same reporter; its bot PR #13792 is parked on the operator).

**Triage (slang-triager `sess-1793273346832-ry0gna`, 11:56Z; codegen reproduced on master `01dcd35`).**
bug / high / P2, target-emit (Metal) + core module. Dedup clean, no reporter PR. Memo saved at
`/workspace/inbox/a2a-1793274970300-9fecwr/triage-14010.md`. The recommended fix is Approach A:
(1) the non-sync Device/All forms become a device-scope `atomic_thread_fence` with a hard MSL 3.2
requirement, like printf; (2) the WithGroupSync forms get a prelude helper, a fence guarded by
`#if __METAL_VERSION__ >= 320` followed by today's barrier; (3) `globallycoherent` becomes
`coherent(device)` and requires 3.2; (4) `-capability metallib_3_x` must raise `-std`. Today only
4_0 does (`slang-code-gen.cpp:774`). The triager flagged two points on the issue for maintainers:
the default WithGroupSync stays threadgroup-coherent, and this adds the first `#if` in emitted
MSL. Overlap with #13792: none in code; its a2-02 doc sentence goes stale, and the second PR to
land rebases.

**Main live check (11:5xZ).** Label `reproduced`, type Bug, comment 6495972441 (nv-slang-bot
11:55:43Z; no links, no @-mentions). slang-fixer session `sess-1793274896080-1zi95v` on the
14010 thread (triager edge `epsn3s`) since 11:54Z. Reporter guard: the reporter often opens
their own PRs, so the fixer re-checks cross-refs before opening a PR and on every push.

**Reporter PR (10-29).** At 12:05:44Z, 9 minutes after the triage, the reporter opened #14011
(`albertrodriguezclo/slang:fix/metal-device-memory-barrier`, not a draft, "Fixes #14010"). At
14:08Z they commented on #14010 that a bot fix is not needed. #14011 covers (1) and the
WithGroupSync forms, but all four forms require 3.2 through a new `memorybarrier_device` alias,
which is closer to the triage's Approach B than A. It raises `-std` from `RequireCapabilityAtom`
decorations. It leaves out `globallycoherent` on purpose, because `coherent(device)` becomes part
of the pointer type and breaks derived pointers (same area as #13084); the reporter offered that
follow-up to the maintainers. The bot fixer `1zi95v` had produced nothing (no outbound rows, no
upstream branch). At 14:1xZ I sent a stand-down to the triager (msg 31, `in_reply_to=14`; the
send was refused without `in_reply_to` because unanswered inbound rows existed). The triager posts
one short deferral on GitHub, and nobody reviews #14011 or files the coherent follow-up unprompted.

**Closed (triager report, 14:16Z).** The fixer confirmed at 14:15Z: it removed worktree
`wt-slang-14010`, pushed nothing, and kept a local `patches/fix-14010.patch`. The triager posted
deferral comment 6498983498 at 14:11:10Z and filed no follow-up. The bot reacts to #14011 only on
a review webhook or an @nv-slang-bot mention. Lesson: the reporter's PR landed 10 minutes after
the issue was filed and 9 minutes after our triage, so for this frequent self-PR reporter the
triager's reporter guard is what stopped duplicate work.
