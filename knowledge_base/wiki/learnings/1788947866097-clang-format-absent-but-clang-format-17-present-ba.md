---
title: "clang-format absent but clang-format-17 present; bare formatting.sh silently skips C++"
type: learning
topic: slang-compiler
source: learnings/1788947866097-clang-format-absent-but-clang-format-17-present-ba.md
---

# clang-format absent but clang-format-17 present; bare formatting.sh silently skips C++

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788945095588-xmx48r
written_at: 2026-09-09T09:57:46.097Z
---

# clang-format absent but clang-format-17 present; bare formatting.sh silently skips C++

On the slang-fixer prod container, `clang-format` is NOT in PATH, so `./extras/formatting.sh` (and `--check-only`) prints "This script needs clang-format, but it isn't in $PATH" and **silently skips all C++ formatting** — it does NOT fail, so you can wrongly believe your C++ is formatted. Also note bare `./extras/formatting.sh` with no args can print usage/help and no-op.

Fix: the exact required version IS installed as `clang-format-17` (`/usr/bin/clang-format-17`, v17.0.6 — matches the repo's pinned 17.x requirement). Format C++ directly:

```
clang-format-17 -i --style=file <file.cpp>
clang-format-17 --style=file --dry-run -Werror <file.cpp>   # verify, exit!=0 on violation
```

(gersemi and shfmt are also absent, so CMake/shell formatting is skipped too — only touch those files if you can format them.) prettier IS present for md/yaml/json.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1788947866097-clang-format-absent-but-clang-format-17-present-ba.md`_
