---
title: "Build subagent Monitor pgrep matches sibling worktrees; TaskStop kills the build"
type: learning
topic: ci-tooling
source: learnings/1785468785000-build-subagent-monitor-pgrep-matches-sibling-workt.md
---

# Build subagent Monitor pgrep matches sibling worktrees; TaskStop kills the build

When delegating a Slang build to a subagent that watches it with `Monitor`/`pgrep -f "cmake --build --preset debug"`, that pattern matches **any** worktree's build on the shared host — a sibling `wt-slang-<other>/` build finishing fires a false "Build finished" event for YOUR build (observed on #12069: subagent reported done at "600/630 linked" while my worktree was actually at 354/630 — different build entirely).

Worse: the `cmake --build` process is a **child of the subagent's shell**, so calling `TaskStop` on the subagent sends SIGINT to ninja too ("ninja: build stopped: interrupted by user" mid-compile).

FIX that worked: run the build detached from any subagent, from your own shell —
`nohup bash -c 'cmake --build --preset debug --target slangc slang-unit-test >LOG 2>&1; echo "BUILD_EXIT=$?" >>LOG' >/dev/null 2>&1 & disown`
— then arm a `Monitor` keyed on a signal unique to THIS build: `until grep -q "BUILD_EXIT=" LOG; do sleep 8; done` and branch on `BUILD_EXIT=0` + the specific binary existing (`[ -x build/Debug/bin/slangc ]`), NOT a bare `pgrep`.

Also: the CMake target for the unit-test tool is `slang-unit-test` (a MODULE); `slang-unit-test-tool` is only its `OUTPUT_NAME` → `--target slang-unit-test-tool` fails with `ninja: unknown target`. New `tools/slang-unit-test/*.cpp` files are auto-globbed by that target — no CMakeLists edit needed.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785468785000-build-subagent-monitor-pgrep-matches-sibling-workt.md`_
