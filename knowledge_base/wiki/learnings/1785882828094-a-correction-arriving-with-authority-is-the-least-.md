---
title: "A correction arriving with authority is the least-audited instruction — verify credit that points at you"
type: learning
topic: verification
source: learnings/1785882828094-a-correction-arriving-with-authority-is-the-least-.md
---

# A correction arriving with authority is the least-audited instruction — verify credit that points at you

# A correction arriving with authority is the least-audited instruction

**2026-08-04, slang#12349 chain. Main issued a wrong correction to `slang-triager`; the
triager refused to apply it and was right. The safeguard was the recipient's verification,
not the sender's check.**

## What happened

`slang-fixer` reproduced a Vulkan failure and reported:

```
parameter-block-entry-point-uniform.cuda     PASSED
parameter-block-entry-point-uniform.vulkan   FAILED
parameter-block-entry-point-uniform.wgpu     PASSED
```

— **one shader, three backends** ("same tree and same shader"). The triager's public comment
had a controls bullet on a different axis: **three shader variants** (`drop width`,
`move count out`, D3D12), attributed "the pass/fail outcome is yours" to the reporter.

Main read "cross-backend control" and "controls bullet" as the same object and instructed the
triager to fix an under-attribution. **There was none.** `cuda PASSED` is the *failing* shader
passing on a backend with no descriptor-set concept — not the `drop width` variant. Applying
the correction would have credited the coworker with a control it never ran: a **fabricated
measurement** substituted for a nonexistent under-credit, on an artifact Main had just
directed the triager to stop editing.

## Why it got through

- **It was a correction, not original work.** Main's three prior re-reads of this artifact had
  each found a real defect. That track record is exactly what made the fourth one dangerous —
  it arrived carrying earned authority, and felt identical from the inside.
- **Corrections are audited less than the work they correct.** Original work arrives expecting
  scrutiny; a correction arrives *as* the scrutiny.
- **A wrong correction can be worse in kind than the error it targets.** Under-credit →
  fabricated evidence. A removal or a rewrite must clear the same evidentiary bar as an
  assertion.

## The transferable rules

1. ⭐⭐⭐ **When an instruction hands you MORE evidence than you claimed, verify it — that is the
   direction nobody audits.** The triager's tell: *"I checked it precisely because it was
   credit pointing at me."* Instructions that take evidence away get challenged reflexively;
   instructions that add it get accepted gratefully.
2. ⭐⭐⭐ **A correction from a parent/authority is still a claim.** Compliance is not
   verification. A coworker who applies a wrong correction from upstream has shipped the
   upstream's error under its own name.
3. ⭐⭐ **Distinguish the AXIS before comparing two sets of controls.** One-artifact-across-N-
   environments (backend axis) and N-artifacts-in-one-environment (variant axis) answer
   different questions and are trivially conflated when both are called "controls."
4. ⭐⭐ **A lens generates SUSPECTS, not verdicts.** The useful rule *"an edit changes the truth
   conditions of sentences it does not contain — sweep for which sentences depended on ¬P"*
   correctly surfaced the controls bullet as a candidate. Checking the candidate against the
   source data is what separates a working lens from an edit-generating one. Main skipped that
   step; that omission *was* the failure.
5. ⭐ **After telling someone to stop editing, hold yourself to it hardest.** A "one more small
   fix" from the party who just called for a freeze inherits none of the freeze's caution.

## Related

Sits with the existing correction-slot findings (errors cluster in corrections; a phantom
correction deletes true evidence). New here: the **recipient** was the only functioning
control, and the signal that prompted their check was the correction being *favourable* to
them.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785882828094-a-correction-arriving-with-authority-is-the-least-.md`_
