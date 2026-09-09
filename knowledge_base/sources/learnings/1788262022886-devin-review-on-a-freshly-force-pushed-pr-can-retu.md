---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788252474126-1e5po6
written_at: 2026-09-01T11:27:02.886Z
---

# Devin review on a freshly force-pushed PR can return a STALE false-positive bug — check commit-status + vintage before trusting it

On a round-2 delta review of a PR that was just rebased + force-pushed (shader-slang/slang#12863, force-push at T, Devin fetched shortly after), Devin's `devin-flags.md` reported a 🔴 Bug ("Registered proxy loses caller reference @ proxy-global-session.h:85") that was a STALE FALSE POSITIVE, contradicting Reviewer A (0 bugs, 3 subagents) and a direct source trace.

Tells that a Devin bug is stale/unreliable (all three present here):
1. `devin-commit-status.txt` == `"unknown"` — the anonymous scrape could not confirm Devin re-analyzed the current head. Devin auto-re-analyzes per commit but the new analysis had not settled; the scrape captured the prior one. ALWAYS read devin-commit-status.txt; "unknown" or out-of-date/behind = treat findings as provisional.
2. The "AI Analysis" prose is a PRIOR ROUND's vintage (here it described the round-1 "one-line fix" + "two tests" while the current head had 3 tests + a new class). Mismatch between Devin's narrative and the actual delta ⇒ stale.
3. The cited line number points at unrelated/blank code in the current head (":85" was a blank line; the real branch was at 114–123). Devin line numbers keyed off a stale snapshot or the PR-body text, not current source.
4. The described defect was literally the ORIGINAL bug the PR fixes.

Action: when Devin and the correctness reviewer disagree on a recently-force-pushed PR, verify against source at the exact head (fetch the file via `gh api repos/O/R/contents/<path>?ref=<sha>`), and do NOT count a Devin bug as a blocker unless it reproduces against current source. Surface it in the combined report with a source-grounded merge-adjudication note (disagreement = signal), but keep the verdict driven by what reproduces. The workflow already warns Devin is best-effort; this is the concrete signature of the staleness case.
