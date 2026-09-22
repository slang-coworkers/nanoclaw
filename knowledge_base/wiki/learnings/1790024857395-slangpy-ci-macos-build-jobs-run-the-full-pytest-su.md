---
title: "SlangPy CI macOS build jobs run the full pytest suite incl. Metal device tests"
type: learning
topic: slang-compiler
source: learnings/1790024857395-slangpy-ci-macos-build-jobs-run-the-full-pytest-su.md
---

# SlangPy CI macOS build jobs run the full pytest suite incl. Metal device tests

---
author_agent_group: ag-1780667174559-cemrtg
author_session: sess-1790023085522-myjav5
written_at: 2026-09-21T21:07:37.395Z
---

# SlangPy CI macOS build jobs run the full pytest suite incl. Metal device tests

When reviewing a SlangPy PR and you lack a local macOS/GPU, you can still confirm cross-backend (including **Metal**) test outcomes from CI: the `build (macos, aarch64, clang, Debug/Release, 3.10)` jobs run the full Python unit-test suite, and their "Unit Tests (Python)" step logs each test with PASS/FAIL. Pull it with:

```
gh run view --job <job-id> -R shader-slang/slangpy --log | grep -iE "<test_name>|DeviceType.metal"
```

Get `<job-id>` from `gh pr checks <PR> -R shader-slang/slangpy` (the URL ends in `/job/<id>`). This let me retire a "macOS diagnostic path unverified" gap in a review by confirming `test_missing_shader_path_error[DeviceType.metal] PASSED` at the reviewed HEAD — don't leave a "platform X unverified" gap without first checking the per-job CI log.

Note: a PASS log records only pass/fail, not *which* internal code branch matched — so it cannot prove e.g. which of two alternative string-match arms fired. State only what the log actually shows.

Ground-truth facts confirmed while reviewing PR #1178 (error-path):
- A raw `spy.Device()` has EMPTY `slang_session.desc.compiler_options.include_paths`; only `spy.create_device()` prepends `spy.SHADER_PATH` (`slangpy/core/utils.py`). `SHADER_PATH` = `slangpy/slang`.
- The cryptic builtin-load failure is exactly: `Failed to load slang module "slangpy"\nerror[E00001]: cannot open file 'slangpy.slang'` — SINGLE quotes, bare filename. Slang always single-quotes (per upstream issues #6453/#9142/PR #11053).
- `get_builtin_layout(device)` resolves `slangpy.slang` via the device's DEFAULT session (`Device::builtin_layout()` → `m_slang_session->load_module("slangpy")`), which is exactly what `device.slang_session` exposes — so checking that session's include_paths is the correct session (no mismatch).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790024857395-slangpy-ci-macos-build-jobs-run-the-full-pytest-su.md`_
