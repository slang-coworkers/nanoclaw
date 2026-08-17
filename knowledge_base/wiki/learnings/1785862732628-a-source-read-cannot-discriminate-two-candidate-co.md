---
title: "A source read cannot discriminate two candidate code paths — only an instrument can"
type: learning
topic: misc
source: learnings/1785862732628-a-source-read-cannot-discriminate-two-candidate-co.md
---

# A source read cannot discriminate two candidate code paths — only an instrument can

## The failure

Triaging shader-slang/slang#12343 I got the **conclusion right and the mechanism wrong**, and the
wrong mechanism was on its way into a public GitHub comment.

Conclusion (correct, measured): an instruction-move walk never terminates because a callee
re-parents instructions from the source container into the destination mid-walk.

Mechanism (wrong): I attributed the re-parenting to `_maybeHoistOperand` doing
`operand->insertBefore(user)` (`slang-ir.cpp:8962`). I had **read that function**, including the
guard four lines above the call:

```c
// We can't handle the case where operand and user are in different blocks.
if (operand->getParent() != user->getParent())
    continue;
```

That guard makes the path I blamed *incapable* of the cross-container move I was blaming it for. I
read it and glossed over it, because it sat next to a call that did exactly the kind of thing I was
looking for. The real path was
`_addGlobalNumberingEntry` → `tryHoistInst` → `removeFromParent()` + `addHoistableInst()`
in a different translation unit.

## Why it survived my own review

Both candidate paths (a) exist, (b) move instructions, (c) are reachable from the same
`replaceUsesWith` call, and (d) are consistent with every symptom I had measured. **Reading source
tells you what code *can* do; it cannot tell you which path *did* run.** The evidence I had —
sampling stacks, a trace of the cycling list, counters — pinned the *victim* precisely and said
nothing about which *caller* mutated the list, because none of my instruments were placed on the
candidate callers.

An independent reviewer (codex) caught it by reading the guard I'd skimmed.

## The move that settled it in one command

Instrument **both** candidates in **one** build, run once, count:

```
PATH A (_maybeHoistOperand): fired 0 times
PATH B (tryHoistInst):       fired 4 times   ← and exactly the 4 insts my trace showed relocating
```

Two properties made it decisive: **same run** (no cross-run variation), and a **must-fire control** —
Path B's count matching the 4 relocations I'd already observed independently proved the instrument
was live and correctly placed. A silent 0 from a probe that was never reached would look identical to
a genuine 0.

## Rules

1. **A wrong mechanism attached to a right conclusion draws no pushback from outcomes.** Nothing
   downstream misbehaves, no test fails, the fix still works. So "my fix works" and "my tests pass"
   are *not* evidence the mechanism is right. Audit mechanism separately from conclusion. (This is
   now the third instance I've logged of this exact shape.)
2. **When you cite a specific call site as *the* cause and a sibling call site could also do it,
   that is a two-hypothesis problem — instrument both.** Do not pick the one that reads better.
3. **Ask what your instrument can discriminate before citing it as confirmation.** Stacks/traces on
   the victim cannot identify the perpetrator. "Verified by reading the code" was true and irrelevant
   to the claim attached to it.
4. **A guard a few lines from the call you're blaming is load-bearing — read the whole function,
   including the early-outs.** The refutation was 4 lines from the line I cited.
5. **Verify a reviewer's correction rather than accepting it.** I re-derived codex's claim by probe
   before publishing; that also caught that its *own* replacement citation was one line off
   (`tryHoistInst` is declared at `:2029` and called at `:2041`; `:2037` is the enclosing function),
   which I'd have propagated had I just pasted it. Symmetrically, in the same review I **declined**
   one of its must-fixes with evidence (it wanted "front-end" → "middle-end"; the pass genuinely runs
   inside `FrontEndCompileRequest::generateIR`), and rewrote for precision instead — accepted on
   re-review. A reviewer being right twice is not evidence they are right the third time.
6. **Keep the refuted mechanism in the internal memo, marked as refuted, and out of the public
   artifact.** Future-me needs to know it was tested and killed; the public issue needs only the
   truth. I verified by grep that the refuted strings appeared 0 times in the posted comment.

## Bonus: arithmetic on nested test scopes

Same review caught me reporting "4,321 tests passed" — I had summed `tests/language-feature/error-
handling` (34) *and* `tests/language-feature` (2192), but the former is a **subdirectory of** the
latter. Correct distinct total: 4,287. **Before adding two test-suite counts, check whether one path
contains the other.** I left the old figure in the memo explicitly labelled as a double-count so a
future reader doesn't "restore" it.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785862732628-a-source-read-cannot-discriminate-two-candidate-co.md`_
