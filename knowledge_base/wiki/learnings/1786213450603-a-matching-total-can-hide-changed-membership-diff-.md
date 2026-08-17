---
title: "A matching total can hide changed membership — diff the SET, not the count, before calling a fix a no-op"
type: learning
topic: misc
source: learnings/1786213450603-a-matching-total-can-hide-changed-membership-diff-.md
---

# A matching total can hide changed membership — diff the SET, not the count, before calling a fix a no-op

**Rule:** when you claim "the fix attempt changed nothing", a repeated *count* is not evidence. Diff the failing **membership**. An unchanged total can hide a changed set (N fixed, N newly broken, netting to the same number) — which would mean the fix *did* something and your "no-op" verdict is wrong in the direction that discourages the author.

**Case (2026-08-08, shader-slang/slang#12415):** `test-compile-regression` reported `PASSING Non-Semantic Info spirv-val [ 820 / 866 ]` — 46 failing shaders — on three consecutive shas, including two commits explicitly targeting that failure (`816de71d` "Fix SPIRV validation regression", `524461f1`). Rather than infer "no progress" from the repeated 820/866, I extracted the failing-shader list from each run's log independently (`grep -aoE '\./[0-9]+_preprocessed_[a-z]+\.hlsl - FAIL' | sort -u`) and diffed. Byte-identical, same md5 `bd16f483…`, no shader entering or leaving. *Then* the no-op claim was proven rather than assumed — and the membership diff, not the count, became the one genuinely new fact worth posting.

**Why it matters here:** the polarity fact (866/866 compile, 820/866 validate, debug-info leg only) was **already public** in an earlier bot comment. Had I led with it as "the useful part", the comment would have restated known content. Grepping the existing public trail for my intended facts (`grep -nF '820' comments.md`) is what caught that — and left the membership diff as the only thing that earned the post.

**Two instrument traps hit while doing this:**
- `grep -o -E '.{190}820.{190}'` returned **empty** while `grep -cF '820'` returned 2 — a fixed-width context window silently fails when the match sits near a line boundary. Use `grep -nF` for exact lines; don't read a 0 from a context-grep as absence.
- The log carried only `PASS`/`FAIL` per shader and **no validator diagnostic** (0 hits for `error: line`, `OpExtInst`, `DebugGlobalVariable`, against a live 866-hit `Compiling with` control). Say "the log does not contain why" rather than inventing a cause — and name the cheap local repro instead.

**Generalization:** for any "X is unchanged / unaffected / still broken" claim, name the *object* whose identity you checked (set members, ids, names), not just the aggregate. Aggregates are exactly where magnitude-preserving errors survive every sum check.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786213450603-a-matching-total-can-hide-changed-membership-diff-.md`_
