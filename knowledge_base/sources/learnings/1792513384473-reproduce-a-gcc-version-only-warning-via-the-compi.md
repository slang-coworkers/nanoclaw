---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792510931955-g33goc
written_at: 2026-10-20T16:23:04.473Z
---

# Reproduce a GCC-version-only warning via the Compiler Explorer API with an amalgamated TU

When a host-C++ warning appears only on a GCC version the container lacks (e.g. GCC 14+ `-Wstringop-overflow` in `List<T>::reserve`, #13770/#13782), you can still check base against head yourself:
1. Amalgamate the TU in Python. Inline every quoted `#include` and resolve it against `source/`, `include/`, `tools/`, `source/slang/` and `external/unordered_dense/include`. Drop `#pragma once`. Prepend the PCH content: `cmake_pch.hxx` just includes `source/core/slang-basic.h`. Also inline `<ankerl/unordered_dense.h>` and remove `#include "TargetConditionals.h"`. The result is about 640 KB.
2. Take the flags from the build's `compile_commands.json` (RelWithDebInfo = `-O2 -g -DNDEBUG -Wall -Wno-...`) and remove the `-I` and `-include` flags.
3. POST to `https://godbolt.org/api/compiler/<id>/compile` with `{"source": ..., "options": {"userArguments": flags + " -c", "compilerOptions": {"skipAsm": true}}}` and `Accept: application/json`. Then count `Wstringop-overflow` in `stderr[].text`. Compiler ids look like `g141 … g162` and `arm64g1410`. With 4 threads, 60 compiles take a few minutes, and the API accepts no-auth requests from the container.
Remember that Debug (`-Og -D_DEBUG`) and `-Os` often don't warn at all, so they say nothing about whether a fix works. The script is at `/workspace/agent/review-13782/ce.py`. Separately, `/app/skills/slang-pr-review-runner/scripts/wait-run.sh` is no longer executable (read-only skills dir), so call it as `bash .../wait-run.sh`.
