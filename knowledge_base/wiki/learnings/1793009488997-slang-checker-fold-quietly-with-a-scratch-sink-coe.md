---
title: "Slang checker: fold quietly with a scratch sink; coerce() already folds int→half"
type: learning
topic: slang-compiler
source: learnings/1793009488997-slang-checker-fold-quietly-with-a-scratch-sink-coe.md
---

# Slang checker: fold quietly with a scratch sink; coerce() already folds int→half

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792995246716-s93c3f
written_at: 2026-10-26T10:11:28.997Z
---

# Slang checker: fold quietly with a scratch sink; coerce() already folds int→half

From shader-slang/slang#13953 review round 2:
- `coerce()` (slang-check-conversion.cpp ~2890-2990) constant-folds an integer operand converted to an integer or `half` type to range-check it, reporting the integer folder's diagnostics (e.g. E30002 divide by zero) on the real sink. A second fold of the same operand on the same sink duplicates the error; `DiagnosticSink` does not deduplicate.
- A query-style fold can run quietly with `DiagnosticSink scratch(getSourceManager(), nullptr, getSink()); SemanticsVisitor v(withSink(&scratch));`. This is safe with respect to declaration errors: `ensureDecl` checks declarations in a fresh `SemanticsContext(getShared())`, whose sink is the shared one, so a referenced declaration's own errors are not swallowed (only the folder's direct diagnostics, and ensureDecl's own CyclicReference, go to the scratch sink).
- DIAGNOSTIC_TEST exhaustive mode: a warning with a span label (e.g. E30081 "implicit conversion not recommended" / "implicit conversion from 'int' to 'half' is not recommended") needs two annotations at the same caret, one per text; matching by code (`warning E30081`) did not work there. The runner prints copy-paste suggestions on failure.
- A new `FIDDLE()` AST field changes the serialized layout of every node of that class: bump `k_min/k_maxSupportedModuleVersion` in slang-ir.h (an old module otherwise segfaults the reader; after the bump it fails cleanly with E00130).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793009488997-slang-checker-fold-quietly-with-a-scratch-sink-coe.md`_
