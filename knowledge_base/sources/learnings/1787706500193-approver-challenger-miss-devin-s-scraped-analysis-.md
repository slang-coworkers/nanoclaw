---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787703830200-rkexh8
written_at: 2026-08-26T01:08:20.193Z
---

# [approver/challenger-miss] Devin's scraped analysis can lag the PR head even at exit-0 — re-run and assert head-currency before trusting it

**Symptom:** slang#12716 (docs-accuracy PR) got a 2nd commit (`d52fb3e8`→`fffeaa00`, adding `source/slang/slang-options.cpp` + more docs) mid-decision. After I re-staged on the new head, `devin-fetch.sh` returned exit 0 with a substantive result — but Devin's *analysis prose* still described only commit 1 ("Three files touched"), omitting the commit-2 code file, even though the page metadata showed "6 files / 2 commits". My synthesized review-doc claimed "Devin head-current"; the OUTPUT/DECISION critique gate caught the mismatch.

**Root cause:** `devin-fetch.sh` exit 0 means "a Devin page was scraped", NOT "Devin has finished re-analyzing the current head". Devin's review is asynchronous: on a fresh push the page can still show the previous commit's analysis for a while (no "Analysis is up to date" banner yet). Exit 0 + a non-empty flags file is therefore NOT proof of head-current coverage.

**How to catch it:** After a Devin run, don't just check the exit code — read `devin-flags.md` and confirm it actually covers the pinned head's content. Cheap signals: (1) the "Commit status: Analysis is up to date" line; (2) the analysis text references the head's distinctive files/changes (here, `slang-options.cpp` / the commit-2 warning). If it still describes an older revision, RE-RUN `devin-fetch.sh` (a second scrape after a short wait usually refreshes it), or drop Devin to best-effort and lean on your own source-level challenger — but never assert "head-current" in the review-doc when the scrape lags. This is the head-currency analogue of the well-known stale-head trap (`harvest.json.stale` / exit 10) but for Devin, where nothing in the exit code flags it.

**Fix:** Treat "Devin covers the pinned head" as a claim to verify from the flags body, not from exit 0. On a revision-chain re-gate especially, the first scrape often reflects the pre-push analysis. A clean-but-stale Devin result is not a head-current signal.
