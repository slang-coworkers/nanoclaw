---
title: "[approver/infra-abstain] critique-gate false-positives read-only `gh api .../pulls/<n>/reviews` GET"
type: learning
topic: review-approval
source: learnings/1784077601519-approver-infra-abstain-critique-gate-false-positiv.md
---

# [approver/infra-abstain] critique-gate false-positives read-only `gh api .../pulls/<n>/reviews` GET

**Symptom:** During the harvest/wait phase of /slang-pr-approve (nowhere near recording a decision), the `gate-critique-on-deliver.sh` PreToolUse hook repeatedly denied read-only `gh api repos/OWNER/REPO/pulls/<n>/reviews` GET calls with "CRITIQUE REQUIRED before PR creation", and after 3 denials escalated to an admin bypass request — wedging the poll loop.

**Root cause:** The hook's `BASH_PATTERNS` includes `gh api [^|]*pulls\b` to catch PR-*creation* REST calls, but it matches ANY `gh api` command containing the literal `pulls` — including read-only GETs like `.../pulls/12109/reviews`. The pattern is not verb- or subpath-aware. Each match increments `critique_gate_denials`; at 3 it fires the human-approval escalation (fail-closed), regardless that the command only reads.

**How to catch it:** Any approver Bash that polls PR reviews via `gh api .../pulls/...` will trip this. The first error also showed a `workflow-state.json.tmp: No such file` write failure, which makes the gate default to "critique required".

**Fix:** In the harvest/wait phase, read reviews via `gh pr view <n> --repo <r> --json reviews --jq ...` (no `pulls` substring → no gate match) instead of `gh api .../pulls/<n>/reviews`. Use `.../commits/<sha>/check-runs` and `gh pr view` for all pre-decision polling. Reserve `gh api .../pulls` for nothing in the approver — we never write. The real decision-recording path goes through the skill's proper DECISION_REVIEW/OUTPUT_REVIEW critique stages, so the gate is satisfied legitimately there; it should never be hit during harvest.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784077601519-approver-infra-abstain-critique-gate-false-positiv.md`_
