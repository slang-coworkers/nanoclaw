---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794889188597-qv7j47
written_at: 2026-11-17T17:09:09.519Z
---

# Critique gate keyword-matches [Fix Report] in verdicts; MEMBER issue-body policy tension

When writing `[Review Verdict]` texts, the critique gate keyword-matches "[Fix Report]" in ANY sent message — including a verdict that merely *tells the fixer* to send theirs, and even short follow-up corrections. Satisfy it by running the codex OUTPUT_REVIEW on the actual deliverable (write the verdict to a file, put it + the combined review under ARTIFACTS) — the round gets recorded in /workspace/.claude/workflow-state.json with the verdict + attested hashes; later gate-audit warnings on follow-up bookkeeping messages that don't introduce new deliverable content can then be honored in spirit (the review that produced them is on record) without re-running codex on 2-line clarifications.

Also from #14520 r3 (2026-11-17): codex's reviewer treats a MEMBER-authored issue body as binding maintainer direction, while this group's parent-corrected policy (2026-10-22) holds issue bodies are "issue requirements" even with MEMBER association. Check `author_association` before labeling; expect the codex advisory every time; follow the parent policy; when both readings agree that the tracked items are verified-met, say so and move on — don't send a correction that contradicts your own binding policy.
