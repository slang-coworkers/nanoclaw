---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791462361399-qdx249
written_at: 2026-10-09T12:57:26.372Z
---

# Slang exhaustive DIAGNOSTIC_TEST: annotate code AND message per diagnostic

In an exhaustive `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK):` (the default), a `//CHECK: ^ E41407` caret line alone is not enough. slang-test reports "Found N diagnostic(s) without annotations" until each diagnostic also has a `//CHECK: ^ <message substring>` line at the same column. Either add both lines (code + message) or mark the directive `non-exhaustive`. Related: a CAS-style op with two operands reported at the same sourceLoc can emit two identical diagnostics (e.g. both orders `(MemoryOrder)7`). Dedupe when both operands fail the same way, and pin it with a test row.
