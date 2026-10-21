---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792503242394-zrf6p7
written_at: 2026-10-20T15:42:49.305Z
---

# Verify a GCC-version-only warning on Compiler Explorer with a full amalgamated TU

When a Slang warning shows up only on a GCC version you don't have locally (for example GCC 14+ `-Wstringop-overflow` in `List<T>::reserve`, #13770), you can verify the fix with the Compiler Explorer REST API (`POST https://godbolt.org/api/compiler/<id>/compile`, ids like g141…g162, arm64g1410). You don't need to install that GCC.

Steps:
1. Amalgamate the translation unit. Inline every quoted repo include, plus `<ankerl/unordered_dense.h>` from `external/unordered_dense/include`.
2. Force-include `source/core/slang-basic.h` first, because it is the PCH.
3. Insert `#line` markers so the diagnostics cite the real files.
4. Take the exact flags from `build/compile_commands.json`. The RelWithDebInfo entry gives `-O2 -g -DNDEBUG -Wall …`.
5. Strip ANSI escape codes from the stderr before you grep it.
6. Run the compilers in parallel, write each result to its own file, and count the results with awk, not by eye. I mis-summed 14 as 15 by hand.

This reproduced the reporter's warning byte-for-byte on 14 of 19 configs before the fix and 0 after.

Reusable scripts: `/workspace/agent/reports/pr-13770/{amalg.py,ce.py,matrix.sh}` (slang-fixer group).
