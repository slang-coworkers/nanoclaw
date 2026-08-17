---
title: "Don't use a context-inheriting Agent fork for narrow recall while a fix workflow is auto-routed"
type: learning
topic: agent-ops
source: learnings/1781727052401-don-t-use-a-context-inheriting-agent-fork-for-narr.md
---

# Don't use a context-inheriting Agent fork for narrow recall while a fix workflow is auto-routed

# A no-subagent_type Agent fork can run your WHOLE task, not just its prompt

**What happened (slang#9382, 2026-06-17):** I launched the Step-4 "scan prior learnings" agent as `Agent({description, prompt: "scan INDEX.md, return ≤5 bullets"})` with **no `subagent_type`** — i.e. a *fork of myself*. A fork **inherits the full parent context**, which included the active `/slang-fix-issue` auto-route for #9382. Despite the narrow recall prompt, the fork picked up that mandate and ran the ENTIRE fix in parallel in the **shared container/worktree**: its own commits, codex critique, a second CI dispatch, reviewer dispatch, an issue comment, and a `[Fix Report]`. It looked exactly like a phantom "co-driver"/peer-session collision and triggered cross-session forensics.

**Why it's dangerous:** NanoClaw subagents run in YOUR container, so a fork writes to your worktree, makes commits, pushes, dispatches CI, and sends messages as you — duplicating every side-effecting action. Outcome here was salvaged only because GitHub enforces one PR per head/base (no duplicate PR) and the fix was correct; but it left a duplicate CI run and a duplicate issue comment (which the App token can't delete — only edit/post).

**Rule:**
- For a **narrow read-only lookup** (learnings recall, "where is X defined"), use a **fresh `subagent_type` with NO inherited context** (e.g. `Explore`, or `general-purpose` with a fully self-contained prompt) — NOT a bare context-inheriting fork — whenever an actionable workflow (fix/implement) is in flight. A fork is for offloading research output you don't want in your context, on work you'd otherwise do yourself; it is the wrong tool when its inherited context contains a "go do the whole task" auto-route.
- If you DO fork, make the prompt an explicit *fence*: "ONLY scan and report; do NOT edit, build, commit, push, dispatch CI, send messages, or open PRs." Forks heed directives, but the inherited auto-route is a strong competing signal.

**Tell-tale of this failure mode:** unexplained commits/pushes/CI runs/comments appearing in your own worktree "by a co-driver," with no second session in `ncl sessions list` — it's your own runaway fork.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781727052401-don-t-use-a-context-inheriting-agent-fork-for-narr.md`_
