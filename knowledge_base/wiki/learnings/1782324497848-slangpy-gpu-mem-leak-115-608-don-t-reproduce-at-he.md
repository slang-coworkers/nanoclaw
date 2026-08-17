---
title: "slangpy GPU mem-leak #115/#608 don't reproduce at HEAD; CI OOM is concurrent-peak high-water-mark, not a leak"
type: learning
topic: slang-compiler
source: learnings/1782324497848-slangpy-gpu-mem-leak-115-608-don-t-reproduce-at-he.md
---

# slangpy GPU mem-leak #115/#608 don't reproduce at HEAD; CI OOM is concurrent-peak high-water-mark, not a leak

Empirical, on an L40S (46GB), slangpy built from HEAD (debug layers on, matching test config), VRAM sampled via nvidia-smi.

**Leak micro-probes (single process, repeated identical op):** #115 functional API `module.fn(Tensor)` on CUDA = warm-up→703 MiB then FLAT over 20,000 iters (0 growth); Vulkan functional FLAT at 74 MiB over 5,000; #608 command-encoder create/finish/submit FLAT on both; #827 torch-interop on CUDA FLAT at 723 MiB over 3,000. → these documented leaks do NOT reproduce at current HEAD.

**Real suite slice** (`pytest slangpy/tests/slangpy_tests --device-types cuda`, 1284 passed): VRAM is a STEP FUNCTION — jumps when a heavier test group runs (705→1041→2541→4987 MiB) then PLATEAUS flat between steps, settling ~5 GB high-water for one CUDA-only worker. That's device-cache + slang-rhi/sgl memory-pool high-water-mark retained for the session, NOT a monotonic climb.

**Conclusion:** the pytest-xdist CUDA-OOM cascade (e.g. slangpy#1024) is **peak concurrent VRAM = workers × per-worker high-water mark** on a VRAM-limited runner, not a runaway leak. Lowering the worker cap only delays each worker's OOM. Real fixes: right-size runner VRAM, or lower per-worker peak (don't cache all device types per worker / release the RHI pool between heavy tests).

**How to apply:** when asked "is there a leak," distinguish a LEAK (monotonic climb on a repeated identical op) from HIGH-WATER-MARK working set (step-function that plateaus). Sample VRAM over BOTH a repeated-op micro-loop AND the real suite. Reusable probe at /workspace/agent/leak_probe.py (modes: func #115, encoder #608, interop #827). Caveat: Vulkan+CUDA-interop errored on the L40S/linux (`command_encoder->finish() SLANG_FAIL`) so #827's vulkan leak couldn't be measured there.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782324497848-slangpy-gpu-mem-leak-115-608-don-t-reproduce-at-he.md`_
