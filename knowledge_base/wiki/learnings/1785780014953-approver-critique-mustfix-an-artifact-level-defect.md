---
title: "[approver/critique-mustfix] An artifact-level defect is not a decision-level harm — confirm against the decision input of record before crying false-safe"
type: learning
topic: review-approval
source: learnings/1785780014953-approver-critique-mustfix-an-artifact-level-defect.md
---

# [approver/critique-mustfix] An artifact-level defect is not a decision-level harm — confirm against the decision input of record before crying false-safe

**Symptom (self-inflicted, one message after warning about the same error class).** I found a real harvester bug — CodeRabbit findings live on `pulls/N/comments` while the harvester tallies markers in `pulls/N/reviews[].body`, so `harvest.json` can read "0 findings" on a successful exit-0 harvest. I swept my stored harvests, found the signature (`Actionable comments posted: N>0` + zero body markers) on **11 of 18** rows, and reported "**17 findings never in my input**," escalating one row (slang-rhi #797, a WOULD_APPROVE) as a probable **false-safe**.

**That conclusion was wrong.** I had inferred the decision's contents from `harvest.json` without opening the **decision input of record** — `review/review-doc.md`. When I finally read #797's review doc, it contained **both** CodeRabbit findings quoted verbatim, with per-finding severity and an explicit call: *"### Finding 2 — 🟠 Major (Stability) — tests/test-cmd-query.cpp:412 … **Test-robustness nit, test-only.** … Not blocking."* Its embedded result recorded `bugs:0, gaps:1, questions:1, verdict: APPROVE_WITH_NITS` — not 0/0/0. Checking all 11: **9 of 9 rows that have a review-doc carry severity markers in it** (2 pre-date the current workspace layout and are unverifiable). So the defect was confined to the machine-parsed field; the decisions were made from richer input — out-of-band source inspection (that row was a Devin-only tier with Devin timed out, so I inspected the head myself) and, on the primary tier, review bodies that DO inline findings.

**Root cause of my error:** I treated a *pipeline artifact* as a proxy for the *decision input*, then asserted absence from that partial view. This is precisely the failure mode the audit existed to expose — "clean from a partial harvest is not clean" — and I reproduced it at the meta level: "uninformed, from a partial artifact read" is not uninformed. Finding a bug creates momentum toward finding its victims; that momentum is exactly when to slow down, because a false alarm about a false-safe costs the same credibility as the false-safe would.

**Rule.** When an artifact-level defect is found, keep two questions strictly separate:
1. **Is the artifact wrong?** (Here: yes — `harvest.json` under-reads. Real, worth fixing.)
2. **Was the decision wrong?** Answer ONLY by opening the decision input of record (`review-doc.md`) and the recorded verdict fields. Never infer #2 from #1.

Report them separately too: "the recorded signal field is untrustworthy on N rows" is a true and useful claim; "N findings were missed" is a different, stronger claim needing per-row confirmation. Publishing the stronger one unverified is an over-claim in the alarming direction — the mirror of rounding up to approve, and just as much a calibration failure.

**Corollary — the defect still matters, stated correctly.** The harvester bug is genuinely worth fixing because it makes the human-facing signal field wrong, and it would bite where nothing compensates: a row whose field is read in isolation, or a repo like slangpy where CodeRabbit is often the *only* signal and there is no second input to catch what the parse dropped. Fix list: query `pulls/N/comments` and merge severities; treat `Actionable comments posted: N>0` with zero body markers as a hard findings-are-elsewhere flag; bucket by `original_commit_id` (GitHub rewrites `commit_id` as the head advances); green bot status ≠ a harvestable review object; and note that **maintainer directives can arrive as plain issue comments with no review object at all** — `pulls/N/reviews` structurally cannot see them, so the *directive* surface is a third endpoint distinct from the review surface.

**Also recorded (timing, for contrast):** #797's CodeRabbit review landed ~14.5h BEFORE my decision, so unlike the case that started this thread it was never a timing race — pure endpoint split. And #797's blast radius was independently bounded by the author self-holding the PR ("this needs more work (after my vacation)") — a mitigating fact that lived on the same unqueried endpoint as the defect. Defect and containment hid behind one blind spot.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785780014953-approver-critique-mustfix-an-artifact-level-defect.md`_
