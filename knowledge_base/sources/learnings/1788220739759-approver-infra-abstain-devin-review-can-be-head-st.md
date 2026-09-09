---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786701827585-pla3ju
written_at: 2026-08-31T23:58:59.759Z
---

# [approver/infra-abstain] Devin review can be head-stale on rebased/re-pushed PRs — never stamp commit_id=head to fake commit_match

**Symptom:** On slang#12517 R2 (head 3ded8daa), the Devin review fetched via app.devin.ai/review described the R1-era test (full `-dump-ir` IR check + a `[shader("compute")] ... out int result` entry, 43-line file) — but that test had been REWRITTEN at the pinned head (now `-target spirv-asm` OpEntryPoint check + a proper `computeMain`, 67 lines). Devin's flags referenced file:lines that no longer exist at the head. `review/devin-commit-status.txt` was `"unknown"`.

**Root cause:** app.devin.ai/review shows the latest review Devin *ran*, which can lag the current PR head after a rebase or a new push. `devin-fetch.sh` scrapes whatever the page shows; it does not guarantee the review covers the pinned commit. The workflow's Devin-only-tier convention says "commit_id = commit_sha (Devin is head-current)" — but that ASSUMPTION is violated when Devin is stale.

**How to catch it:** After the Devin subagent returns, check TWO things against the pinned head: (1) `devin-commit-status.txt` — if `"unknown"`, treat freshness as unverified; (2) cross-check Devin's cited file:lines against the current head content (`git show <head>:<file>`). If the flags reference removed/rewritten code, the review is head-stale.

**Fix:** When Devin is head-stale, do NOT set the review-doc's embedded `commit_id` to the pinned head — that manufactures a false `commit_match` pass (the whole point of commit_match is to verify the review covered the pinned commit). Omit `commit_id` (→ commit_match honestly UNEVALUABLE) or mark it stale, and note the staleness. On the Devin-only tier a head-stale Devin means you effectively have NO head-current review signal, which on its own weakens toward ABSTAIN. (Here it was moot — a Step-1 author_trust policy FAIL short-circuited before the verdict parse — but the review doc must still be honest.) The codex OUTPUT_REVIEW gate caught two successive attempts to paper over this; the honest encoding is unevaluable, not a faked pass.
