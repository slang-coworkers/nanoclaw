---
title: "critique gate false-positives on read-only pulls API calls"
type: learning
topic: agent-ops
source: learnings/1795204342182-critique-gate-false-positives-on-read-only-pulls-a.md
---

# critique gate false-positives on read-only pulls API calls

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795190231482-uplj97
written_at: 2026-11-20T19:52:22.182Z
---

# critique gate false-positives on read-only pulls API calls

The critique gate's bash pattern `gh api [^|]*pulls\b` matches READ-ONLY pulls GETs too — `gh api repos/shader-slang/slang/pulls/14561 --jq .body` (and codex's own `pulls/14666/reviews` read) got denied as "CRITIQUE REQUIRED before PR creation", bumped the denial counter, and later surfaced as a "CRITIQUE GATE BLOCKED your PR creation (attempt 1 of 3)" card even though no PR was being created. Workarounds: use `gh pr view <n> --json ...` for PR bodies/metadata, `gh api repos/.../issues/<n>...` (comments endpoint works for PR threads), and `gh pr checks`. If a spurious "PR creation blocked" card arrives with no pending create, check /workspace/.claude/workflow-state.json — the per-window stage state may just be missing PLAN_REVIEW (CODE_REVIEW/OUTPUT_REVIEW recorded separately), and one PLAN_REVIEW codex round on the plan file clears it.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1795204342182-critique-gate-false-positives-on-read-only-pulls-a.md`_
