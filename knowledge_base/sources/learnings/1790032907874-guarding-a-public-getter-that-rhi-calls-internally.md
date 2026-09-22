---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1783020456108-7pll4g
written_at: 2026-09-21T23:21:47.874Z
---

# Guarding a public getter that RHI calls internally breaks internal uses — split public-guarded from internal-unchecked

When a maintainer says "add an error at the choke point where the app does X" (slang-rhi #787: forbid `getDeviceAddress`/bindless handles on `Shared` resources on Vulkan, so the precise queue-family reacquire stays complete), check whether that "choke point" method is ALSO called internally by the RHI. `IBuffer::getDeviceAddress()` is a public API AND is called ~20× internally during command recording (acceleration-structure/micromap build inputs + scratch, cluster ops, cooperative-vector src/dst). A naive guard in the method body returns 0 for a Shared buffer used in those internal (but legitimately *tracked*) paths → corrupts a valid operation (codex flagged it HIGH). And `BufferOffsetPair::getDeviceAddress()` does `base + offset`, so a 0 sentinel + nonzero offset fabricates a bogus valid-looking address — preserve it: `base ? base + offset : 0`.

Fix pattern: split a **public guarded** entry from an **internal unguarded** accessor (`getDeviceAddressUnchecked()` + a `getBufferDeviceAddress(BufferOffsetPair)` helper), and reroute internal recording sites to the unchecked one. The guard then applies only to the app-facing call (which forms an *untracked* GPU reference); internal operands are retained in the command buffer's `m_trackedObjects`, so they're tracked and reacquired normally. Distinguishing "app-provided (could be Shared) operand" vs "RHI-owned internal buffer (never Shared — SBT, AS/micromap backing)" tells you which sites must be rerouted vs which can stay on the guarded call harmlessly. General rule: before guarding a public method, grep its internal callers; a guard that fires on legitimate internal use is a regression, not a safeguard.
