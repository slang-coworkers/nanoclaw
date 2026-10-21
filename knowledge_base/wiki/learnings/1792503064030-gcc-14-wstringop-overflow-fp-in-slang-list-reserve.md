---
title: "GCC 14+ -Wstringop-overflow FP in Slang List::reserve — verify on Compiler Explorer via header amalgamation"
type: learning
topic: slang-compiler
source: learnings/1792503064030-gcc-14-wstringop-overflow-fp-in-slang-list-reserve.md
---

# GCC 14+ -Wstringop-overflow FP in Slang List::reserve — verify on Compiler Explorer via header amalgamation

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792501964483-uxx230
written_at: 2026-10-20T13:31:04.030Z
---

# GCC 14+ -Wstringop-overflow FP in Slang List::reserve — verify on Compiler Explorer via header amalgamation

Slang #13770: GCC >= 14.1 (x86-64 and aarch64; not 11.4/12.2/13.x, not -Os) warns `__builtin_memcpy writing 1024 bytes into a region of size 256 [-Wstringop-overflow=]` at List<T>::reserve's copy loop (slang-list.h:387) when many `add()`s are inlined (unit-test-string.cpp:284-285, the tail adds from #13217). It is a false positive: GCC can't see `m_count <= m_capacity`. Adding `SLANG_ASSERT(m_count <= m_capacity);` before `_allocate` in `reserve` silences it on 14.1–16.2 at -O2/-O3, because release SLANG_ASSERT is SLANG_ASSUME. The same pattern fixed #13754 (setCount). Gotcha: `SLANG_ASSERT(m_count >= 0 && m_count <= m_capacity)` STILL warns on 14.2/15.3, so use the single conjunct. A `values.reserve(N)` in the test does not help.

Technique, when the container only has GCC 12: do not send `g++ -E` output to godbolt, because glibc's preprocessed `_Float128` typedefs break GCC 14. Instead, amalgamate only the quoted `#include "..."` Slang headers with a small python resolver (search source/, include/, tools/; drop `#pragma once`; inline `<ankerl/unordered_dense.h>` from external/unordered_dense/include). Leave the system `<...>` includes alone, then POST to https://godbolt.org/api/compiler/g141|g153|g162|arm64g1410/compile with `{"source":..., "options":{"userArguments":"-std=gnu++20 -O2 -g -DNDEBUG -Wall ...","compilerOptions":{"skipAsm":true}}}`. A 720 KB full TU works. CI GCC versions (from merge-queue logs, 2026-10): x86-64 11.4.0, aarch64 13.3.0. So GCC-14-only warnings are invisible to CI today.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792503064030-gcc-14-wstringop-overflow-fp-in-slang-list-reserve.md`_
