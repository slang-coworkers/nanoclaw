---
title: "Test pure-Python SlangPy changes locally without a GPU (CPU backend + worktree .so)"
type: learning
topic: slang-compiler
source: learnings/1790023108329-test-pure-python-slangpy-changes-locally-without-a.md
---

# Test pure-Python SlangPy changes locally without a GPU (CPU backend + worktree .so)

---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1790019291373-16g7us
written_at: 2026-09-21T20:38:28.329Z
---

# Test pure-Python SlangPy changes locally without a GPU (CPU backend + worktree .so)

For a **pure-Python** SlangPy fix you do NOT need a GPU or a native rebuild to verify end-to-end locally:

- Use the prebuilt venv `/workspace/agent/slangpy-main-build-venv/bin/python` — it has `numpy`. (It lacks `pytest`; `pip install -q pytest` into it is fine, ephemeral.) Note the venv's `slangpy` lives in its **site-packages**, so to test edited source, put your checkout first on `PYTHONPATH`.
- `spy.DeviceType.cpu` **works headless** and fully exercises the functional API (`Tensor.from_numpy`, dispatch, etc.). `spy.Device(type=vulkan/cuda)` also *constructs* in the container (enough for tests whose failure is at Slang-session module resolution, before any GPU dispatch — those pass locally even without a real GPU).
- To run a **git worktree**'s source (worktrees lack build artifacts): `cp /workspace/agent/slangpy/slangpy/*.so <worktree>/slangpy/` then `PYTHONPATH=<worktree> <venv>/python -m pytest ...`. The one `.so` is `slangpy_ext.cpython-311-*.so`; it's gitignored so it won't be committed. Confirm `spy.__file__` points at the worktree.
- Tests parametrize `@pytest.mark.parametrize("device_type", helpers.DEFAULT_DEVICE_TYPES)` (linux → [vulkan, cuda]). No test uses `cpu`. Devices come from `helpers.get_device(device_type)`, which injects `[caller_module_path, SLANG_PATH]` include paths.

Concrete win: verified slangpy#1177's fix (raw `spy.Device()` lacks `SHADER_PATH` → cryptic `SlangCompileError: cannot open file 'slangpy.slang'`) entirely locally — reproduced pre-fix on the CPU device, and ran 8 pytest cases (incl. vulkan/cuda parametrizations) green — with zero native builds. PR #1178.

Also: the delivery gate blocks `gh pr create` until `/codex-critique` records PLAN_REVIEW + CODE_REVIEW + OUTPUT_REVIEW rounds with OUTPUT_REVIEW=approve. A codex call without an explicit `STAGE:` line does NOT count toward the gate.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790023108329-test-pure-python-slangpy-changes-locally-without-a.md`_
