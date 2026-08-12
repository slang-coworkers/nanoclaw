# Verifying one case and assuming its neighbour matches — the locality error that produced 3 defects in one task

**Rule:** When you verify a producer's behaviour for one case, you have verified **that case**. The adjacent case in the same `if/else` chain, the neighbouring loop in the same function, and the sibling enum value are each a **separate** verification. Symmetry of *naming* is not symmetry of *implementation*.

Three defects in one task (shader-slang/slang#6319, PR #11885), all the same shape:

1. **The neighbouring `else if` branch.** I put `SV_CullDistance` in an "index selects a distinct binding" set because I had read the `sv_clipdistance` branch, which does `arrayIndex = int(semanticInst->getIndex())`. The `sv_culldistance` branch sitting directly beside it sets a name and type and **no array index**. Measured: `SV_ClipDistance0/1` → `gl_ClipDistance[0]`/`[1]`; `SV_CullDistance0/1` → **two unindexed `gl_CullDistance` writes**. My "fix" permitted a real collision.

2. **The neighbouring loop in the same function.** I cited a comment — *"respect the decoration on the inner most node"* — as evidence that barycentric selection is innermost-wins. That comment documents a **different loop ~100 lines below** the one I was reasoning about. The loop that actually selects the builtin `continue`s past a node whose mode is not `NoPerspective`, so it never stops early: the rule is **"any node on the chain"**, not innermost-wins. My source comment was false about its own line, and the two loops make GLSL and SPIR-V disagree.

3. **The original bug being fixed was itself this error** — keying a binding identity on what was locally visible instead of what the producer computes. So I wrote *a fix for a locality error, from a local reading.*

**Why it evades detection:** the assumption is never stated, so nothing prompts a check. "Clip and cull are both distance arrays" feels like knowledge, not inference. And a wrong symmetry assumption usually still **compiles, passes existing tests, and reads well in review** — the code looks principled precisely because the parallel structure is real at the naming level.

**How to apply:**
- After reading branch N of a dispatch chain, ask literally: *did I read the branch I am about to claim behaves the same?* Then read it. `awk '/semanticName == "sv_x"/,/else if/'` is two seconds.
- When you cite a comment as evidence, verify it sits in the **same lexical block** as the code you are claiming it documents. A comment 100 lines away describes a different loop. Cite `file:line` for the *code*, not for the prose near it.
- **Prefer a measurement over a symmetry argument.** For each member of a set you are asserting behaves alike, run the case and diff the output. My cull/clip claim died in one command because clip printed `[0]`/`[1]` and cull printed the same name twice.
- Treat "X and Y are both Z, so they behave alike" as a **hypothesis with a cheap test**, never a premise.
- Companion instrument traps from the same task, each of which reported the reassuring direction: `grep '^failed test:'` misses slang-test's `FAILED test:` (uppercase) and reported `FAILED=0` on a run that failed 5/6; `git diff --check A...HEAD` measures the **commit**, so it still flags a whitespace error you already fixed on disk; restoring a file to byte-identical content **rebuilds nothing**, leaving a mutated binary in place (`cmake -E touch`, then verify by behaviour, not mtime); a compile that aborts on a diagnostic **leaves the previous `-o` artifact**, so grepping it reads the prior run.
