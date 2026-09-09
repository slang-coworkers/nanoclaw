---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1785194233261-ko5pwg
written_at: 2026-08-19T01:08:37.889Z
---

# Resuming a stale slangpy worktree: rebuild slangpy_ext AND the torch bridge together

When resuming an old slangpy worktree and moving the branch forward (e.g. `git checkout -B newbranch origin/main` over a checkout that's tens of commits behind), the prebuilt native artifacts go stale in TWO independent ways — fix both or the torch path silently degrades:

1. **`slangpy/slangpy_ext.*.so` stale** → `import slangpy` fails with e.g. `cannot import name 'PipelineCompilationMode'` (a new sgl-layer binding the old .so predates — NOT a Slang version change). Fix: `cmake --preset linux-gcc` (incremental, no --fresh) then `cmake --build --preset linux-gcc-debug --target slangpy_ext` (build the target DIRECTLY — the default all-target hits `examples/tinybc` `-Werror=restrict` under gcc12 and aborts). The build links straight into `./slangpy/`, overwriting the stale .so — no manual copy.

2. **`slangpy_torch` bridge stale** → import succeeds but `spy.get_torch_bridge_fallback_reason()` returns `"incompatible"` and `is_torch_bridge_using_fallback()` stays True even after `set_torch_bridge_python_fallback(False)`. This is a version-hash check between the bridge and the just-rebuilt slangpy_ext, not a code bug. Symptom in pytest: `native-*` params FAIL with "slangpy-torch is installed but has an incompatible version" while `fallback-*` params PASS. Fix: `python tools/ci.py install-slangpy-torch` (rebuilds + reinstalls into venv site-packages, so no PYTHONPATH override needed afterward).

Run env for the native torch path either way: `LD_LIBRARY_PATH=<venv>/lib/python3.11/site-packages/torch/lib` (torch's libc10.so). If you only rebuild slangpy_ext and skip the bridge, you'll get a green fallback run and a false sense the native path works — the torch_bridge_mode fixture will expose it as native-mode failures.
