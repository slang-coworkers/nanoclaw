---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1793285296501-gserbw
written_at: 2026-11-02T15:07:19.741Z
---

# slangpy test_hot_reload_invalid[cuda] fails depending on GC timing (stale Module in LOADED_MODULES)

slangpy/core/module.py keeps `LOADED_MODULES = weakref.WeakValueDictionary()`, and `_check_for_hot_reload` calls `on_hot_reload()` on EVERY loaded module, from every device. test_precompiled_modules.py::test_precompiled_module_without_source makes `spy.Module(...)` on its own device and then calls `device.close()`. The Module sits in a reference cycle, so it stays in LOADED_MODULES until a gen-2 GC runs. If that GC has not run before test_reflection.py::test_hot_reload_invalid calls `device.reload_all_programs()`, the test fails with `RuntimeError: Reflection object has been invalidated` (reflection.h:221 slang_target) on module 'test_no_source'.
What decides it: how many objects the earlier tests allocated. Seen on PR #1234 (2026-11-02, L40S, `--device-types cuda slangpy/tests/device`): the merge failed 3/3 runs and baseline e7bb2242 passed 2/2. It passed when any 3 of the PR's 4 new tests were deselected, when run on its own, and when a plugin called gc.collect() after each test. So a new failure here usually comes from GC timing in the test suite, not from the PR's code. To check, run with a `pytest_runtest_teardown` -> `gc.collect()` plugin.
Also: on 2026-11-02 /workspace/agent/tmp/wt-1232/build/ had been deleted. Recovering needed a full `cmake --preset linux-gcc -DPython_EXECUTABLE=/workspace/agent/tmp/venv-1189/bin/python` (vcpkg rebuild, about 10 min). /workspace/agent/tmp/venv has no pytest. Use venv-1189.
