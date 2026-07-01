---
title: "Device caching silently defeats per-invocation debug-callback bridges in slang-test (false greens)"
type: learning
topic: slang-compiler
source: learnings/1782862613084-device-caching-silently-defeats-per-invocation-deb.md
---

# Device caching silently defeats per-invocation debug-callback bridges in slang-test (false greens)

**Context:** shader-slang/slang#11856, a regression from PR #11785 ("Fix stale test debug callback"). Verified by code inspection at HEAD 6d355565c.

**The failure mode:** slang-test's render-test path (`tools/render-test/`) routes RHI debug-layer/validation messages to the active test via a `CoreToRHIDebugBridge` (slang-support.h). PR #11785 made each render-test invocation mint a *fresh* bridge and clear its inner callback on scope exit (RAII `ScopedCoreDebugCallback`) — a deliberate per-invocation isolation design that assumes a 1:1 device↔bridge lifetime, with all bridges kept alive in a process-global list to avoid use-after-free from late driver-thread messages.

But `DeviceCache` (`tools/render-test/slang-test-device-cache.cpp`, on by default; exists to dodge Tegra `VK_ERROR_INCOMPATIBLE_DRIVER` after ~19 create/destroy cycles) keys on validation flags/profile/target — **not** the debug callback. So a later test gets a *cached* device that still holds the *earlier* invocation's bridge, whose inner callback was already nulled → `handleMessage` drops every message. The later test's fresh bridge is bound to its live callback but wired to no device. Net: **validation messages from any cached device are silently dropped for every test after the one that created it → false greens, eroded CI coverage.**

**The general lesson:** when a resource (here an RHI `IDevice`) caches/reuses a raw callback pointer set only at creation time, any "fresh per-use callback + clear-on-exit" design is silently broken by caching unless the callback travels with the cached resource. Check whether the consumer API has a *post-creation* setter (`IDevice` does NOT — `DeviceDesc::debugCallback` is creation-only, slang-rhi.h:3301); if not, the fix must store/rebind the callback alongside the cache entry, not at the call site.

**Principled fix shape:** make the bridge travel with the cached device — DeviceCache stores one bridge per device and returns it; each invocation binds its scope to the *returned* bridge (re-pointing the inner callback) instead of a fresh one. Keep the global-list retention for UAF safety. Putting the callback in the cache key (or disabling caching under validation) "works" but defeats the cache's purpose. A GPU-free regression test is possible by reusing one bridge across two scoped bindings in `tools/gfx-unit-test/scoped-core-debug-callback-test.cpp`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782862613084-device-caching-silently-defeats-per-invocation-deb.md`_
