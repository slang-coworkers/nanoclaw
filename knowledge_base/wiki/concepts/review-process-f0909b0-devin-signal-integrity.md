---
title: Devin signal integrity — echoes, stale revisions, and subagent narration vs artifact
type: concept
group: review-process
tags: [devin, independence-check, staleness, subagent, devin-page-txt, reviewers-complete, approver]
source_count: 10
---

## TL;DR

Beyond the extraction bugs (see the scraper-false-cleans page), Devin fails as a
*review signal* in ways that survive a healthy-looking scrape. Four independent
hazards, all measured on the approver's Devin-only tier where Devin is often the
sole voice:

1. **Devin echoes the PR body as its "AI Analysis".** A fluent, on-topic,
   technically-correct ~3-5 KB analysis block can be verbatim the author's own
   description. That is *sycophantic corroboration* — it always agrees with the
   author because it IS the author. Length and fluency are not independence:
   spot-check 2-3 distinctive phrases against `gh pr view <n> --json body`; on
   overlap, record "no independent signal", never "Devin found no bugs".
2. **Devin can return a STALE revision's analysis.** The review page renders no
   commit SHA, so a scrape on a fast-moving PR silently shows an earlier
   revision's findings. `exit 0` means "a page was scraped", NOT "the pinned head
   was reviewed". Bind trust to `devin-commit-status.txt` (== pinned head, not
   `"unknown"`) and cross-check every cited `file:line` against the actual diff.
3. **A subagent's narration is not a reading of the artifact.** Running Devin in a
   background subagent (correct for context hygiene) means only its short reply
   re-enters the session. A "still running / I'll wait" non-answer, or a single
   `ls` that missed the file, is a claim about the subagent's turn — not the
   findings. Read `review/devin-page.txt` yourself before recording DEVIN_SKIPPED
   or a zero.
4. **"Devin flagged X" means LOCAL analysis, not a public PR comment.** The
   approver's Devin never posts to GitHub; its page has a "Suggested reviewers"
   section. Never write "Devin surfaced/tagged X publicly" without reading the
   live PR comments.

The unifying rule: **read the raw artifact, not the framing.** An empty/absent
*derived* file (`devin-flags.md`) is a claim about the EXTRACTOR; the *raw*
capture (`devin-page.txt`) is the source of record. Judge prose and findings
sections separately — prose can be derivative while findings are real, and vice
versa. Devin's three tiers are **Bugs > Flags > Informational**; a "Flag" is not
an informational nit and still needs Step-3 adjudication.

## Devin as a working instrument whose output is a mirror

The extraction bugs are a *broken* instrument reading clean. The echo problem is a
*working* instrument whose output is derivative. On slang#12454 `devin-fetch.sh`
finished cleanly (`Analysis complete`, no truncation) and reported
`(none reported)` for Bugs/Flags/Informational — but the `## AI Analysis` section
was verbatim the PR's Motivation/Proposed-solution text, truncated mid-word. A
clean Devin result normally counts as one of three independent reviewer voices;
when the analysis is the PR body, "(none reported)" carries **zero independent
signal** and is worse than nothing — it is corroboration that *always* agrees with
the author, "inflating confidence exactly where the author's own reasoning most
needs an outside check" [Devin can echo the PR body as its AI Analysis](../learnings/1786381953297-devin-can-echo-the-pr-body-as-its-ai-analysis-that.md).
The check: diff the analysis prose against `gh pr view <n> --json body`; only
credit "(none reported)" when the text contains claims *not* in the PR body.

This sharpened into a distinct "4th instance" leaf on slang#12452 adding an
**independence check** to the standing positive-token rule: length and fluency are
not independence, and the echoing artifact is one level nastier when it is the very
thing you were treating as your independent head-current signal
[Devin false-clean 4th instance — check independence of the prose](../learnings/1786389320523-approver-infra-abstain-devin-false-clean-4th-insta.md).

**Supersession within the same session.** That 4th-instance leaf was then *itself
partly retracted*. An OUTPUT_REVIEW critique read the raw capture the author had not
opened: `devin-page.txt` contained a genuine `0 Bugs / 0 Flags` positive token AND
two Informational findings the extractor dropped — one of which was the exact
concern the decision ultimately abstained on. The "no usable signal" half was
wrong; the independence-of-prose half survived. The correcting atom is explicit
that it **supersedes the "no signal" claim** of the prior leaf: "a 'false clean'
verdict is itself a claim that needs the same evidence standard I was demanding of
Devin — I required a positive token from it; I did not require myself to open the
file that contained one", and **prose can be derivative while the findings section
is not — judge the sections separately** [CORRECTION: my Devin false-clean leaf was itself wrong](../learnings/1786392010498-approver-challenger-miss-correction-my-devin-false.md).

## Read the raw capture, not the subagent's summary

`devin-fetch.sh` writes **two** artifacts: `devin-flags.md` (post-processed, lossy)
and `devin-page.txt` (the raw page with the findings rail: `N Bugs`, `N Flag(s)`,
per-finding lines). Concluding a channel is empty from `devin-flags.md` alone,
without listing the directory, is the "read the artifact, not the framing" failure:
on slangpy#1100 the full rail (`0 Bugs / 1 Flag`, `Checks 16/16`) sat in
`devin-page.txt` in the same dir, a file never opened — "before ANY claim that a
Devin channel is empty/unread/clean, `ls review/` and read `devin-page.txt`". Note
the error direction: it produced an *over-cautious* ABSTAIN, which flatters the
agent (looks careful) and escapes audit because nothing internal flags a mistake
that lowers your apparent error count [Devin writes findings to devin-page.txt — ls the dir](../learnings/1786463021434-approver-critique-mustfix-devin-writes-findings-to.md).

Delegation to a subagent compounds this. On slang#12427 the subagent's final text
was a non-answer ("I'll wait for the monitor to notify me"), a single `ls
devin-flags.md` reported absent, and DEVIN_SKIPPED was recorded — but the file had
landed 6 minutes earlier with a real 🔴 runtime bug. **A subagent's non-answer is a
claim about the subagent's turn, not a reading of the artifact**; verify the
*absence* against the filesystem + raw page, and DEVIN_SKIPPED is legitimate only
when the subagent explicitly returned `DEVIN_SKIPPED:<reason>` AND no
`devin-flags.md`/`devin-page.txt` landed [Devin subagent non-answer + one ls miss recorded DEVIN_SKIPPED over a real 🔴](../learnings/1786464068756-approver-challenger-miss-devin-subagent-non-answer.md).
The pattern recurs on slang#12492 — the subagent's `devin-flags.md` said "0 flags"
while its own raw capture listed `1 Flag` (a middle-tier concern, above
Informational); "the delegation that saved context also moved the extractor error
out of my sight", so **grep the raw `devin-page.txt` yourself for the `N Bugs / N
Flag(s)` counters and reconcile against the derived file** [Devin-in-subagent: read devin-page.txt for the tally](../learnings/1786533325328-approver-challenger-miss-devin-in-subagent-read-de.md).
And on slang#12536 the harvest truncated *before* the flags rendered — the counts
live near the END of `devin-page.txt` after the "173 lines left / Read more"
analysis body, so `grep -niE "[0-9]+ (bug|flag)s?|Investigate|Informational"
devin-page.txt | tail` is the count check; "an empty `## Flags` is only trustworthy
when the page's own `0 Flag(s)` count confirms it", and the OUTPUT_REVIEW gate is
the backstop that read the primary artifact and caught the omission [Devin harvest can truncate before the flags render](../learnings/1786662188316-approver-challenger-miss-devin-harvest-can-truncat.md).

## Head-currency and the local-vs-public distinction

**Staleness by content, not by scrape.** The review page renders no commit SHA, so
on slang-rhi#831 R6 Devin exited 0 with `2 bugs / 8 flags / 7 informational` — every
one referencing code **absent from the R6 diff** (`vk-heap.cpp:64-85`,
`action.yml:74-126` machinery R6 had removed), and `devin-commit-status.txt` was
literally `"unknown"`. Devin had reviewed an *earlier* revision. The rules:
`exit 0` means "a page was scraped", NOT "the pinned head was reviewed"; **read
`devin-commit-status.txt` (== pinned head, else not head-current); cross-check
cited file:lines against the actual diff; bind trust to the commit-status, not the
exit code** — when production/CodeRabbit/Devin are all absent-or-stale for the head,
that is `ABSTAIN_INFRA:NO_REVIEW_SIGNAL`, even with green CI and a clean self-read
[Devin fetch can return a STALE revision's analysis](../learnings/1786654604214-approver-infra-abstain-devin-fetch-can-return-a-st.md).

A companion staleness note gives the finer discriminators for a *re-scrape*: a
short page ending in `Loading diffs…` with a partial `Checks 6/16` is *incomplete*,
not stale (re-scrape); key on the substantive claim the new commit changed (a
single flipped token like `.default` → `.deferred`); and crucially, a stale-looking
flag can persist on a head-current page **annotated `• Resolved`** — Devin's own
statement that it re-reviewed and the push fixed it, i.e. *evidence of*
head-currency, so a staleness predicate must be "flag text present AND not marked
Resolved", and live flag counts exclude `Informational` and `• Resolved` items
[Devin review staleness — discriminate by content, treat • Resolved as head-current](../learnings/1786443772351-approver-infra-devin-review-staleness-discriminate.md).

**Local analysis is not a public comment.** On slang#12536 the approver wrote "Devin
tagged @csyonghe / #8870" as if Devin had posted it — but the approver's Devin runs
in a subagent against a local dump and **never posts to GitHub by design**. The
"@csyonghe/#8870" text came from Devin's local "Suggested reviewers" section. The
false "it's already public" became a *reason* in a decision about whether to post a
bot comment. Distinguish three states explicitly: (1) a reviewer's LOCAL analysis
(never public), (2) a bot's POSTED review/comment (has an html_url), (3) a related
ISSUE that exists but does not mention this PR's sub-case — never collapse (1)/(3)
into (2), and confirm authorship in live comments before writing "surfaced/posted/
visible on the PR" [Devin flagged X means LOCAL analysis, not a public comment](../learnings/1786662912913-approver-critique-mustfix-devin-flagged-x-means-lo.md).

**Source learnings (10):**

- [Devin can echo the PR body as its "AI Analysis"](../learnings/1786381953297-devin-can-echo-the-pr-body-as-its-ai-analysis-that.md) — a clean-looking result whose analysis is verbatim the author's description is sycophantic corroboration with zero independent signal; diff the prose against `--json body`.
- [Devin false-clean 4th instance — also check the prose is INDEPENDENT of the PR body](../learnings/1786389320523-approver-infra-abstain-devin-false-clean-4th-insta.md) — length and fluency are not independence; the echo is nastiest when it is the artifact you treat as your head-current signal. (Its "no signal" half is retracted below.)
- [CORRECTION: my Devin false-clean leaf was itself wrong — the raw page had a positive token + 2 findings](../learnings/1786392010498-approver-challenger-miss-correction-my-devin-false.md) — supersedes the prior leaf's "no signal" claim; a false-clean verdict needs the same evidence standard; judge prose and findings sections separately.
- [Devin review staleness — discriminate by content, treat "• Resolved" as head-current signal](../learnings/1786443772351-approver-infra-devin-review-staleness-discriminate.md) — no SHA on the page; a `Loading diffs…` short page is incomplete not stale; a `• Resolved` flag is evidence of re-review, not staleness.
- [Devin writes findings to devin-page.txt, not just devin-flags.md — ls the dir](../learnings/1786463021434-approver-critique-mustfix-devin-writes-findings-to.md) — an empty `## Flags` means the extractor failed to split, not that Devin found nothing; the over-cautious ABSTAIN direction escapes audit.
- [Devin subagent non-answer + one ls miss recorded DEVIN_SKIPPED over a landed real 🔴](../learnings/1786464068756-approver-challenger-miss-devin-subagent-non-answer.md) — a subagent's turn-narration is not a reading of the artifact; verify absence from the filesystem + raw page.
- [Devin-in-subagent: read devin-page.txt for the Bugs/Flags tally](../learnings/1786533325328-approver-challenger-miss-devin-in-subagent-read-de.md) — delegation hid a dropped Flag; reconcile the raw counters against the derived file; Bugs > Flags > Informational, a Flag is not a nit.
- [Devin fetch can return a STALE revision's analysis](../learnings/1786654604214-approver-infra-abstain-devin-fetch-can-return-a-st.md) — `devin-commit-status.txt` == pinned head or it is not head-current; cross-check cited file:lines against the diff; exit 0 ≠ reviewed the pinned head.
- [Devin harvest can truncate before the flags render](../learnings/1786662188316-approver-challenger-miss-devin-harvest-can-truncat.md) — counts live at the end of `devin-page.txt` after the "Read more" body; grep the full page; OUTPUT_REVIEW gate is the backstop.
- ["Devin flagged X" means LOCAL analysis, not a public PR comment](../learnings/1786662912913-approver-critique-mustfix-devin-flagged-x-means-lo.md) — the approver's Devin never posts; never write "surfaced/public/visible" without reading live comments; distinguish local analysis / posted comment / related issue.
