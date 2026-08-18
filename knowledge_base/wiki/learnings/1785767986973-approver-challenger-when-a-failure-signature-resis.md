---
title: "[approver/challenger] When a failure signature resists explanation, stop refining the observation and read the INPUT CONTRACT — three reviewers re-read the same output; the fixer opened the test source and root-caused in one pass"
type: learning
topic: review-process
source: learnings/1785767986973-approver-challenger-when-a-failure-signature-resis.md
---

# [approver/challenger] When a failure signature resists explanation, stop refining the observation and read the INPUT CONTRACT — three reviewers re-read the same output; the fixer opened the test source and root-caused in one pass

## Symptom

slang-rhi#802's CI failure (77 assertions across two Metal bindless tests) got **three
successive wrong characterizations** from three reviewers, each corrected by the next:

1. "reads **all zeros**" — from reading the head of the failure list (which is all zeros).
2. "`result[i] == i`, a neat **off-by-one indexing shift**" (**mine**) — from spotting the shifted
   rows further down. Falsified: at `logged: i := 0` the actual is `0.0`, `1.0`, `3.0` *and* `5.0`,
   so the value isn't a function of `i`.
3. "the distribution is a **mixture** (56 zero / 21 shifted), therefore **no single cause** can
   explain it" — from correctly parsing all 77 rows, then inferring mechanism from the shape of
   the distribution.

All three are wrong, and #3 is the instructive one: it had *complete, correct* observational data
and still reached a false conclusion ("mixture ⇒ mixed cause"). One mechanism explains both
classes.

## Root cause of the pattern

**Every wrong reading came from interrogating the OUTPUT. The answer was in the INPUT CONTRACT.**

The fixer opened the test source and the emitted MSL, and it fell out immediately: on Metal a
top-level `uniform ....Handle` is emitted as an *ordinary directly-bound parameter* with its own
`[[buffer(n)]]`/`[[texture(n)]]` slot (a deliberate upstream unwrap — `slang-emit-metal.cpp:148-152`
at tag `v2026.12.2`, with `tests/metal/entry-point-descriptor-handle-buffer.slang` a #11066
regression test *requiring* it). So values written via `setDescriptorHandle` are never read; the
handles are **never bound at all**.

That single cause predicts the whole mixture once you group rows by **assertion phase**:
- phase-1 reads → `0` (nothing bound), and
- phase-2 read-backs → each RW resource's *unmodified seed* (writes never landed), e.g.
  `rwTexture1DArray L1` seeds `{3,4}`, observed `3,4`, expected `4,5` — which is why every shifted
  row is uniformly `diff == 1.00`.

Two assertion *phases*, one mechanism. No amount of further output analysis produces that; it
requires knowing what the shader was *supposed to receive*.

Why it's a stable trap: refining the observation **feels like progress**. Each of us stopped at
the evidence level that happened to confirm the hypothesis we walked in with — head-of-list, then
shape-of-distribution — and each stop produced a *more precise* wrong answer than the last.

## How to catch it

**Escalation rule: when a signature resists explanation, stop refining the observation and go read
what the code was supposed to receive.** Concretely, in order:

1. **Group failures by assertion phase / target before inferring anything.** "What is this
   assertion observing — a fresh read, or a read-back of something a prior step should have
   written?" A heterogeneous signature very often means heterogeneous *observation points*, not
   heterogeneous causes.
2. **Read the test source**, not just its output. What does each sub-check bind, write, and expect?
3. **Read the actual interface the code receives** — for a shader, the emitted target source and
   its parameter list. On Metal: `slangc test.slang -target metal -entry computeMain -stage compute`
   and look at the signature. Cheap, no GPU required, and decisive here.
4. Only then name a signature or a cause.

**Corollary — a heterogeneous signature does NOT imply a heterogeneous cause.** Prefer the
single-mechanism explanation until it's actually excluded, and exclude it by checking observation
points rather than by eyeballing the distribution's shape.

## Fix

The durable form: **output analysis localizes a symptom; only the input contract explains it.**
Three reviewers, complete log access, zero progress on cause — versus one pass over the test source
plus emitted MSL. When a distribution won't reduce to a mechanism, that is the signal to change
*level of evidence*, not to sharpen the same level.

Companion atoms from the same PR: `[approver/challenger-miss] parse the WHOLE failure set before
naming a signature` (my #2 error), and `[approver/clause-gap] byte-for-byte equivalence to an
incumbent path proves consistency, never correctness` — which is the same disease in the review
direction: I validated against a *reference implementation's output shape* instead of against the
contract the consumer actually requires.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1785767986973-approver-challenger-when-a-failure-signature-resis.md`_
