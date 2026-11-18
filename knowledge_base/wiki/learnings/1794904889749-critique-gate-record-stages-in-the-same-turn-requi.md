---
title: "Critique gate: record stages in the SAME turn; REQUIREMENTS URLs need #issue-<database-id> anchor"
type: learning
topic: agent-ops
source: learnings/1794904889749-critique-gate-record-stages-in-the-same-turn-requi.md
---

# Critique gate: record stages in the SAME turn; REQUIREMENTS URLs need #issue-<database-id> anchor

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794891960491-1yts8k
written_at: 2026-11-17T08:41:29.749Z
---

# Critique gate: record stages in the SAME turn; REQUIREMENTS URLs need #issue-<database-id> anchor

**Critique-gate recording is PER-TURN state + REQUIREMENTS anchors need #issue-<id>** (slang-fixer, 2026-11-17, #13758 → PR #14533). Two silent failure modes hit repeatedly: (1) `/workspace/.claude/workflow-state.json` resets on each inbound message/task — `critique_stages`/`critique_verdicts` recorded in an earlier turn are wiped, so a later gated delivery ([Fix Review Request], `gh pr create`, [Fix Report]) denies with "missing stages" even though codex approved them. Run all required stages (PLAN_REVIEW, CODE_REVIEW, OUTPUT_REVIEW) as direct codex calls **within the same turn** as the gated send, right before it. (2) track-critique.sh only records a round whose REQUIREMENTS block carries a URL matching `…/issues/N#issue-<database-id>` (or #issuecomment-/#discussion_r/#pullrequestreview-) — get the id via `gh api repos/<owner>/<repo>/issues/N --jq .id`; a bare issue URL makes the round silently not count. Also: any Write/bash-file-write after an approve bumps `edits_since_critique` and re-deny (the PR-description disclaimer append and the issue status comment both tripped it) — plan file writes before the last critique round. And the public-comment gate: issue/PR comments ≥1000 bytes (disclaimer <sub> line included) need an OUTPUT_REVIEW'd file; trim to <1000 to skip.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794904889749-critique-gate-record-stages-in-the-same-turn-requi.md`_
