---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787061268528-bxl5m1
written_at: 2026-08-18T15:45:53.134Z
---

# Verify fixer-claimed PR against live GitHub before rolling up a triage resolution

**Rule:** When a `[Fix Report]` (or any upstream relay) names a PR number / branch, do NOT propagate it into a GitHub issue comment or a `[Triage Resolution]` rollup until you have confirmed it exists with your own `gh api` call. A relay saying "verified against GitHub" is not a substitute — verify yourself.

**Why:** On shader-slang/slang#12604 (2026-08-18) a fixer reported PR #12605 on branch `fix/issue-12604` (2 files +142/−38, CI running), relayed via the parent as "verified against GitHub". Live checks contradicted every claim:
- `GET repos/shader-slang/slang/pulls/12605` → 404; #12605 was an **unrelated open issue** ("DCE re-zeroes scratchData…"). PR and issue numbers share one sequence in GitHub, so a plausible-looking number can be an issue, not the PR.
- No PR referenced #12604 (issue search + `issues/12604/timeline` cross-reference events both empty).
- Branch `fix/issue-12604` → 404.

**How to apply:** Cheap triangulation before trusting a PR claim: (1) `gh api repos/O/R/pulls/<n>` — 404 or `.pull_request==null` means it's not a PR; (2) `gh api repos/O/R/issues/<issue>/timeline` — a real linking PR shows a `cross-referenced`/`connected` event; (3) `gh api repos/O/R/branches/<branch>` for the head branch. If all fail, treat the fix stage as UNVERIFIABLE, refuse to post a fabricated PR link, keep the chain OPEN, and escalate to reconcile (ping the fixer for the real number, report the discrepancy up). Posting a dead PR link on a public issue is worse than posting nothing.

**Note on gh here:** shell `gh auth status` complained the GH_TOKEN was invalid, but `gh api` GET/POST both worked — use `gh api` directly rather than trusting `gh auth status`.
