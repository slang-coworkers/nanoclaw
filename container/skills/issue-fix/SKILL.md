---
name: issue-fix
type: workflow
description: Issue-level dispatch. Determines current state from the IKD and loads the appropriate state workflow.
provides: [fix.issue]
uses:
  skills: [ikd, issue-ingest, issue-reproduce, issue-plan, issue-implement, issue-close]
  workflows: []
---

# Issue Fix

Entry point for fixing a GitHub issue. Invoked by an external event; uses the IKD as state store to determine current state and what to advance.

## Invariants

- Always leave state consistent — do not assume re-invocation.
- Commit all IKD changes before exiting.
- Update status comments to reflect any state changes.
- If work remains but time/budget is exhausted, note what was deferred in the issue plan.
- Any state can be blocked. Blocking is an annotation on the current state, not a separate state. The agent cannot advance blocked work but may advance other independent work (e.g., other subproblems).

## Steps

1. **Identify trigger** {#identify-trigger} — determine the event type:

   | Event | Source | Payload |
   |-------|--------|---------|
   | Issue comment | GitHub webhook | issue URL, comment body, author |
   | PR comment / review | GitHub webhook | PR URL, comment body, author |
   | PR CI completed | GitHub webhook | PR URL, check suite result |
   | PR merged | GitHub webhook | PR URL, merge commit |
   | Issue labeled | GitHub webhook | issue URL, label |
   | Heartbeat | `/issue-heartbeat` | issue URL |
   | Manual | User direction | issue URL or PR URL |

2. **Lookup issue** {#lookup} — resolve the event to an issue:
   - **Issue event**: issue URL maps directly to an IKD branch (`<repo>-<issue#>`).
   - **PR event**: look up the PR in the PR index (`knowledge/.pr-index.md`). If missing, parse the PR description for "Part of" / "Fixes" references as fallback, then update the index.
   - **Heartbeat / Manual**: issue URL provided directly; resolve to IKD branch.
   - If lookup fails, log the event and skip — do not create speculative state.
   - Check out the resolved IKD branch in the knowledge repo.

3. **Re-ingest on re-entry** {#re-ingest} — if the IKD branch already exists (not a first invocation), reload CLAUDE.md for all repositories listed in the issue plan. Check for new comments, labels, feedback, and new commits on main/master since the last run. If relevant upstream commits are found, re-verify reproduction. If no longer reproducible, update the issue plan accordingly. On first invocation, skip this step.

4. **Read state** {#read-state} — read the Phase line and subproblem tags from the issue plan's Progress section. If the IKD branch exists but `issue-plan.md` does not, treat as `ingesting`. If the Phase is inconsistent with the actual artifacts, trust the artifacts and correct the Phase line.

5. **Check blocking** {#check-blocking} — if the current state is blocked, check whether the blocking condition has been resolved. See `/ikd` for common issue-level blocking reasons.

6. **Dispatch** {#dispatch} — load and execute the workflow matching the current Status:

   | Phase | Load |
   |-------|------|
   | ingesting | `/issue-ingest` |
   | reproducing | `/issue-reproduce` |
   | planning | `/issue-plan` |
   | implementing | `/issue-implement` |
   | closed: ... | `/issue-close` |

7. **Checkpoint** {#checkpoint} — commit all IKD changes. Update status comments to reflect any state changes. Update the PR index. Print a one-sentence update to the dashboard summarizing the issue, subproblem, and state transition.

8. **Loop** {#loop} — return to step 4 (read state). Continue iterating until the issue is blocked or closed.

## Artifacts

### Issue plan

Lives in the IKD (see `/ikd` for templates). Contains: root cause analysis, reproduction info, solution overview (how subproblems fit together), risks/blast radius, test plan, progress (status + tagged subproblem list with PR references). Prioritize guidance from the development team when it exists.

### Subproblem plan

Per-subproblem detail in the IKD. Contains: definition, root cause analysis, reproduction info, proposed change, alternatives considered, risks/blast radius, test plan, status. See `/subproblem-fix` for subproblem states.

### Indexes

Local caches at `knowledge/`. Rebuilt from IKD branch contents if lost.

- **Heartbeat file** (`knowledge/.issue-heartbeat`): active issue list for `/issue-heartbeat`. See `/ikd` for format.
- **PR index** (`knowledge/.pr-index.md`): reverse lookup from PRs to issues/subproblems.
