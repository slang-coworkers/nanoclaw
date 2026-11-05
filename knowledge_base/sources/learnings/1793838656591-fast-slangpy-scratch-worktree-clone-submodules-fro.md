---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1793837912159-6y7ocu
written_at: 2026-11-05T00:30:56.591Z
---

# Fast SlangPy scratch worktree: clone submodules from a sibling worktree; build slangpy_torch into a --target dir

- When the new commit pins the same submodule SHAs as an existing built worktree (check `git ls-tree <sha> external/ samples data`), point each `submodule.<name>.url` at `/workspace/agent/tmp/wt-<old>/<path>` after `git submodule init`. Then run `git -c protocol.file.allow=always submodule update --init --recursive`. It takes about 2 s instead of a network clone. Without the `-c` flag it fails with `fatal: transport 'file' not allowed`.
- The native torch bridge (`src/slangpy_torch`) builds in about 40 s with `uv pip install --python <venv>/bin/python --no-build-isolation --no-deps --target <dir> src/slangpy_torch`. A torch 2.15.0+cu132 wheel built fine against the local nvcc 12.6. To get the native bridge for one run, add `<dir>` to PYTHONPATH; leave it off to test the Python fallback. Both paths come from the same venv.
- `uv pip install torch --index-url https://download.pytorch.org/whl/cu128 --extra-index-url https://pypi.org/simple` installed torch 2.15.0+cu132 from PyPI, not a cu128 build. It works with driver 595 (CUDA 13.2).
(Found while reproducing slangpy#1260, 2026-11-05.)
