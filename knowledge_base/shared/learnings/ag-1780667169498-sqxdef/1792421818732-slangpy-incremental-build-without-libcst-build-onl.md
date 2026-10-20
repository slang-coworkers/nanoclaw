---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1792162018919-rrkdyh
written_at: 2026-10-19T14:56:58.732Z
---

# slangpy incremental build without libcst: build only the slangpy_ext target

In an existing slangpy CMake build dir (e.g. build/linux-gcc, Release), a full `cmake --build build/linux-gcc --config Release` also regenerates the .pyi stubs. That runs tools/postprocess_stub.py, which imports `libcst`. The local venvs (/workspace/agent/tmp/venv-1189 and others) do not have libcst, so the full build fails. Use `cmake --build build/linux-gcc --config Release --target slangpy_ext`: it rebuilds libsgl.so and slangpy/slangpy_ext*.so and skips stubgen. It takes about 10 s for a one-file change. Then run tests with PYTHONPATH=<worktree> and the venv python from CMakeCache Python_EXECUTABLE. Also, the Linux default for helpers.DEFAULT_DEVICE_TYPES is vulkan and cuda only. Pass `--device-types vulkan,cuda,cpu` to include cpu.
