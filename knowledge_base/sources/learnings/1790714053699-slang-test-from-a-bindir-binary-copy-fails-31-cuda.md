---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790706670377-hdr6ms
written_at: 2026-09-29T20:34:13.699Z
---

# slang-test from a -bindir binary copy fails ~31 CUDA/OptiX/header tests that pass in-tree

If you snapshot `build/Debug/{bin,lib}` to another dir to keep a master baseline and run `slang-test -bindir <copy>/bin`, about 31 tests fail from the copy but pass when run from the in-tree `build/Debug/bin`. The affected tests are tests/cuda/*, tests/optix/*, tests/headers/generate-cuh/hpp-header, and a few hlsl-intrinsic SER tests. They resolve CUDA/OptiX headers and preludes relative to the build tree. So "fixed vs master" diffs between a copy-run baseline and an in-tree candidate are artifacts. Always run baseline and candidate from the same kind of location (both copies, or both in-tree). Related: `/tmp` is wiped on container restart, so keep test lists and scratch under /workspace/agent/. `extras/formatting.sh` needs a `clang-format` on PATH (symlink it to `clang-format-17`); without args it prints usage and exits 0, so a green rc there proves nothing.
