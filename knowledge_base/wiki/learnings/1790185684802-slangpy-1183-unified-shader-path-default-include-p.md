---
title: "slangpy #1183 unified SHADER_PATH default-include-path mechanism (supersedes #886/#1177 fixes) + pyright scope gotcha"
type: learning
topic: slang-compiler
source: learnings/1790185684802-slangpy-1183-unified-shader-path-default-include-p.md
---

# slangpy #1183 unified SHADER_PATH default-include-path mechanism (supersedes #886/#1177 fixes) + pyright scope gotcha

---
author_agent_group: ag-1780667174559-cemrtg
author_session: sess-1790109332123-vigt90
written_at: 2026-09-23T17:48:04.802Z
---

# slangpy #1183 unified SHADER_PATH default-include-path mechanism (supersedes #886/#1177 fixes) + pyright scope gotcha

PR #1183 ("Add slangpy shader path to devices and sessions by default", HEAD 21cd7ca) is the maintainer-blessed UNIFIED fix for both #886 and #1177, superseding PR #1182 (session inheritance, #886 only) and PR #1178 (narrow actionable-error for #1177). The earlier "held design decision" on #886 was resolved in favor of broad default-on: maintainers @ccummingsNV / @kaizhangNV asked for the slangpy module path to be a default include path, no opt-out kwarg. On merge, #1178 and #1182 are closed as superseded.

**Mechanism:** a file-local (anon namespace) `std::vector<std::filesystem::path> g_default_slang_include_paths` in `src/slangpy_ext/device/device.cpp`, set once at package import via a new module-level binding `_set_default_slang_include_paths([SHADER_PATH])` called from `slangpy/__init__.py` (SHADER_PATH is a Python-package path unknowable in C++, so Python registers / the binding applies — core SGL stays package-agnostic). `prepend_default_slang_include_paths()` (dedup via std::find, defaults-first) is applied at THREE binding sites: both `Device` ctor bindings (kwargs + the `DeviceDesc` one, which takes the desc BY VALUE to avoid mutating a caller-owned desc) and `device.create_slang_session`. The redundant manual prepend in `create_device` (`slangpy/core/utils.py`) is removed (single source of truth; `pathlib` import dropped there). Injection is UNCONDITIONAL — not gated on `add_default_include_paths`. Sessions get only the global default, NOT device-specific custom paths (intended: globals-plus-own-options model, operator Option-1). Still-uncovered (intentional follow-ups): `spy.App()`'s native-factory device (strongest fast-follow, user-facing) and the free-function `spy.create_slang_session()`.

**PYRIGHT SCOPE GOTCHA (saves a false-positive scare):** running `pyright slangpy/<file>.py` with an explicit file arg reports `reportUndefinedVariable` for runtime-injected native symbols (e.g. `_set_default_slang_include_paths`, `Device`) — BUT CI does NOT fail, because `pyproject.toml [tool.pyright] include = ["./src","./tools","./examples"]` EXCLUDES the `slangpy/` package entirely. The whole slangpy/ Python package relies on symbols injected by `_import("slangpy.slangpy_ext")` and sits outside pyright's roots by design. So bare native-symbol references in slangpy/*.py are fine for CI. Verify CI-impact against the pyright `include` roots, not against an ad-hoc `pyright <file>` run.

**Reviewer verification technique:** a `mcp__codex__codex` critique round run with `sandbox: danger-full-access` can leave a REAL built checkout on disk (here `/tmp/slangpy-pr1183-review`, git HEAD = PR head, native `.so` with the new symbol). A reviewer can reuse that build to run the actual tests instead of a costly from-scratch rebuild: `PYTHONPATH=<build> /workspace/agent/slangpy/.venv/bin/python3.11 -m pytest ...`. On the container GPU host (NVIDIA L40S) `helpers.DEFAULT_DEVICE_TYPES` expands to `[vulkan, cuda]` (no cpu), so those tests run on real GPU; use a direct `spy.Device(type=cpu)` repro for CPU coverage. Do NOT trust a codex "tests passed" Notes claim without re-running — verify the artifact and execute yourself.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790185684802-slangpy-1183-unified-shader-path-default-include-p.md`_
