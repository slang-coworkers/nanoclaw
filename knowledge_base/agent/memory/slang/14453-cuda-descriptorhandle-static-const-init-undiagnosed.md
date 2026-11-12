---
type: chain
title: slang#14453 — CUDA: DescriptorHandle from uint2 in a static const initializer is not diagnosed, emits invalid code
description: Maintainer (jkwak-work) filed 11-11 07:59Z, assigned to the author by jhelferty-nv 13 s later. Follow-up of jkwak-work's merged PR #14204 (#13107 chain). HELD rung 4: no dispatch, no post.
tags: [cuda, metal, cpu, descriptor-handle, capability-check, static-const, global-init, maintainer-owned, held]
---

# slang#14453 — `DescriptorHandle` construction in a `static const` initializer skips E36107

**11-11 07:59:34Z, `issue_opened`.** Live read (11-11): OPEN, author **jkwak-work** (MEMBER), assigned to
jkwak-work by **jhelferty-nv** at 07:59:47Z, 0 labels, 0 comments, body 2388 B. Timeline: only the assign
event, no linked PR or commit. No memory hits for 14453.

**Report.** On CUDA, `(DescriptorHandle<RWStructuredBuffer<uint>>)uint2(...)` inside an entry point gets
E36107 ("see using of 'DescriptorHandle.init'"). The same construction in a `static const Bindful gItems[2]`
initializer gets no diagnostic. `-target cuda` emits `Bindful_x24init_0(1U, make_uint2(3U, 4U))`, which passes
a `uint2` for a `RWStructuredBuffer<uint>`, and NVRTC 13.2 rejects it (exit 255). `-target metal`/`cpp` also
exit 0 with no diagnostic. The author did not root-cause it; their guess is that the capability check does not
see global initializers. Side note: also emits unused module-scope `__device__ static const` ctor calls without
`-g` (same shape as #14217). The test `tests/language-feature/constants/static-const-struct-array-resource-13107.slang`
(from PR #14204, merged 11-04 02:32Z) carries `no-downstream-validation` until this is fixed.

**Relation to our chains.** Downstream of [#13107](13107-cuda-static-const-struct-array.md), closed on our side.
#14204 is merged, so the `irht3p` session (owner of `gh-issue-shader-slang/slang-14204`) has nothing owed here.
Same filing batch as [#14433](14433-cuda-coop-mat-invalid-type-ice.md) / [#14447](14447-nvrtc-builtins-dll-not-on-path.md).

**Disposition: held, nothing dispatched or posted.** It is a maintainer-filed report assigned to its author by a
peer maintainer (rung 4 of
[[feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new]]). **Resume** only on an @nv-slang-bot mention,
an operator ask, or the issue being unassigned. Mentions arrive as webhooks, so no timer.
