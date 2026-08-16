---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1784269307766-ml7a4j
written_at: 2026-08-14T08:02:10.901Z
---

# [approver/clause-gap] CodeRabbit's formal review OBJECTS and its recent-review SUMMARY comment are DIFFERENT collections with different currency — harvest exit 10 keys on the review objects and misses a head-current clean summary

## Symptom
On slang-rhi#797 (re-gate at head `3044352d` after a rebase), `collect-reviews.sh`/`harvest-reviews.py` returned **exit 10 (stale-only)** because CodeRabbit's two formal REVIEW OBJECTS (reviews API) were posted against the OLD head `b34042ac`. I wrote "CodeRabbit reviews are stale and ignored" across the decision artifacts. Codex OUTPUT_REVIEW flagged it: CodeRabbit's **recent-review SUMMARY comment** had been refreshed post-reopen and explicitly covered the current-head interval (`coderabbit-review.md:75`: "between b34042ac and 3044352d") reporting **"No actionable comments were generated"** (`:54`) — a head-current CLEAN signal I had discarded.

## Root cause
CodeRabbit emits its verdict through (at least) two distinct GitHub surfaces:
- **Review objects** (`pulls/N/reviews`) — the formal "Actionable comments posted: N" reviews, each pinned to the commit it was submitted against. These go stale on a rebase.
- **The walkthrough / recent-review SUMMARY issue-comment** — CodeRabbit EDITS this in place as new commits land; it states the interval it just reviewed and whether it found actionable comments. It can be head-current even when every formal review object is stale.

`harvest-reviews.py`'s staleness check keys on the review OBJECT's `commit_id`, so exit 10 correctly means "no head-current review OBJECT" but says nothing about the summary comment's currency. This is the same collection-scoping trap as "newest non-bot comment is null" (a `null` in one GitHub collection says nothing about the others) — applied to CodeRabbit's own two surfaces.

## How to catch it
On a fallback-tier re-gate with harvest exit 10, before concluding "CodeRabbit stale/ignored", read `review/coderabbit-review.md` for the `recent_review` / walkthrough block: grep for the current head SHA and "actionable comments". If the summary covers the current-head interval, that is a head-current signal — cite it as such.

## Fix
Distinguish "stale review objects" from "head-current summary" in every audit surface. On #797 this turned a claimed inspection-only basis into TWO head-current clean signals (Devin re-run 0/0 + CodeRabbit summary "no actionable comments") + real-HW CI. Don't call CodeRabbit "stale" wholesale off exit 10 alone.
