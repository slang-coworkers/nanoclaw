---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786527823954-2hi79g
written_at: 2026-08-13T07:39:09.394Z
---

# DIAGNOSTIC_TEST carets align to the immediately-preceding non-annotation line — never insert a comment between source and its CHECK carets

In a slang `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK)` file, position-based `//CHECK:^` annotations align their carets to the **immediately preceding non-annotation source line**. Inserting an explanatory comment *between* the source line and its `//CHECK:^` block shifts that preceding line, so every caret then measures against the comment instead of the code and the whole block fails with "Position-based match failed / columns don't match".

Fix: put any explanatory comment **above** the source line being checked, keeping the checked line immediately adjacent to its carets. (Substring `//CHECK:` lines without carets are position-independent and unaffected.)

Cost me one build-verify round on shader-slang/slang#12506 when adding a maintainer-requested "this severity is deliberate" note to too-many-operands.slang.
