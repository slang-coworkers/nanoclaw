---
title: "[approver/human-disagreement] Latent-bug gaps in dev-only release tooling: maintainers merge them knowingly — ABSTAIN_POLICY aligns, and this class rarely warrants BLOCK"
type: learning
topic: review-approval
source: learnings/1784150237934-approver-human-disagreement-latent-bug-gaps-in-dev.md
---

# [approver/human-disagreement] Latent-bug gaps in dev-only release tooling: maintainers merge them knowingly — ABSTAIN_POLICY aligns, and this class rarely warrants BLOCK

Calibration join: slangpy#1065 "Merge 0.43.0" (jhelferty-nv, version-bump PR). Approver decided ABSTAIN_POLICY/OPEN_GAP on one CodeRabbit 🟠 Major finding: a whole-changelog year-extraction regex in tools/fix_version_numbers.py that pulls the previous release's year when the top changelog heading has a placeholder date. Verified real but LATENT (this release's committed output year=2026 was correct; trigger is a future placeholder-date prep run). Human outcome: MERGED by the author ~34 min later, at EXACTLY the decision commit (745604850f89 == merged head, no follow-up commits), with the regex UNCHANGED — i.e. the maintainer merged KNOWINGLY, declining CodeRabbit's one-line committable fix.

What this calibrates:
- The ABSTAIN (not BLOCK) call was correct. The decisive discriminator was "verified regression on THIS PR's committed output?" — NO (year=2026 was right) — so BLOCK was never warranted; the finding was a latent future-trigger gap, which is squarely "human should look", and the human looked and merged. Had I rounded to BLOCK on the Major severity label alone, I'd have contradicted the human.
- Transferable class signal: for changes to DEV-ONLY / RELEASE-TOOLING code (fix_version_numbers.py, CI helpers, doc-gen scripts — code NOT shipped in the wheel and NOT on any runtime path), a reviewer-flagged correctness gap whose blast radius is bounded to a future maintainer-run artifact (a wrong bibtex year in docs, surfaced as a reviewable diff on the NEXT bump PR) is one maintainers routinely defer. The right routing is ABSTAIN_POLICY/OPEN_GAP (human should look), not BLOCK. Reserve BLOCK for a verified defect in THIS change's committed output or on a runtime/shipped path.
- Probe to sharpen next time: when weighing a Major-labelled gap, always separate (a) severity of the mechanism from (b) whether it fires on THIS commit's output. A "Major functional-correctness" label on a branch that is provably not taken by the current change is a latent gap, and latent gaps in low-blast-radius tooling do not BLOCK. Empirically running the flagged code path (as done here) is what tells (a) from (b) — do it before assigning severity.

Confirmed: this shape (latent gap, dev-only tooling, correct committed output) was safe to ABSTAIN rather than BLOCK, and the human merge validates it. Extends [approver/false-safe] "static-CLEAN never rounds toward approve" from the opposite side: not-rounding-up also means not-rounding-DOWN a latent tooling gap to a spurious BLOCK.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784150237934-approver-human-disagreement-latent-bug-gaps-in-dev.md`_
