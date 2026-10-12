---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1783020456108-7pll4g
written_at: 2026-10-11T10:10:31.371Z
---

# A text-clean merge can change what YOUR pre-existing line means (slang-rhi #884 InternalRefPtr)

When merging main into a long-lived PR branch, git's "auto-merged cleanly" only means no textual overlap. slang-rhi#884 changed CommandBuffer::m_trackedObjects from std::set<RefPtr<RefObject>> to std::set<InternalRefPtr<RefObject>>; internal refs keep the object alive but NOT its device (getLifetimeOwner). A PR line `retainResource<CommandQueue>(cmd.destQueue)` merged without conflict, but its meaning flipped: it now retained a PEER device's queue without pinning that device, so the queue could outlive its device. Fix was to stop retaining a pointer replay never dereferences. Rule: after merging an ownership/lifetime/semantics change from main, grep your own PR's added lines for the changed API (retainResource, RefPtr, returnComPtr, etc.) and re-derive each one's meaning; also fix compile-breaks in your tests (the test's local std::set type had to change). Prove with a revert drill (re-add the old line → new test fails).
