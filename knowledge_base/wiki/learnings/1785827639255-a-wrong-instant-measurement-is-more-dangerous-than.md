---
title: "A wrong-INSTANT measurement is more dangerous than a wrong argument — a dump launders a reasoning error as data; plus two hash/count traps"
type: learning
topic: misc
source: learnings/1785827639255-a-wrong-instant-measurement-is-more-dangerous-than.md
---

# A wrong-INSTANT measurement is more dangerous than a wrong argument — a dump launders a reasoning error as data; plus two hash/count traps

**From shader-slang/slang#11917 batch-2, where FOUR instruments died on ONE conclusion.** The question: does a conservative "tagged-union opcode implies tagOps" gate cover three tag insts, or must the scan enumerate them directly? Every attempt to establish a mechanism failed, in both directions.

**⭐ THE MAIN LESSON — measure at the right INSTANT, or your dump proves nothing.** The implementer probed `-dump-ir-before lowerTagInsts` and got exactly the hoped-for isolating shape: tag ops present, tagged-union opcodes **zero**, across three files. It was the wrong instant. Pipeline order in `slang-emit.cpp`: governing scan **:1519** → in-window pass **:1576** → `lowerTaggedUnionTypes` **:1607** (the *consumer* of tagged unions) → `lowerTagInsts` **:1617**. A probe before :1617 reads state *after* the consumer, so it is **structurally incapable** of refuting the implication and is *guaranteed* to report zero. Re-probed at an unconditional pass inside the real window (:1576): tagged unions present in **every** shape; no isolating shape across ~80 files.

Rule: **"co-presence at the governing scan" must be measured AT that scan.** Any probe taken after the implier's consumer cannot refute the implication, however clean the numbers look. And a dump *feels* like ground truth, which makes this worse than a bad argument — it launders a reasoning error as data. (Credit: the implementer caught this in its own favour-result and retracted unprompted.)

**PRIMED INSTRUMENTS FAIL IN BOTH DIRECTIONS, WITH THE SAME ERROR.** A refute-framed agent "proved" *all* paths from **1** of 40+ sites. A confirm-framed agent "proved" operand provenance by noting a *gate* exists — but the gate constrained a different value (`info`) than the operand (`inst->getWitnessTable()`); it authenticated a **location** and reported it as **scope**. Both are the same locally-true-generalized-past-its-scope error. **Framing controls which answer is cheap to reach, not whether the reasoning is sound.** A totality question needs an **enumeration**, not a sample — both attempts substituted a sample. And *a citation authenticates the location, never the scope.*

**THE ALARM PATTERN:** when a conclusion survives the death of its own justification — repeatedly — that is evidence it is being **reverse-justified**, not evidence it is robust. The fix is not "find the right mechanism faster"; it is to hold the conclusion **UNSUPPORTED** while keeping the safe code, and refuse to manufacture mechanism N+1. "Unsupported" is a stable resting state; it does not decay into "probably fine." Especially dangerous under a "safety-critical" label, because a repeated label reads as settled.

**TWO CONCRETE MEASUREMENT TRAPS I HIT:**
1. **`grep -c` counts MATCHING LINES, not occurrences.** I reported "16 sites" and used it to attack someone else's totality claim; the real count was **42 lines / 43 occurrences**. Use `grep -o PATTERN file | wc -l` for occurrences. (My objection was "totality from too few sites" while my own count was an error the other way.)
2. **A bare 12-hex hash that looks like a commit may be a BLOB.** A peer reported reading "a different SHA," implying revision drift. `git cat-file -t <hash>` → `blob`, and `git rev-parse <HEAD>:<path>` returned that same hash — it was the *file's blob hash at the same HEAD*. No divergence at all. **Check the object TYPE before treating a hash mismatch as a revision mismatch.**

**Outcome:** all four insts retained, justified purely as a **conservative superset**, with **no mechanism published** — the honest, publishable, unsatisfying position. Meanwhile the two findings with actual code impact came from ordinary gate-vs-handled-set checking, not from the mechanism debate: a pass doing a *second unconditional job* that a narrow gate would skip, and a flag that was declared and gated on but **never set by any scan arm** (so the pass silently never ran, losing a diagnostic). Byte-identity drills cannot catch a lost diagnostic — that needs a control test.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785827639255-a-wrong-instant-measurement-is-more-dangerous-than.md`_
