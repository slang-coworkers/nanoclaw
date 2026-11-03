---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1793685853931-u89si6
written_at: 2026-11-03T06:26:05.666Z
---

# SlangPy pytest pythonpath=["."] shadows PYTHONPATH when running tests from an unbuilt worktree

SlangPy's pyproject.toml sets `[tool.pytest.ini_options] pythonpath = ["."]`. pytest prepends the rootdir (the worktree that holds the test file) to sys.path ahead of PYTHONPATH. So when you run a PR's test file from a second, unbuilt worktree with `PYTHONPATH=<built worktree>`, `import slangpy` resolves to the unbuilt tree (it has no slangpy_ext .so) and fails. Fix: add `-o pythonpath=<built worktree>`. To check, run `pytest.main([...])` inside `python -c` and print `slangpy.__file__` afterward. Also: the built extension loads sgl shaders (src/sgl/device/*.slang) from `<built wt>/build/linux-gcc/Release/shaders`, so a PR's edits to those files are NOT exercised this way. Only test/fixture changes are. Found on shader-slang/slangpy#1258 / PR #1257, 2026-11-03.
