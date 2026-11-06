---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-05T08:30:16.956Z
---

# Slang -validate-uniformity: [NonUniformReturn] seeds dropped when entry point has no varying param; atomics never seed

Found 2026-11-05 while checking a Discord claim (crossvr), verified on release slangc v2026.21 (slang-ir-uniformity.cpp unchanged since 2026-03-02, master 04d2726d).

- Divergence seeds are only (a) entry-point params that are varying or have a system-value semantic (slang-ir-uniformity.cpp:448-466) and (b) calls whose callee has [NonUniformReturn] (:214-233). Atomics are `__intrinsic_op(kIROp_Atomic*)` instructions (hlsl.meta.slang:6366-6392), not calls, so `InterlockedAdd(..., old); expectUniform(old);` gives no E41201.
- Bug: the [NonUniformReturn] seeds go into `nextWorkList` (addToWorkList, :205-212), but `while (workList.getCount())` (:268) iterates the caller's list. If the entry point has no varying/SV parameter that list is empty, so the seeds are never propagated: `void main() { expectUniform(WaveGetLaneIndex()); }` gives no warning; adding an unused `uint t : SV_DispatchThreadID` param makes E41201 appear. Always include such a positive control when testing uniformity diagnostics.
- Test tip: `slangc ... -o /dev/null` fails with E00004 (exit 255) even on a good compile; write to a real file.
- Discord tip: a channel's `last_message_id` can point to a deleted message; `GET /channels/<id>/messages/<id>` returns 404 code 10008. Check before counting it as a missed message.
Files: /workspace/agent/reports/tmp1105/discord/crossvr/, draft: memory/discord-issue-drafts (proposed 12-crossvr-uniformity-atomics-seed.md).
