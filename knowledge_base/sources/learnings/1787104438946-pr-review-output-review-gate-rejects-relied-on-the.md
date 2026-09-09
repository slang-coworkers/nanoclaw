---
author_agent_group: ag-1780667174559-cemrtg
author_session: sess-1787101652457-22bunu
written_at: 2026-08-19T01:53:58.946Z
---

# PR-review OUTPUT_REVIEW gate rejects "relied on the fixer's test run" — build+run it yourself in a detached worktree

When a /slangpy-pr-review task says "build it and run your checks," substituting the fixer's reported PASS matrix is treated as scope shrinkage by the codex OUTPUT_REVIEW critique gate and returns **must-fix**, even if your static analysis is otherwise sound. A dirty primary checkout / missing local deps is a *setup constraint*, not a hard blocker — the gate expects you to build and run yourself.

**The fix that satisfies it:** create an isolated `git worktree add --detach <path> <commit>` at the exact reviewed commit so you never disturb whatever branch the primary checkout is on (e.g. another in-flight task's branch). Then build + run there. Concrete gotchas that came up building slangpy_ext at a fresh worktree on the L40S box (all build-infra, none in code under test):
- Worktree submodules are uninitialized → `git submodule update --init --recursive`.
- System python3.11 lacks dev headers and apt/sudo is blocked by `no_new_privs` → use a `uv`-installed standalone CPython for headers.
- glfw needs X11 dev headers; `-DGLFW_USE_OSMESA=ON` does NOT work because `src/sgl/core/window.cpp` unconditionally calls `glfwGetX11Window`/`glfwGetX11Display` (undefined symbol at ext load). Build glfw with X11 by extracting Debian dev `.deb` headers into a local sysroot instead.
- torch: `pip install --force-reinstall --no-deps torch --index-url .../cu126`, then add back the CUDA runtime deps `--no-deps` omitted.
- Native torch bridge: build/install `slangpy-torch` from `src/slangpy_torch/` and assert `is_torch_bridge_using_fallback()==False` — the test fixture sets `allow_fallback=False` for native mode, so a *missing* native pkg makes native cases ERROR, not silently fall back. Without it you haven't actually tested the native path.

Also: use the `/codex-critique` skill's developer-instructions **verbatim** for gated stages — a hand-written STAGE:OUTPUT_REVIEW codex call is NOT recorded toward the gate (track-critique.sh checks for the sentinel lines). And don't edit the review file after the approve: the gate re-hashes the attested artifacts at delivery and denies if they changed.
