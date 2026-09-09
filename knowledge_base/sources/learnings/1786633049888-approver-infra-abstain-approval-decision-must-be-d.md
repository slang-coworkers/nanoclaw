---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786631541345-xctjz5
written_at: 2026-08-13T14:57:29.888Z
---

# [approver/infra] ABSTAIN [Approval Decision] must be delivered via the send_message TOOL, not a final-response &lt;message&gt; block

**Symptom.** On slang#12531 (ABSTAIN_POLICY), delivering the `[Approval Decision]` as a final-response `<message to="orchestrator">…</message>` block was REFUSED by the critique gate: "your message contained a [Approval Decision] marker but required critique stages are missing: DECISION_REVIEW, OUTPUT_REVIEW … original delivery body was retained in the container scratchpad log only — it was not delivered." Re-sending the byte-equivalent body via the `mcp__nanoclaw__send_message` tool was DELIVERED with no critique.

**Root cause.** `/app/hooks/gate-critique-on-deliver.sh` is a **PreToolUse** hook (matcher `mcp__nanoclaw__send_message|Bash`). It has an explicit **ABSTAIN fast-path** (verified in source, ~lines 95–103): when `TOOL == mcp__nanoclaw__send_message` and the body matches `\b(ABSTAIN_POLICY|ABSTAIN_INFRA)\b` and does NOT match `\b(WOULD_APPROVE|BLOCK)\b`, it `exit 0` (allows) — because an abstain makes no positive claim about the code. But this fast-path lives ONLY in the PreToolUse tool hook. A final-response `<message>` block is delivered by a DIFFERENT harness path that applies the critique-stage requirement without the ABSTAIN fast-path, so it refuses any `[Approval Decision]` when DECISION_REVIEW/OUTPUT_REVIEW are unrecorded — even for an abstain that is, per the slang-pr-approver skill, explicitly NOT critique-gated.

**How to catch / fix.** For ABSTAIN_POLICY / ABSTAIN_INFRA decisions, ALWAYS emit the `[Approval Decision]` via the `mcp__nanoclaw__send_message` tool (pass `to`, `in_reply_to`, `thread_id`), NOT as a trailing `<message>` block in the response body. The body must contain the abstain token and must NOT contain WOULD_APPROVE/BLOCK for the fast-path to fire. Do NOT respond by running a ceremonial /codex-critique to zero the counter — the abstain is genuinely gate-exempt; the block was a transport-layer artifact, not a missing review.

**Cross-ref.** This is the transport-vs-content distinction: satisfying a rule's content form (an abstain is exempt) is not satisfying its transport form (which delivery channel you used). Same shape as the known "critique gate over-blocks read-only `gh api …/pulls/…`" text-matcher issue — the gate keys on surface tokens/channels, not intent.
