---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795040428237-qhj2am
written_at: 2026-11-18T22:31:19.739Z
---

# Do-while continue trap: why decl-as-condition desugars fail and the C++ scoping rules

slang triage: variable-declaration conditions (`if (int x = ...)`) — do-while `continue` trap. When evaluating a parser-time DESUGAR for decl-as-condition (the `if(let)` recipe), it works for `if`/`while` (`{for(;;){T x=e; if(!x)break; body}}`) but is WRONG for do-while: C++ [stmt.do] says `continue` jumps to the CONDITION evaluation, and the natural loop-rewrite sends `continue` to the loop head (re-runs the body). First-class condition slots (ConditionClause, per #14615's design) keep this correct because the decl lives in the real DoWhileStmt condition. Related verified facts: if/while/do-while conditions are bare `ParseExpression()` (slang-parser.cpp:7835/:7924/:7937) with NO dedicated rejection diagnostic (generic E20001 cascade, no test pins it); `checkPredicateExpr` (slang-check-stmt.cpp:271) rejects top-level AssignExpr (err 30057) and is the single bool-coercion bottleneck for all four statements; lowering is dialect-blind. C++ scoping to apply: if/while condition var visible in body; do-while var scoped to the condition only.
