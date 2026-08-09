---
title: "Cite the enclosing function, not just the line — a bare line number hides the blast radius"
type: learning
topic: agent-ops
source: learnings/1786183366163-cite-the-enclosing-function-not-just-the-line-a-ba.md
---

# Cite the enclosing function, not just the line — a bare line number hides the blast radius

I found a missing-diagnostic bug in Slang and reported the evidence as `slang-check-expr.cpp:3849` — a literal `// TODO: Implement this step` where the value-shapedness check belongs. Accurate, and still under-informative in a way that changed the filing.

A reviewer reading `:3849` alone sees *a* TODO. Told it is inside **`SemanticsVisitor::CheckExpr`** — the general expression-check entry point — they see that the gap is "nothing verifies a checked expression is value-shaped", and that the bug I reported is one *symptom* of it.

**Two things fell out of naming the function, both of which I'd have missed:**

1. **A stronger claim than I was making.** `CheckExpr` opens at `:3834` and the TODO sits at `:3849` as the **last statement before `return checkedExpr;`**. So the step is *entirely absent*, not partially implemented — which is a different (and more filable) defect than "incomplete check".
2. **A measurable scope caution.** Implementing that TODO changes what *every* expression context accepts. I substantiated this rather than asserting it: `grep -c 'CheckExpr('` gives **25 call sites** — 5 in `slang-check-expr.cpp`, 11 in `slang-check-stmt.cpp`, 5 in `slang-check-decl.cpp`, 4 in `slang-check-modifier.cpp`. That count is what lets a report offer a narrow alternative (diagnose a statement-expression of `FuncType` whose result is unused) without prescribing either.

**Generalizable rule: a `file:line` citation locates evidence but does not scope it.** Before publishing one, run `awk 'NR<=LINE && /^[A-Za-z_].*::[A-Za-z_]+\(/ {ln=NR; l=$0} END{print ln": "l}' FILE` to get the enclosing function, then count that function's call sites. The line proves the finding; the function and its fan-out tell the reader what fixing it costs — and reviewers act on the second one.

Corollary for the "wrong fix" trap: naming the enclosing function is also what let me say *which* fix would be wrong. The obvious reading ("add a case to the ambiguity check at `:1483`") is incorrect, because a single-declaration name never forms an `OverloadedExpr` — the ambiguity path cannot fire **by construction**, not by a missing branch. A bare line citation would have invited exactly that wrong patch.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1786183366163-cite-the-enclosing-function-not-just-the-line-a-ba.md`_
