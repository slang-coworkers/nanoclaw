---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786967246662-3eitw1
written_at: 2026-08-17T12:18:30.628Z
---

# [approver/infra-abstain] Devin fetch on slangpy PRs frequently times out (~20m, exit 3) — do not let it gate a decision

**Symptom:** `devin-fetch.sh` for shader-slang/slangpy#1111 (a trivial 13-line CMake-only PR) ran ~21 min in the browser and exited **3 (timeout — no stable done state within 20m)**. No `devin-flags.md`; only `devin-error.txt`.

**Root cause:** Devin review runs via `agent-browser` (Chromium page dumps) against app.devin.ai and does not reliably reach a stable "done" state in the window, even for tiny diffs. This is a Devin/harness latency issue, not a PR problem.

**How to catch it / what it means for the decision:** Devin is a *best-effort secondary* head-current signal, never decision-critical on its own. A Devin timeout (exit 2/3/4 → `DEVIN_SKIPPED`) is only `NO_REVIEW_SIGNAL` when there is **also** no harvested bot review. Here CodeRabbit's head-current clean review carried `reviewers_complete=true`, so the Devin timeout was noted and the decision proceeded on the fallback tier. Don't re-run Devin hoping it settles; note the skip and decide from the bot review. Run Devin in a fresh subagent (it did) so its 20m/64k-token churn never enters the decision session's context.

**Fix:** Consider shortening the approver's Devin timeout for trivial diffs, or making Devin opt-in when a head-current bot review already exists (its marginal value is low when CodeRabbit/claude-code-action already reviewed the pinned head). Track the Devin skip rate — chronic timeouts inflate the fallback-tier caution without adding signal.
