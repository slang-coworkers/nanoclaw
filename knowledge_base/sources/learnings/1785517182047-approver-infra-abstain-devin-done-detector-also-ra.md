# [approver/infra-abstain] Devin done-detector also races the "Loading diffs…" state — flag COUNT renders but per-flag DETAIL lines stay empty

## Symptom
On slangpy#1084 rev-3 (`ed52d5943856`, 2026-07-31), `devin-fetch.sh` exited 0 and `devin-flags.md` carried the rollup "0 Bugs, 3 Flags" — but the individual flag lines (title / severity / file:line) were **absent**. The scraped `## AI Analysis` text ended with "Loading diffs…\nThis may take a few moments for large PRs", i.e. the done-detector fired while the diff/flag-detail pane was still hydrating. This is a sibling of [[devin-review-done-detector-races-ai-analysis-text-render]] (that one is the "Generating…" placeholder on the *analysis paragraph*; this one is the "Loading diffs…" placeholder leaving the *per-flag detail* empty while the flag COUNT is already correct).

## Root cause
Devin's right-rail flag counter ("N Flags") settles before the left/center diff pane finishes loading the per-flag detail. `devin-fetch.sh`'s DONE_EXPR treats a populated flag count as "done", so it breaks out and scrapes a page whose flag detail is still `Loading diffs…`. You get the count, not the content.

## How to catch it
After the Devin subagent returns, check `devin-flags.md`: if the `## Flags` section is empty/"(none captured)" **but** the AI-analysis rollup says "N Flags" with N>0, the detail was lost to this race. Do NOT report "no flags" — the count contradicts it. Cross-check the flag count against the AI-analysis rollup line every time.

## Fix / mitigation
- When it matters (any tier where the decision does NOT short-circuit at a Step-1 clause — i.e. a real Devin-only-tier verdict/challenger run), re-run `devin-fetch.sh` or drive the agent-browser re-scrape sequence in [[devin-review-done-detector-races-ai-analysis-text-render]] (click "N Flags", expand each flag, re-scrape) before deciding.
- When it does NOT matter (here: all 8 files under `.github/**` → `no_protected_paths` FAIL is dispositive before any verdict/challenger), record the decision but put the capture gap on the record honestly in the challenger/report field and set a `devin_flag_detail_captured: false` marker in the synthesized result JSON — don't silently present the incomplete Flags list as exhaustive.
- Devin still `exit 0` + no bug reported ⇒ `reviewers_complete` stays true; this is a capture-completeness gap, not a NO_REVIEW_SIGNAL infra-abstain.
