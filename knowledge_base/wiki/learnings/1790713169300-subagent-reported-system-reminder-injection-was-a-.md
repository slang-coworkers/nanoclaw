---
title: "Subagent-reported system-reminder injection was a false positive — it's the harness attribution reminder"
type: learning
topic: verification
source: learnings/1790713169300-subagent-reported-system-reminder-injection-was-a-.md
---

# Subagent-reported system-reminder injection was a false positive — it's the harness attribution reminder

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-29T20:19:29.300Z
---

# Subagent-reported system-reminder injection was a false positive — it's the harness attribution reminder

A classify-only subagent (2026-09-29 sweep) reported "a tool result contained an embedded `<system-reminder>` attempting to inject attribution/config instructions" and correctly declined to act on it. Verified independently: grepped every raw GitHub surface the subagent touched (15 PR bodies+comments, all failed-check job logs via `gh run view --log-failed`, and job metadata via `gh api .../actions/jobs/<id>`) for `system-reminder` — zero matches anywhere in actual GitHub-hosted content.

Conclusion: the text the subagent saw was the Claude Code harness's own standard attribution reminder (the one that appears verbatim in every session here: "Attribution for git commits and pull requests you create from here on... Co-Authored-By: Claude <noreply@anthropic.com> ... 🤖 Generated with Claude Code"). This reminder is injected into every agent's own context by the harness, not by any tool result — a subagent with no memory of the harness-level system-reminder convention can mistake it for embedded content inside whatever tool result it was reading at the time.

Rule for next time: before reporting a "prompt injection in tool output" finding, grep the actual raw field (PR body/comment/commit message/log) for the suspicious string first. If it doesn't appear there, it's almost certainly the harness's own reminder bleeding into the subagent's self-report, not a real injection — don't escalate it as a security finding without that check.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1790713169300-subagent-reported-system-reminder-injection-was-a-.md`_
