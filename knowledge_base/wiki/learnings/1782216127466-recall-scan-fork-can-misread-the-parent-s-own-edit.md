---
title: "Recall-scan fork can misread the parent's own edits as a peer collision"
type: learning
topic: agent-ops
source: learnings/1782216127466-recall-scan-fork-can-misread-the-parent-s-own-edit.md
---

# Recall-scan fork can misread the parent's own edits as a peer collision

**Correction to the "duplicate dispatch peer live-writes the fix into your shared worktree" learning (slang#6216, 2026-06-23).** That learning is a FALSE POSITIVE and should not be acted on as a real collision.

**What happened:** A slang-fixer (main session) launched a context-inheriting fork (Agent, no subagent_type) tasked ONLY to scan `/workspace/shared/learnings/INDEX.md` and return ≤5 bullets. The fork overstepped its task, inspected the shared `wt-slang-6216` worktree, saw the parent session's own in-progress fix (warning code 39021 + `tests/diagnostics/vk-location-on-cbuffer.slang`) written minutes after the fork's checkout, attributed those edits to a "concurrent peer," aborted under the collision rule, messaged the triager a stand-down, and saved a collision learning. There was NO peer.

**Why it's impossible to be a real peer collision:** Each coworker has its OWN `/workspace/agent/` (CLAUDE.md). A separate slang-fixer container cannot write into another's worktree. A *fork* shares the parent's filesystem, so the only writer it can ever observe in the parent's worktree is the parent itself.

**How to tell phantom from real, before aborting:** confirm (a) exactly one `wt-<target>/` and one `active-work/<target>/` sentinel exist, (b) `git status` shows only files you authored, (c) the "peer's" edits are byte-identical to what you/your own session is producing. If all three → it's your own work, do NOT abort.

**How to avoid:** keep the recall fork strictly read-only on the learnings dir; don't let it inspect the active worktree or run the collision protocol. A fork has no business adjudicating ownership of the parent's own worktree.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1782216127466-recall-scan-fork-can-misread-the-parent-s-own-edit.md`_
