---
title: "[approver/human-agreement] full-arc vindication: R3 ABSTAIN(OPEN_GAP) merged only AFTER the author implemented the exact next-action (copy sink severity-overrides + add -Wno test); BLOCK→BLOCK→ABSTAIN→merge"
type: learning
topic: review-approval
source: learnings/1784838040864-approver-human-agreement-full-arc-vindication-r3-a.md
---

# [approver/human-agreement] full-arc vindication: R3 ABSTAIN(OPEN_GAP) merged only AFTER the author implemented the exact next-action (copy sink severity-overrides + add -Wno test); BLOCK→BLOCK→ABSTAIN→merge

**Context:** shader-slang/slang PR #12141 (skiminki-nv, vector<T,4> 3-elem init deprecation, #12093) is a rare 3-revision chain I decided across, now MERGED — the strongest calibration signal. Trajectory: R1 @c51b4786 BLOCK (static_assert disable broke bundled slang-rhi test-ray-tracing-clusters.slang:74, E41400) → R2 @13d1c111 BLOCK (redesign to [deprecated]/[RemovedSince] fixed rhi, but success-path forwardDiagnostics() leaked E30081 and broke integer_pack.slang on the GPU x86_64 vk legs) → R3 @b4e6a60e ABSTAIN_POLICY/OPEN_GAP (E30081 fixed via explicit test casts + rhi green, but the forwardDiagnostics() call was still over-broad and — because diagnoseRaw re-emits a raw buffer with no diagnostic id — bypassed per-id -Wno-*/#pragma suppression; latent, CI-invisible; flagged by the production PRIMARY review Gap#1 and source-verified).

**Outcome (verified against live GitHub, join-SHA-first):** merged at 0f6d38f40612 — **5 commits PAST my R3 head b4e6a60e** (merge commit 5374382b; csyonghe APPROVED @0f6d38f, a maintainer ≠ author; author skiminki-nv merged after). The R3 gap did NOT ship unaddressed. The post-R3 commits fix my exact next-action:
- `17bf5c1924b3` "Copy parent sink's severity overrides in child sink constructor" — adds `getSeverityOverrides()/setSeverityOverrides()` to DiagnosticSink and, in the parent-copying ctor, `setSeverityOverrides(parentSink->getSeverityOverrides())`. So the TEMP sink now inherits the `-W<name>/-Wno-<name>` override map before its buffer is forwarded → closes the suppression-bypass exactly at the root I named (fix the sink construction, not the forwarding site).
- `4f4140d4881b` "Add test for the deprecated vec4 constructors" + a `//TEST:SIMPLE(filecheck=NOWARNCHECK): ... -Wno-31200` line with `//NOWARNCHECK-NOT: warning` — precisely the -Wno / warnings-as-errors path test the PRIMARY (Gaps #2/#4) and my OPEN_GAP asked for.
- `6abe8e18` notes the deprecation in the user guide (primary Gap#3).
Merged-head CI: 0 failures.

**Calibration lesson (transferable):**
1. **An ABSTAIN(OPEN_GAP) with a concrete, source-grounded next-action is validated when the author implements THAT next-action before merge.** Here the author's fix commit message and diff map 1:1 to the gap I named (per-id severity-override inheritance) — the hold did its job: it surfaced a real, CI-invisible containment gap that a human/author then closed, rather than letting it merge silently. This is the ideal ABSTAIN outcome, not a withhold-on-SAFE over-caution. When the fix targets the exact mechanism you flagged, that's the signal your gap was real and correctly scoped.
2. **The right layer for a "temp-sink forwards raw diagnostics" bug is the sink construction, not the forwarding call.** I proposed "scope forwardDiagnostics() OR re-raise through the normal path"; the author chose a cleaner root fix — make the child/temp sink inherit the parent's severity-override map so suppression is honored by construction wherever that sink is later drained. For future reviews of "diagnostics captured in a sub-sink then re-emitted" patterns, the canonical question is "does the sub-sink inherit the parent's suppression/severity state?" — check the DiagnosticSink parent-copying ctor.
3. **Revision-chain scoring nuance:** R1/R2 were BLOCK on revisions whose breaks were fixed before merge; the merge is of the fixed R3+ line (R1 even shows `diverged`/behind_by=1 vs the merged head — the static_assert design was replaced). merged⇒APPROVED-equivalent was recorded against all three decided rows, but the substance is: the BLOCKs identified real breaks that HAD to be fixed to merge (and were), and the ABSTAIN identified the residual gap that was then closed. This is end-to-end agreement across the whole arc, not a false-block/false-safe — the shadow decisions tracked the fix frontier correctly at every revision.
4. **Join-SHA-first paid off:** had I recorded the verdict assuming the merge was at my R3 head, I'd have missed that 5 fixing commits landed after — the merge validates a *later* head, and the R3 gap was resolved, not shipped. Always diff decided-head → merged-head before interpreting a merge.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784838040864-approver-human-agreement-full-arc-vindication-r3-a.md`_
