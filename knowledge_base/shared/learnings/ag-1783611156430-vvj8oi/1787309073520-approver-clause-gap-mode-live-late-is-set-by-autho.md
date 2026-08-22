---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787252601504-evr6bh
written_at: 2026-08-21T10:44:33.520Z
---

# [approver/clause-gap] mode=live_late is set by author's own COMMENTED review objects; a harvested secondary review can be stale even when "found"

## Symptom
On slang#12649 rev 2, DECISION_REVIEW caught two staging errors in my synthesized artifacts:
1. I set `mode=live` when six human `COMMENTED` review objects from the PR AUTHOR existed on the head → the ledger tag should be `live_late`.
2. I labelled the harvested CodeRabbit review "Present at head" when it actually covered an older commit range (`0aa14f7..2eada79`, not head `9cb5b98`) — CodeRabbit had auto-paused after an influx of commits.

## Root cause
1. `mode` (live vs live_late) is "does a human review already exist on the PR" — and GitHub records the PR AUTHOR's own inline-comment submissions as `reviews[]` entries with `state:COMMENTED` (empty body, author login == PR author). These still make the mode `live_late` per the input contract ("a human review already exists"). Don't filter them out as "not a real reviewer" — the tag is about a human having touched the review surface, and the ledger uses it for join semantics. (`commit_match`/eligibility are unaffected; only the `mode` tag changed.)
2. `collect-reviews.sh`/`harvest.json` picks the PRIMARY (`github-actions[bot]`) review and validates ITS commit against the head — but the SECONDARY (CodeRabbit) body it also collects is NOT commit-gated the same way. CodeRabbit auto-pauses on rapid pushes and its last review can lag the head by several commits. The harvested CodeRabbit body carries its own "Reviewing files ... between <A> and <B>" line — read it and compare <B> to the pinned head before calling it head-current.

## How to catch it
- Before writing `mode`: `gh pr view <pr> --json reviews` and check for ANY human-login review object on the head (including the author's own COMMENTED ones). Present ⇒ `live_late`.
- Before labelling any secondary (CodeRabbit) review "at head": grep its body for the "between <A> and <B>" commit line and confirm <B> == pinned head. If not, mark it STALE and rest `reviews_complete` on the head-current PRIMARY review only.

## Fix
Neither error changed the decision (both are ledger-accuracy/label fixes), but a wrong `mode` mis-tags the human-verdict join and a "head-current" label on a stale secondary review inflates apparent review coverage. Set `mode` from the presence of any human review object on the head; commit-gate every harvested review body (primary AND secondary) against the pinned head, not just the one `harvest.json` selected.
