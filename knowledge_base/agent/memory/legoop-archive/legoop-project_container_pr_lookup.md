---
type: project
title: "How an agent container resolves a chain's PR/issue link — thread_id is unreliable, pr_session_mappings is unreadable, use gh"
description: "ported lego-operator-memory archive; project note"
tags: [legoop-archive, ported]
---

# How an agent container resolves a chain's PR/issue link — thread_id is unreliable, pr_session_mappings is unreadable, use gh

Inside an agent container (verified via `docker exec` into a live orchestrator), the PR↔issue↔session links must come from `gh` over the OneCLI proxy — NOT from the central DB:

- **No `v2.db` mount** — only `/workspace/inbound.db` + `/workspace/outbound.db` (the session DBs). `pr_session_mappings` lives in the central DB and is **not queryable from the container**. It's host-side state the *fixer* writes via `report_pr_created()`; the container can't read it.
- **`ncl` has no PR resource** — only approvals/destinations/dropped-messages/groups/members/messaging-groups/roles/sessions/user-dms/users/wirings. `ncl sessions` does not expose PR mappings.
- **`thread_id` ≠ work product** — a coworker session is reused across issues, so a session threaded `gh-issue-…-11367` may have shipped the PR for #11356 (real case: session e5w8oc, PRs #11386 *and* #11389 in pr_session_mappings). Never infer a chain's PR or which issue a PR fixes from `thread_id`.

**Container-executable resolution (all work via OneCLI proxy):**
- Find a chain's PR by the fixer branch convention: `gh pr list --repo <o>/<r> --head fix/issue-<num> --state all --json number,isDraft,state,headRefName`.
- Authoritative PR→issue link = PR body: `gh pr view <pr> --json body --jq '.body' | grep -ioE '(fixes|closes|resolves) #[0-9]+'`.
- Issue closed-by-PR detection (postmortem): `gh issue view <num> --json state,stateReason,closedByPullRequestsReferences`. NOTE: `timelineItems` is **not** a valid `gh issue view` field — use `closedByPullRequestsReferences`.
- Writes confirmed available in-container: `gh pr ready` / `--undo` / `gh pr close`; MCP `append_learning`.

The dashboard API at `host.docker.internal:3838` works (`:3000`→404 on this instance); `172.17.0.1:3000/api/sessions/in-flight` is what the supervise-issues cron gate hits.

Encoded into `container/skills/supervise-issues/SKILL.md` (PR #542). Related: [[project_pr_session_mapping]], [[feedback_gh_auth_status_misleading]] (gh works via proxy even when `gh auth status` looks broken), [[reference_show_transcript_skill]].

