---
title: "[approver/infra-abstain] devin-fetch.sh drops the 'N Flag' block from devin-flags.md — always cross-check raw devin-page.txt"
type: learning
topic: review-approval
source: learnings/1784017360003-approver-infra-abstain-devin-fetch-sh-drops-the-n-.md
---

# [approver/infra-abstain] devin-fetch.sh drops the "N Flag" block from devin-flags.md — always cross-check raw devin-page.txt

**Symptom:** `devin-fetch.sh` wrote `## Flags\n(none reported)` into `devin-flags.md` on PR #11670 twice (both the b7686cb and 49825f56 revisions), while the raw `devin-page.txt` it also captured clearly showed `0 Bugs / 1 Flag` with the flag text ("Differential zero uses emitDefaultConstructRaw for inout slots but getDifferentialZeroOfType for return values", slang-ir-autodiff-fwd.cpp:205). On b7686cb this was decision-changing: the dropped flag was the *only* review-surfaced signal of the open gap, and had I trusted `devin-flags.md` alone I'd have derived CLEAN (WOULD_APPROVE) against a real gap + a standing human CHANGES_REQUESTED — a false-safe. The DECISION_REVIEW critique caught it by reading the raw page.

**Root cause:** the flag-extraction step in `devin-fetch.sh` doesn't reliably scrape the "N Flag" section from the Devin SPA — especially when the page is still "Loading diffs…" (commit status "unknown") at capture time. The Informational section extracts fine; the Flags section silently comes back empty. So `devin-flags.md`'s `## Flags` cannot be trusted as authoritative.

**How to catch it:** after any `devin-fetch.sh` run, ALWAYS grep the raw `review/devin-page.txt` for the tally + flag text before synthesizing the review doc:
`grep -nE '[0-9]+ Bug|[0-9]+ Flag|getDifferentialZeroOfType|emitDefaultConstructRaw|dzero' devin-page.txt`
If the raw `N Flag` count > 0 but `devin-flags.md` says "(none reported)", the extraction dropped it — recover the flag verbatim from the raw page. Also treat "Loading diffs…" / commit status "unknown" in the raw page as "Devin not fully settled": the flag *count* may be right but the flag *detail* may not have rendered; say so explicitly rather than inventing text.

**Fix:** (a) procedure fix now — never synthesize from `devin-flags.md` alone; cross-check `devin-page.txt` tallies. (b) tooling fix (file separately against slang-pr-review-runner): make `devin-fetch.sh` wait for the page to leave "Loading diffs…" before scraping, and fail loudly (non-zero, or an explicit "flags-unextracted" marker) when the `## Flags` section is empty but the header tally shows `≥1 Flag`, instead of writing "(none reported)". A silent empty-flags extraction is an infra gap that can flip an ABSTAIN to a false WOULD_APPROVE.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784017360003-approver-infra-abstain-devin-fetch-sh-drops-the-n-.md`_
