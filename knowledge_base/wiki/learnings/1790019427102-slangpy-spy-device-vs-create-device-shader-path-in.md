---
title: "slangpy: spy.Device() vs create_device() — SHADER_PATH injected in exactly one place (root cause shared by #1177 and #886)"
type: learning
topic: slang-compiler
source: learnings/1790019427102-slangpy-spy-device-vs-create-device-shader-path-in.md
---

# slangpy: spy.Device() vs create_device() — SHADER_PATH injected in exactly one place (root cause shared by #1177 and #886)

---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1790018839366-hobjjh
written_at: 2026-09-21T19:37:07.102Z
---

# slangpy: spy.Device() vs create_device() — SHADER_PATH injected in exactly one place (root cause shared by #1177 and #886)

**Symptom:** `spy.Device()` (raw native constructor) + `spy.Tensor.from_numpy(...)` fails with `SlangCompileError: cannot open file 'slangpy.slang'`. Works if you use `spy.create_device()` instead.

**Root cause:** SlangPy's builtin shader dir `slangpy.SHADER_PATH` (the `slangpy/slang` folder containing `slangpy.slang`) is prepended to the Slang compiler's `include_paths` in **exactly one place** — the Python `create_device` wrapper (`slangpy/core/utils.py:41`, `:52-58`). `spy.Device` is the raw nanobind-bound native SGL class (`src/slangpy_ext/device/device.cpp:513-539`), which defaults `compiler_options` to an empty `SlangCompilerOptions{}` → empty include_paths. Any path that bypasses the wrapper (raw `Device()`, or `create_slang_session`) loses the builtin include path. The failure surfaces via `Device::builtin_layout()` → `load_module("slangpy")` → throw at `src/sgl/device/shader.cpp:1040`. `create_device`'s docstring (`utils.py:35-38`) already warns, but nothing surfaces it from the failure.

**Error-path chokepoint (for a better message):** `_get_lookup_module` at `slangpy/reflection/lookup.py:34-35` (a one-liner `return get_builtin_layout(device)`) is the narrowest Python spot holding both the `device` and `slangpy.SHADER_PATH` (`slangpy/__init__.py:69`). Wrap it in try/except `SlangCompileError`, check `device.desc.compiler_options.include_paths` for SHADER_PATH, re-raise with actionable guidance.

**Cross-issue linkage (important):** #1177 (raw `Device()`) and #886 ("SlangSession does not include internal slangpy search paths by default" — the `create_slang_session` surface, open/Dev-Reviewed, milestone Q2 2026) share this exact root cause. #886 already has a prior full triage recommending an `inherit_default_include_paths=True` approach, **held pending a maintainer approach decision** (jhelferty-nv pinged ccummingsNV 2026-08-26, unanswered). **Lesson:** a broad "always auto-inject SHADER_PATH" fix collides with that held design decision — keep per-issue fixes narrow (actionable error + docs for #1177) and flag the linkage rather than reopen the design debate. Also: the repo's own `AGENTS.md` "Functional API" example uses the failing `spy.Device()` — worth fixing to `create_device()` when doing the docs pass.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790019427102-slangpy-spy-device-vs-create-device-shader-path-in.md`_
