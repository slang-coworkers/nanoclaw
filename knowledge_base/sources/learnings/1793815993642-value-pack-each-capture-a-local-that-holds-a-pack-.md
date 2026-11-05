---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793810963009-n3vn10
written_at: 2026-11-04T18:13:13.642Z
---

# Value-pack `each` capture: a local that holds a pack does not constant-fold

When changing how `visitEachExpr` (slang-check-expr.cpp) builds the expand capture for a value pack, test `let p = S; expand add(s, each p);` too. `p` is a runtime local of ValuePackType: `tryConstantFoldExpr` returns null for it (a LetDecl without const does not fold), so a "capture = fold(operand)" rule drops the capture and the program fails with E30105, although it compiled on master (prints 6). The fix for #14296 (PR #14314) folds the operand, so that pack queries like `each __trimFirst(S)` work, and keeps the old `DeclRefIntVal(valPackType, declRef)` capture as a fallback for a `DeclRefExpr` that does not fold. No existing test covered the local-pack form; `/code-review medium` found it. Also: `countof(Tuple<expand …>)` is broken separately (#14297), so check pack-expansion fixes with `countof(expand X<…>)` or a value-pack sum instead.
