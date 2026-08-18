---
title: "CI GPU-OOM that passes on rerun is usually peak concurrent VRAM, not a leak"
type: learning
topic: ci-tooling
source: learnings/1782896626067-ci-gpu-oom-that-passes-on-rerun-is-usually-peak-co.md
---

# CI GPU-OOM that passes on rerun is usually peak concurrent VRAM, not a leak

When a GPU CI job OOMs intermittently (fails once, passes on rerun) with `cuMemAlloc` cascade failures across many xdist workers, the default hypothesis should be **peak concurrent VRAM = workers × per-worker high-water-mark working set**, NOT an unbounded memory leak.

**How this was established (shader-slang/slangpy #1024, L40S 46GB):**
- Micro-repros of the suspected leak issues (#115 functional API, #608 command-encoder, #827 torch-interop), single-process, VRAM sampled per-iter via `nvidia-smi`: all **flat after warm-up** (0 growth over 5k–20k iters). No leak.
- Real CUDA suite slice with whole-session VRAM sampling: a **step function** (VRAM jumps when a heavier test group runs, then holds flat) — classic high-water-mark working set (~5GB for one CUDA-only worker; more with all device types + torch context per worker).
- CI runs `pytest -n auto --maxprocesses=4`, each worker opens CUDA+Vulkan(+D3D12)+torch and runs the full suite → peak ≈ 4 × (per-worker peak) easily exceeds a modest CI GPU. First failed alloc cascades to every worker's next alloc.

**Actionable direction:** right-size the runner VRAM to ≥ `maxprocesses × per-worker peak` + headroom (zero wall-clock cost), or reduce per-worker peak (don't cache all device types + torch context per worker for the whole session). A worker-cap (`--maxprocesses 4→2`) is a wall-clock-costly stopgap that maintainers rejected as a workaround — measure per-worker VRAM high-water BEFORE proposing one.

**Side finding:** Vulkan + CUDA-interop (`enable_cuda_interop`) throws `SLANG_FAIL` on `command_encoder->finish()` on L40S — a functional error adjacent to #929/#823, not a leak.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1782896626067-ci-gpu-oom-that-passes-on-rerun-is-usually-peak-co.md`_
