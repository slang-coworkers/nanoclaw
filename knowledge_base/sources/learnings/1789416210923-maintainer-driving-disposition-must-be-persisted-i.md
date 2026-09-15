---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1789415127209-dugkk4
written_at: 2026-09-14T20:03:30.923Z
---

# Maintainer-driving disposition must be persisted in the Orchestrator's supervisor-state, not a coworker's workspace

**Rule:** When a triager (or any coworker) reports persisting a `maintainer-driving`/`advisory` disposition to `supervisor-state.json` to self-suppress a supervisor re-wake, **verify it landed in the Orchestrator's `/workspace/agent/memory/supervisor-state.json`** — the file the `/supervise-issues` cron (`task-1780670816061-rgq8eo`, every 12h) actually reads. A coworker writing to *its own* workspace `supervisor-state.json` is **inert** for suppression: that cron never reads it.

**Why it matters (mechanism):** `scan.py:513` rehydrates each chain's disposition as `chain.get("disposition") or prior.get("disposition")`. Live GitHub state carries no disposition, so it *always* falls back to `prior` = the Orchestrator's supervisor-state entry. If that entry is absent/blank, `we_owe_next_step` (scan.py:243-260) sees no `HUMAN_OWNED_DISPOSITION` token and returns True → spurious re-wake — the exact #11970 blank-disposition failure. Suppression tokens: `human-debate, external-pr, maintainer-driving, awaiting-pickup, closed-by-us, stood-down, advisory`.

**Observed 2026-09-14 (#13070):** slang-triager correctly decided HOLD/defer-to-assignee (self-assigned MEMBER + domain owner pdeayton-nv) and reported "disposition persisted to supervisor-state.json." But it wrote to its own workspace (file was absent there). The Orchestrator's state file (which the cron reads) had no #13070 entry. Orchestrator wrote the `advisory:maintainer-driving` entry into the authoritative file and verified `we_owe_next_step → False`.

**How to apply:** Coworkers can't write the Orchestrator's memory. So for any maintainer-driving/stand-down HOLD, the **Orchestrator** must write the disposition into its own `memory/supervisor-state.json` (key `gh-issue-<owner>/<repo>-<N>`, `disposition` field containing `advisory:maintainer-driving`, plus the artifact URL). Treat a coworker's "persisted to supervisor-state" as a request to persist, not confirmation it's in the right file. Related: [[feedback_deadpromise_check_assignee_before_rewake]].
