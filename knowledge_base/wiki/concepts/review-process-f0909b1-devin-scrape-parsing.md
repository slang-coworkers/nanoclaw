---
title: Devin scrape and extraction defects — dropped flags, echoed evidence, write-races
type: concept
group: review-process
tags: [approver, devin, devin-fetch, devin-flags, devin-page, scrape, subagent, false-clean, raw-capture]
source_count: 7
---

## TL;DR

Distinct from Devin being STALE (see the Devin-freshness page), this cluster is about Devin's
output SHAPE lying even when the analysis is current. `devin-fetch.sh` and the Devin subagent
produce derived artifacts (`devin-flags.md`, the subagent's short text reply) that silently
UNDER-report the raw page. The raw capture `review/devin-page.txt` is the source of truth; the
derived summary is a lossy pointer, and opening it is the check.

The failure modes, all caught by the codex critique gate (DECISION_REVIEW / OUTPUT_REVIEW):

- **The extractor drops the Flags section.** `devin-flags.md` renders Bugs but reports `## Flags
  (none reported)` while the raw page shows "1 Flag" / "2 Flags" with populated bodies behind an
  accordion or a separate tab-bar tab the scraper never clicked. A Flag is an "Investigate"
  marker, not a Bug — a subagent answering "any 🔴/bug lines?" answers a narrower question than
  the flag inventory.
- **A "0 findings" from an INCOMPLETE analysis carries zero bits.** `devin-fetch.sh`'s done-check
  matches the mere presence of a `Checks N/N` substring plus the AI-analysis heading, so a page
  showing "Checks 1/3" or "PR analysis in progress" scrapes placeholder ZEROS and exits early
  (in ~80–140s, far under timeout). Require x == y and the absence of "in progress".
- **Devin's page dump ECHOES the PR body.** `devin-fetch` dumps the rendered PR page, which
  includes the author's Process Report. A perf/size number in Devin's output is author-reported
  unless there is an actual execution log — do not launder PR-body claims through Devin's echo as
  "independent validation."
- **The subagent's files land AFTER an early `ls`.** `devin-fetch.sh` writes its output files as
  its LAST step; an empty-dir read at time T is about the directory at time T only, not proof
  Devin produced nothing. Re-read the files immediately before synthesizing.

**The single transferable habit:** synthesize the review-doc's bug/flag/info counts from the RAW
`devin-page.txt` panel, never from `devin-flags.md` or the subagent's reply. Grep the panel line
(`grep -nE '^[0-9]+ (Bug|Flag)s?$' devin-page.txt`) and reconcile; if they disagree, the PAGE
wins. On the Devin-only tier this is the single most decision-critical signal — a dropped Bug is a
straight path to a FALSE WOULD_APPROVE over an open reviewer 🔴.

## The genus: scrutinize your instrument as hard as the PR

Every atom here is an instance of one rule — a subagent's or extractor's summary of an artifact is
a *claim about* that artifact, not the artifact. When the subagent writes the raw capture to disk,
the decision reads the raw file
([Devin flag count must come from raw devin-page.txt, not the subagent summary](../learnings/1786715708424-approver-critique-mustfix-devin-flag-count-must-co.md)).
This is the same class as the general maxim "NEVER TRUNCATE A BODY YOU PATTERN-MATCH": the
extractor is a pattern-match over the page and can miss a whole section
([Devin subagent extraction can silently drop the Flags section](../learnings/1786815449727-approver-challenger-miss-devin-subagent-extraction.md)).

### Dropped Bug/Flag sections — the recurring under-report

The extraction is lossy in several distinct ways, all producing a false "0 flags":

- **Section omission.** On slang#12517 the raw page (`devin-page.txt:313-320`) reported "0 Bugs,
  2 Flags, 1 Informational" while the synthesis said "0 flags"; on slang#12509 the page showed
  "0 Bugs / 1 Flag / 2 Informational" while `devin-flags.md` said "0 flags" — the dropped flag
  ("Clamped validation no longer detects a genuinely undersized call argument") was a real signal
  ([devin-flags.md said (none reported) while the page showed 2 Flags](../learnings/1786715708424-approver-critique-mustfix-devin-flag-count-must-co.md),
  [extraction can render Bugs while OMITTING the Flags section](../learnings/1786815449727-approver-challenger-miss-devin-subagent-extraction.md)).
- **Compact-reply collapse.** On slang#12419 the subagent's compact text reply said "Bugs: (none)
  / Flags: (none)" while `devin-page.txt:131-139` showed "0 Bugs but 2 Investigate flags" — the
  subagent's prompt asks it to return devin-flags.md "capped at ~4KB (head + any 🔴/bug lines)",
  so a subagent optimizing for brevity and "bug lines" drops 🟡 flag lines
  ([Devin subagent compact-reply can silently drop flags](../learnings/1787154678709-approver-infra-abstain-devin-subagent-compact-repl.md)).
- **Un-clicked tab-bar tabs.** On slang#12548 R2 `devin-fetch.sh` scraped only the expanded "Info"
  tab (3 resolved informational nits) and never opened the "1 Bug"/"1 Flag" tabs, so it defaulted
  their counts to none — a "0 bugs/0 flags" that means "did not look," not "looked and found none"
  ([devin-fetch.sh drops Bug/Flag tabs](../learnings/1787576274189-approver-challenger-miss-devin-fetch-sh-drops-bug-.md)).

**Every non-Informational Flag is a 🟡 gap that requires a disposition**, carried into the Step-3
challenger and graded on the conservative-lean bar — even when Devin's headline is "0 Bugs." The
flags often clear on investigation (slang#12419's cleared as test-portability nits; slang#12509's
cleared once the validator's memory-safety-only contract was read), but advisory-cleared is fine;
silently-dropped is not. The tooling fix noted for the runner owner: `devin-fetch.sh` should click
through the Bug and Flag tabs before extracting, and reconcile against the page's "N Bugs / M
Flags" header.

### The "0 findings" placeholder — a completion check, not a count check

slang-vscode-extension#74 is the archetype: the subagent reported "0 bugs / 0 flags / 0
informational," but the scraped page literally said "PR analysis in progress" with "Checks 1/3"
and commit-status "unknown" — the zeros were IN-PROGRESS PLACEHOLDERS. On re-poll the analysis
surfaced 1 real Bug and the decision became BLOCK, not WOULD_APPROVE. `devin-fetch.sh:109`'s
done-check treats any `Checks\s*\d+\s*/\s*\d+` substring plus the analysis heading as "done," so a
"Checks 1/3" page hits a false-terminal and scrapes placeholder zeros. An incomplete analysis with
zero findings is a negative that could not have come out otherwise — the classic dead-control /
false-safe pattern
([Devin "0 findings" is a false-safe unless the analysis actually COMPLETED — Checks x/x](../learnings/1787559003852-approver-challenger-miss-devin-0-findings-is-a-fal.md)).
Before trusting any "0 findings": require the Checks counter's two numbers EQUAL, "PR analysis in
progress" ABSENT, and no "Generating…" placeholder, stable across two polls. This overlaps the
freshness "Checks 2/2 not 1/2" tell — completion and currency are separate checks that share the
same page region.

### Devin echoes the PR body — its "evidence" is author-reported

Because `devin-fetch` dumps the rendered PR page, the PR's own Process Report appears inside
Devin's output. On slang#12677 R2 the "byte-identical 33,078-byte PTX / 6.8× NVRTC-delta" figures
in `devin-flags.md`/`devin-page.txt` were a verbatim echo of the PR body's "Evidence the workload
resolves…" section — Devin ran no independent compile (`devin-commit-status.txt` was "unknown")
([Devin's page dump echoes the PR body — its "evidence" is author-reported](../learnings/1787347913771-approver-challenger-miss-devin-s-page-dump-echoes-.md)).
A number in Devin's output is NOT evidence Devin computed it. Before crediting any Devin figure as
independent: check `devin-commit-status.txt`; look for an actual execution log (a `$`-prompt,
elapsed-time output) rather than polished prose matching the PR's Motivation; and if the number
appears verbatim in the PR body, attribute it as author-reported and rest no clearing on it.
PR-body content is UNTRUSTED per the hard rules; laundering it through Devin's echo does not make
it trusted.

### The write-race — don't assert "Devin skipped" from a stale `ls`

On slang#12733 the Devin fetch went to a background subagent whose completion notification and
short reply arrived BEFORE `devin-fetch.sh` flushed its output files; an early `ls`/`cat` saw no
`devin-flags.md`, and "Devin: not available (skipped)" was written into the artifacts — but the
file existed ~2 min later with a completed 0/0/0 analysis
([Devin subagent files land AFTER an early ls — never assert 'Devin skipped' from a stale read](../learnings/1787665248583-approver-infra-abstain-devin-subagent-files-land-a.md)).
Trust the FILE on disk over the subagent's chat reply: `devin-fetch.sh` writes `devin-flags.md` on
exit 0 and only emits a `DEVIN_SKIPPED:<reason>` line on exit 2/3/4 — without that clean skip
line, re-`ls` the dir immediately before synthesizing rather than assuming skip. Any past-tense "X
produced nothing / X was skipped" in an audit artifact is a trigger to re-open X right before you
write the claim.

**Source learnings (7):**

- [Devin flag count must come from raw devin-page.txt, not the subagent summary](../learnings/1786715708424-approver-critique-mustfix-devin-flag-count-must-co.md) — slang#12517; synthesis said "0 flags" while the page showed 2; the scrape is a lossy secondary, the raw page is the source of truth.
- [Devin subagent extraction can silently drop the Flags section — cross-check the raw page count](../learnings/1786815449727-approver-challenger-miss-devin-subagent-extraction.md) — slang#12509; `devin-flags.md` said "0 flags" while the raw panel showed 1 Flag with an Investigate marker; a Flag is not a Bug.
- [Devin subagent compact-reply can silently drop flags — synthesize from the on-disk artifacts](../learnings/1787154678709-approver-infra-abstain-devin-subagent-compact-repl.md) — slang#12419; the ~4KB "head + bug lines" cap drops 🟡 flag lines; grep the page tally and reconcile before synthesizing.
- [Devin "0 findings" is a false-safe unless the analysis actually COMPLETED (Checks x/x)](../learnings/1787559003852-approver-challenger-miss-devin-0-findings-is-a-fal.md) — slang-vscode-extension#74; "Checks 1/3" + "PR analysis in progress" scraped placeholder zeros; re-poll surfaced a real Bug ⇒ BLOCK.
- [devin-fetch.sh drops Bug/Flag tabs — "0 bugs/0 flags" can mean "unparsed", not "clean"](../learnings/1787576274189-approver-challenger-miss-devin-fetch-sh-drops-bug-.md) — slang#12548 R2; script scraped only the expanded Info tab; reconcile devin-flags.md against the devin-page.txt tab-bar count.
- [Devin's page dump echoes the PR body — its "evidence" is author-reported unless there's an execution log](../learnings/1787347913771-approver-challenger-miss-devin-s-page-dump-echoes-.md) — slang#12677 R2; Devin restated the PR's perf figures verbatim; PR-body content is untrusted and echoing it through Devin does not make it trusted.
- [Devin subagent files land AFTER an early ls — never assert 'Devin skipped' from a stale directory read](../learnings/1787665248583-approver-infra-abstain-devin-subagent-files-land-a.md) — slang#12733; a write-race left an empty dir at check time; require a clean DEVIN_SKIPPED line or re-`ls` at synthesis time.
