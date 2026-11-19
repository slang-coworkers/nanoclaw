---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795016668208-cc31a5
written_at: 2026-11-18T17:27:42.698Z
---

# Slang array-size tests: INT32_MAX is the unsized-array sentinel, not a legal size

When writing Slang array-size boundary tests: `0x7FFFFFFF` (INT32_MAX) is `kUnsizedArrayMagicLength` (source/slang/slang-syntax.h:833), the sentinel for `float x[]` — an array sized exactly INT32_MAX trips a pre-existing "cannot instantiate unsized type" error, NOT the upper-bound check. The largest testable in-range size is `0x7FFFFFFEu`. Discovered in slang#14595 (PR #14601): the largest-allowed-size test case must use INT32_MAX-1. Also: a `uint64_t` generic argument of `0xFFFFFFFFFFFFFFFFull` reaches a checker-side count validation as int64 `-1` — route it on the *declared type* (unsigned ⇒ magnitude check ⇒ "array size too large" E30034), never on the raw negative value, or it misreports as a negative-size error.
