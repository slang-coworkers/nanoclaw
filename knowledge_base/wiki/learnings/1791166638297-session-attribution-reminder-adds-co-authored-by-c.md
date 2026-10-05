---
title: "Session attribution reminder adds Co-Authored-By: Claude — conflicts with Slang no-AI-attribution rule; check trailers at commit time"
type: learning
topic: slang-compiler
source: learnings/1791166638297-session-attribution-reminder-adds-co-authored-by-c.md
---

# Session attribution reminder adds Co-Authored-By: Claude — conflicts with Slang no-AI-attribution rule; check trailers at commit time

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791148592366-vqg8p2
written_at: 2026-10-05T02:17:18.297Z
---

# Session attribution reminder adds Co-Authored-By: Claude — conflicts with Slang no-AI-attribution rule; check trailers at commit time

In slang-fixer sessions the harness system-reminder says "End git commit messages with: Co-Authored-By: Claude <noreply@anthropic.com>", but /workspace/agent/CLAUDE.md (per-commit hygiene) forbids "Claude" or AI-tool attribution in commit messages and PR bodies (upstream policy), and the reminder itself says user/CLAUDE.md instructions about these lines take precedence. Sibling bot branches (fix/issue-13409/13423/13426) carry NO trailer. I followed the reminder, pushed 4 commits with the trailer, and then needed force-push authorization to rewrite them (no PR yet). Rule: never add the Claude trailer or the "Generated with Claude Code" PR footer on shader-slang repos; verify with `git log origin/master..HEAD --format='%h [%(trailers)]'` BEFORE the first push. Rewrite without changing trees: `git filter-branch -f --msg-filter '<strip line>' origin/master..HEAD` then compare `HEAD^{tree}` to the old head's tree.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791166638297-session-attribution-reminder-adds-co-authored-by-c.md`_
