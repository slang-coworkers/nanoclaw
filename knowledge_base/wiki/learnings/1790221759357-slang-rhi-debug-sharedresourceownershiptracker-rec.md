---
title: "slang-rhi debug SharedResourceOwnershipTracker: recycled IResource* pointer → cross-test false-positive fatal abort"
type: learning
topic: slang-compiler
source: learnings/1790221759357-slang-rhi-debug-sharedresourceownershiptracker-rec.md
---

# slang-rhi debug SharedResourceOwnershipTracker: recycled IResource* pointer → cross-test false-positive fatal abort

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790196393150-6taxcp
written_at: 2026-09-24T03:49:19.358Z
---

# slang-rhi debug SharedResourceOwnershipTracker: recycled IResource* pointer → cross-test false-positive fatal abort

In slang-rhi's debug-layer `SharedResourceOwnershipTracker` (PR #881 / issue #787), the ownership
cache `m_resourceKeys` is a `std::map<IResource*, Key>` keyed by the **raw resource pointer**, and
`resolveKey()` checks that cache FIRST and returns the cached `Key` **without any re-validation** —
only on a cache miss does it fall back to `getSharedHandleOf()` (which checks the `Shared` usage flag
and calls `getSharedHandle`). The cache is evicted only by `resetForNewSharedResource()`, which the
debug device calls **only on Shared-producer creation** (`createBuffer`/`createTexture` with
`Shared`), never on resource destruction (the debug layer can't observe it — documented in the class
comment as a known recycled-handle-aliasing limitation).

The hole: a NON-Shared resource that recycles a freed shared resource's address never triggers
`resetForNewSharedResource` (that path only fires for Shared producers), so it inherits the stale
`m_resourceKeys[ptr]` entry, and `resolveKey`'s tied-cache-first lookup returns the stale key without
re-checking whether the new resource is even shared. The tracker is **process-global**, so under
`slang-test -use-test-server` (many tests, one process) this crosses test boundaries: a prior test's
freed Shared resource leaves a stale entry; a later test whose non-Shared resource reuses that address
gets a false "a shared resource is used on a queue that does not currently own it" diagnostic →
Vulkan Error escalation → fatal abort. Concretely: `ray-tracing-triangle-intersection.vulkan` (which
creates NO Shared resources) aborted on eaa551f while 99263c1 passed the same jobs.

Fix direction: on a cache hit, re-validate the cached key against the resource's CURRENT shared handle
(re-query `getSharedHandle` and compare) before trusting it — or otherwise avoid trusting a
pointer-keyed cache that can't observe destruction. This is the same pointer-identity fragility family
as slang-rhi #860 (null `m_api`) — raw `IResource*`/pointer identity as a map key is unsafe across
create/destroy cycles. Reviewer signal (a REQUEST_CHANGES on out-of-contract/recycled-state fatal
paths) and the CI red were the same root theme. See wiki concept `slang-rhi-backend-runtime.md`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790221759357-slang-rhi-debug-sharedresourceownershiptracker-rec.md`_
