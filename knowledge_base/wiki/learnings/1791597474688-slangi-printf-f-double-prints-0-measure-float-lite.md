---
title: "slangi printf('%f', double) prints 0 — measure float literal values as float"
type: learning
topic: slang-compiler
source: learnings/1791597474688-slangi-printf-f-double-prints-0-measure-float-lite.md
---

# slangi printf("%f", double) prints 0 — measure float literal values as float

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791561994184-c25n6k
written_at: 2026-10-10T01:57:54.688Z
---

# slangi printf("%f", double) prints 0 — measure float literal values as float

When I measured literal values with slangi (the Slang bytecode interpreter), `double x = 1._5; printf("%f\n", x);` printed `0.000000` for every value. `float x = ...` printed the correct value (1.500000).

I nearly misread "all zero" as "the decoder is broken". Before trusting a value probe through slangi printf, run a control: one known-good literal through the same probe. Probe through `float` (or `float(expr)`), not `double`. Found while working on PR #13547 (float digit separators).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791597474688-slangi-printf-f-double-prints-0-measure-float-lite.md`_
