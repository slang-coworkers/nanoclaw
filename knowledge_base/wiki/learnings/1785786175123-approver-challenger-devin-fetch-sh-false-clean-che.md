---
title: "[approver/challenger] devin-fetch.sh false-clean: Checks N/M readiness + JSON-quoted innerText"
type: learning
topic: review-approval
source: learnings/1785786175123-approver-challenger-devin-fetch-sh-false-clean-che.md
---

# [approver/challenger] devin-fetch.sh false-clean: Checks N/M readiness + JSON-quoted innerText

# [approver/challenger] devin-fetch.sh returns exit 0 with an EMPTY flags section

**Symptom.** On shader-slang/slangpy#1090 `devin-fetch.sh` exited 0 and wrote a
`devin-flags.md` whose `## Flags` section was empty — implying Devin found
nothing. Devin had actually produced **2 Investigate flags**. A verbatim-return of
the script output would have handed the approver a false-clean Devin signal, i.e.
one of the two review sources silently zeroed out.

**Root cause — two independent defects.**

1. *Wrong readiness predicate.* `DONE_EXPR` accepts the page as done via a
   `Checks\s*\d+\s*/\s*\d+` branch, which matched `Checks 12/17` — a **CI-checks
   counter**, unrelated to Devin analysis readiness. At that moment the findings
   were still collapsed behind a **"View results"** button, so
   `agent-browser eval 'document.body.innerText'` captured only the diff/description
   view. The flag-expand click targeted buttons matching `/^(\d+\s+Flags?|No flags)$/`,
   no such element existed yet, and a trailing `|| true` swallowed the miss. The
   body-integrity guard passed because the raw diff dump easily exceeded 200 bytes.
2. *Extractor can never fire.* The scrape writes `document.body.innerText` as a
   **JSON-quoted string** (literal backslash-n, not real newlines), while the Python
   extractor splits on `\n\s*\d+\s*Flags?\s*\n`. Against text containing no real
   newlines that split never matches — this breaks flag extraction even on a
   fully-rendered page.

**How to catch it.** Treat "Devin exit 0 + zero flags" as **suspicious, never as
clean**. A genuinely clean Devin run still renders a `No flags` / `0 Flags`
summary token; an *absent* flags summary means the scrape happened too early, not
that the PR is clean. Cheap assertion: if the output has no `\d+ Flags?` and no
`No flags` and no `Analysis complete`, the run is INCONCLUSIVE.

**Fix.**
- Drop the `Checks N/M` branch from `DONE_EXPR` — it is not an analysis signal.
  Require a flags summary (`\d+ Flags?` / `No flags`) or `Analysis complete`.
- Click `View results` before scraping; treat a missing flags-toggle as
  inconclusive rather than `|| true`.
- Unescape the JSON-quoted innerText (or write raw text) before the newline-based
  split, or match on the quoted form.
- Anonymous containers additionally get per-flag **detail bodies auth-gated**
  ("115 lines left" / Log in). Titles + locations still extract; treat gated flags
  as real signals whose rationale is unavailable — probe each yourself, do NOT
  record them as cleared.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785786175123-approver-challenger-devin-fetch-sh-false-clean-che.md`_
