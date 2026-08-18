---
title: "pytest-xdist high gwN worker IDs are crash-respawns, not a concurrency count"
type: learning
topic: misc
source: learnings/1781204283033-pytest-xdist-high-gwn-worker-ids-are-crash-respawn.md
---

# pytest-xdist high gwN worker IDs are crash-respawns, not a concurrency count

**Trap (observed in CI-flake diagnosis):** seeing pytest-xdist worker IDs `gw0`–`gw9` in a log does **not** mean ~10 workers ran concurrently. xdist assigns a **new sequential ID to each crash-respawned replacement worker**, so a job capped at 4 concurrent workers can still show `gw0`–`gw9` (or higher) over its lifetime as workers OOM/crash and get replaced. Inferring parallelism from the **max `gwN` seen** is wrong.

**How to actually determine concurrency:**
- Look for the xdist startup line `created: N/N workers` (and `N workers [M items]`) — that `N` is the real concurrent count.
- High `gwN` shows up as repeated `[gwN] node down: Not properly terminated` → `replacing crashed worker gwN` lines; treat those as crash evidence, not parallelism.
- Check the invocation flags: `-n auto` sizes to CPU count, but `--maxprocesses=K` caps it. The effective concurrency is `min(auto, K)`. For slangpy this lives in `tools/ci.py` (`unit_test_python`/`test_examples`), NOT in `pyproject.toml` (which only sets `pythonpath`).

**Worked example (SlangPy nvrgfx CUDA-OOM, 2026-06-11):** the CI-babysitter diagnosed the OOM cascade as "`-n auto` fanning out ~10 workers ignoring the cap." slangpy-fixer disproved this from logs (run 27044842987 / job 80546562316): `created: 4/4 workers` — the existing `pytest -n auto --maxprocesses=4` (`tools/ci.py:149,157`, in place since PR #393 / 2025-07-31) IS honored. The `gw0–gw9` IDs were respawns. **Actual root cause:** each of the 4 workers holds its own CUDA+Vulkan(+D3D12) devices + a torch CUDA context for its lifetime → 4 device-holding processes saturate VRAM → a single OOM cascades across all workers (e.g. 291 failed / 3410 passed). Fix shipped as draft slangpy#1024 (lower `--maxprocesses` 4→2; tradeoff ~2× wall-clock).

**How to apply:** when triaging a GPU/parallel-test OOM, don't size the fix from the max worker ID. Confirm real concurrency from `created: N/N` + `--maxprocesses`, and treat OOM cascades as *aggregate per-worker resource pressure* (each worker holds its own `DEVICE_CACHE` of CUDA+Vulkan(+D3D12) devices plus a torch CUDA context for its whole lifetime — slangpy/testing/helpers.py:39-46,73,251 — compounded by known GPU-mem leaks #115/#827/#608), not "too many workers spawned." Lever = fewer concurrent workers (lower the cap), not the `gwN` number.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1781204283033-pytest-xdist-high-gwn-worker-ids-are-crash-respawn.md`_
