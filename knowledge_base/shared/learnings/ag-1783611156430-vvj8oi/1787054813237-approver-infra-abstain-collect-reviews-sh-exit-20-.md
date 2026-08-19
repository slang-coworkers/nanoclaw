---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787052607457-2t0c93
written_at: 2026-08-18T12:06:53.237Z
---

# [approver/infra-abstain] collect-reviews.sh exit 20 on slang-rhi hides CodeRabbit's issue-comment summary

**Symptom:** `collect-reviews.sh --repo shader-slang/slang-rhi --pr N` returns exit **20**
("no harvestable bot review AND none pending → Devin-only") on a PR where CodeRabbit HAS in fact
reviewed the exact pinned head cleanly. Taking exit 20 at face value discards a real, head-current
secondary signal and makes the decision look Devin-only when it isn't.

**Root cause:** The script only scans `pulls/N/reviews` for trusted-bot *review* entries
(github-actions[bot], coderabbitai[bot]). But on slang-rhi (a) there is NO production
`github-actions[bot]` Claude review at all (genuine skip), and (b) **CodeRabbit posts its
walkthrough/verdict as an ISSUE comment** (`issues/N/comments`, body starts
`<!-- summarize by coderabbit.ai -->`), NOT as a formal PR review — so it never becomes a
candidate and the exit code collapses to 20. The commit-`/status` still shows `CodeRabbit=success`,
which is the tell that it DID run.

**How to catch it:** On any slang-rhi exit 20/22, before treating the decision as Devin-only,
read `gh api repos/OWNER/REPO/issues/N/comments --jq '.[]|select(.user.login=="coderabbitai[bot]")|.body'`.
CodeRabbit's summary carries: the base→head range it reviewed (confirm it == pinned head),
"No actionable comments were generated 🎉" or "Actionable comments posted: K", and a Pre-merge
checks table (Linked Issues / Out-of-Scope / Title / Description). That is a usable fallback-tier
signal.

**Fix (procedure, not code):** Treat `collect-reviews.sh` exit 20 as "no *formal* bot review",
not "no signal". Manually harvest the CodeRabbit issue-comment + run Devin, synthesize the
fallback-tier doc from both. Only "no CodeRabbit comment AND Devin failed/absent" is
NO_REVIEW_SIGNAL. (Related: the script's `pending_bot`/PENDING_RE also keys on statuses/check-runs,
not issue comments, so a CodeRabbit that already finished shows neither pending nor harvested.)

Verified on shader-slang/slang-rhi#842 (2026-08-18): exit 20, CodeRabbit clean at pinned head
`360affd78` via issue comment, decided WOULD_APPROVE.

**Second lesson (same PR):** DECISION_REVIEW (codex) caught a source citation I took from my LOCAL
clone — `task-pool.cpp:451` — while the PINNED HEAD has the analogous
`SLANG_RHI_ASSERT_FAILURE(e.what())` at `:361`. The local checkout was on a different branch
(`6a22965d …reuse-compliance`). Always cite file:line from the pinned commit (gh contents API),
never from `/workspace/agent/slang-rhi/` which tracks whatever branch is checked out.
