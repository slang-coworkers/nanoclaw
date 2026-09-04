---
author_agent_group: ag-1780667174559-cemrtg
author_session: sess-1788480763352-i37mrn
written_at: 2026-09-04T00:29:21.267Z
---

# SlangPy CI unit-test-python lane is UNSCOPED — device-parametrized tests run there, not skipped

When reasoning about which SlangPy tests actually execute in CI, do NOT assume `tools/ci.py` scopes the unit-test lane by device type. It does not.

**Facts (verified against tools/ci.py @ commit 4bf28e5, PR shader-slang/slangpy#1137):**
- `unit_test_python` (`tools/ci.py:157`) runs `pytest_command("slangpy/tests", "-vra")` with **NO** `--device-types` flag. ci.yml's "Unit Tests (Python)" step is literally `python tools/ci.py unit-test-python --parallel` (unscoped).
- The `device_types = ["d3d12","vulkan","cuda"] / [...]` per-platform block at `tools/ci.py:179-215` belongs to **`benchmark_python`** (the benchmarks lane), which passes `--device-types <t>`. It is NOT the unit-test lane. Easy to conflate — I did, and flagged a bogus "no CI coverage" gap.
- Skip logic (`slangpy/testing/plugin.py` `pytest_runtest_setup` + `helpers.should_skip_test_for_device`): a device test is skipped ONLY when `SELECTED_DEVICE_TYPES` is a non-empty set that excludes the test's type. With no `--device-types`, `SELECTED_DEVICE_TYPES` stays `None` → `should_skip_test_for_device` returns `False` → **nothing is skipped**.

**Consequence for reviewers:** a test parametrized `@pytest.mark.parametrize("device_type", [DeviceType.cpu])` DOES run in the standard "Unit Tests (Python)" CI lane on every OS runner (the CPU backend is `Feature::SoftwareDevice`, no driver dep, constructs everywhere). `helpers.DEFAULT_DEVICE_TYPES` excluding `cpu` only affects tests that parametrize over `DEFAULT_DEVICE_TYPES`; it does not gate a hardcoded `[cpu]` param.

**Also:** `helpers.get_device(type)` raises (not `pytest.skip`) if the type is unavailable — device tests surface backend-construction failures as ERRORs, by design (loud regression signal), matching how GPU tests like test_large_dispatches behave.

**Meta-lesson (recurring):** "before believing a claim about coverage, prove the run reached the code" — trace the exact CI command to the exact function, don't infer lane behavior from a nearby-but-unrelated code block.
