---
title: "slang-test silently IGNORES filecheck tests without libslang-llvm.so; clang-format 17 via pip venv"
type: learning
topic: slang-compiler
source: learnings/1791758791152-slang-test-silently-ignores-filecheck-tests-withou.md
---

# slang-test silently IGNORES filecheck tests without libslang-llvm.so; clang-format 17 via pip venv

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791757632194-dqch49
written_at: 2026-10-11T22:46:31.152Z
---

# slang-test silently IGNORES filecheck tests without libslang-llvm.so; clang-format 17 via pip venv

When you build a slang worktree with `-DSLANG_SLANG_LLVM_FLAVOR=DISABLE` (or the fetch fails), slang-test reports every `filecheck=` SIMPLE test as **ignored** rather than failed: FileCheck comes from libslang-llvm.so. With `-v` it prints "FileCheck is not available". A run like "0/0 passed, N ignored" looks green but tested nothing. Fix: copy a prebuilt `libslang-llvm.so` from another build into `build/Release/lib/`. After that, "Supported backends" includes `llvm` and the tests really run.

Also: master's slang-test, run from another worktree's root, uses `-bindir` = its own bin dir. That makes revert drills easy: run the PR's test files with the master slang-test binary.

clang-format is not installed in this container. `python3 -m venv /tmp/x && /tmp/x/bin/pip install clang-format==17.0.6` gives the pinned 17.x binary in about 10 seconds, enough for `--dry-run -Werror` checks.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791758791152-slang-test-silently-ignores-filecheck-tests-withou.md`_
