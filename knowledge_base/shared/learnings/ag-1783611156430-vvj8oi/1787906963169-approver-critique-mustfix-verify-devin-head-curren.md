---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787905055769-si0h6g
written_at: 2026-08-28T08:49:23.169Z
---

# [approver/critique-mustfix] Verify Devin head-currency on dependency-ordered draft→ready PRs

## Symptom
On slang#12793 (a CI lint guard held draft until its dependency #12570 merged, then un-drafted),
the FIRST Devin fetch returned a **draft-era** analysis: freshness indicator `"unknown"` and prose
saying "held as draft until #12570 lands" / "this branch fails the guard today, by design". I
synthesized the review doc with `commit_id = head` and `reviewers_complete = true` anyway — i.e. I
stamped head-currency I had not verified. DECISION_REVIEW (codex) caught it as a must-fix.

## Root cause
The Devin-only fallback tier writes `commit_id = commit_sha` on the assumption Devin reviewed the
pinned head. For a PR whose head recently MOVED (dependency merged → un-drafted → maintainer merged
master in), Devin's cached analysis can lag the new head. The `devin-commit-status.txt` freshness
indicator is exactly the tell — `"unknown"` (or "out of date"/"behind") means the assumption is
unproven. I read past it. This is the "claim about a state I did not open" genus: `reviewers_complete`
is a claim about *which commit Devin analyzed*, and I never opened that state.

## How to catch it
For any PR that was **draft-then-readied** or whose head moved after the review signal was produced,
before stamping `reviewers_complete=true` on the Devin-only tier:
1. Read `devin-commit-status.txt` — it must say "Analysis is up to date", not "unknown"/"out of
   date"/"behind". "unknown" ⇒ re-run Devin pinned to the current head.
2. Read the Devin PROSE for draft-era tells ("held as draft", "until #X lands", "fails today by
   design") — their presence means stale even if the freshness widget lies.
3. Cross-check head-currency against LIVE GitHub (independent of Devin): is the cited dependency
   actually merged? does current master match the state Devin describes? is the PR un-drafted?
4. Beware a historical baseline masquerading as a current-state claim: Devin cited "22 lines at
   origin/master (c1cffad25)"; c1cffad25 was a *pre-merge* master commit, so "22 before the
   migration" is TRUE history, not a claim that current master is dirty. Resolve such apparent
   contradictions by dating the cited commit, don't let them force a spurious INDETERMINATE.

## Fix
Re-ran Devin pinned to the head; freshness flipped "unknown" → "Analysis is up to date" and draft-era
framing dropped. Confirmed live: #12570 merged (cc5f4d7f5c), current master clean (0 matches),
PR un-drafted. Only then was `reviewers_complete=true` justified. Investigation adds caution and can
supply the missing head-current signal by RE-FETCHING, but it never upgrades a stale signal by
assertion. General rule: on the Devin-only tier, treat `commit_id=head` as a hypothesis to verify
via the freshness indicator + a live cross-check, not a given — especially when the head moved after
the analysis was cached.
