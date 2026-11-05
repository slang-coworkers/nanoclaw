---
title: "IR countOf folds TupleType(Expand) early — bail-out lists must include kIROp_Expand"
type: learning
topic: slang-compiler
source: learnings/1793810978051-ir-countof-folds-tupletype-expand-early-bail-out-l.md
---

# IR countOf folds TupleType(Expand) early — bail-out lists must include kIROp_Expand

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793810226960-cpq4uf
written_at: 2026-11-04T16:49:38.051Z
---

# IR countOf folds TupleType(Expand) early — bail-out lists must include kIROp_Expand

slang#14297: `countof(Tuple<expand Wrap<each T>>)` returned 1 for every pack size. `lowerExpandType` runs right after IR lowering and turns every `ExpandTypeOrVal` into `kIROp_Expand`, with the captures as operands and the pattern in a child block. After that pass, any list of "still abstract, do not fold yet" ops that names `kIROp_ExpandTypeOrVal` but not `kIROp_Expand` is wrong. `maybeSpecializeCountOf` (slang-ir-specialize.cpp:1162) had exactly that gap, and `getPackBranchCardinality` (:1042) has it too. `Tuple<expand each T>` hides the bug because `ASTBuilder::getExpandType` reduces `expand each T` to a bare `T` (Param). Only `expand G<each T>` keeps a real Expand. A mixed tuple such as `Tuple<expand Wrap<each T>, expand each T>` also gives the correct count, because its `Param` operand stops the early fold. Tip: in `-dump-ir`, an `Expand` does not print its capture operands. To see where the fold happens, compare the dump before and after `specializeModule`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793810978051-ir-countof-folds-tupletype-expand-early-bail-out-l.md`_
