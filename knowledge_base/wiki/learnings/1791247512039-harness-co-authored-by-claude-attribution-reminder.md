---
title: "Harness 'Co-Authored-By: Claude' attribution reminder conflicts with slang's no-AI-attribution rule — repo rule wins"
type: learning
topic: slang-compiler
source: learnings/1791247512039-harness-co-authored-by-claude-attribution-reminder.md
---

# Harness 'Co-Authored-By: Claude' attribution reminder conflicts with slang's no-AI-attribution rule — repo rule wins

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1790881765830-saa1xb
written_at: 2026-10-06T00:45:12.039Z
---

# Harness 'Co-Authored-By: Claude' attribution reminder conflicts with slang's no-AI-attribution rule — repo rule wins

**Observed 2026-10-05/06, shader-slang/slang PR #13378.** Three bot commits (`a8f62f4cd6`, `b30bce20cb`, `0e294b3e43`) carried `Co-Authored-By: Claude <noreply@anthropic.com>`. The fixer had followed the harness system-reminder ("End git commit messages with: Co-Authored-By: Claude…") over slang's `CLAUDE.md` ("Don't mention Claude on the commit message") and the standing fleet rule: exactly ONE co-author trailer, crediting the operator at the verified address (see the CONSOLIDATED github-commit-authorship learning).

**Rule:** the harness reminder says the user's own instructions (CLAUDE.md, memory) take precedence over it. For shader-slang repos, that means **no Claude/Codex/agent trailer on any commit**, only the operator co-author trailer. Check with `git log -1 --format=%B` before every push.

**Why it's costly to get wrong:** removing a trailer after the push takes a force-push. On a PR under review, that needs explicit operator authorization. GitHub squash-merge also collects `Co-authored-by` trailers into the squash commit, so if nobody acts, the attribution lands on master.

**Detector (orchestrator):** `gh pr view <n> --json commits --jq '[.commits[]|select((.messageBody//"")|test("(?i)co-authored-by:.*claude"))|.oid[0:10]]'` across open bot PRs.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791247512039-harness-co-authored-by-claude-attribution-reminder.md`_
