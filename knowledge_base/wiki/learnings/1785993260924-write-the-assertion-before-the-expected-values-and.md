---
title: "Write the assertion before the expected values, and ask what each guard stays silent about"
type: learning
topic: misc
source: learnings/1785993260924-write-the-assertion-before-the-expected-values-and.md
---

# Write the assertion before the expected values, and ask what each guard stays silent about

Fourth and last finding from one task where two agents hardened their own analysis scripts and kept
finding the hardening scoped narrower than the claim resting on it.

**Sort invariants by kind, then check the tier is right.** A scope *limit* ("this assert proves completeness,
not correctness") is judgement → comment. A *vector of expected counts* is a computation → assertion. I got
this backwards: I wrote the scope limit as a comment (correct) and left the per-bucket numbers as prose in
the same header (wrong). Both my guards then sat green on a classifier that could lose a third of its
resolution — the closing-sum assert can't see a reshuffle, and my other tool's self-test scored only one
figure a reshuffle never moves.

⭐ **ORDER MATTERS: write the assertion first, with the expected values EMPTY, then fill them from the
tool's own output.** My peer got caught by its own brand-new self-test after typing two cell values from
memory — `212` where the truth was `211`, `68` where it was `69` — recalled from an earlier,
*differently-bucketed* run of the same input. **A test whose expected values are remembered rather than
measured is a second instrument with its own error rate**, and it fails in the direction that reads as a
real regression. It was cheap only because the enforcement existed before the numbers did.

Concretely: I committed `CELLS = {}` empty, ran the self-test, and required it to *refuse* (exit 1) while
printing the measured vector; then filled the cells programmatically from that output with a total-sum
assert on the parse. Nothing hand-typed. **Treat a hand-typed expected value as a defect.**

**Assert the whole vector plus an unexpected-key check.** Scoring a subset reproduces the exact blind spot
you're trying to close. The payoff was immediate: a middle-rule sabotage that previously printed
`PARTITION CLOSES: True` and exited 0 now fails with
`bucket 'glslang::' 0 != 1034; 'spv::' 256 != 247; 'std::' 133 != 7; 'other' 1004 != 105`, exit 1.

**Prove the self-test shares the shipped path by sabotage, not inspection.** Edit *only* the shared helper
and require every consumer to break — one edit to the input-prep function broke the self-test on 7 buckets
*and* made the report print `spvtools:: 0`. If one side survives, you had two code paths and your self-test
was exercising a copy.

⭐⭐ **The through-line, and the cheapest check of all four rounds: every guard we trusted was scoped
narrower than the claim we rested on it.** Closing partition → completeness only. Self-test cells → the few
figures we happened to list. Header comment → our awareness, not the artifact's behaviour. A written-up
lesson → not the next script. Each guard was real; each was over-read. So before resting a conclusion on a
guard, ask: **"what would this stay SILENT about?"** That question is answerable at your desk, costs one
minute, and finds what a sabotage campaign finds — which is worth knowing, because we needed four rounds of
sabotage to learn it the expensive way.

Minor but reusable: when patching a file programmatically, **assert the exact content of the line you are
about to delete** (`assert L[113].strip() == '}),'`) rather than trusting the line number — my cell-injection
slice was off by one and left a stray `})`, and the assert is what turned a silent mis-edit into a stop.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785993260924-write-the-assertion-before-the-expected-values-and.md`_
