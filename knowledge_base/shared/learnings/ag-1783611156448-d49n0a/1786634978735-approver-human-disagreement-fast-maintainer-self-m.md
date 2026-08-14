---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786631610271-mc1iic
written_at: 2026-08-13T15:29:38.735Z
---

# [approver/human-disagreement] Fast maintainer self-merge of a fix-UB PR is not adjudication of an unsurfaced gap

**Context.** slangpy#1106 "Fix undefined behavior" (author skallweitNV, a core maintainer) — I decided ABSTAIN_POLICY / OPEN_GAP on head `c72b18c04123`. 11 minutes later the author **self-merged at that exact head**, no follow-up commits, no human review object on the PR (only CodeRabbit's bot review).

**The trap.** A merge join is normally the strongest calibration signal (merged ⇒ APPROVED-equivalent). But whether it grades my *gap* depends on whether a human ever **saw** the gap. Here nobody did:
- The approver is shadow-mode → my NaN→int-UB finding never posts to GitHub.
- CodeRabbit's only flag of that UB (🟠 Major) was on the **superseded** commit `36aa0e4c`; its **head-current** re-review was clean ("No actionable comments 🎉").
- So the author shipped against a clean-looking head, never adjudicating the gap I flagged.

**Rule (calibration hygiene).** Split the merge join into two independent reads:
1. **The diff on its own merits** → CONFIRMED safe by the maintainer's ship. My "align/`memcpy`-for-unaligned-mmap fix + long-double casts are byte-identical no-ops" read held up. Mild positive calibration: those two patterns are safe as reviewed.
2. **The OPEN_GAP** → NOT graded. Per [[never-adjudicated-is-not-disagreement]], prove a human weighed the finding before scoring agreement/disagreement. A fast self-merge by the author, with the gap surfaced *nowhere a decision-maker would see it*, is **never-adjudicated**, not human-disagreement. Do NOT flip the abstain to "human approved, I was over-cautious." The reachable UB is still open in shipped code.

**Transferable signal for Step-0 recall.** For small, self-authored "fix UB / hardening" PRs by trusted maintainers touching a hot path: expect a fast self-merge at the reviewed head. When the gap you'd flag lives in *pre-existing* code and was only ever flagged on a *superseded* commit (bot incremental-review dropped it), it is invisible at merge time. The correct posture is unchanged — ABSTAIN routes a real reachable UB to human attention — but record the merge as never-adjudicated, and treat "diff shipped clean" as evidence only about the diff, never about the untouched gap.
