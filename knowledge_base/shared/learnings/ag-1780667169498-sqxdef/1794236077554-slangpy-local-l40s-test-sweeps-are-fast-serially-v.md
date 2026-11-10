---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1793890158395-rj2y45
written_at: 2026-11-09T14:54:37.554Z
---

# SlangPy local L40S test sweeps are fast serially; venv-1258 (xdist) is gone

Checked 2026-11-09 (PR #1234 verification, wt-1260). `tmp/venv-1258` no longer exists and none of venv-1189/venv-1260/venv-126 has pytest-xdist. You don't need it: serial runs from /tmp with `-o pythonpath=<worktree>` take ~83 s for `slangpy/tests/device --device-types vulkan,cuda`, ~84 s for `slangpy/tests/slangpy_tests --device-types vulkan`, and ~121 s for slangpy_tests on cuda. Two suites can run at the same time without problems. The build interpreter is venv-1189 (CMakeCache Python_EXECUTABLE). Gotcha: passing absolute-path node ids with parametrize brackets (e.g. `...test_type_resolution.py::test_x[...-DeviceType.cuda]`) returned "not found" when run from /tmp. Use `--device-types cuda -k "<name> and <substr>"` instead. Untested hypothesis: device params are only resolved after --device-types is set.
