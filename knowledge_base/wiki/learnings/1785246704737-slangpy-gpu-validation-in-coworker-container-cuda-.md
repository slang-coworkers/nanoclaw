---
title: "slangpy GPU validation in coworker container: CUDA works, Vulkan autodiff fails with NVVM error"
type: learning
topic: slang-compiler
source: learnings/1785246704737-slangpy-gpu-validation-in-coworker-container-cuda-.md
---

# slangpy GPU validation in coworker container: CUDA works, Vulkan autodiff fails with NVVM error

The slangpy-fixer container DOES have a usable GPU (NVIDIA L40S, CUDA 12.7, `nvidia-smi` works, `/dev/nvidia*` present). Earlier "no GPU backend" claims were stale — always probe with `nvidia-smi` before claiming no GPU.

Setup that works: `python3 -m venv /tmp/venv && /tmp/venv/bin/pip install slangpy` (pins 0.43.1; wheel is ~92MB so use `--retries 5 --timeout 120`, the first download often breaks mid-stream). Also `pip install pillow` for image loading (imageio's backend discovery is flaky in-container; use `PIL.Image.open` directly). Sample image assets in slangpy-samples are **git-LFS pointers** (not pulled) — fetch a specific one via the LFS batch API: POST to `https://github.com/<owner>/<repo>.git/info/lfs/objects/batch` with `{"operation":"download","transfers":["basic"],"objects":[{"oid":<sha256-from-pointer>,"size":<size>}]}` and Accept/Content-type `application/vnd.git-lfs+json`, then curl the returned `actions.download.href`.

KEY FINDING — backend matters for differentiable code:
- `spy.Device(type=spy.DeviceType.cuda, ...)` → forward AND backward (`.bwds`) both work. A minimal `RWDiffTensor<float,1>` + `.store` backprop gives the analytically exact gradient (verified `f(t)=t^2` → grad `2t`). To seed a backward pass: run forward, then `result.grad_in.copy_from_numpy(np.ones(...))`, then `module.fn.bwds(inputs..., result, spy.grid(shape=...))`; read `input.grad_out`.
- Default `spy.Device()` resolves to **Vulkan** on this box, and Vulkan `.bwds` (auto-generated `bwd_diff` kernel) fails with `NVVM compilation failed: 1` / `command_encoder->finish ... error -13`. Forward-only Vulkan works fine; only the differentiable backward codegen fails. This is a slangpy-0.43 autodiff-on-Vulkan toolchain issue in-container, NOT a shader-migration defect — the module compiles cleanly, only the generated backward kernel fails to build.

So for functionally validating differentiable slangpy samples in-container, explicitly select CUDA. Module-load (compile check) works on both backends and is the strongest content-agnostic signal that a migration is correct.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785246704737-slangpy-gpu-validation-in-coworker-container-cuda-.md`_
