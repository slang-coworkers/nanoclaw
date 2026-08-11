---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786387700481-wz3abm
written_at: 2026-08-10T19:15:20.523Z
---

# [approver/infra-abstain] Devin false-clean, 4th instance: also check whether its prose is INDEPENDENT of the PR body, not just for a positive count token

## Symptom

`devin-fetch.sh` exits 0, `devin-flags.md` is a healthy ~5 KB, and its
`## Flags` section is **empty** — no 🔴/🟡/🔵, no "N bugs / M flags" token.
Fourth observed instance (slang#12452, and previously #12455, #12450, #12437).

The existing standing rule already covers half of this: **empty findings + exit 0
= FALSE CLEAN, demand a positive count token**, because a rate-limited or
never-started review prints its intended scope the same way a genuinely clean one
does. Zero findings and zero liveness are indistinguishable from the artifact.

## New root cause this instance surfaced

On #12452 the `## AI Analysis` body was ~3.4 KB of fluent, on-topic, technically
correct prose about the change — and it was a **scrape of the PR's own
description**. The mechanism explanation, the `[dcl.link]/7` citation, the
motivation section: all the author's words, re-served as "Devin's AI analysis".

That is worse than an empty file, because it *reads* as an independent reviewer
agreeing with the author. A liveness check based on "is there substantive
analysis text?" passes. Only comparing the text against the PR body reveals it
carries **zero independent bits**.

Same class as the already-recorded "two reviewers echoing the PR body are one
source" (#12451), but one level nastier: there the echo was a bot restating the
body in its own review; here the echoing artifact is the one I was treating as my
*independent* head-current signal, i.e. the thing whose whole job was to not be
derivative.

## How to catch it

Before crediting a Devin (or any scraped-UI reviewer) result in either direction:

1. **Positive count token** — require an explicit "N Bugs / M Flags". Absent ⇒
   zero-finding **and** completeness-unattested; count it in neither direction.
2. **Independence check (new)** — spot-check 2–3 distinctive phrases from the
   analysis body against `gh pr view <pr> --json body`. Substantial overlap ⇒ the
   prose is a restatement, not a review; record it as no-usable-signal even though
   it is long and correct.
3. **Grep the raw capture before recording a zero** (from #12450): an empty
   *derived* artifact is a claim about the extractor, not about the source — on
   #12450 the flags file was empty while the raw page said `0 Bugs / 1 Flag`.

## Fix / transferable rule

**Length and fluency are not independence.** When an artifact's value depends on
it being a second opinion, verify it is not a paraphrase of the first — a
derivative artifact laundered through a reviewer's byline is indistinguishable
from corroboration unless you diff it against the source.

Consequence for the decision: `reviewers_complete` should rest on the
commit-matched primary review alone in these cases, and the Devin row recorded
explicitly as "no usable signal — neither corroborating nor dissenting", never as
a clean bill. On #12452 the primary `github-actions[bot]` review was
commit-matched and carried the decision on its own, so this cost nothing; on a PR
where the production review is skipped and Devin is the *sole* signal, the same
false-clean would be the whole basis of a WOULD_APPROVE — that is the case to
guard hardest, and it should be `ABSTAIN_INFRA:NO_REVIEW_SIGNAL`.
