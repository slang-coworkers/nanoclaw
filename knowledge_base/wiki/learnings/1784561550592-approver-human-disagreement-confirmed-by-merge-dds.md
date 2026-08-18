---
title: "[approver/human-disagreement] CONFIRMED-by-merge — DDS subresource-math fix WOULD_APPROVE matched merge outcome"
type: learning
topic: review-approval
source: learnings/1784561550592-approver-human-disagreement-confirmed-by-merge-dds.md
---

# [approver/human-disagreement] CONFIRMED-by-merge — DDS subresource-math fix WOULD_APPROVE matched merge outcome

**Terminal outcome:** shader-slang/slangpy#1049 MERGED by jhelferty-nv (2026-07-20T15:29:19Z, merge commit 7e8c09cb) ~4 min after the human APPROVED the pinned head 6fd917aa. My shadow decision was WOULD_APPROVE @ 6fd917aa. Merged ⇒ APPROVED-equivalent ⇒ **decision confirmed by the strongest calibration signal.**

**Diff between my read and the shipped change:** none. The merge commit is a fast merge of the exact head I decided on; no follow-up commits between my decision commit and the merged head. So the class-level lesson from #1049 stands as recorded in the sibling [approver/human-disagreement] confirmed-agreement note (hand-verify offset-math test literals; deleting a rounding-buggy override is a positive signal; verify test-data git-submodule bump is merged to the data repo's default branch and contains the referenced files; 3D layer_count==1 with depth folded into .size).

**Process meta-lesson (worth its own probe):** the OUTPUT_REVIEW critique gate re-hashes attested artifacts at delivery time, so ANY edit after an approve — even applying the reviewer's own advisory — re-trips the gate and forces another round. On this PR that produced 5 critique rounds (1 DECISION + 4 OUTPUT) largely from (a) fixing a factual error codex caught in the agreement rationale [I initially assumed the human approved an EARLIER commit; live `gh pr view --json reviews` commit oids showed jhelferty-nv approved the SAME head directly], and (b) time-sensitive cautions going stale (CI "still settling" became all-green mid-flight). **Fixes:** (1) resolve the human-verdict commit alignment from review `commit` oids BEFORE drafting the deliverable, never assume; (2) write time-sensitive cautions as record-time-scoped from the start ("CI was not green AT RECORD TIME; policy did not require it") so a later CI transition doesn't invalidate the text; (3) batch all known edits before the FIRST OUTPUT_REVIEW to minimize re-hash rounds.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784561550592-approver-human-disagreement-confirmed-by-merge-dds.md`_
