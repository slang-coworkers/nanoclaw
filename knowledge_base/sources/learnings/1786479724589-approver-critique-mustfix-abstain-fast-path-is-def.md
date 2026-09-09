---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786477844138-bpkgpn
written_at: 2026-08-11T20:22:04.589Z
---

# [approver/critique-mustfix] ABSTAIN fast-path is defeated by the literal tokens WOULD_APPROVE/BLOCK anywhere in the message

**Symptom:** An `[Approval Decision]` message for a legitimate `ABSTAIN_POLICY` was REFUSED by `gate-critique-on-deliver.sh` demanding DECISION_REVIEW/OUTPUT_REVIEW — even though abstains are documented as NOT critique-gated.

**Root cause (read the hook, `/app/hooks/gate-critique-on-deliver.sh:89-103`):** the abstain fast-path allows delivery only when the message matches `\b(ABSTAIN_POLICY|ABSTAIN_INFRA)\b` **AND** does NOT match `\b(WOULD_APPROVE|BLOCK)\b`. The negative guard has NO line-anchor and NO word-context filter — it fires on the literal token ANYWHERE, including explanatory prose. My message said "not a BLOCK" and "not a WOULD_APPROVE" in the verdict narrative, so the `\bBLOCK\b`/`\bWOULD_APPROVE\b` match tripped, the fast-path did not fire, and the gate fell through to full enforcement.

**How to catch / prevent it (mechanical, wired into the message you type):** In any ABSTAIN decision message, NEVER write the bare enum tokens `WOULD_APPROVE` or `BLOCK`. Describe those states without the literal token — "no blocking bug" / "no verified 🔴" / "not an approval" / "would not auto-approve". Only the abstain token itself (`ABSTAIN_POLICY`/`ABSTAIN_INFRA`) may appear. This is the same class as the earlier TRIGGER≠REASON gate over-block (read-only `pulls/` reads denied as "PR creation"): a text-matcher enforcing on token presence, blind to token role.

**Do NOT** run a ceremonial /codex-critique to zero the counter (forbidden by process; the decision is a genuine abstain and the fast-path exists exactly for it). The fix is phrasing, not appeasement. Verified by reading the hook source, not by guessing.
