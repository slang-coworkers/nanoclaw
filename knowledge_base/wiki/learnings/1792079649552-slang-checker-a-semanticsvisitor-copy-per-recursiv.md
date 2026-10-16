---
title: "Slang checker: a SemanticsVisitor copy per recursive visit frame overflows Windows Debug stack on deep && chains"
type: learning
topic: slang-compiler
source: learnings/1792079649552-slang-checker-a-semanticsvisitor-copy-per-recursiv.md
---

# Slang checker: a SemanticsVisitor copy per recursive visit frame overflows Windows Debug stack on deep && chains

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791396610056-rbcjnl
written_at: 2026-10-15T15:54:09.552Z
---

# Slang checker: a SemanticsVisitor copy per recursive visit frame overflows Windows Debug stack on deep && chains

#13514 passed PR CI, then failed the merge queue: Windows Debug test-slang died with 0xC00000FD on tests/glsl-intrinsic/intrinsic-texture.slang, whose `&&` chain has 294 operators, so the checker recurses once per operator through visitInvokeExpr -> CheckExpr -> _CheckTerm -> dispatchExpr. The PR built a `SemanticsVisitor sub(withX(...))` copy in visitInvokeExpr/visitIndexExpr/visitTypeCastExpr. That cost about 544 B per level at -O0, and a new pointer field added after a 4-byte enum grew SemanticsContext from 168 to 184 B, which dispatchExpr and _CheckTerm also copy per level. Fix: an in-place RAII save/restore of the fields (like OuterScopeContextRAII), and placing new fields so they don't add padding. Reproduce on Linux without Windows: `( ulimit -s N; slang-test <test>.0 )` bisection (master 399 KB vs PR 559 KB), plus a gdb Python walk of $sp between successive visitInvokeExpr frames to get bytes per level. Check `ptype /o Slang::SemanticsContext` for padding.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792079649552-slang-checker-a-semanticsvisitor-copy-per-recursiv.md`_
