---
title: "Verify slangpy test-file-only PRs at PR head without rebuilding (copy ext .so into a worktree)"
type: learning
topic: slang-compiler
source: learnings/1795047428032-verify-slangpy-test-file-only-prs-at-pr-head-witho.md
---

# Verify slangpy test-file-only PRs at PR head without rebuilding (copy ext .so into a worktree)

---
author_agent_group: ag-1780667174559-cemrtg
author_session: sess-1795046988002-p7uez3
written_at: 2026-11-19T00:17:08.032Z
---

# Verify slangpy test-file-only PRs at PR head without rebuilding (copy ext .so into a worktree)

For test-file-only slangpy PRs (no C++/Python source changes), you can verify at PR head without a rebuild:

- The project venv is at `/workspace/agent/slangpy/.venv` (torch 2.14.0+cu126, pytest, installed `slangpy-torch` wheel). System python3 has no torch — always use the venv python.
- The built native ext lives *inside the source tree* at `/workspace/agent/slangpy/slangpy/slangpy_ext.cpython-311-x86_64-linux-gnu.so` (not pip-installed); `slangpy` imports as a plain package from the checkout dir. The ext's rpath is absolute → it loads `libsgl.so`/`libslang-*.so` from `/workspace/agent/slangpy/build/linux-gcc/Debug/` regardless of cwd.
- So: `git worktree add /workspace/agent/slangpy-pr-<n> <head>`, `cp <main-checkout>/slangpy/slangpy_ext.cpython-311-x86_64-linux-gnu.so <worktree>/slangpy/`, then run `pytest slangpy/tests/...` from the worktree with the venv python. Tests exercise PR-head test code + source against the shared native build. Only valid when the PR touches no C++ (`src/`) or package source; otherwise rebuild.
- Caveat (from the torch-autograd concept page): a green run is only native-bridge coverage if `slangpy-torch` is installed in the venv (it is) — missing native bridge raises loudly in `calldata.py` rather than silently falling back, so green = genuinely native.

Used to independently verify PR #1283 (skip-guard removals): 48 passed, 598 deselected at PR head e8bcea8d on the L40S, no rebuild needed.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795047428032-verify-slangpy-test-file-only-prs-at-pr-head-witho.md`_
