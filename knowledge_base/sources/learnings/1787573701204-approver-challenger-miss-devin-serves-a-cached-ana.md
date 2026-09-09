---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786749174835-feop8m
written_at: 2026-08-24T12:15:01.204Z
---

# [approver/challenger-miss] Devin serves a CACHED analysis of an OLD revision — check commit-status + diff-shape before trusting it

**Symptom:** On PR #12548 R2 (a `synchronize` that RE-SCOPED the PR from a 2-file `[ForceUnroll]` source change to a 1-file test-only diff at new head 715dec4e), the Devin re-run returned a stale CACHED analysis of the R1 revision. `devin-flags.md` looked clean (0 bugs/0 flags), so I synthesized a WOULD_APPROVE review-doc with `reviewers_complete:true, commit_id:715dec4e`. On the **Devin-only tier that Devin run is the SOLE review signal**, so a stale one silently fabricates a head-current signal that never existed. The DECISION_REVIEW critique (codex) caught it; I confirmed it from the artifacts.

**Root cause:** `devin-fetch.sh` scrapes whatever Devin currently shows, and Devin can still be displaying a prior revision's analysis. Tells, all present here:
- `devin-commit-status.txt = "unknown"` (Devin never pinned the head; a fresh run reads "Analysis is up to date").
- The page's **commit cards / files-changed** showed the OLD shape: two cards, `+1` to `hlsl.meta.slang` and a `+44` test — but the real R2 head is 1 file, `+40`, test-only. (R1 test = 44 lines, R2 test = 40 lines — a cheap discriminator.)
- Devin's nits cited a `TEST_INPUT` block at `:10-13` that does not exist in the R2 test.

**How to catch it:** On the Devin-only tier, before trusting `devin-flags.md`, cross-check that the analysis reflects the pinned head: (1) read `devin-commit-status.txt` — anything other than "Analysis is up to date" (esp. "unknown"/"out of date"/"behind") is a red flag; (2) compare Devin's reported files-changed / diff-size against `gh pr view --json changedFiles,additions,deletions` at the pinned head; (3) if the PR was re-scoped (title/diff-shape changed vs a prior revision), assume the first scrape may be cached. On mismatch, ARCHIVE the stale artifacts and RE-RUN Devin, verifying head-currency in the subagent's reply (`HEAD_CURRENT: yes` + commit-status line). If it stays stale → **ABSTAIN_POLICY:STALE_STAGE** (per the skill; a stale sole-signal is not a WOULD_APPROVE, and a human approval on the same head does NOT substitute for a head-current review signal).

**Fix (transferable):** Treat "Devin returned exit 0 and clean" as necessary-but-insufficient on the Devin-only tier — the freshness of the scrape is a separate, mandatory check. Have the Devin subagent assert head-currency (commit-status + diff-shape match) as part of its contract, not just "exit 0". This is the STALE_STAGE analogue of the harvest-staleness (exit 10) branch, but for the Devin path where nothing else flags it.
