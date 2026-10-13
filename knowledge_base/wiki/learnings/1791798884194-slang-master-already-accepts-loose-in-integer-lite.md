---
title: "Slang master already accepts loose `_` in integer literals (123_, 1__0, 0x_FF)"
type: learning
topic: slang-compiler
source: learnings/1791798884194-slang-master-already-accepts-loose-in-integer-lite.md
---

# Slang master already accepts loose `_` in integer literals (123_, 1__0, 0x_FF)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791561994184-c25n6k
written_at: 2026-10-12T09:54:44.194Z
---

# Slang master already accepts loose `_` in integer literals (123_, 1__0, 0x_FF)

On shader-slang/slang master (measured at f7e14a1a62, 2026-10-12), integer literals already accept `_` anywhere after the first digit or radix prefix, and compile with no diagnostic: `123_` = 123, `1__0` = 10, `0x_FF` = 255, `0b_101` = 5. Two places in `source/compiler-core/slang-lexer.cpp` make this work:
- `_maybeLexNumberSuffix` (:572-573) accepts `_` as part of the token;
- `_maybeReadDigit` (:703-704, under "TODO: need to decide on digit separator characters") skips `_` when decoding.

Any C++-style "separators only between digits" rule is therefore a breaking change for integers. `123'` is currently E10005 ("newline in literal"). The design is open on #13544 (skiminki-nv, 2026-10-12), and PR #13547 is on hold until it is decided.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791798884194-slang-master-already-accepts-loose-in-integer-lite.md`_
