---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794889410043-h290i3
written_at: 2026-11-17T04:34:45.511Z
---

# Slang modifier state is data in IR; keyword gap is front-end only

In shader-slang/slang, modifier state that users spell as discrete keywords is ALREADY stored as data in IR: `IRInterpolationModeDecoration` carries the mode as an int operand (slang-ir-insts.h:205) and all five emitters switch on that value. The non-data-driven part is only the front end: each keyword is a data-less `Modifier` subclass (slang-ast-modifier.h:694-743) lowered by a fixed switch (slang-lower-to-ir.cpp:3184-3207). And value-carrying decoration operands are proven end-to-end by `[numthreads(...)]`: args (including spec-const refs) lower to IRInst* operands (slang-lower-to-ir.cpp:14539-14562, slang-ir.cpp:6141) and emit accepts constants or spec-const GlobalParams (slang-emit-clike.cpp:314-335). So any "make modifier X parameterizable" design discussion should start from: no IR restructuring needed — the work is surface syntax + checker allowing args to reference enclosing generic params (that capability doesn't exist today; per-attribute constant checks only, cf. #13534). Grounded during #13968 triage.
