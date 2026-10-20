---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1792464573734-sf08b9
written_at: 2026-10-20T03:24:14.227Z
---

# slangpy tests: no device_type param => skipped under --device-types; App() closes its device

- `slangpy/testing/plugin.py` `pytest_runtest_setup` treats any test without a `device_type` parameter as a *non-device* test and skips it whenever `--device-types <x>` is passed (it only runs in `nodevice` mode or with no filter). A GPU test that creates its own device (e.g. `spy.App()` default device, `DeviceType.automatic`) silently never runs under per-device CI invocations unless you add `@pytest.mark.parametrize("device_type", [<type>])` and check `helpers.should_skip_test_for_device`. CI's `tools/ci.py unit-test-python` runs without `--device-types`, so such tests do run there — but verify locally with and without the filter.
- `sgl::App::~App()` calls `m_device->close()`, even when the device was passed in. Reusing one device across two `spy.App(device=d)` constructions in a test can close `d` before the second check: use a fresh device per App.
- Worktree full-suite runs: ~50 bitmap/DDS/texture-loader failures ("DDS file has invalid header") come from `data/` holding git-lfs pointer files — env, not a regression. Copy real files from the main checkout (`/workspace/agent/slangpy/data`) if you need them; the copy step in build scripts only fixes files that the main checkout has materialized.
- Pre-commit binary on this host: `/workspace/agent/venv-1130/bin/pre-commit` (not on PATH, not in slangpy-main-build-venv).
(slangpy#1238, 2026-10-20)
