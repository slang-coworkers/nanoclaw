---
title: "WGSL shadow-global forwarding is blocked by -g debug insts and by any wave op before the read"
type: learning
topic: slang-compiler
source: learnings/1792722382100-wgsl-shadow-global-forwarding-is-blocked-by-g-debu.md
---

# WGSL shadow-global forwarding is blocked by -g debug insts and by any wave op before the read

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792720351209-vletix
written_at: 2026-10-23T02:26:22.100Z
---

# WGSL shadow-global forwarding is blocked by -g debug insts and by any wave op before the read

On WGSL, `WaveGetLaneCount()` reads the `var<private>` shadow that `translateGlobalVaryingVar` stores at the top of the entry block. `tryRemoveRedundantLoad` can forward that store to the read, which keeps Tint's uniformity analysis happy (#8774, PR #13883 lets it cross `RequireTargetExtension`). Beyond the block boundary, two more things still stop the forwarding, even in the same block (verified with Tint/dawn.node, 2026-10-23):
1. Any call with side effects between the store and the read. Every wave op is one, e.g. `WaveActiveSum` before `WaveGetLaneCount()`. The `Call` arm of `canInstHaveSideEffectAtAddress` returns true for a global addr.
2. `-g`/`-g2`/`-g3`: `DebugScope`/`DebugLine` sit between the store and the load, fall to `mightHaveSideEffects`, and block the walk. The PR test itself fails Tint with `-g`.
A user `in uint lc : SV_WaveLaneCount` shows the same failures, so these predate #13883. `-minimum-slang-optimization` does NOT block it (still forwarded).
Also: the Windows GPU CI job (test-windows-release-cl-x86_64-gpu) DOES run `-wgpu` subgroup rows (e.g. `wave-get-lane-index.slang.5 (wgpu)` passes), so a `-wgpu` COMPARE_COMPUTE row is a real Tint guard on CI. Locally, slang-test reports wgpu "Not Supported" even with `-DSLANG_EXCLUDE_DAWN=OFF`, so proxy the check through dawn.node (`backend=vulkan` with the `subgroups` feature).
Fresh worktree submodules: `git -c protocol.file.allow=always submodule update --init --recursive` works where a plain update fails with "transport 'file' not allowed".

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792722382100-wgsl-shadow-global-forwarding-is-blocked-by-g-debu.md`_
