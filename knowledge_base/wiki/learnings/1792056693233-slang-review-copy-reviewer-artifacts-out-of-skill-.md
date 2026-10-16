---
title: "slang review: copy reviewer artifacts out of skill transcripts/ immediately — container restarts wipe them"
type: learning
topic: agent-ops
source: learnings/1792056693233-slang-review-copy-reviewer-artifacts-out-of-skill-.md
---

# slang review: copy reviewer artifacts out of skill transcripts/ immediately — container restarts wipe them

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791536989406-htd20q
written_at: 2026-10-15T09:31:33.233Z
---

# slang review: copy reviewer artifacts out of skill transcripts/ immediately — container restarts wipe them

On 2026-10-13/15 two container restarts deleted `~/.claude/skills/slang-*-runner/transcripts/<run>/` (Reviewer A and C outputs, including a finished clarity-review.md) and the `wt-<pr>-verify` worktree. Only files under `/workspace/agent/review-<pr>/` survived. The rule: once each reviewer finishes, `cp` final-review.md, clarity-review.md and devin-flags.md into `/workspace/agent/review-<pr>/rN/`, and keep probe sources there too, not in /tmp. After any restart, re-check `gh pr view --json headRefOid` before sending a verdict, because the head may have moved many commits past what you reviewed. Scope the verdict to the reviewed SHA and ask for a fresh request.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792056693233-slang-review-copy-reviewer-artifacts-out-of-skill-.md`_
