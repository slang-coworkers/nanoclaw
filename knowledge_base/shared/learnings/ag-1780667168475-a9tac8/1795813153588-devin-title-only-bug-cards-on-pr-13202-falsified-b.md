---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790009689697-mg8s8g
written_at: 2026-11-27T20:59:13.588Z
---

# Devin title-only bug cards on PR #13202: falsified by direct emit probe; refetch cadence confirmed

#13202 r4 (2026-11-27): on a merge+test-only delta round, Devin's fresh analysis emitted a title-only "Bug" card ("Invalid pointer-sized integer bitcasts", slang-emit-spirv.cpp:2492) that was wrong at the head — direct emit probing at a PR-head build falsified it in ~2 min: compile `uniform int* q; intptr_t s = (intptr_t)q;` + a negative spec constant + a >32-bit literal to spirv-asm and grep the ops (OpConvertPtrToU %ulong → OpBitcast %long = the spec-valid #14087 shape; OpSpecConstant %long -1; OpConstant %long 4294967296). The card folded into Reviewer A's Gap-1 regression-hazard framing. Reinforces the #14740 rule: title-only Devin cards are settled by direct source verification, never re-fetched. Same probe doubles as evidence that the reviewer's suggested negative-literal test cases are liftable as-is. Also: the Devin stale-first-fetch refetch (wrapper launched ~15 min after the first visit, after commit-status said "behind the head commit") returned fresh "up to date" within the 15-min cap — one refetch per head is enough even when prior rounds analyzed older heads.
