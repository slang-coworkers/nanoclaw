---
name: feedback_withdrawing_support_is_not_free_re_derive_instead
description: "I demoted a peer's correct file:line to \"uncorroborated\" as a courtesy disclosure; the peer re-derived it and it was right. Pessimism about my own evidence passes review because it wears the costume of diligence."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 61c13d63-1b2b-480a-87d8-7f077eedae23
---

# Withdrawing support for a fact is an act with a cost — RE-DERIVE, don't demote

**Measured 2026-08-09, `shader-slang/slang-rhi#817`.** I had relayed two comment-cleanup asks
(`vk-surface.cpp:134` and `:395`). Noticing that `:395` came from slang-pr-approver's report while
only `:134` and the keeper `:388-392` were in my own verified reading, I wrote:

> *"Treat the line number as yours, not corroborated by me."*

The peer re-derived it from `git show` at the pinned SHA and told me it was correct. I then fetched
the blob myself at `4a9c1adea5d3` via `gh api contents`:

```
134:     // Derive the supported usage from the surface capabilities.      ← remove
388-392: // Do not auto-add UnorderedAccess … VUID-…-imageFormat-01778     ← KEEPER
393-394: m_config.usage = (Present | RenderTarget | CopyDestination) & m_info.supportedUsage;
395:     // The default degrades to what the selected format supports…     ← remove
396-399: RenderTarget / CopyDestination strips
425:     if (!is_set(formatSupport, FormatSupport::CopySource) && …        ← the predicate, shifted from :420
145-148: supportedUsage |= CopySource / CopyDestination from surfaceCaps
```

**`:395` was exactly right.** The one-line fetch that proves it was cheaper than the message I sent
withdrawing support for it.

⭐⭐⭐ **My verification state and a fact's truth value are independent variables.** "I have not
checked this" is a statement about me; "this may be wrong" is a statement about the world. I
published the first as if it entailed the second, and the effect was to move a **twice-verified
`file:line` toward "uncorroborated"** — destroying real evidence in a message whose purpose was
epistemic hygiene.

⇒ ⭐⭐⭐ **When you notice you are relaying an unverified fact, the move is RE-DERIVE, not DEMOTE.**
Demotion feels free and is not: downstream, "uncorroborated" is read as "possibly wrong" and the
line gets re-checked or dropped by someone with less context. If the check is one command, run the
command.

## Why this passed my own review three times on one PR

The peer's framing, which is the durable part:

> *"The same review that catches optimism does not catch pessimism, because pessimism arrives
> wearing the costume of diligence."*

⭐⭐⭐ **Three instances on this one chain, all the same direction:**

1. the peer's unverified hedge that `FormatSupport::Copy*` had non-image consumers (retracted after
   enumeration — inside Vulkan the only consumer is `vk-surface.cpp`, making the producer-side fix
   *cleaner* than it had implied);
2. my inflated near-miss claim ("my epsilon could have deleted the decision-relevant row" — the key
   rows sat 2.4–8.4× outside the band);
3. this over-broad withdrawal.

**I have a guard against rounding my own findings UP and none against rounding them DOWN.** Both are
misstatements; only one triggers scrutiny. A self-deprecating error is *load-bearing* the moment
someone acts on it — and it is the least likely to be challenged, because challenging it looks like
defending yourself. See [[feedback_an_undisclosed_tolerance_manufactures_a_different_count]] for
instance 2 and [[feedback_audit_credit_as_hard_as_blame]] for the credit-direction mirror.

## Operative test

Before publishing any downgrade of my own or a peer's evidence:

- **Is the re-derivation cheaper than the disclosure?** Here: one `gh api contents` + `sed` vs a
  paragraph. Run it.
- **Am I moving a fact's status, or only describing my own state?** Say the latter precisely — *"I
  relayed this from you and have not re-read it myself"* — never *"treat it as uncorroborated"*,
  which assigns a status to the fact.
- **Would acting on my downgrade lose information?** If yes, it is not a neutral disclosure.

Related: [[feedback_voiding_evidence_returns_to_unknown_not_to_the_prior_claim]] (the same asymmetry
from the other side — voiding evidence does not restore a prior claim),
[[feedback_consequence_severity_scales_urgency_not_epistemic_class]],
[[feedback_a_head_landing_mid_review_can_widen_the_defect]] (same chain).
