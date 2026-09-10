---
name: feedback-an-observation-promoted-to-a-requirement
description: "'X reproduces under conditions C' silently becomes 'X requires C' — same measurement, different logical force. Happened twice in one chain at two tiers in the same direction; both were caught by the tier below re-measuring"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: aca60d25-6de7-4dad-b49c-1719f9d3edd0
---

# "X reproduces under C" → "X requires C" is a promotion, not a restatement

**Measured twice in one chain, 2026-08-10 (slang #12442), at two tiers, in the same direction.**

- **`slang-fixer`:** measured three test failures in a Debug build on a machine with a CUDA device, and wrote
  *"all three reproduce only in a Debug build with a CUDA device."* Two of them have suppressed **`(cpu)`**
  cells (`expected-failures.txt:140`, `:114`) — CUDA is not needed at all. Actual reasons differ per issue:
  `_DEBUG`-gated (#12460), *debug-info*-gated (`-g2`/`-g3`, and reproducing on `-target cuda` too, #12461),
  plain cpu-reachable (#11317).
- **Me, one tier up:** the triager measured *"all 144 `syn (cuda)` cells are `ignored` in CI"* — true, and a
  statement about **CI**. I compressed it into "these fail in a Debug build **with a CUDA device present**"
  and instructed the fixer to write that. The fixer had measured past it and overruled me. Correctly.

⛔ **The two sentences describe the same measurement, which is why the promotion is invisible.** "I observed
X under C" is a report. "X requires C" is a claim about every configuration I did *not* test. Nothing in the
observation licenses it, and no re-reading of the observation catches it — the words are almost identical
and the evidence is genuinely present.

✅ **Test before publishing a conditional: did I vary C and see X disappear?** If not, the honest form is
*"observed under C; other configurations not tested."* One clause, and it is the difference between a report
and an unearned universal.

⭐ **Direction matters — this is the mirror of
[[feedback_publish_a_claim_as_wide_as_your_evidence]].** That leaf is about a claim published *narrower*
than the evidence (a real finding lost in transcription). This is a claim published *stronger* than the
evidence. Same seam — the step from raw output to prose — opposite failure, and the remedies differ: widen
the report to match the evidence vs. weaken the modal to match it.

⚠ **What made it recoverable:** every tier kept the measurement rather than the summary, so each could
re-derive and overrule the tier above. A chain that passes summaries down cannot self-correct — by the time
the promotion reaches the bottom it has no evidence attached to contradict. ⇒ **when handing a conditional
downstream, hand the measurement with it**, and say explicitly that a downstream measurement outranks my
framing. The fixer overruling my instruction was the system working, not insubordination.

⇒ Cf. [[feedback_mechanism_must_predict_observed_coordinates]] (a mechanism must predict *where* the fault
appeared) and [[feedback_a_correct_rule_with_an_unvisited_boundary]] (correct everywhere you checked is
indistinguishable from complete).
