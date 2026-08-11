---
name: feedback_check_a_quoted_claims_author_before_deciding_your_obligation
description: "When an upstream artifact corrects a figure, check WHO published it before choosing your obligation — 'don't re-quote it' and 'it is ours to retract' differ, and the author check is one gh api call"
metadata:
  node_type: memory
  type: feedback
  originSessionId: e8e0b387-afc1-4d91-ab15-dd8e100744b7
---

**TRIGGER: any time you route around a figure someone else's artifact corrects.** Before you tell
a peer *"don't re-quote X"*, resolve **who published X**. If it turns out to be your own identity,
your obligation was never avoidance — it was **retraction, at the place the claim lives**.

**What happened (2026-08-10, slang#12447).** jvepsalainen-nv's RFC corrected an expansion factor:
*"3.10x, not ~20x as quoted in #12113"*. I dispatched #12447 to slang-triager and wrote that the
~20x *"lives in #12113's GitHub thread, and the triager should not re-quote ~20x from there"* —
framing it as a third party's number and my store as clean. The triager came back: **the ~20x is
ours.** Verified: `gh api repos/shader-slang/slang/issues/comments/4977530963 --jq .user.login`
→ **`nv-slang-bot`**, 2026-07-15 — our own triage *verdict* comment on #12113, reading
*"deserialized IR is ~20× its packed form, so +4.6 MiB serialized → ~+90 MiB RSS"*.

**Why the weaker obligation is the damaging one.** "Don't re-quote" protects the *next* message.
"Retract" repairs the *existing* artifact. I chose the first, so the wrong figure stayed live and
unmarked in the comment that is #12113's public verdict — and the one my own memo cites as its
source. My instruction read as diligence while leaving the defect exactly where a reader would
find it.

**How to apply.**
1. **One call decides it:** `gh api repos/<repo>/issues/comments/<id> --jq .user.login`. Do it
   *before* dispatching, not after a peer corrects you. A comment id is right there in the
   correcting artifact most of the time.
2. **Retract where the claim lives, not only where the correction arrived.** A retraction posted
   on the *new* issue does not reach the reader of the *old* one. Both surfaces need it when the
   stale figure sits in a verdict/summary comment. (Placement gap left open on #12113 here —
   recorded, not silently dropped.)
3. **A figure with no stated denominator is the shape that does this.** Our ~20x was an *inferred
   bridging factor* (blob delta → RSS delta) shipped as a measured ratio; his 3.10x range-checks
   from its own stated denominator (430,369 × 155 B = 63.6 MiB ÷ 20.5 MiB). Both surrounding
   measurements (×1.96 blob, ×1.93 RSS) were real — **the glue between two real numbers is the
   part nobody audits.**

Kin: [[feedback_audit_credit_as_hard_as_blame]] (same reflex, opposite polarity — check provenance
before assigning *credit* too), [[feedback_a_stored_claim_re_shipped_as_a_live_finding]],
[[project_12113_minimal_compile_peak_rss_doubled]],
[[project_12447_on_demand_ir_loading_builtin_modules]].
