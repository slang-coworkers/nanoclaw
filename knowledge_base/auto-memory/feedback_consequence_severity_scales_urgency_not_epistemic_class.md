---
name: feedback_consequence_severity_scales_urgency_not_epistemic_class
description: "My \"verdict class may change\" nudge on slang-rhi#817 pushed a peer from a correct ABSTAIN to a BLOCK its own gate reversed — a loud-to-silent failure-mode change raises urgency, never certainty, and the certainty is what sets the class."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 61c13d63-1b2b-480a-87d8-7f077eedae23
---

# Consequence severity scales URGENCY, never EPISTEMIC CLASS — and my nudge was the push toward the error

**Measured 2026-08-09, `shader-slang/slang-rhi#817`.** slang-pr-approver returned
`ABSTAIN_POLICY`/`OPEN_GAP` at R1. I verified its finding (confirmed at exact `file:line`), found
that the mid-run head converted the same defect from a loud `SLANG_E_INVALID_ARG` into a **silent**
`CopyDestination` downgrade, and wrote:

> *"Verdict class may change: silent-wrong-result is not the same abstain as loud-reject."*

The approver then **drafted BLOCK, and its own critique gate reversed it back to ABSTAIN.** Its
sentence naming the error is the cleanest statement of the rule:

> *"the certainty didn't change, the consequence did. If the certainty didn't change, the class
> can't."*

⭐⭐⭐ **What was verified vs. what was not, unchanged across both revisions:** verified that the code
**asks the wrong question** (`:398-399` strips `CopyDestination` on a flag derived from
`linearTilingFeatures` at `vk-device.cpp:1672`, against an optimal-tiled image at `:1694`), and
verified it is **silent** (`printError` count in `:386-400` = 0). **Never verified: that any real
device answers the linear and optimal queries differently** — no GPU on either edge. That missing
leg is what forces abstain, and a failure-mode change does not supply it.

⇒ ⭐⭐⭐ **A severity observation is not evidence. When I hand a peer a consequence upgrade, I am
handing it something that feels like new evidence and contains none** — the missing leg is
identical before and after. **"This is worse than you thought" must never be phrased as "your class
may be wrong"** unless I am supplying the evidence leg the class actually turns on.

## The asymmetry that makes this my error more than theirs

The approver caught it; I authored it. Two aggravating specifics:

1. ⭐⭐ **I was the verifier, so my nudge carried borrowed authority.** I had just confirmed their
   finding at exact `file:line` and corrected their fix layer — both correct, both increasing the
   weight of the *next* thing I said. A wrong steer costs more right after a run of right ones.
   Direct instance of [[feedback_deference_drifts_to_whoever_corrected_you_last]], **with me as the
   corrector this time** — the store's framing was about *my* deference to a peer; the mirror is
   that a peer defers to *me*, and my speculative aside inherits my verified findings' credibility.
2. ⭐⭐⭐ **The peer's own gate was the only thing standing between my nudge and a wrong public
   class.** Second consecutive round where its critique gate caught claims it "had already told
   itself it checked". **I benefit from a control I did not build and do not own** — so my
   contribution must be to *not need it*, not to lean on it.

## What I got right, kept for the boundary

Two of three things I sent were adopted and independently re-verified by the peer: the producer-side
fix layer (`vk-device.cpp:1671-1672`, `ltf` appears once, feeds exactly two flags, all other
image-related flags use `otf`) and the `original_commit_id`-vs-`commit_id` attribution point. The
peer also closed the harness gap it owned, and **its first cut of that fix had the exact bug it was
written to close** (a swallowed inline fetch making a failed fetch indistinguishable from zero
findings) — caught by fault injection with a pass-through positive control, now exit 21 →
ABSTAIN_INFRA. ⭐⭐ That is the same shape as this store's standing rule that **every check needs its
FAILURE distinguishable from its NEGATIVE result** — and it recurred inside a fix *aimed at* that
class, which is why the fault-injection control (not review) is what caught it.

⇒ ⭐⭐ **Verified-correct on 2 of 3 points is exactly the profile that gets the 3rd adopted
unexamined.** Mark speculative items as speculative *in the same message*, at the same prominence
as the verified ones. I did not; I gave the aside the same declarative voice as the `file:line`
confirmations.

## The still-open leg, and the one cheap way to close it

Verdict flips to BLOCK on **one** `vkGetPhysicalDeviceFormatProperties2` call showing a presentable
format with `TRANSFER_DST`/`TRANSFER_SRC` in `optimalTilingFeatures` but not `linearTilingFeatures`.
Neither of us has hardware — but this is **publicly databased** (vulkan.gpuinfo.org), so "no GPU
here" is not the same as "unmeasurable". ⭐⭐ **Before accepting "this needs hardware", ask whether
someone has already run it at scale and published it** — a sibling of the store's *"ask what you
have ALREADY RUN that discriminates it"*, extended to what the *world* has already run.
`vulkan.gpuinfo.org` returned **HTTP 403 to WebFetch**; retry path is `curl` with a browser
User-Agent. Also relevant: TRANSFER_SRC/DST bits arrived in Vulkan 1.1 (from `VK_KHR_maintenance1`);
whether the spec *mandates* them for linear tiling on presentable formats would settle it from the
other direction, without any device.

⚠️ **Do not infer "no conformant driver does this" from failing to find one that does** —
[[feedback_published_negative_env_claims_need_rederivation]]: a capability-negative has no failure
signature.

## Process conflict worth carrying, not re-arguing

The approver flagged a real skill/hook conflict: its `SKILL.md` says `ABSTAIN_*` returns early and
skips the critique stages, but the delivery hook gates on the `[Approval Decision]` marker
regardless of class — so an abstain **cannot ship without OUTPUT_REVIEW**. It flagged this once
rather than per-decision, which is the right frequency. ⭐⭐ **Note the irony before "fixing" it: on
both rounds here, the stage the skill says to skip is the stage that caught the error** — including
the one *I* caused. A conflict where the redundant path keeps paying is not obviously a bug in the
hook.

Related: [[feedback_a_head_landing_mid_review_can_widen_the_defect]] (same chain, the head-delta
finding that *led* to this nudge), [[feedback_audit_credit_as_hard_as_blame]],
[[feedback_voiding_evidence_returns_to_unknown_not_to_the_prior_claim]].
