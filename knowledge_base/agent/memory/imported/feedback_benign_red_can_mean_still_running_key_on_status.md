---
name: feedback_benign_red_can_mean_still_running_key_on_status
description: "\"Red but benign\" often describes a SUPERSEDED attempt while a new one is mid-flight. `conclusion` is EMPTY in flight, so classify on `status` first; and reconcile rows_counted == total_count or the sweep is short"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 74bd0427-6442-4f24-8daf-b9fa0bb445f8
---

⛔ **MEASURED 2026-08-06 on shader-slang/slang#12309.** A fixer reported: approved at HEAD, *"the red
CI run is the known benign draft priority-yield (33 build jobs skipped), not a failure"*, and closed
with **`next-action: none`**. The cause-story was right. The **state** was wrong: that job set belonged
to the **superseded** first attempt, and a second attempt was **running at that moment** — 8
`in_progress` + 2 `queued` when I swept, 12 `in_progress` when they re-swept minutes later.

## The field-selection error
`conclusion` is **EMPTY while a run is in flight.** So a sweep that only groups by `conclusion` cannot
distinguish *unfinished* from *finished-with-no-result* — both read as "not success," and a skipped-heavy
tally then invites the story "benign skips." **Key on `status` first** (`completed` vs
`in_progress`/`queued`), and only then read `conclusion` within the completed set.

```bash
# complete tally, both axes, explicit pagination (total_count routinely > 100)
gh api "repos/<o>/<r>/commits/<sha>/check-runs?per_page=100"        --jq '{total:.total_count, listed:(.check_runs|length)}'
gh api "repos/<o>/<r>/commits/<sha>/check-runs?per_page=100&page=2" --jq '.check_runs[]|"\(.conclusion // .status)\t\(.name)"'
```

## Three merge-relevant distinctions this collapsed
⭐⭐⭐ **"red but benign", "green", and "pending with nothing failed yet" are three different merge
inputs.** The first says ignore the signal; the second says the signal came back clean; the third says
*there is no signal yet*. Reporting the third as the first tells a maintainer to merge on a run that
hasn't finished. **Zero failures is not zero unfinished jobs** — the sibling of
"zero test jobs is not zero failures," on the unfinished axis rather than the skipped axis.

⚠️ **`next-action: none` on a live run deletes the watcher.** A pending external process has a real
resume trigger (the last job landing); closing the chain on the current snapshot means nobody holds it.
Per [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]] — set the fallback when you set
the gate. The fixer re-armed a background watcher with a 2h ceiling once the chain was held open.

⚠️ **`mergeStateStatus: BEHIND` is invisible in a checks sweep** and was unreported. Read it from
`gh pr view --json mergeable,mergeStateStatus` alongside `reviewDecision`/`isDraft`; it's maintainer-gated
(don't push an approved branch to fix it) but a merger must know an update-branch step may be needed.

## Instrument guard — a short fetch must not read as settled
⭐⭐ **My own first sweep died on a OneCLI **401 mid-`--paginate`**, silently returning a partial set with
rc=0.** I only caught it because the error text landed inside the output. ⇒ **Reconcile
`rows_counted == total_count` and retry on mismatch**, never trust a truncated sweep — and note the count
moves under you (105 → 109 within minutes on a live run), so a *stale complete* sweep is also not settled.
Cross-check: [[feedback_filter_latest_returns_two_suites_per_sha]] (classification and currency are
independent).

✅ **What the check bought:** approval was genuinely non-stale (`jkwak-work` at exactly the current HEAD),
zero `failure` conclusions across the full set — so the fixer's *cause* analysis held. Only the
finality claim failed. **Confirm the parts that hold; correct only the part that doesn't.**
