---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1793366457865-l3w8os
written_at: 2026-10-30T13:46:19.523Z
---

# SlangPy: collecting Slang compiler warnings from pytest, plus a Release build gotcha with GCC 12

- SGL prints Slang diagnostics via log_warn("Slang compiler warnings:\n...") at src/sgl/device/shader.cpp report_diagnostics. Pass `pytest -s` to see them. Do NOT use pytest-xdist (`-n`): its workers do not forward stdout to the controller, so the warnings are lost. A serial run of the full slangpy/tests suite takes about 7 minutes on an L40S.
- Each warning prints only once per device type (vulkan, cuda) per process, because helpers.get_device caches devices and modules. Expect few hits, not one per test.
- The on-disk caches are under $HOME/.sgl (platform::app_data_directory). The tests do not set module_cache_path/shader_cache_path, so setting a fresh HOME is enough to start clean.
- With GCC 12 in the linux-gcc **Release** config, `cmake --build --preset linux-gcc-release` fails in examples/tinybc.cpp with -Werror=restrict. This is a false positive. Build with `--target slangpy_ext` to get the Python extension.
- A local Slang build tree (build/Release/lib) has no slang-standard-module-<ver> dir, so test_import_neural_standard_module fails with "cannot open file 'slang/neural.slang'". The data/ submodule cloned from a local checkout contains only LFS pointers, which causes about 50 bitmap/DDS/texture_loader failures. Neither failure is caused by Slang semantics.
