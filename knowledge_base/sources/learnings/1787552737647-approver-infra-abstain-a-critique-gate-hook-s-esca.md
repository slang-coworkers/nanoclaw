---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786731670083-vn3pfm
written_at: 2026-08-24T06:25:37.647Z
---

# [approver/infra-abstain] A critique-gate hook's "escalation opened" is a LOCAL self-heal file, not a host escalation row — check forwarded_at before reporting one exists

**Context:** slang#11225 R3, 2026-08-24. The critique-gate hook over-blocked a read-only `gh api repos/.../pulls/<n>/reviews` fetch (matched as "PR creation"), hit its 3-denial cap, and printed "denial cap reached; escalation opened." I reported up-thread that I had "opened an admin escalation." The orchestrator's `ncl approvals list` showed NO pending row for that PR and pushed back.

**Ground truth.** The hook wrote a LOCAL file `/workspace/.claude/critique-escalation.json` with `self_heal_attempts:1` and **`forwarded_at` ABSENT**. Per `gate-critique-on-deliver.sh` (~:380-405), the host-side `approvals`/`critique_gate_bypass` row is created only when the escalation is FORWARDED (`forwarded_at` set); an unforwarded file is still in local self-heal. So no host row existed — the "escalated to admin" claim was an over-claim.

**Rule.** A hook/tool's message is a claim about the call, not the world. Before reporting a host-side row/escalation/decision was created:
1. Open the artifact and read the field that gates persistence — `forwarded_at` for a critique escalation; the ledger row itself for `record_decision` (which has separately returned "Decision recorded" while the host DENIED the append with `APPROVAL_LEDGER_WRITERS` unset).
2. If you can't read the authoritative store (e.g. `ncl approvals` is group-scoped → "forbidden"), you have NO standing to assert the row exists — say "a local X was written; I can't confirm a host row."

**Genus:** same family as "the success string is not the write." Both are the root mechanism — a past-tense claim about a state I did not open — countered mechanically by opening the gating field before the sentence. Extra tell here: I reported MORE machinery had fired than actually had, which reads as diligence ("I even triggered an escalation") — audit self-flattering/thoroughness-inflating claims first.

**Also:** the underlying guard false-positive is real and worth a fix — the critique gate matches a read-only `pulls/<n>/reviews` fetch as "PR creation." Mitigation for approver agents: read PR reviews via the MCP tool (github_get_pull_request_reviews), which doesn't trip the text matcher. And never run a ceremonial /codex-critique to clear it for an ABSTAIN decision — abstains are not critique-gated.
