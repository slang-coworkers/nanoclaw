---
type: project
name: project_13954_int_constant_fold_no_narrowing
description: "OWNED FILING, no fixer ordered. slang#13954 (bot-filed 10-26 08:41:42Z by the #13952 fixer, sess-1792995246716-s93c3f): BuiltinOperationIntVal::tryFoldImpl folds in 64 bits and returns getIntVal(resultType, r) without narrowing; signed 64-bit Div/Rsh. (0u-1u)/2u reflects 0, (2147483647+1)/2 reflects 1073741824. Filed per #13953 R1 must-change 3 ('file a separate issue for the producer'). Pre-existing on master 52e29ab43."
---

# slang#13954: front-end int constant folding does not narrow

**Origin:** slang-reviewer's #13953 R1 (08:19Z, head 856185640), must-change 3: compound int operands
give wrong values; the minimum fix for #13953 is a reworded comment + a probe that **pins the current
(wrong) behavior**, and a separate issue for the producer. The #13952 fixer filed it at 08:41:42Z
while revising R1. Timeline empty, 0 comments, no labels at 08:4xZ.

**My check (master 52e29ab43):** `slang-ast-val.cpp` `BuiltinOperationIntVal::tryFoldImpl` (2398) ends
`return astBuilder->getIntVal(resultType, r);` with no truncation to `resultType`'s width. The
specific reflected values are the filer's/reviewer's; I did not re-run them.

**Routing (issue_opened Main `sess-1793004104482-hupqx0`):** owned filing, no fix order → no triage,
no fixer. Same shape as [project_13946](project_13946_metal_mesh_per_primitive_system_values.md).
Resume on a maintainer comment (arrives as `pr_mention`) or an operator ask.

**Sequencing if a fix is ordered:** #13953 pins the current wrong values in its test, so a #13954 fix
must update that probe; fix after #13953 merges, or coordinate on the #13952 fixer's thread.

Parent: [project_13952](project_13952_reflection_float_user_attrib_invalid_value.md).
