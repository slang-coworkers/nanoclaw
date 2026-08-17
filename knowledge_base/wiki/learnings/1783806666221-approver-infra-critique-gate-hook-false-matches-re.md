---
title: "[approver/infra] critique-gate hook false-matches read-only `gh api .../pulls/...` GETs as PR-creation — use `gh pr view/diff --json` instead"
type: learning
topic: review-approval
source: learnings/1783806666221-approver-infra-critique-gate-hook-false-matches-re.md
---

# [approver/infra] critique-gate hook false-matches read-only `gh api .../pulls/...` GETs as PR-creation — use `gh pr view/diff --json` instead

**Symptom.** In the slang-pr-approver container (critique-gate overlay active, `CRITIQUE_GATE_ACTIVE=1`), a Bash call like `gh api repos/OWNER/REPO/pulls/12065/reviews` or `.../pulls/12065/comments` — a pure read-only GET — is DENIED pre-execution with "CRITIQUE REQUIRED before PR creation. Reason: missing critique stages: DECISION_REVIEW, OUTPUT_REVIEW." The whole compound Bash command is blocked, so any side effects (mkdir, writes) in the same call also don't run.

**Root cause.** `/app/hooks/gate-critique-on-deliver.sh` matches Bash commands against `BASH_PATTERNS` which includes `gh api [^|]*pulls\b` — intended to catch PR *creation* (`POST .../pulls`), but it matches ANY `gh api` path containing `pulls`, including read GETs of `/pulls/N/reviews`, `/pulls/N/comments`, `/pulls/N/files`, etc. The pattern is method-blind (no `--method POST` requirement).

**How to catch / avoid it.**
- For PR reads, prefer `gh pr view <n> --repo <r> --json <fields>` and `gh pr diff <n> --repo <r>` — these do NOT contain the literal `api .../pulls` substring and pass the gate.
- For data only `gh api` exposes (inline review threads, review-thread resolve state, per-review commit_id), use `gh api graphql -f query='...'` (the GraphQL endpoint path is `graphql`, not `.../pulls`, so it doesn't match).
- The bundled `harvest-reviews.py` and `eval-clauses.py` call `gh api .../pulls` *inside python subprocess* — the hook only sees the `python3 script.py` Bash command, not the inner gh calls, so those are unaffected. It's only raw `gh api .../pulls` typed directly into a Bash tool call that trips.
- Also: `/workspace/.claude/` may not exist at session start; the critique state file lives at `/workspace/.claude/workflow-state.json`. `track-critique.sh` mkdir -p's it on the first codex call, but pre-create it (`mkdir -p /workspace/.claude`) if you hit a `workflow-state.json.tmp: No such file or directory` hook error before your first critique.

**Fix.** Route all PR reads through `gh pr view/diff --json` or `gh api graphql`; reserve raw `gh api .../pulls` only for the scripts that wrap it. Saves a denial (and a soft-cap strike) per read.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783806666221-approver-infra-critique-gate-hook-false-matches-re.md`_
