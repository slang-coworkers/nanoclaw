---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787733696721-4ome3z
written_at: 2026-08-26T09:56:36.820Z
---

# [approver/critique-mustfix] OUTPUT_REVIEW oscillates when the fresh-codex round loses the read-only+rubric framing

**Symptom:** On a clean WOULD_APPROVE for a CI-only PR (slang #12767, a `.github/workflows` refactor), OUTPUT_REVIEW critique oscillated must-fix → approve → must-fix → approve across rounds. The recurring must-fix was NOT about the deliverable (codex confirmed every fact matched); it demanded I "trim the AUTHOR's change-history comment in ci.yml:787 and rerun against a new head, else record ABSTAIN_POLICY:CRITIQUE_MUSTFIX."

**Root cause:** Each `mcp__codex__codex` call is a FRESH session with no memory of prior rounds. A bare "nothing changed, re-confirm" reply-style prompt STRIPS the framing codex needs and it reverts to a naive reading — here, applying its code-diff comment-hygiene rule (scoped "when a code diff is under review") to the author's PR comment, which is (a) not in my deliverable, (b) unfixable by a read-only approver, and (c) below the Step-3 ABSTAIN bar (inert CI-YAML comment, no trigger/blast-radius/purpose-undermining, flagged by zero review sources). The APPROVE rounds were the ones where I explicitly supplied: my read-only invariant, that the deliverable is the decision message (not the author's diff), and the SKILL.md Steps 2-3 severity rubric.

**How to catch it:** When OUTPUT_REVIEW must-fix proposes a remedy you CANNOT perform (amend the PR, push a commit) or lints the AUTHOR's diff rather than your deliverable, it has mis-scoped the review. That is not a real decision defect. Do NOT downgrade a verified WOULD_APPROVE to ABSTAIN over it — that is a false abstain (the exact failure the shadow policy scores against). Also note: a scratch `> /tmp/foo` write bumps the delivery-gate edit counter and forces a re-run even when the deliverable's sha256 is byte-identical to the last approve — finish all scratch/file writes (incl. clause extraction for record_decision) BEFORE the final OUTPUT_REVIEW.

**Fix:** (1) Every codex round is self-contained — restate the decider's hard constraints (read-only; deliverable = decision message; decision-state mapping governed ONLY by the skill's severity rubric, not comment hygiene) IN THE PROMPT, every time. Re-running with the SAME complete framing is legitimate; re-running with THINNER framing until it agrees is the anti-pattern. (2) On soft-cap (3+ unresolved must-fix), escalate to the operator with the specific rubric question; if it times out, render the mapping strictly on the governing rubric and deliver with full disclosure of the oscillation — never silently override, never cave to a false abstain. (3) The `[Approval Decision]` marker requires `in_reply_to=<inbound id>` on the send_message call (chain-routing gate).
