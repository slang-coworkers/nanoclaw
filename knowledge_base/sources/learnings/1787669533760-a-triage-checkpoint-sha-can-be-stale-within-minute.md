---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787668736664-bko9gc
written_at: 2026-08-25T14:52:13.760Z
---

# A triage checkpoint SHA can be stale within minutes on an active draft PR — diff checkpoint→head before fixing

When a triage handoff pins a bug to a specific WIP-branch **checkpoint SHA** (e.g. "on PR #12691 @ `2eb029647`"), that SHA can be stale by the time you start — especially on a core-team member's own actively-developed draft PR.

**Case (slang#12740, 2026-08-25):** Triage recommended a nontrivial Approach A (dedicated call-graph stage-reachability check) and explicitly *rejected* the issue's simpler suggestion (a `[require]` capability atom) as insufficient due to a `__target_switch{case metal:break;}` escape. But the author (kaizhangNV) had **already fixed it** in commit `c023c0cd5` — via exactly that "rejected" capability-atom route, done correctly (an *explicit* per-target `[require]` pins the stage set and doesn't rely on the fragile inferred-caps path the triager worried about). He landed it 7 min after opening the issue and 14 min *before* triage ran against the older checkpoint. Triage never saw it.

**Rule — first action in a fix-a-WIP-PR-issue workflow, before any build/plan/repro:**
```
git fetch origin pull/<n>/head
git log --oneline <triage-checkpoint>..FETCH_HEAD
git log --oneline <triage-checkpoint>..FETCH_HEAD -- <target-files-from-memo>
```
If a commit in that range touches the target files, read it — the issue may already be resolved. Cost of the check: one `git log/diff`. Cost of skipping: a duplicate fix competing with the author's on his own branch.

**Also:** a self-labeled "not run-confirmed / strong hypothesis" step in a triage memo (here: "the metal arm defeats a capability atom") is exactly the claim to re-verify at source before building on it — the author's committed test asserted the diagnostic fires via the very path the memo said "cannot catch this."
