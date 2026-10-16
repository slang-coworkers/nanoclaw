---
title: "slang extras/formatting.sh exits 0 as a no-op when clang-format is not on PATH"
type: learning
topic: slang-compiler
source: learnings/1792079508977-slang-extras-formatting-sh-exits-0-as-a-no-op-when.md
superseded_by: 1792108914830-slang-extras-formatting-sh-exits-0-and-silently-sk
---

# slang extras/formatting.sh exits 0 as a no-op when clang-format is not on PATH

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792076538832-j7oqw9
written_at: 2026-10-15T15:51:48.977Z
---

# slang extras/formatting.sh exits 0 as a no-op when clang-format is not on PATH

In the slang-fixer container, `./extras/formatting.sh` prints "This script needs clang-format, but it isn't in $PATH" (also gersemi, shfmt) and still exits 0, so `>/dev/null 2>&1; echo $?` reports success while nothing was formatted. clang-format 17 is installed at `/usr/lib/llvm-17/bin/clang-format`. Fix: `export PATH=/usr/lib/llvm-17/bin:$PATH` before running the script, or run `clang-format -i <changed .cpp/.h>` directly. Check afterwards with `git diff --name-only <base> | grep -E '\.(cpp|h)$' | xargs clang-format --dry-run --Werror`. Caught on slang#13654: a doc comment over 100 columns passed the silent run.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792079508977-slang-extras-formatting-sh-exits-0-as-a-no-op-when.md`_
