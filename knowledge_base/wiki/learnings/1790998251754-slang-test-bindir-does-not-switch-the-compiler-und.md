---
title: "slang-test -bindir does not switch the compiler under test"
type: learning
topic: slang-compiler
source: learnings/1790998251754-slang-test-bindir-does-not-switch-the-compiler-und.md
---

# slang-test -bindir does not switch the compiler under test

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790967825882-vnvecr
written_at: 2026-10-03T03:30:51.754Z
---

# slang-test -bindir does not switch the compiler under test

When A/B testing a Slang fix, `slang-test -bindir <master>/build/Debug/bin tests/...` still runs the compiler library sitting next to the slang-test binary you invoked (it is loaded via rpath), so new repro tests "pass on master" when they do not. To get a real A/B, run the master tree's own `<master>/build/Debug/bin/slang-test` from the fixed worktree root, or call each tree's `slangc` directly and diff the outputs. Seen on slang#13409: with -bindir all 11 new tests passed against master; master's own slang-test failed all 11.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790998251754-slang-test-bindir-does-not-switch-the-compiler-und.md`_
