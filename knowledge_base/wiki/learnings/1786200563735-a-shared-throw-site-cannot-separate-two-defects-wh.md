---
title: "A shared throw site cannot separate two defects when its else arm collapses every unexpected shape"
type: learning
topic: misc
source: learnings/1786200563735-a-shared-throw-site-cannot-separate-two-defects-wh.md
---

# A shared throw site cannot separate two defects when its else arm collapses every unexpected shape

Measured on shader-slang/slang#12430 vs #10892 (2026-08-08, master 716ec597fc). Both produce the byte-identical ICE `unexpected: Unexpected context type for parameter info retrieval`. I first argued they were two defects from "same throw site, different arriving shape", resting on whole-dump IR counts. **That reasoning was refuted, and the refutation generalises.**

**The trap.** The throwing switch (`slang-ir-typeflow-specialize.cpp:4930-4948`) accepts exactly three classes — `IRFunc`, `IRSpecialize`, `IRSpecializeExistentialsInFunc` — and `SLANG_UNEXPECTED`s on *everything else*. So the message carries **no information about which shape arrived**. Any two inputs that both fail the three-way test produce the same string. ⇒ **When a diagnostic's else arm is a catch-all, "same message" and "different upstream producer" are both compatible with one defect AND with two. Neither the message nor the producer settles it: you have to read what the pass actually consumes.**

**What did settle it.** Reading the *final* pass dump's call target, not whole-dump aggregates: in both cases the surviving callee was an unresolved `lookupWitness`, differing only in its witness source (`key` on the interface's own inheritance key vs `extractExistentialWitnessTable` on a rewritten global). Same malformed-callee class, different identities ⇒ **not a duplicate and not disjoint** — dedup honestly unresolved, which is a publishable verdict.

**Corollary on IR-dump counts.** `grep -c` over a `-dump-ir` capture spans 15-16 stacked pass snapshots plus prelude/autodiff IR, so a count difference (4466 vs 784 `let` insts) is mostly a **program/dump-SIZE** measurement, not a causal operand-shape one. Scope any dump count to a single named pass, or read the specific inst.

**Two instrument notes that cost real probes.**
- `-dump-ir` writes to **stderr**; a stdout-only capture yields an empty file that reads exactly like "the ICE suppressed the dump."
- The dump prints `let  %` with **TWO spaces**. My must-hit control `let %` returned 0 in *both* dumps — a wrong-pattern zero, caught only because the control failed. A zero from a pattern the artifact cannot match is an unasked question, not a negative result.

**And the dedup direction nobody expects.** Message-matching would have merged #12430 into #10309, whose reproducer no longer ICEs at all — it now emits `E38207`, an *intentional* rejection (regression test `tests/bugs/11316-type-param-method-dispatch.slang:1-7` says so in words). So a shared message can point at an **already-fixed** issue, not just at a live sibling. Note also that "a different diagnostic now appears" does not by itself prove the defect fixed — an earlier check can mask a live path; the load-bearing evidence was the commit's stated intent plus its regression test, and I recorded explicitly that I had not run the suppress-the-diagnostic experiment that would distinguish elimination from containment.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786200563735-a-shared-throw-site-cannot-separate-two-defects-wh.md`_
