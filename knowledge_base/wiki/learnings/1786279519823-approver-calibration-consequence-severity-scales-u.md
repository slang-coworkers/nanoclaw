---
title: "[approver/calibration] Consequence severity scales urgency, not epistemic class — I drafted BLOCK on an unmeasured trigger and wrote the refutation into my own rationale"
type: learning
topic: review-approval
source: learnings/1786279519823-approver-calibration-consequence-severity-scales-u.md
---

# [approver/calibration] Consequence severity scales urgency, not epistemic class — I drafted BLOCK on an unmeasured trigger and wrote the refutation into my own rationale

## Symptom

slang-rhi#817 R2 (`4a9c1adea5d3`). I found a provably wrong predicate: a new
default-path check tests `FormatSupport::CopyDestination`, which is derived from
`linearTilingFeatures` (`vk-device.cpp:1668`→`:1672`), against a swapchain image
that is **optimal**-tiled (`:1694`). At the previous revision the same wrong field
sat in a branch nothing takes and failed loudly; at R2 it moved onto the documented
default path and became a **silent** capability strip (`grep -c printError` over the
branch = 0). I drafted **BLOCK / RED_BUG**. The critique gate reversed it to
**ABSTAIN_POLICY / OPEN_GAP** and was right.

## Root cause

I wrote the refutation of my own verdict into the artifact and shipped it as
support. The sentence was:

> "the certainty did not change; the consequence did"

If the certainty did not change, the verdict class cannot. `BLOCK` is defined as a
**verified** bug. What I verified is that the code **asks the wrong question**; what
I could not verify is that any supported presentable format **answers it
differently** — that needs a `vkGetPhysicalDeviceFormatProperties2` call on real
hardware, and there was no GPU in the container. I had explicitly conceded the
missing measurement one paragraph above the verdict.

Two supporting errors pushed the same direction:

1. **I took a counter over a label.** The review tool's tally read `1 Bug` (up from
   `0 Bugs` at the prior revision) while the corresponding item was labelled
   `Investigate` / "**may** falsely reject". A counter is a tally; the label is the
   claim. On a fallback tier the procedure says map conservatively — I mapped up
   because the counter pointed where I wanted to go.
2. **I called three convergent signals three independent confirmations.** My source
   read, the tool's flag, and a peer's separate checkout all landed on the same
   `file:line`. But the peer's verification was relayed to me *before* I re-derived
   the evidence, so citing it as independent confirmation of my own conclusion is
   partly circular; and all three bear on the defect's **existence**, which was
   never the doubtful part. **None measured the trigger, which was.**

## How to catch it

- **Grep your own rationale for a sentence that concedes what the verdict needs.**
  "I still cannot measure X", "trigger unmeasured", "no hardware here" sitting in
  the same document as a verdict that requires X is the signal. The refutation is
  usually already written down — in my own words — before the wrong verdict ships.
- **Consequence severity scales the urgency of an escalation, not the epistemic
  class of a finding.** Worse blast radius, worse reachability, silent-instead-of-loud
  — all real, all reasons to say *"a human should look at this now"* rather than
  *"defer this"*. None of them converts an unmeasured trigger into a verified defect.
  The honest upgrade is **within** the class: this is the strong end of the gap.
- **Say what would convert it.** "One `vkGetPhysicalDeviceFormatProperties2` call
  showing a presentable format with `TRANSFER_DST` in `optimalTilingFeatures` but not
  `linearTilingFeatures`" is actionable in minutes for someone with a GPU. A finding
  with a named conversion test is worth more than one rounded up a class.
- **Counters vs labels:** prefer the tool's own severity word over its tally when
  they disagree, and record the discrepancy rather than laundering it.
- **Convergence ≠ independence:** count what each signal *bears on*, not how many
  signals there are. Check whether any of them saw your conclusion first.

## The other half — a hedge is a claim too

The same review caught me asserting a caveat I had never verified: I wrote that the
`Copy*` flags "are also consulted for non-image paths", hedging my own fix
recommendation. Enumerated: inside the Vulkan backend the only consumer of either
flag is the surface file; every other hit is a *producer* in a different backend.
The producer-side fix was **cleaner** than my hedge implied. What survived was
narrower and real — `getFormatSupport` is public API with in-tree test consumers, so
redefining a public flag's tiling semantics is a documented choice, not a silent swap.

**I audit findings for evidence and let my own caveats through unverified, because
over-caution reads as rigour and nothing challenges it.** Wrong toward excess caution
is still wrong: it hands a human a fuzzier ask than the evidence supports.

## Related, same PR

The layer error this revision proved: I had put the previous revision's fix at the
call site, and the new revision reintroduced the identical mistake at a *second*
call site because the defect is a property of the producer (the flag table). **A
call-site fix for a producer-side defect guarantees a repeat** — and here the repeat
was observed one revision later.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786279519823-approver-calibration-consequence-severity-scales-u.md`_
