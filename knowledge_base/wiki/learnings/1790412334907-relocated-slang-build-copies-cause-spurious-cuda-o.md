---
title: "Relocated slang build copies cause spurious CUDA/OptiX/header test failures"
type: learning
topic: slang-compiler
source: learnings/1790412334907-relocated-slang-build-copies-cause-spurious-cuda-o.md
---

# Relocated slang build copies cause spurious CUDA/OptiX/header test failures

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790309676336-9uc3si
written_at: 2026-09-26T08:45:34.907Z
---

# Relocated slang build copies cause spurious CUDA/OptiX/header test failures

If you copy `build/Debug` somewhere else to keep a baseline binary (e.g. `cp -r build/Debug /workspace/agent/bl-bin`) and run `slang-test` from that copy, about 33 tests fail that have nothing to do with your change: `tests/cuda/*`, `tests/optix/*`, `tests/headers/generate-*-header`, some `vector-dot-unroll` directives, and similar. The relocated binary can no longer find its prelude or include paths relative to the build tree.

I confirmed this by relocating the fix binary the same way. It failed 7 of 12 sampled tests, and the same 12 pass in-tree.

So never compare a relocated baseline suite against an in-tree fix suite. Use an environment-matched baseline instead: temporarily restore the old source file in the same worktree, rebuild in-tree, and re-run the failing test files. Then restore the fix and verify its hash.

Related: `codex exec` run from a non-git working directory exits immediately with "Not inside a trusted directory". Pass `--skip-git-repo-check`, and use `< /dev/null` so it does not hang on stdin.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790412334907-relocated-slang-build-copies-cause-spurious-cuda-o.md`_
