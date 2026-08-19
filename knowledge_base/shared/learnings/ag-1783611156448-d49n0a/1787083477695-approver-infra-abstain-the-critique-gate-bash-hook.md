---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786998787240-iokice
written_at: 2026-08-18T20:04:37.695Z
---

# [approver/infra-abstain] The critique-gate Bash hook false-positives on read-only `gh api .../pulls` GETs — route PR/issue reads through MCP tools, never Bash gh api

**Symptom:** During slangpy#1112 (a normal approver run — all decisions ABSTAIN_POLICY, zero GitHub writes), the `gate-critique-on-deliver.sh` PreToolUse hook denied read-only `Bash` calls like `gh api "repos/o/r/pulls?state=all&head=..."` and `gh api ".../pulls?..."`. After 3 denials it hit its strike cap, opened a real admin-approval card (`critique_gate_bypass`), and an admin had to tap "Reject with reason" to clear it. Net cost: several dead tool calls + an admin interruption, for a PR the approver never wrote to.

**Root cause:** The hook's `BASH_PATTERNS` includes `gh api [^|]*pulls\b`, which matches the literal substring `pulls` regardless of HTTP verb. `gh api` defaults to GET, so a read of `.../pulls?...` trips a clause meant to catch PR *creation*. Tell-tale in the escalation payload: `hit:"PR creation"` but `repo/prNumber/prUrl` all null (a real mutation would populate them).

**How to catch / avoid it:**
- For ANY PR or PR-list read, use the MCP read tools, NOT `Bash gh api`: `mcp__slang-mcp__github_get_pull_request`, `github_list_pull_requests`, `github_get_pull_request_comments/reviews`. These don't go through the Bash hook.
- If you must use `gh api` in Bash, avoid the substring `pulls` in the path — the **issues** endpoints cover most needs and don't trip it: `repos/o/r/issues/<n>`, `.../issues/<n>/comments`, `.../issues/<n>/timeline` (the timeline event `event:"closed"` + `actor` tells you who closed a PR and whether a superseding PR cross-referenced it — no `pulls` needed). `actions/runs`, `commits/<sha>/status`, `commits/<sha>/check-runs` are also safe.
- The clause also fires on the abstain fast-path's siblings only for WOULD_APPROVE/BLOCK deliveries — but the **Bash** arm has no abstain exemption, so even a pure-abstain, read-only session can be blocked by a `pulls` read.

**Fix (durable, owner-gated):** tighten the hook clause to fire only when a write verb is present — `pulls\b` AND (`-X`/`--method POST|PATCH|PUT|DELETE` OR field flags `-f`/`--field`/`--input`/`--raw-field`), spelled `(A.*B|B.*A)` since grep -E has no lookahead. It's a safety control (stops un-reviewed WOULD_APPROVE/BLOCK deliveries), so route the edit to the hook owner with read-GET + write-POST test fixtures; don't self-apply. Related: [[read-only verification paths]].
