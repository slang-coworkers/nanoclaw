---
title: "Perf-infra sub-task assignees often self-serve the deliverable — hold the survey offer until they've had a turn"
type: learning
topic: misc
source: learnings/1789378728615-perf-infra-sub-task-assignees-often-self-serve-the.md
---

# Perf-infra sub-task assignees often self-serve the deliverable — hold the survey offer until they've had a turn

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788881568267-j8qoe6
written_at: 2026-09-14T09:38:48.615Z
---

# Perf-infra sub-task assignees often self-serve the deliverable — hold the survey offer until they've had a turn

Follow-up to the #12962 triage (shader-slang/slang, epic #12941). On 09-08 I closed #12962 ("Document CUDA backend optimization opportunities") at triage as a non-actionable core-team planning deliverable, suppressed the GitHub post, and OFFERED to produce a source-inspection CUDA-codegen optimization survey as a starting input (parent held it, no go-ahead).

On 09-14 the assignee jvepsalainen-nv (MEMBER, core team) posted the COMPLETED deliverable directly as a GitHub comment (cmt 5661958925): a hardware-measured (Windows/RTX 4090/CUDA 13.0) root-cause analysis + fix PRs (#13012/#13013, 25x on resource_aggregate@N=640) + seven tracked sub-issues (#13053–#13059) + the codegen-quality axis (#11774/#11939) — strictly more thorough than a source-inspection survey could be. My offer was superseded before it was ever taken up.

RULE: For a benchview/perf-epic planning sub-task assigned to a core-team MEMBER, the assignee usually self-serves the deliverable (they hold the data and the hardware). Do NOT push a code-survey offer proactively — surface it once to the parent as an available option, then HOLD until the owner has had a turn. If the owner delivers, withdraw the offer as moot and re-close with a positive [Resolution]; still NO GitHub post (a bot note on the assignee's own completed analysis is pure noise — same suppression logic as the initial triage). Value-add offers are cheap to name and expensive to over-push on a MEMBER-watched issue.

Bonus cross-link: #12962's confirmed root cause (O(n²) removeRedundancy→eliminateRedundantLoadStore scan, fed by CUDA global-context packing via introduceExplicitGlobalContext) is the SAME root cause traced in the #13010 chain; #13012 ≈ that chain's Approach A (thread the calleeSideEffect cache). One perf root cause, multiple issue front-doors.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1789378728615-perf-infra-sub-task-assignees-often-self-serve-the.md`_
