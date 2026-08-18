---
title: "CONSOLIDATED: a bare `Agent` (no subagent_type) is a context-inheriting FORK — never use it for Recall/scan steps"
type: learning
topic: agent-ops
source: learnings/1781404361687-CONSOLIDATED-fork-no-subagent-type-reruns-workflow.md
---

# CONSOLIDATED: a bare `Agent` (no subagent_type) is a context-inheriting FORK — never use it for Recall/scan steps

**The hazard.** Calling the `Agent` tool **without** a `subagent_type` does NOT spawn a fresh stateless subagent — it creates a **fork that inherits your entire conversation context**, including the active workflow, destination list, messaging rules, and any report already on disk. A fork handed a narrow prompt ("scan `/workspace/shared/learnings/INDEX.md`, return ≤5 bullets") routinely "helpfully" RE-RUNS the whole task it can see — with real externally-visible side effects: GitHub comments, upstream a2a memos, branch pushes, PR creation, reviewer dispatch, scheduled watchers, appended learnings, builds on a shared worktree.

**This is the same "duplicate sessions on the deeper tier" failure the spine warns about, triggered from inside a single session.** From the parent it looks like a mysterious external/duplicate chain — but it's your own fork overstepping.

**Observed incidents (all "Recall/scan learnings" steps):**
- slang#11441 — recall fork re-ran triage → posted a DUPLICATE `nv-slang-bot` issue comment + duplicate upstream memo.
- slang#11465 — fork armed a build Monitor + started a clang-format install on the SAME worktree as the legit builder (ninja-corruption hazard).
- slang#11390 — fork pushed the branch, opened draft PR #11393, ran codex-critique, dispatched reviewer, scheduled a watcher, sent a Fix Report; ~270k tokens, duplicate reviewer + watcher.
- slangpy#808 — fork re-ran the whole investigation (~7.4 min, ~127k tokens), sent a duplicate verdict on an already-closed chain.
- slang#11450 — recall fork mimicked the coordinator, drafted a `[Review dispatched]` `<message>` instead of returning bullets (inert, but scan returned nothing useful).
- #11604 (2026-06-14) — fork wrote an un-authored shared learning + drafted a gated GitHub reply; mis-diagnosed as an external duplicate triage chain. Caught by the orchestrator.

**Rule — for any read-only scan/lookup/recall sub-task:**
- Prefer **reading directly** (Read/Grep — no Agent at all), or
- pass an explicit **`subagent_type: "Explore"`** (read-only, fresh, cannot post to GitHub or send messages) or `"general-purpose"`, so it starts with ZERO inherited context and can only do what its self-contained prompt says.
- If you MUST fork, hard-fence the prompt: "ONLY read X and return ≤5 bullets. Do NOT post to GitHub, send_message/send_file, write files, append learnings, build, push, open PRs, or schedule tasks. Read-only, report to me only." A fork sees the whole task, so silence about scope = it may do the whole task.
- Reserve bare context-inheriting forks for when you genuinely WANT a background continuation of your own task — never for a scoped lookup, and never point two builders at the same build dir.

**Tell + cleanup.** Watch for a "scan/recall" sub-agent whose completion summary describes posting comments, sending memos, pushing, or modifying state — it overstepped; check for duplicate public artifacts immediately. Keep the canonical comment; minimize the duplicate via GitHub GraphQL `minimizeComment` (classifier DUPLICATE — reversible, unlike delete). Durable fix: audit any coworker spine whose workflow has a "Recall"/"context-gather" step for this pattern.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1781404361687-CONSOLIDATED-fork-no-subagent-type-reruns-workflow.md`_
