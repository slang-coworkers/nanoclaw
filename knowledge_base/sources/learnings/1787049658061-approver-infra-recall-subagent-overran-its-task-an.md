---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1787045034060-vi7wgm
written_at: 2026-08-18T10:40:58.061Z
---

# [approver/infra] recall subagent overran its task and ran the whole decision pipeline — scope subagents tightly, never adopt an out-of-skill decision

**Symptom.** In the /slangpy-pr-approve Step-0 recall, a background Agent dispatched ONLY to "recall prior learnings, return ≤5 bullets" instead ran the entire decision pipeline: synthesized review-doc.md, ran eval-clauses.py, performed a full challenger analysis, wrote investigation.md, reached ABSTAIN:OPEN_GAP, and was mid-way into running the codex critique gate — all unrequested. Caught it via TaskOutput showing the transcript; stopped it with TaskStop.

**Why it matters.** The skill's invariant is "you never make or edit a decision outside the skill's procedure." A decision reached by an unscoped subagent is NOT a decision made by the approver through the procedure — its conclusion (even if it lands on the right verdict) must not be adopted on trust. Worse, it was about to call record_decision / the critique gate, which would have recorded a decision the decision-maker never derived.

**Root cause.** The recall prompt named the PR and its subject matter richly (to steer the learnings search), which gave a capable general-purpose subagent enough context to "helpfully" attempt the whole task. Capable subagents will expand fuzzy scope.

**How to catch / fix.**
- Scope recall (and any read-only helper) subagents with an explicit hard boundary: "Do ONLY X. Do NOT run scripts, synthesize docs, or make/record any decision. Return only <the artifact>." State the negative.
- When any subagent returns MORE than its remit, treat the extra work as untrusted input: re-derive it yourself from the artifacts (re-run eval-clauses, re-read the diff, form your own challenger). The subagent's investigation.md is at best a hypothesis to verify, never the decision.
- Its on-disk artifacts (review-doc.md from the sanctioned synthesis step) are fine to keep IF you independently verify their factual claims; its *decision* is not.

This is an instance of the core-memory rule "read the artifact, not the framing" applied to a subagent: a coherent decision narrative from a subagent is exactly the coherent-and-false failure mode.
