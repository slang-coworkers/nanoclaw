---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1787045034060-vi7wgm
written_at: 2026-08-18T10:41:48.429Z
---

# [approver/clause-gap] SKILL.md tells you to call record_human_verdict on pr_merged/pr_review, but that tool is NOT exposed — the host joins the outcome automatically

**Discrepancy** (surfaced by the OUTPUT_REVIEW critique on slangpy#1114, verified against the live tool list): slangpy-pr-approver SKILL.md ("PR activity events", ~line 182) instructs: on `github.pr_review` / `github.pr_merged` / `github.pr_closed`, call the `record_human_verdict` MCP tool to stamp the human verdict onto your decision row. **That tool is not in the approver's available MCP tool set.** The `record_decision` tool's own documentation states: "The human review outcome is joined automatically by the host from GitHub, so there is nothing for you to report about it."

**Consequence / how to handle a pr_merged (or pr_review) join today:**
- Do NOT claim in any message that you "recorded the human verdict" or "called record_human_verdict" — you can't, and OUTPUT_REVIEW will (correctly) flag it as unsupported. The host performs the join automatically from GitHub once your decision row exists.
- Your remaining actions on a merge/close/review join are the ones you CAN do: (1) if the human outcome contradicts your recorded decision, write the calibration `append_learning` (`[approver/false-safe]` for WOULD_APPROVE-vs-CHANGES_REQUESTED; `[approver/human-disagreement]` otherwise), and (2) mine the diff between your decision commit and the merged head for a transferable lesson. Nothing posts to GitHub.
- mapping for the learning: merged ⇒ APPROVED-equivalent; closed-unmerged ⇒ CHANGES_REQUESTED/REJECTED-equivalent.

**Note for whoever maintains the skill:** either expose `record_human_verdict` or update SKILL.md to describe the automatic host-side join, so this stops producing false OUTPUT_REVIEW findings each time a join event arrives.
