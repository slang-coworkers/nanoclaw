---
title: "An unvalidated probe's FAILURE needs the same scrutiny as its success — false alarms invite wasted action"
type: learning
topic: verification
source: learnings/1785859342024-an-unvalidated-probe-s-failure-needs-the-same-scru.md
---

# An unvalidated probe's FAILURE needs the same scrutiny as its success — false alarms invite wasted action

**The rule:** before believing *any* reading from a probe you just invented, establish what the probe measures. This is normally taught for the false-*pass* direction (a control that returns 0, a guard that "looks passing", `100% of tests passed` computed over survivors). The **false-alarm** direction is the mirror case and is more expensive in one way: **a false pass invites inaction, a false alarm invites action** — you go investigate a regression that doesn't exist.

**Observed 2026-08-04 (shader-slang/slang PR #11709), two instances in one turn:**

1. **False alarm.** As a "core-module canary" I ran `slangc --version` and printed `CORE MODULE FAILURE` on non-zero exit. Slang takes **single-dash** options for multi-character flags (`-v`, `-target`, `-dump-ir`) — documented in the repo's own `CLAUDE.md`. So the non-zero exit said nothing about the core module. I was one step from investigating a nonexistent regression on a branch whose real work was already finished. **Discriminator:** exercise the thing the canary claims to be about — a real compile (`slangc trivial.slang -target hlsl -entry main -stage compute`) plus the feature's own repro, both `rc=0`.

2. **Uninformative-but-true.** To show that `const groupshared` lowered identically to a read-write param, I compared **emitted CUDA signatures** — both printed `FixedArray<uint,8> *`. The conclusion was right but the evidence was worthless: **CUDA prints a raw pointer for *every* by-reference mode**, so the comparison cannot distinguish `BorrowIn` from `BorrowInOut` at all. The signatures were identical for a reason unrelated to the bug. **The instrument that separates the modes is `-dump-ir`** (`BorrowInParam(...)` vs `BorrowInOutParam(...)` on the `func` line). Publishing the CUDA comparison would have let a reviewer refute the *evidence* while the *claim* stayed true — the worst public position, since it invites doubt about everything else.

**Both failures share one shape:** an instrument whose output you can't interpret because you never established what it measures. Ask *what does this actually measure?* not *what does its output look like?*

**Also: report a withdrawn alarm, don't silently drop it.** A quietly-retracted false alarm leaves no trace that the probe is broken, so the next session re-runs it and re-investigates. Saying "that was my probe, not a regression, here's why" makes the probe's defect discoverable.

**Corollary for reviewers:** when you endorse a coworker's evidence ("put that in the PR body verbatim"), you inherit responsibility for the instrument. Ask what it measures before endorsing it.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785859342024-an-unvalidated-probe-s-failure-needs-the-same-scru.md`_
