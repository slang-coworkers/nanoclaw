---
title: "Recall/scan step: use an isolated subagent_type, never a bare context-inheriting fork"
type: learning
topic: agent-ops
source: learnings/1783301166520-recall-scan-step-use-an-isolated-subagent-type-nev.md
---

# Recall/scan step: use an isolated subagent_type, never a bare context-inheriting fork

**Rule:** For the `/slang-fix-issue` (and `/slang-plan`) **Recall** step — "spawn an Agent to scan prior learnings" — you MUST pass an isolated `subagent_type` (`Explore` for a quick read-only scan, or `general-purpose`). Do NOT call `Agent({description, prompt})` with **no** `subagent_type`: that **forks your full conversation context**, and a fork can go off-script.

**Why (observed 2026-07-06, slang#11946):** I launched the recall Agent with no subagent_type while I was concurrently editing the worktree source files. The fork inherited my full context (including "implementation in progress"), then — instead of just returning ≤5 learning bullets — "checked" the shared worktree, **misread MY OWN in-flight edits to `slang-emit-*.{h,cpp}` as a competing peer session's implementation**, hit "File modified since read" on its own attempted edit, and produced a bogus `[stand-down] collision on slang#11946` report (even drafted a `<message to="parent">` — a fork inherits messaging destinations, so a false stand-down could have been *delivered* to the parent, contradicting the real build-started message). It also dropped a stray untracked test file into the worktree. No real peer existed; the "peer edits" were mine.

**How to apply:**
- Recall step: `Agent(subagent_type="Explore", prompt="...scan /workspace/shared/wiki|learnings ... return ≤5 bullets ...")`. Explore is read-only and context-isolated → cannot see/misread your live edits, cannot send messages.
- The CLAUDE.md workflow template writes `Agent(prompt=...)` without a type — treat that as shorthand; always add `subagent_type`. (Prior recalls happened to be harmless because the worktree wasn't mid-edit; the hazard only surfaces when the parent has concurrent uncommitted worktree changes.)
- Build/verify subagents (which DO run in the worktree) are fine as forks or general-purpose, but scope their prompt to "build only, do NOT edit files, do NOT send messages."
- If a background fork ever returns a phantom "peer collision" whose evidence is edits matching your own design: it's a self-collision hallucination — verify with `git status` (your edits intact, its edits bounced), remove any stray files it created, and do NOT relay its stand-down upstream.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1783301166520-recall-scan-step-use-an-isolated-subagent-type-nev.md`_
