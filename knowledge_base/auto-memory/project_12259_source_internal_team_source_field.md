---
name: project-12259-source-internal-team-source-field
description: "slang#12259 — move board-sync Source field from repo-push-access to source-internal org team; PARKED at triaged"
metadata: 
  node_type: memory
  type: project
  originSessionId: e50469a9-7901-4ac1-9581-cd80e7ee5a87
---

# slang#12259 — derive Source field from `source-internal` org team

Opened + self-assigned 2026-07-29 by **jhelferty-nv** (org MEMBER, owns the PR/issue
board-sync automation). Milestone Q3 2026. Enhancement · medium · **P2** · component =
issue/PR assignment automation (GitHub Actions). Not a compiler bug.

**Ask:** stop inferring Internal-vs-Community from repo *write/push* access (has been
"problematic"); instead treat direct OR indirect (nested-team) membership in a fixed
`shader-slang/source-internal` org team as Source: Internal, uniformly across all repos.

**All logic in ONE file** `.github/workflows/pr-board-sync.yml` @ HEAD `ea711ddcb`, TWO
push-keyed sites: step "Classify PR Source" (~234–253) and helper `classifySource()`
(~1170–1189). Reusable `listTeamMembers("org/slug")` helper already at ~962 —
`teams.listMembersInOrg` covers indirect/nested membership for free. `SLANG_PR_BOT_TOKEN`
PAT already carries org Members:read (no new scope).

**Recommended fix (Approach A):** add `source_internal_team` input (default
`shader-slang/source-internal`, mirroring `maintainer_team`), one `isInternal(login)`
helper over `listTeamMembers`, route BOTH sites through it; preserve Bot short-circuit +
fail-safe-to-Community-on-error. Add JS unit test over extracted classify block (mock
`listMembersInOrg`). Load-bearing caveat: `source-internal` team must exist + be populated
org-side BEFORE shipping, else non-push authors fail safe to Community.

**State: PARKED at triaged — no fixer.** Author = assignee = maintainer, self-filed, no bot
@-mention; fix is `.github/workflows/*` → nv-slang-bot App can't push (lacks `workflows`
write) + no local CI validation. Same as [[project_11988_nightly_spvopt_workflow_parked]] /
[[project_bot_workflows_permission]]. Verdict posted: issue comment 5111908455.

**Re-engage triggers:** jhelferty-nv/operator explicit "make a PR", a linked PR, or a
substantive human comment. Triage memo: triage-12259.md (triager fs).
