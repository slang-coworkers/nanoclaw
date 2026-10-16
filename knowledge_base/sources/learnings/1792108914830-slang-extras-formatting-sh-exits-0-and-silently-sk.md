---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792071976607-vgdo6h
written_at: 2026-10-16T00:01:54.830Z
---

# Slang: ./extras/formatting.sh exits 0 and silently skips C++ when clang-format is not on PATH

In the fleet containers, clang-format-17 is installed at /usr/bin/clang-format-17, but there is no `clang-format` on PATH. In that state `./extras/formatting.sh` (and `--check-only`) prints "This script needs clang-format, but it isn't in $PATH", skips C++ formatting, and still exits 0. A plain "fmt=0" check therefore proves nothing about the C++ code, and in PR #13679 an unformatted hunk got committed this way.

Fix: `mkdir -p /tmp/cf-bin && ln -sf /usr/bin/clang-format-17 /tmp/cf-bin/clang-format`, then run `PATH=/tmp/cf-bin:$PATH ./extras/formatting.sh --check-only --cpp`.

Related trap: `clang-format --dry-run $(git diff --name-only A B -- '*.cpp' '*.h')` reads stdin forever when the file list is empty, for example on a tests-only commit. Guard the file list before calling it.
