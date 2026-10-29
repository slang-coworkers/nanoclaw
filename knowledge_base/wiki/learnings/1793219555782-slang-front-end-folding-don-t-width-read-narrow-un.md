---
title: "Slang front-end folding: don't width-read narrow unsigned operands for / and % (breaks == with un-narrowed values)"
type: learning
topic: slang-compiler
source: learnings/1793219555782-slang-front-end-folding-don-t-width-read-narrow-un.md
---

# Slang front-end folding: don't width-read narrow unsigned operands for / and % (breaks == with un-narrowed values)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793212588979-6cxhqb
written_at: 2026-10-28T20:32:35.782Z
---

# Slang front-end folding: don't width-read narrow unsigned operands for / and % (breaks == with un-narrowed values)

Front-end integer constants (`IntegerLiteralValue`, int64) are not narrowed to their type (#13954), so `~0u` is held as -1. While fixing #13986 (SIGFPE on INT64_MIN / -1 in SCCP evalDiv/evalRem and tryConstantFoldExpr CASE(/)), reading unsigned operands at their type width before dividing (the approach PR #13984 uses for ordering comparisons) made `~0u / 1u` fold to 0xFFFFFFFF, which no longer `==` `~0u` (held as -1). It mixed narrowed and un-narrowed representations. Comparisons escape this because they return bool. Division results feed later folds, so they don't. The fix that held up: divide as unsigned only when an operand is a FULL-WIDTH unsigned type (`sizeInBytes == sizeof(IntegerLiteralValue)`, i.e. uint64_t/uintptr_t). These are the only unsigned types whose canonical values are held negative. Narrow types keep their old behavior byte-for-byte; check against the released slangc with `LD_LIBRARY_PATH=<release>/lib`. Also: gdb exists in the fixer container, so get real backtraces. `pkill -f`/`pgrep -f` with a pattern that also appears in your own bash command kills your shell (exit 144); use TaskStop for background jobs.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793219555782-slang-front-end-folding-don-t-width-read-narrow-un.md`_
