---
name: project_10892_crash_relocated_by_pr11491
description: "slang#10892's filed SIGSEGV (null getFuncDefinitionForContext deref in propagateInterproceduralEdge) was silently relocated by PR #11491 (perf fix, 2026-06-09, first release v2026.11), which added an early return. Two builds one commit apart show #10892 AND #12430 Repro 1 were the SAME crash pre-#11491; Repro 2 is stable and genuinely separate. Posted to #10892 (cmt 5226850234)."
metadata:
  node_type: memory
  type: project
  originSessionId: ca41560b-b199-4c60-94f8-8afbca9f7f07
---

# #10892's documented crash mechanism no longer exists — PR #11491 moved it

Found 2026-08-08 while deduping [[project_12430_existential_static_requirement_ice]].

**The fact.** #10892's body root-causes its SIGSEGV 139 to `propagateInterproceduralEdge`
dereferencing `getFuncDefinitionForContext(lookup)` → `nullptr`, then `baseFunc->getParams()`.
Commit `70dda1029` = **PR #11491 "Fix compiler performance regressions from auto-diff refactor"**
(2026-06-09T00:46Z) adds `if (!getFuncDefinitionForContext(targetCallee)) return;` verbatim. Its
literal parent `38c853dbed` lacks it. First release carrying it: **v2026.11**. The three
`SLANG_UNEXPECTED` param-info sites were 3 before and 3 after, so #11491 did not add the throw — it
only removed the null deref, so the input now reaches the `E99997` throw instead.

**Rival cause held fixed.** PR #10776 (interface-typed global params + `-conformance`) also touched
`collect-global-uniforms` since filing; `ac1b066c55` is an ancestor of both bisect endpoints, so it
cannot explain the flip. ⭐**A bisect that pins WHEN does not pin WHICH CHANGE unless every other
candidate touching the path is held fixed across both endpoints.**

## Two Release builds one commit apart (`-40-g38c853dbe` vs `-41-g70dda1029`)

| cell | PRE | POST |
|---|---|---|
| #10892, 2 conformances | 139 SIGSEGV | 255 `E99997` |
| #10892, no conformances | 139 (after E50100) | 255, clean `E50100` |
| #12430 R1 | 139 SIGSEGV | 255 same `E99997` |
| #12430 R2 | 255 assert | 255 assert — stable |
| 3 controls | 0 | 0 |

Under `SA_SIGINFO` both pre-guard crashes report `si_addr=0x30` with matching module-offset
backtraces ⇒ **#10892 and #12430 R1 were the same crash before #11491**, and #11491 relocated it for
both at once. R2's stability is what genuinely separates R2.

⛔**My "artifact of a partial fix / they merely converged" framing was refuted by the one cell
predicted to confirm it:** the triager predicted R1 would be immune (0 `global_param` insts vs 30),
and it moved too. I had published the framing to a peer before testing; the retraction is mine.
⭐**A prediction of immunity that fails is worth more than one that holds — it was the only cell that
could overturn the framing.** Published #12430 text was checked (positive-controlled grep) and never
carried the wrong framing.

**Measurement traps from this bisect.** `globalParam` (56, matches `%globalParams`, the collected
uniform buffer) and `global_param` (30, the IR opcode) are different nouns in the dump. A context grep
can return empty while the count is non-zero because tokens span line breaks.

**Posted:** triager's attribution on #10892 (cmt `5226850234`, 08-08 15:48Z). #10892's body is stale on
its own mechanism; `jvepsalainen-nv` owns it (and #10309).

⛔**Worktrees `wt-11491-{pre,post}` (3.4 G each, with `WHY-THIS-EXISTS.txt`) are the only way to
reproduce #10892's filed symptom — master cannot. Do not reap until #10892 and #12430 both resolve.**
