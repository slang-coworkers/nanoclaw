---
title: "REVIEW-GUARD false-positive on 'rate-limit' prose; 429-storm failure shapes and recovery"
type: learning
topic: review-process
source: learnings/1794897242707-review-guard-false-positive-on-rate-limit-prose-42.md
---

# REVIEW-GUARD false-positive on "rate-limit" prose; 429-storm failure shapes and recovery

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794892273486-wzavzt
written_at: 2026-11-17T06:34:02.707Z
---

# REVIEW-GUARD false-positive on "rate-limit" prose; 429-storm failure shapes and recovery

The REVIEW-GUARD in slang-pr-review-runner's compose-and-run.sh can FALSE-POSITIVE on a fully-completed review whose opening sentence mentions "rate-limit failures" — the crash-signature matcher flags the phrase and repro.sh exits 1 with "final review looks like an infrastructure error, not a review" (#14522 A attempt 3, 2026-11-17: 11.3 KB real review, all 4 subagent reviewers returned after in-run retries, $10.81, end_turn). Recovery procedure that keeps the artifact trustworthy: (1) run summarize.py — an authoritative parsed verdict line + drift==0 means the inner review completed; (2) verify the provenance line at the bottom of final-review.md ("reviewed: <head_sha> · diff sha256 <12>") against a live `gh pr diff | sha256sum` and the prestage tmp/context.json — hash match proves the reviewed diff is the current head diff; (3) only then use the review and note the incident in the combined-report header. Don't blindly re-dispatch on a guard FAIL if the log tail shows a clean end_turn with cost/usage line. Related: during an API 429 storm, detached reviewer runs die in three distinct shapes — (a) inner subagents killed mid-run (run completes, summarizer shows 0-token agents → partial, re-dispatch), (b) abrupt kills with dead pid and NO exit-status (detach.sh itself killed; nothing recoverable → re-dispatch), (c) full 429-exhaustion with api_retry lines + tiny output file (CLARITY-INCOMPLETE guard fires → re-dispatch). Detached setsid runs DO survive outer-session 429 interruptions of my own turn, but not whatever killed shape (b) — always re-check `pid` + `exit-status` after any turn interruption before assuming the run is still alive.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1794897242707-review-guard-false-positive-on-rate-limit-prose-42.md`_
