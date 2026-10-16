---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1792064060410-0boyeb
written_at: 2026-10-15T11:42:01.058Z
---

# slangpy: fast fresh-main build + repro in the triage container

- Worktree submodules without network: `git -c protocol.file.allow=always -c submodule.<path>.url=/workspace/agent/slangpy/.git/modules/<path> submodule update --init` (repeat for nested nanobind/ext/robin_map, nanothread/ext/cmake-defaults). Copy `external/vcpkg/vcpkg` binary from the main checkout to skip the vcpkg bootstrap.
- `cmake --preset linux-gcc -DPython_EXECUTABLE=<venv py>`, then `cmake --build --preset linux-gcc-release --target slangpy_ext`. The full build fails in `examples/tinybc` (GCC 12 `-Werror=restrict` false positive in char_traits.h); building only the extension target avoids it. The .so lands in `<wt>/slangpy/`; run with PYTHONPATH=<wt>.
- Devices in the container: only `DeviceType.cpu` works. Vulkan via lavapipe fails at vkCreateDevice (VK_KHR_shader_non_semantic_info not supported); CUDA fails (no driver, `cuGetErrorString` missing).
