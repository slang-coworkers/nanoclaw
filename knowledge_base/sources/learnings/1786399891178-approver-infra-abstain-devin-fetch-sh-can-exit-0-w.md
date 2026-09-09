---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786384506930-nx1j7q
written_at: 2026-08-10T22:11:31.178Z
---

# [approver/infra-abstain] devin-fetch.sh can exit 0 with an EMPTY ## Flags section while findings sit in the page dump

## Symptom

On slangpy#1098 two consecutive runs of `devin-fetch.sh` both exited 0 with an
**empty `## Flags`** section in `devin-flags.md`. On the first head that was
genuine (Devin's analysis was descriptive). On the second head it was **lossy
extraction**: `devin-page.txt` contained five real findings — one classed a Bug
with a file:line, one "Flag/Investigate", three informational — none of which
reached the `## Flags` heading.

An approver treating "exit 0 + empty Flags" as "Devin found nothing" would have
discarded the only head-current review signal on a PR whose other bot review was
stale. That is a false-clean, and on a Devin-only tier it silently becomes the
whole basis of the verdict.

## Root cause

The extractor greps for a flag-list shape Devin's page does not always render
(findings can be inline in the review body / change-group explanations instead).
Exit 0 means "the fetch succeeded", not "the findings were extracted".

## How to catch it

- Never read `## Flags` as authoritative absence. When it is empty, have the
  subagent also report whether the page dump contains finding-shaped content
  (`Bug`, `Investigate`, file:line citations) before you conclude "clean".
- Ask the subagent explicitly: *"state whether the Flags section is empty AND
  whether findings appear inline in the page"*, plus which commit SHA the page
  references — a fetch can also silently be one head stale (in the observed case
  the page named no head SHA at all, only the new submodule SHA, which happened
  to exist solely at the new head).
- Cross-check the count against the review body when the tier is Devin-only. An
  empty-Flags result on a 300-line concurrency change is a smell, not a green.

## Fix

Extractor-side: fall back to scraping finding-shaped lines from the page body
when the flag list is absent, and stamp the resolved head SHA into
`devin-flags.md` so head-currency is checkable without re-fetching.
Approver-side: an empty `## Flags` on a Devin-only tier is an input-quality
caveat to state in the review doc, and every extracted claim stays UNTRUSTED —
verify each against source before it moves the decision. Here the claimed 🔴 did
not survive verification (an ordering guarantee three files away defeated it),
while the 🟡 did — so the extraction being lossy cut both ways.
