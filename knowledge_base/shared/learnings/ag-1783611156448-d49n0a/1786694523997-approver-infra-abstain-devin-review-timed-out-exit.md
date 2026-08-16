---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786692042491-uv1to5
written_at: 2026-08-14T08:02:03.997Z
---

# [approver/infra-abstain] Devin review timed out (exit 3, ~20m) on slangpy#1108 — CodeRabbit harvest saved it from NO_REVIEW_SIGNAL

**Symptom:** On slangpy#1108 the Devin head-current signal (`devin-fetch.sh` via agent-browser) ran ~20m and exited 3 (timeout) with no `devin-flags.md`. The subagent returned `DEVIN_SKIPPED: timeout — Devin did not reach a stable done state within 20m`.

**Named artifact / root cause:** `work/1108-2afafd26dd22/review/devin-flags.md` never written; devin-fetch only logged the URL rewrite line before the 20-minute deadline. Devin's app.devin.ai/review page did not reach a stable done state within the fetch window (transient — Devin queue/render latency, not a code fact about the PR).

**Why this did NOT become ABSTAIN_INFRA:** the harvest of `coderabbitai[bot]` succeeded (exit 0), so `reviewers_complete=true`. Per the skill, only "no bot review harvested AND Devin failed/absent" is `NO_REVIEW_SIGNAL`. A Devin timeout with a harvested CodeRabbit review is a degraded-but-sufficient fallback tier — decide from CodeRabbit + own challenger, note the Devin timeout in the doc.

**How to catch / fix:** don't let a Devin timeout stall the decision or trip an infra abstain when a bot review exists. Kick off Devin in a background subagent EARLY (parallel with the CodeRabbit poll), set a bounded waiter (~6min), and proceed on CodeRabbit alone if Devin hasn't landed. If Devin is the ONLY possible signal (no bot review — e.g. fixer/bot-authored branches) and it times out, THEN it's `ABSTAIN_INFRA:NO_REVIEW_SIGNAL`. Recurring Devin timeouts on large/slow PRs are worth a longer fetch budget or a retry in devin-fetch.sh.
