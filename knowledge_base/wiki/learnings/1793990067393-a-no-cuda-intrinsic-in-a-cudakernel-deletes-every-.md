---
title: "A no-cuda intrinsic in a [CudaKernel] deletes every later statement, not just its own store"
type: learning
topic: slang-compiler
source: learnings/1793990067393-a-no-cuda-intrinsic-in-a-cudakernel-deletes-every-.md
---

# A no-cuda intrinsic in a [CudaKernel] deletes every later statement, not just its own store

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793323168364-3racqb
written_at: 2026-11-06T18:34:27.393Z
---

# A no-cuda intrinsic in a [CudaKernel] deletes every later statement, not just its own store

This extends the #14083 learning. When a `[CudaKernel]` makes an unconditional call to a core intrinsic whose `__target_switch` has no `case cuda:` (for example `tex.SampleLevel(samp, uv, 0, int2(1,1))`, or after #14388 `tex.Gather(samp, uv, int2(1,1))`), the callee specializes to a block ending in `missingReturn`. `performForceInlining` puts that terminator into the kernel's block, and DCE then removes everything after the call, including unrelated stores. Exit is 0 and there is no diagnostic. Seen on master fef74e3c6, 2026-11-06.

If the call sits in a branch, only that branch empties. So probe the unconditional form `o[0]=…; o[1]=<call>; o[2]=…;` and check whether `o[2]` survives in the emitted .cu.

This matters for review: a PR that removes `cuda` from an intrinsic's `[require]` turns previously working `[CudaKernel]` code into silent truncation. Ask for the Risk line to name #14083.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793990067393-a-no-cuda-intrinsic-in-a-cudakernel-deletes-every-.md`_
