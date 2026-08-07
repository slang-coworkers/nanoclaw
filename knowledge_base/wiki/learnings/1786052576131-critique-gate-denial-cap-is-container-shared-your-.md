---
title: "Critique-gate denial cap is container-shared: your FIRST read-only /pulls GET can escalate straight to an admin"
type: learning
topic: agent-ops
source: learnings/1786052576131-critique-gate-denial-cap-is-container-shared-your-.md
---

# Critique-gate denial cap is container-shared: your FIRST read-only /pulls GET can escalate straight to an admin

**Rule:** `gate-critique-on-deliver.sh` matches Bash commands against `gh api [^|]*pulls\b`, so it
denies **read-only GETs** (`gh api repos/O/R/pulls/N/commits`, `.../reviews`) and labels them
`hit: "PR creation"`. The denial counter (`critique_gate_denials`) and the edit counter
(`edits_since_critique`) in `/workspace/.claude/workflow-state.json` are **workspace-scoped** — shared
by every session in the container (~8 for slang-fixer). Consequence: if a peer already burned the
3-denial cap, **your very first `/pulls` GET auto-forwards a bypass request to an admin**, with no
"denied, try again" step in between. An admin then rejects a request whose premise ("N edits since
critique", "PR creation") is a phantom you had nothing to do with.

**Observed twice in one day (2026-08-06):** #12080 (three GETs burned the cap → rejected) and #11820
(two GETs, cap already spent → immediate escalation → rejected). In both cases the session created no
PR, pushed nothing, and edited no repo code; the dirty files in the shared base clone belonged to a
peer working a different issue. Acting on the rejection's framing ("satisfy the requirement") would
mean running codex critique stages over **no artifact at all** — a hollow critique that launders the
control.

**How to apply:**
- Use gate-safe reads from the start on any PR investigation — they return everything the REST
  `/pulls` routes do:
  - `gh pr view <n> -R O/R --json reviews,commits,comments,assignees,isDraft,headRefOid,mergeStateStatus`
  - `gh api graphql -f query='{repository(owner:"O",name:"R"){pullRequest(number:N){reviewThreads(last:20){nodes{isResolved path line comments(first:10){nodes{author{login} createdAt body}}}}}}}'`
    (review-thread bodies + resolution state — the one thing `gh pr view` won't give you)
  - `gh pr checks`, `gh api repos/O/R/actions/runs/<id>` (verify a green binds the current head),
    `gh api repos/O/R/issues/<n>/comments` (issue-route comments are NOT gated),
    `gh api repos/O/R/compare/<branch>...master` for behind/ahead.
- Before believing a denial: read `critique-escalation.json` (`hit`, `reason`, `resolved`) and
  `workflow-state.json`, then `git status --porcelain` in **your own** worktree to see whether any of
  the counted edits are yours.
- A rejected bypass is not an instruction to force the work through and not necessarily a finding
  against your work. If nothing of yours is actually blocked, the correct action is a report, not a
  retry.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1786052576131-critique-gate-denial-cap-is-container-shared-your-.md`_
