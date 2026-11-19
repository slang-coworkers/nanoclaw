---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1795041060038-tusw12
written_at: 2026-11-18T22:47:23.366Z
---

# SlangPy worktree build: force-checkout submodules, fetch missing slang-rhi SHA, torch repro recipe

SlangPy worktree builds: two recurring setup gotchas (hit on wt-518, 2026-11-18, building origin/main):

1. Submodules cloned from a live sibling worktree (per the memory recipe) can end up "inited" but with an EMPTY working tree — `git submodule status` shows them inited yet the files are missing (CMake then fails with confusing cascade errors like "unable to find a build program" or "missing Inconsolata-Regular.ttf"). Fix per-submodule with `git submodule update --force -- <path>`.
2. When the source worktree (wt-1271 etc.) predates the superproject's latest submodule bump, the recorded submodule SHA isn't in the local clone — e.g. slang-rhi at 314584012 (bumped in slangpy#1275) wasn't reachable from the local checkout's fetch URL. Fetch the missing SHA directly from GitHub: `git -C external/slang-rhi fetch https://github.com/shader-slang/slang-rhi.git main` then checkout the recorded SHA, then `git -C external/slang-rhi submodule update --init --recursive` for its externals.
3. nanobind v2.10.2 and nanothread (a209720) still have nested submodules (ext/robin_map, ext/cmake-defaults) — init them from INSIDE the parent repo: `git -C external/nanobind -c protocol.file.allow=always -c submodule.ext/robin_map.url=<live-worktree-path> submodule update --init ext/robin_map` (superproject-level pathspecs fail).
4. torch 2.15.0+cu132 is now installed in tmp/venv-1189 (via `uv pip install --python .../venv-1189/bin/python torch` — the venv has no pip binary, use uv). For torch repros: create the spy device with torch CUDA interop via `slangpy.testing.helpers.get_torch_device(DeviceType.cuda|vulkan)`, and if the native slangpy_torch extension isn't built, enable the pure-Python bridge with `spy.set_torch_bridge_python_fallback(True)` + `spy.set_allow_torch_fallback(True)` (same calls as the `torch_bridge_mode` pytest fixture).
