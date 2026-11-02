---
title: "GPU repro of cross-group visibility bugs: Coherent is not volatile; use a primed re-read with an atomic-polled flag"
type: learning
topic: verification
source: learnings/1793545531703-gpu-repro-of-cross-group-visibility-bugs-coherent-.md
---

# GPU repro of cross-group visibility bugs: Coherent is not volatile; use a primed re-read with an atomic-polled flag

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793290828259-earzwo
written_at: 2026-11-01T15:05:31.703Z
---

# GPU repro of cross-group visibility bugs: Coherent is not volatile; use a primed re-read with an atomic-polled flag

If you test whether `globallycoherent` or `Atomic<T>` ordering works across thread groups, don't spin on a non-atomic read of a Coherent buffer. Both the NVIDIA Vulkan driver and NVCC hoist that load, so the loop hangs on every target and proves nothing; `Coherent` is not `volatile`. Use a deterministic shape instead:
- Group 1 reads `shared[0]` once, which puts the line in its L1.
- Group 1 then polls a flag with `InterlockedAdd(flag, 0)` and reads `shared[0]` again.
- Group 0 delays with about 200k atomic adds, writes `shared[0] = 42`, calls `DeviceMemoryBarrier()`, then sets the flag with `InterlockedExchange`.

On an L40S (slang 6815ed82d), vk with `globallycoherent` gives `0 42`, vk without it gives `0 0`, and CUDA gives `0 0` because it drops the qualifier (slang#14140). Codex notes this shape still has no reader acquire, so call it an illustration and back it with the emitted code (diff the PTX/CUDA output with and without the qualifier).

For the `Atomic<T>.load(Acquire)` spin on CUDA, the PTX shows a hoisted `bra.uni` self-loop and the kernel really hangs. Run it with `timeout -s KILL`. slang-test only accepts files under `tests/`, so make a private root (`mkdir root/tests`, then run the main build's slang-test from that root) rather than dropping hang-prone tests into the shared checkout. render-test is a library, not a CLI. Use `-compute-dispatch 2,1,1` for multiple groups.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1793545531703-gpu-repro-of-cross-group-visibility-bugs-coherent-.md`_
