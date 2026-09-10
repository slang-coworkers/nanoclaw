---
name: feedback_an_approval_that_never_saw_the_finding_is_not_a_refutation
description: "slang-rhi#817 merged with our finding never disclosed to anyone; the approver scored the merge against itself as a false abstain. Absence of disclosure is not adjudication — and a self-assigned loss inflates the very defect rate its remedy would rest on."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 61c13d63-1b2b-480a-87d8-7f077eedae23
---

# An approval that never saw the finding is not a judgment that the finding doesn't block

**Measured 2026-08-10, `shader-slang/slang-rhi#817`.** The PR merged (`d4d2266b49bb`,
`merged_at=07:42:26Z`, by `skallweitNV`, approved 13s earlier). slang-pr-approver had five
`ABSTAIN_POLICY` rows across five heads; it recorded the merge as **"FALSE ABSTAIN, loss #7"** and
began drafting an `APPROVAL_POLICY.json` carve-out to lower its bar.

**The defect shipped and is live on `main`** (verified: `vk-surface.cpp` `bcdcece338ed`,
`vk-device.cpp` `73ef1ed20899` on `main` == the reviewed blobs; sites `:398` silent strip, `:408`,
`:425` loud reject, against `:1671-1672` deriving both copy flags from `linearTilingFeatures`).

**What refutes the self-assigned loss.** I searched every public surface on the PR, paginated
(`issues/N/comments`, `pulls/N/comments`, `pulls/N/reviews`): **nobody ever stated the finding.** The
only review content is three coderabbit inline comments. The lone substring hit —
*"lacks sampled-image or linear tiling transfer-source support"* at `vk-surface.cpp:146` — is a
passing clause inside a request to **ADD** the `CopySource` check, i.e. the recommendation whose
implementation (`0d8fada`) **created** the predicate we found, and it is marked
**"✅ Addressed in commit 0d8fada"**. The opposite of the finding, closed as satisfied.

⭐⭐⭐ **So the approval was given by someone who had never seen the finding in any form. Joining it as
a refutation treats ABSENCE OF DISCLOSURE as ADJUDICATION** — it manufactures losses out of your own
silence. The correct ledger entry is *"finding never reached the decision-maker"*, a
**disclosure-path** failure, not a bar failure.

⭐⭐ **The approval body actively supports the finding's premise** (verified verbatim on my edge,
typo included): `skallweitNV` wrote *"LGTM, I will follow this up with some additional cleanup across
the various backeds and validation layer."* and the author replied *"Sounds good. Yes, maybe the api
needs a bit of a redesign."* That is a maintainer **scheduling follow-up work in exactly this area**,
not someone weighing and accepting the mismatch.

## Why a false loss is not the safe error

⭐⭐⭐ **The peer's own statement of the cost, which generalizes past this chain: a false loss inflates
the apparent bar-defect rate, so the remedy (a policy carve-out lowering the bar) would rest on
evidence that does not exist.** Self-penalty is not conservative when the penalty is an *input to a
policy change*. It took **two pushes** to land, on a peer that had caught five of my errors and was
otherwise the more careful party.

⇒ ⭐⭐⭐ **Guarding against rounding your findings UP must cash out as *look harder*, never as *accept
the worse reading of your own work*.** Fourth over-caution error on this single PR (unverified
non-image-consumers hedge → my inflated near-miss → my needless withdrawal of a correct `file:line`
→ this self-assigned loss). Same direction every time. See
[[feedback_withdrawing_support_is_not_free_re_derive_instead]] for the general rule: *the same review
that catches optimism does not catch pessimism, because pessimism arrives wearing the costume of
diligence.*

## The search-method rule, second instance on one chain

⚠️ My first search used camelCase-only (`linearTiling|optimalTiling`) and I nearly reported its hit
count before widening to `linear[ ._-]?tiling`. ⭐⭐⭐ **A narrow regex over PROSE fails toward
"nobody mentioned it" — and both times on this chain it failed toward the searcher's own
conclusion.** Rule: **when absence load-bears, widen the pattern and state the control.** The peer
re-ran it with a must-be-nonzero control (19,782 body bytes; `the`=80, `usage`=82 ⇒ query live) and
got zero hits across `optimalTiling`, `\b(ltf|otf)\b`, `vkGetPhysicalDeviceFormatProperties`. Compare
[[feedback_zero_hit_grep_has_never_once_proved_fabrication_in_my_store]].

## My own failure on this chain: the gate with no resume path

I held the finding internal awaiting an operator disclosure decision from 08-09, re-asked on 08-10,
and **the PR merged while the decision sat unanswered.** Shadow mode means the approver cannot post,
so my escalation was the only disclosure mechanism and it had **no deadline and no default action**.
⇒ ⭐⭐⭐ **A finding gated on someone else's authorization needs a stated deadline AND a default —
"waiting for authorization" on a green, mergeable PR is a race you lose by default.** Third instance
of [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]]; this time the cost was a
known live defect with zero public record.

⚠️ **Do not over-assign this to myself either** — the peer explicitly declined to blame me, and the
symmetric error would be to take the whole thing as my fault when shadow mode is a shared
constraint. The accurate statement: the pipeline had no path from finding to decision-maker, and I
owned the only segment that could have opened one.

## Bookkeeping trap worth remembering

⚠️ **A loss ordinal is a shared-store fact.** A sibling session minted **#819** as "loss #7" while
this conversation was running; the retraction here freed the number, so the streak is 7 with #819
seventh — not 8. **Grep the shared store before minting a sequential id**, same class as
[[feedback_a_shared_name_merges_two_sessions_reports]].

Dedup verified before proposing a follow-up issue: `search/issues` for
`linearTilingFeatures OR optimalTilingFeatures` in `shader-slang/slang-rhi` → **0 results**.

Related: [[feedback_consequence_severity_scales_urgency_not_epistemic_class]],
[[feedback_an_undisclosed_tolerance_manufactures_a_different_count]],
[[feedback_a_head_landing_mid_review_can_widen_the_defect]] (all same chain).
