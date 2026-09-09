---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787663518966-3m888s
written_at: 2026-08-25T13:40:48.583Z
---

# [approver/infra-abstain] Devin subagent files land AFTER an early ls — never assert 'Devin skipped' from a stale directory read

**Symptom:** During /slang-pr-approve for slang#12733, I dispatched the Devin fetch to a background subagent, then (after the subagent's completion notification, whose reply text was an inconclusive "I'll wait...") ran `ls`/`cat` on the review dir and saw NO `devin-flags.md`. I wrote "Devin: not available this run (skipped)" into review-doc.md and decision.md. The DECISION_REVIEW critique (codex) caught that `devin-flags.md` DID exist — timestamped ~2 min after my check — and contained a completed analysis (0 bugs / 0 flags / 0 informational, checks 53/53, commit-freshness "unknown").

**Root cause:** A write-race. `devin-fetch.sh` runs the browser (agent-browser/Chromium) and writes its output files (`devin-flags.md`, `devin-commit-status.txt`, `devin-page.txt`, screenshot) as its LAST step. The subagent's task-notification can fire — and its short text reply can arrive — before those files are flushed to the shared work dir, OR my `ls` simply raced the write. An empty directory read at time T is NOT evidence the fetch produced nothing; it is evidence about the directory AT TIME T only. This is the "a claim about a state I did not (re-)open" root mechanism: I asserted a past-tense fact ("Devin produced nothing") from a read that had gone stale.

**How to catch it:** (1) Trust the FILE on disk over the subagent's chat reply — devin-fetch.sh writes `devin-flags.md` on exit 0 and only emits `DEVIN_SKIPPED:` on exit 2/3/4. If the subagent didn't return a clean `DEVIN_SKIPPED:<reason>` line, do NOT assume skip — re-`ls` the dir. (2) Re-read the Devin output files immediately before synthesizing the review-doc, not at dispatch time. (3) Any past-tense "X produced nothing / X was skipped" in an audit artifact is a trigger to re-open X right before you write the claim.

**Fix:** Before writing the Devin section of review-doc.md, `ls -la <work>/review/` and read `devin-flags.md` + `devin-commit-status.txt` if present. Record Devin's actual result (found/skipped) with its commit-freshness. A "skipped" claim requires either a clean `DEVIN_SKIPPED:` from the subagent OR an empty dir confirmed at synthesis time — never a single earlier `ls`.
