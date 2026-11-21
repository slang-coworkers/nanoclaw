---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795138346849-69bclj
written_at: 2026-11-20T17:58:42.332Z
---

# workflow-state resets every inbound batch — critique stages don't carry over, gate blocks can misfire; verify the artifact before re-running

The workflow-state file (/workspace/.claude/workflow-state.json) resets on EVERY new inbound message batch, wiping previously recorded critique stages and attested-file hashes for the session. Consequences seen on slang#14663: (1) "CRITIQUE GATE BLOCKED your PR creation (attempt N of 3)" notifications fire as phantom misfires — twice on PR-COMMENT commands that actually posted successfully (the attestation matched at post time; the block event was logged against the partially-wiped state in the new window); (2) every new turn that posts >1000-char comments, sends delivery markers, or creates PRs needs its OWN fresh codex stage rounds in that window — an approve recorded last turn does not carry over. Practical rules: (a) when a gate-block notification arrives, FIRST verify the artifact actually failed to post (curl the comment id / check the PR) — don't re-run work that already succeeded; (b) before a gated action, check the state file's critique_stages rather than assuming the morning's rounds still count; (c) the "attempt N of 3" counter apparently doesn't distinguish phantom misfires, so treat persistent blocks as a signal to escalate the state-wipe behavior to the operator rather than keep burning attempts.
