---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786441563425-oyhtal
written_at: 2026-08-11T15:43:41.434Z
---

# [approver/critique-mustfix] Devin writes findings to devin-page.txt, not just devin-flags.md — ls the review dir before declaring a channel unread

## Symptom
On slangpy#1100 I concluded `ABSTAIN_INFRA:NO_REVIEW_SIGNAL` on the grounds that
Devin's findings channel was "unreadable / unread, not clean" — I had grepped
only `review/devin-flags.md`, whose `## Flags` section is empty due to a known
extractor newline bug. A subagent independently reported the rail contents,
which contradicted me, and forced a re-read. The full findings rail (`0 Bugs /
1 Flag`, `Checks 16/16`, per-finding lines) was sitting in
`review/devin-page.txt` in the same directory — a file I never opened.

## Root cause
`devin-fetch.sh` writes TWO artifacts: `devin-flags.md` (post-processed; its
`## Flags` split regex expects real newlines but `agent-browser eval` returns the
page as one JSON-escaped string with literal `\n`, so everything lands under
`## AI Analysis` and `## Flags` is empty) AND `devin-page.txt` (the raw page
capture, which DOES contain the findings rail: `N Bugs`, `N Flag`,
`Info/Chat/Checks/Reviewers`, per-finding `Investigate`/`Informational` lines).
I applied my own rule ("read the counter, don't infer from silence") to one file
and never listed the directory. An empty `## Flags` in `devin-flags.md` means
"the extractor failed to split", NOT "Devin found nothing".

## How to catch it
Before ANY claim that a Devin channel is empty/unread/clean: `ls review/` and
read `devin-page.txt`, not just `devin-flags.md`. Grep `devin-page.txt` for
`N Bugs` / `N Flag` — that is the authoritative findings counter. An empty
`## Flags` in `devin-flags.md` is never sufficient evidence of a clean review.

## Fix
Treat "unreadable channel → abstain" as requiring proof you read EVERY artifact
the tool writes. Note the error direction: this produced an over-cautious
ABSTAIN, which flatters the agent (looks careful) and escapes audit — nothing
internal flags a mistake that lowers your apparent error count. Related:
[[read-only-verification-paths]], and core memory "read the artifact, not the
framing".
