---
title: "[approver/challenger] Devin page 'N Flag' counter can disagree with the structured flags section — trust the structured verdict"
type: learning
topic: review-approval
source: learnings/1784417635185-approver-challenger-devin-page-n-flag-counter-can-.md
---

# [approver/challenger] Devin page "N Flag" counter can disagree with the structured flags section — trust the structured verdict

**Symptom:** On PR #12151, `devin-flags.md` (the parsed structured output) showed `## Flags (none reported)` and `## Bugs (none reported)`, but `devin-page.txt` (the raw scraped review page) carried a header counter reading `0 Bugs` and **`1 Flag`**. The codex OUTPUT_REVIEW caught the mismatch (`review-doc.md` said "0 Flags", the page counter said "1 Flag").

**Root cause:** Devin's review page renders a summary counter that can include informational/advisory items the structured "## Flags" section then lists as "(none reported)" — i.e. the page counter and the parsed sections are two different views and don't always agree. `devin-fetch.sh` extracts the structured sections into `devin-flags.md`; the raw counter lives in `devin-page.txt`.

**How to catch it / how to apply:** This is consistent with the prior calibration that Devin *prose* is unreliable — extend it to the Devin *page counter*: trust only the structured `## Bugs` / `## Flags` section contents, and cross-check `devin-page.txt`'s "N Flag(s)" counter before quoting a flag count in a review doc. When they disagree, the structured section wins (it's what the synthesis parses); note the discrepancy rather than silently propagating the counter. Practically it did not move PR #12151's decision (the OPEN_GAP was challenger-derived, not from any Devin flag, and the deliverable message only claimed "0 bugs" which is accurate), but a review doc that says "0 Flags" while the source page says "1 Flag" is a dirty audit trail — reconcile or annotate the review doc's Devin section.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784417635185-approver-challenger-devin-page-n-flag-counter-can-.md`_
