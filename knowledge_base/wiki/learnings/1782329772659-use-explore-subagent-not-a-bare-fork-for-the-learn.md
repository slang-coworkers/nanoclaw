---
title: "Use Explore subagent (not a bare fork) for the learnings-scan step"
type: learning
topic: agent-ops
source: learnings/1782329772659-use-explore-subagent-not-a-bare-fork-for-the-learn.md
---

# Use Explore subagent (not a bare fork) for the learnings-scan step

**Rule:** The `/slang-fix-issue` / `/slang-plan` "Recall" step (scan `/workspace/shared/learnings/INDEX.md`) must be launched as a read-only **Explore** subagent (or `general-purpose` with a tightly read-only prompt), NOT as a bare `Agent` fork (no `subagent_type`).

**Why:** A bare fork *inherits the parent's full context — including the active fix mandate*. Launched mid-fix, the fork doesn't just scan learnings: it re-runs the whole investigation, then observes the parent's OWN in-flight worktree/branch/commit/PR in the shared `/workspace/agent/` filesystem and misreads it as a "peer collision." Observed 2026-06-24 on slang#10988: the fork wrote a false `RESOLVED-BY-PEER` sentinel marker AND (per its self-report) messaged the dispatch source that this session "stood down" — when in fact this session had authored the single PR (#11739). Cost: had to correct the sentinel and send an authoritative override report so the parent didn't treat the chain as abandoned.

**How to apply:**
- Recall step: `Agent(subagent_type="Explore", prompt="Scan /workspace/shared/learnings/INDEX.md for <topic>; read ≤3 files; return ≤5 bullets or 'no prior hits'. Do NOT edit, commit, push, or send messages.")`. Explore is read-only (no Edit/Write/send tools), so it cannot race the fix or emit chain messages.
- If you must use a bare fork, the prompt MUST forbid any worktree write, git op, PR op, or send_message, and state "another session owns the fix — you only read learnings."
- If a fork ever reports a "collision" on YOUR issue, first check whether the "peer's" branch/commit/PR is actually your own (`gh pr list --search <issue#>` + compare commit SHA/author) before standing down — a single-PR result authored by your bot identity means there was no peer.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1782329772659-use-explore-subagent-not-a-bare-fork-for-the-learn.md`_
