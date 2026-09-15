---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789440049823-a7tvb7
written_at: 2026-09-15T05:02:49.968Z
---

# slang-rhi fix pattern: tie pooled-staging lifetime to GPU completion via CommandList::retainResource (not RAII scope-exit)

Complements the "pooled staging + RAII free-on-scope-exit + OOM-capable queue-wait = in-flight page reuse" hazard note. The **correct fix** (used to resolve slang-rhi#869 F3) is completion-coupled free via the command buffer's tracked-object set — not a bare RAII free at function scope exit, and not a detach/leak.

Pattern (mirrors the established `CommandEncoder::uploadBufferData`/`uploadTextureData`, src/command-buffer.cpp:616,688):
```
RefPtr<StagingHeap::Handle> staging;
m_readbackHeap.allocHandle(size, {}, staging.writeRef());
commandEncoder->copyBuffer(staging->getBuffer(), staging->getOffset(), ...);
// tie the pooled allocation to command completion:
checked_cast<CommandEncoder*>(commandEncoder.get())->m_commandList->retainResource(staging);
queue->submit(commandEncoder->finish());
queue->waitOnHost();      // may fail (OOM etc.) — but the region is now safe
staging->map(...); memcpy; staging->unmap();
```

Why it works: `retainResource(RefObject*)` (src/command-list.h:473) inserts a `RefPtr` into the command buffer's `m_trackedObjects` (`std::set<RefPtr<RefObject>>`, src/command-buffer.h:422). That set is cleared in `CommandBuffer::reset()` (src/command-buffer.cpp:964) — i.e. at RETIREMENT — and otherwise held until the command buffer is destroyed. So on a successful `waitOnHost`, retirement + the local RefPtr dropping frees the page (`getUsed()==0`); on a post-submit `waitOnHost` failure the un-retired command buffer keeps the handle owned, so the possibly-in-flight shared page is NOT returned to the pool. `CommandList::reset()` does NOT clear `m_trackedObjects` — retirement (`CommandBuffer::reset`) does.

Review notes for this pattern:
- It has a KNOWN residual: device-teardown ordering. `~DeviceImpl` (vk-device.cpp:147) calls `m_queue->waitOnHost()` ignoring its result, then releases both staging heaps (`m_uploadHeap`/`m_readbackHeap`, device.h:492-493 peers) which assert `m_totalUsed==0`. A failed teardown wait leaves a retained handle unfreed → assert / free-against-released-heap. This is PRE-EXISTING and shared by every retained-staging path (upload + readback), fixable only by a cross-backend teardown reorder — so a readback PR adopting this pattern adds no new hazard class; flag the teardown reorder as a follow-up rather than a blocker.
- Don't over-claim `checked_cast` as "type-safe": it validates the type in debug builds and is a plain `static_cast` in release. It's valid here only because the queue always creates the backend `CommandEncoderImpl`.
