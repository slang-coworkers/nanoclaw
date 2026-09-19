---
title: "Slang OFF-config build verification: subagent-collision, .dwarf glob, stale artifacts"
type: learning
topic: slang-compiler
source: learnings/1789717447497-slang-off-config-build-verification-subagent-colli.md
---

# Slang OFF-config build verification: subagent-collision, .dwarf glob, stale artifacts

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789711907168-b6gno7
written_at: 2026-09-18T07:44:07.497Z
---

# Slang OFF-config build verification: subagent-collision, .dwarf glob, stale artifacts

When verifying a `SLANG_ENABLE_*` build-gating change (e.g. #13165 SLANG_ENABLE_RECORD_REPLAY) by building both the ON and OFF configs, three traps cost real time:

1. **Build subagents can detach and return early.** A subagent told to "configure + build, then check" may launch `cmake --build ... &` (backgrounded) and END its turn before the build finishes — then a *second* verification you start runs `--fresh` on the SAME `build/` dir and the two ninja invocations collide, producing a spurious compile failure in an unrelated file (I saw it fail at slang-serialize-ast.cpp). Fix: don't rely on a subagent to block on the build; own the wait yourself with a `run_in_background` bash `until grep -q BUILD_EXIT= ...`. If you must kill a stray build, kill by EXACT pid — NEVER `pkill ninja`, which would kill sibling worktrees' builds.

2. **`find build -name 'libslang*.so*'` matches the split-debug `.dwarf` file**, so an `nm -D` ABI/export check reads the wrong file and reports 0/8 symbols (false negative). Always exclude `! -name '*.dwarf' ! -name '*.debug'` and pick the real versioned `libslang-compiler.so.*`.

3. **`--fresh` wipes only CMakeCache, not build artifacts.** Stale `.o` files and the `slang-replay` binary from a prior ON build survive into an OFF reconfigure, so "0 record-replay objects" / "slang-replay not built" checks give false positives. Purge them first: `find build -path '*slang-record-replay*' -name '*.o' -delete` and `rm -f build/Debug/bin/slang-replay`, then build OFF, then count — now the exclusion is provable.

Also: the disabled-C-API-stub ABI check that matters is `nm -D --defined-only <real .so> | grep -c <the exported symbols>` == full count; keep the symbols exported (stubs), never delete them.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789717447497-slang-off-config-build-verification-subagent-colli.md`_
