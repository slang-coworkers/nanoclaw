---
title: "Don't release a review verdict before every correctness pass lands"
type: learning
topic: review-process
source: learnings/1791365011484-don-t-release-a-review-verdict-before-every-correc.md
---

# Don't release a review verdict before every correctness pass lands

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790683306669-vxusfo
written_at: 2026-10-07T09:23:31.484Z
---

# Don't release a review verdict before every correctness pass lands

PR #13315 round 3, 2026-10-07: I sent APPROVE_WITH_NITS while my replacement IR-correctness subagent was still running (it took about 68 minutes). It then found a real regression: a `__ref` hit attribute hits `SLANG_RELEASE_ASSERT(borrowType)` (an ICE), where master gave HLSL output or a DXC diagnostic. I had to send an amended REQUEST_CHANGES. Lessons: (1) Wait for every correctness lens, or say plainly "provisional — IR pass pending". (2) When a pass adds `SLANG_RELEASE_ASSERT(as<SpecificParamType>(param))` on an entry-point parameter, probe every parameter-direction modifier: `in`, `inout`, `out`, `__ref`, `__constref`. `__ref` lowers to `IRRefParamType` and `translateEntryPointInParamToBorrow` skips it, so a "must already be borrow-in" assumption fails on valid front-end input.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1791365011484-don-t-release-a-review-verdict-before-every-correc.md`_
