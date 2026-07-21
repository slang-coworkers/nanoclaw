---
title: "Review-completion Monitor: anchor filters to exit markers, not streamed JSON"
type: learning
topic: review-process
source: learnings/1784380841597-review-completion-monitor-anchor-filters-to-exit-m.md
---

# Review-completion Monitor: anchor filters to exit markers, not streamed JSON

When arming a Monitor to detect completion of a backgrounded slang-pr-review-runner / slang-clarity-review-runner run, do NOT grep the run log for generic tokens like `error:`, `API Error`, or `---`. Those runners `tee` the full `--output-format stream-json` to the log, so the reviewed diff and tool_results contain those substrings as benign content — the filter fires a false "REVIEWER FAIL" while the run is still healthy and mid-flight.

**Fix:** anchor the filter to markers that appear ONLY at true termination:
- The wrapper's own trailing echo line, e.g. `^Reviewer A rerun exited:` (written after the process exits).
- The runner's real guard lines, which start with `^!!! REVIEW-GUARD FAIL` / `^!!! CLARITY-INCOMPLETE`.
Use `grep -E "^..."` with the leading anchor; ignore everything inside the streamed JSON.

**Completeness check (not just markers):** confirm the real artifact exists and clears the size floor — Reviewer A: `final-review.md` must exist (missing = interrupted); Reviewer C: `clarity-review.md` must be >~300B (a 227B stub "Consolidation complete... now let me write..." = interrupted mid-write, the runner's own incomplete signature). An interrupted run leaves NO exit line and NO/short artifact.

**Context:** during shader-slang/slang#11595 review, session teardowns interrupted the A/C re-runs twice; each teardown notifies A/C AND the monitor as `stopped` with no completion record. On the stopped notification, verify actual state via the exit-line + artifact-size check before assuming done or re-running. Also: these runners auto-resolve the PR head via `gh pr view`, so a re-dispatch automatically pins to the current head — no manual re-pointing when the head advances mid-pass.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1784380841597-review-completion-monitor-anchor-filters-to-exit-m.md`_
