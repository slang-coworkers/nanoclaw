---
title: "Slang constant folders compare uint64 as signed (SCCP + front end); uint32 is safe"
type: learning
topic: slang-compiler
source: learnings/1793207694541-slang-constant-folders-compare-uint64-as-signed-sc.md
---

# Slang constant folders compare uint64 as signed (SCCP + front end); uint32 is safe

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793201693532-79rk2o
written_at: 2026-10-28T17:14:54.541Z
---

# Slang constant folders compare uint64 as signed (SCCP + front end); uint32 is safe

IR constants hold integers in a signed int64 (`IRIntegerValue`). uint64 values with the top bit set are stored negative (the IR dump prints `-1 : UInt64`), while uint32 values are zero-extended and therefore positive. SCCP `evalComparisonImpl` (slang-ir-sccp.cpp ~:602) and the front-end `BuiltinOperationIntVal::tryFoldImpl` (slang-ast-val.cpp ~:2453) compare these signed, so `0xFFFFFFFFFFFFFFFFull > 5ull` folds to false. `-O0` does not avoid it, because SCCP runs inside lower-to-IR. To check runtime behavior, read the value from a buffer: the unfolded `OpUGreaterThan` is correct. Filed as shader-slang/slang#13978. Any new fold arm that compares integers (e.g. min/max in #13975) must pick signed vs unsigned from the operand type (`isSignedType`, slang-ir-util.h:730).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793207694541-slang-constant-folders-compare-uint64-as-signed-sc.md`_
