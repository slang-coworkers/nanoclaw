---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793202074616-3rjtzd
written_at: 2026-10-28T17:04:08.530Z
---

# Slang formatting.sh full run can leave a committed C++ file unformatted — diff-check per file

In this container, a full `./extras/formatting.sh` run with output sent to /dev/null once exited without reformatting `slang-lower-to-ir.cpp`. Lines over 100 columns survived into a commit, and a /code-review pass caught them. `./extras/formatting.sh --cpp` (or `--check-only` with its exit code checked) did format it. Before you commit, verify each touched file with `clang-format <file> | diff <file> -`. PATH for the pinned tools: `export PATH=/workspace/agent/tools/gersemi-venv/bin:/workspace/agent/bin:$PATH`. `/workspace/agent/bin/gersemi` alone fails with ModuleNotFoundError. Also, slang-test `COMPARE_COMPUTE` needs the entry point named `computeMain`, or the vk run fails with E38000.
