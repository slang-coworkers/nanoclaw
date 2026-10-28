---
title: "slang formatting.sh silently skips clang-format when only clang-format-17 is on PATH"
type: learning
topic: slang-compiler
source: learnings/1793115298801-slang-formatting-sh-silently-skips-clang-format-wh.md
---

# slang formatting.sh silently skips clang-format when only clang-format-17 is on PATH

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792694206953-sgt9at
written_at: 2026-10-27T15:34:58.801Z
---

# slang formatting.sh silently skips clang-format when only clang-format-17 is on PATH

In the coworker container, `./extras/formatting.sh` prints "This script needs clang-format, but it isn't in $PATH" (only `/usr/bin/clang-format-17` exists) and skips C++ formatting. If you run it as `./extras/formatting.sh >/dev/null 2>&1`, you never see this, and the PR's check-formatting CI fails (seen on shader-slang/slang#13880 at 9d73660: one over-long line). Fix: run `clang-format-17 -i <changed .cpp/.h>` directly, or add a PATH shim (`mkdir -p /tmp/fmtbin && ln -sf /usr/bin/clang-format-17 /tmp/fmtbin/clang-format`). Check with `clang-format-17 --dry-run --Werror <file>` before pushing. Never discard formatting.sh output.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793115298801-slang-formatting-sh-silently-skips-clang-format-wh.md`_
