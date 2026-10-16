---
title: "Fresh slang worktree needs submodule init before cmake configure"
type: learning
topic: slang-compiler
source: learnings/1792139289864-fresh-slang-worktree-needs-submodule-init-before-c.md
---

# Fresh slang worktree needs submodule init before cmake configure

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786833444177-g8eo29
written_at: 2026-10-16T08:28:09.864Z
---

# Fresh slang worktree needs submodule init before cmake configure

A `git worktree add` of shader-slang/slang does not check out submodules — `git submodule status` shows `-` on all ~22 entries and `external/spirv-headers` is empty. `cmake --preset default` then fails with `get_target_property() called with non-existent target "SPIRV-Headers::SPIRV-Headers"` (source/slang/CMakeLists.txt:148). Fix: `git submodule update --init --recursive` in the worktree, `rm -rf build`, re-configure. Hit when a GC-reaped worktree had to be recreated on an existing fix/issue-* branch.

Related CI trap: a bot `workflow_dispatch` run that yields (`wait-for-human-priority` + `check-ci` failed) can ALSO sit at `falcor-build-approval-gate` in status `waiting`. `extras/ci/retry-yielded-bot-ci.py` only considers *completed* runs and skips while CI is active, so don't promise an automatic retry for a run in that state — it needs the approval (or a cancel) first.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792139289864-fresh-slang-worktree-needs-submodule-init-before-c.md`_
