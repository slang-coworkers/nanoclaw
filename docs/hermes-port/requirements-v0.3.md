> **v0.4 addendum (2026-09-09) — fleet topology baseline.** The operator fixed the target topology in `container/spines/hermes/context/topology.md`: one Hermes gateway per fleet in Bot Mode, coworkers as profiles, Bot Chat and kanban for bot-to-bot work, per-profile podman tool sandboxes as the isolation MUST, an elevated orchestrator profile, adopt-Hermes-native first, one desktop app as the unified panel. Reading of the requirements under it: **SR-1a / SR-5 (tool-tier isolation)** are met by per-profile podman sandboxes plus a `pre_tool_call` veto; **SR-1b (whole-agent isolation)** is satisfied at the tenant boundary only (a second gateway per tenant), not per bot; **SR-3 (A2A authorization)** is met inside the fleet by room membership plus the same veto on `message_agent`, with a2a reserved for cross-gateway peering; **FR-11 (project self-onboarding)** is the compose plugin that renders coworker types into the gateway's profiles. Each of the 61 gap rows now carries a disposition (ADOPT / CONFIGURE / BUILD / MERGE / DEFER) in `gap-matrix.md`, judged against outcomes O1-O8 in `outcomes.md`; the dispatch order is `dispatch-plan.md`.

ultrathink - We want to make this whole hermes bot setup - to implement some requirements
---
Requirements to Support Slang Coworkers on a Corp-Standard Agent Stack
v0.3-draft  ·  Harsh Aggarwal  ·  30 Jul 2026
1. Objective and Scope
Slang Coworkers is an existing production system. We want other teams to be able to recreate Slang Coworkers on top of NVIDIA's enterprise-approved standard stack, starting with NemoClaw. The enterprise stack has limits — especially in NemoClaw — that must be fixed before a team could recreate this result without building its own systems instead.
For background on Slang Coworkers, including its architecture, roles, workflows, and current behavior, see the Slang Coworkers wiki. This document intentionally does not restate that material.
This document identifies the NemoClaw capabilities that Slang Coworkers requires, highlights the gaps, and provides acceptance criteria for closing them. The status column reflects our current understanding and should be validated with the NemoClaw team. The requirements should also inform the NemoClaw Internal Workflow Architecture working draft.
2. Requirements
Every requirement belongs to one of six categories. The highest-priority gaps: artifact ownership and routing, workload identity and scoped access, A2A authorization, project isolation, NV-systems connectivity, zero-downtime skill and workflow updates, and end-to-end telemetry.
Category
Requirement IDs
Sandboxing & Isolation — runtime, context, and permission scope per container
SR-1  ·  SR-5  ·  FR-10
Identity & Access — credentials, tools, NV systems
SR-2  ·  SR-6  ·  SR-8
Communication — events in/out, A2A, humans
FR-1  ·  FR-4  ·  FR-5  ·  FR-6  ·  SR-3  ·  PR-1
Workflow & Orchestration — ownership, loops, gates, scheduling
FR-2  ·  FR-3  ·  FR-7  ·  FR-9  ·  SR-4  ·  PR-3
Knowledge & Skills — shared learnings, versioned skills, onboarding
FR-8  ·  FR-11  ·  NF-3
Observability & Operations — telemetry, outcomes, audit, self-healing
NF-1  ·  NF-2  ·  NF-4  ·  NF-5  ·  NF-6  ·  NF-7  ·  NF-8  ·  SR-7  ·  PR-2  ·  PR-4  ·  PR-5

Priority:  P0 — required to run Slang Coworkers safely and correctly on NemoClaw   ·   P1 — required for production at useful scale   ·   P2 — important, not an initial blocker.  P0 rows are listed first in every table.
Status:  YES — supported today   ·   NO — not currently supported   ·   TBD — NemoClaw team to confirm.
2.1 Functional Requirements
ID
Category
Capability required
Acceptance criteria
Pri
Status
FR-1
Communication
Event-driven activation: signed webhooks, bot events, and chat messages wake the right workload; no polling
A bot's PR review comment and a CI check-run event each wake the workload that owns that PR; a Slack approval wakes the approver; unsigned payloads are rejected and logged
P0
TBD
FR-2
Workflow
Single ownership, routing, and handoff: every artifact has exactly one owning workload; events route to it; transfers are recorded
Two CI events for PR #123 arrive together — only the owning fixer acts. Triage hands PR #123 to a fixer; the handoff is recorded and later events reach the fixer
P0
NO
FR-3
Workflow
Durable workflows: loops, pause, resume: revisit prior steps without losing lineage; suspend and resume with state intact
A fix → verify → fail → rework loop on one SHR: round 3 is traceable to round 1. A fixer paused on a reviewer's question resumes with its workspace and context
P0
NO¹
FR-4
Communication
Human approval and escalation: approval cards to named humans; escalation on repeated failures; control over who may task a workload
A change failing review twice raises an approval card to the project owner; an unauthorized Slack user cannot task a workload
P0
TBD
FR-5
Communication
A2A messaging: correlated request/response between workloads, plus read-only status subscriptions (authorization: SR-3)
A reviewer's question to the fixer returns to the exact session that asked. A triager subscribes to PR #123 status without being able to act on it
P1
TBD
FR-6
Communication
Outbound channel adapters: post to GitHub, Slack, Discord — threads, edits, reactions, attachments — under the workload's identity
A workload posts a PR review and a threaded Slack reply attributable to its identity; attachments transfer both ways
P1
TBD
FR-7
Workflow
Project orchestrator: inspects its project's workloads, routes work, recovers stalls — without writing through another workload's identity
The orchestrator spots a fixer stalled for 4 hours, nudges it, and reassigns if still stuck — it cannot edit the fixer's work
P1
TBD
FR-8
Knowledge
Project-scoped shared knowledge: approved learnings flow to later sessions in the same project; no unintended cross-project reads
A build quirk learned fixing one slang issue is available to the next slang session; other projects see it only after explicit promotion
P1
NO
FR-9
Workflow
Durable scheduled triggers: scheduled work fires reliably across restarts and idle periods
A nightly SHR sweep fires once at the right time, even across a platform restart or idle period
P1
TBD
FR-10
Sandboxing
Per-workload provider, model, and effort: each workload picks its own; an independent reviewer runs in its own container, connected by A2A, possibly on a different provider
The fixer runs on provider A; its reviewer runs on provider B in its own container — per-workload config, not a deployment setting
P1
TBD
FR-11
Knowledge
Project self-onboarding: scaffold a complete project — roles, workflows, skills, wirings — from templates with one command
A new team goes from repository URL to deployable workload definitions in under a day, without the platform team
P2
NO

¹ The pause/resume half is verified (rehydration: same container and workspace, fresh session context); loops are not supported.
2.2 Security Requirements
ID
Category
Capability required
Acceptance criteria
Pri
Status
SR-1
Sandboxing
Workload identity and runtime isolation: each role or agent instance has its own attributable identity in its own container; contexts are isolated
A fixer and reviewer are separate principals in separate containers; one cannot read the other's files or context; every log line names exactly one principal
P0
NO
SR-2
Identity & Access
Scoped credentials, network, and tools: base policy + role grants, capped by the project. Credentials injected only when used, never on disk, rotated with no container downtime
The reviewer cannot push and cannot read the fixer's token from anywhere it can reach. An expiring GitHub token refreshes with no container restart
P0
NO
SR-3
Communication
A2A authorization: workloads discover or message each other only through configured connections; approval gates on selected connections; a delegated child may reply upward to its parent
slang-fixer cannot discover or message slangpy-reviewer until wired; a gated message waits for an approver; a delegated sub-task replies to its parent without extra wiring
P0
NO
SR-4
Workflow
Mandatory policy gates: required checks run before protected actions; the workload cannot bypass them
A fixer cannot open a PR unless the code-critique gate has passed; an attempted push around the gate is blocked, not just logged
P0
YES²
SR-5
Sandboxing
Project isolation: compute, filesystem, process, and credential boundaries between projects
A runaway build or compromised workload in project A cannot slow, read, or alter project B
P0
NO
SR-6
Identity & Access
NV-systems connectivity, scoped per identity: attach NVBugs, Jira, Jama, Colossus, DriveFarm and other CLI/MCP tools behind the credential proxy; tool surface resolved per role identity (per SR-2)
The fixer's identity gets NVBugs-write and Jira-read; the reviewer's is read-only; an unscoped tool is invisible to the workload, not merely denied
P0
NO
SR-7
Observability
Immutable ledger: record shipped changes, approvals, and ownership transfers; keep session transcripts
For any merged PR, the ledger proves the approved commit hash equals the merged hash — and who approved it
P1
NO
SR-8
Identity & Access
Operator access control: human roles (owner / admin / member) scoped per project
A project admin cannot administer another project's workloads; every operator action is attributed
P1
TBD

² Verified on the Hermes engine; cross-engine parity is NF-2.
2.3 Performance and Scale Requirements
Targets from the current Slang Coworkers deployment; revise after measuring an end-to-end integration.
ID
Category
Capability required
Target or acceptance criteria
Pri
Status
PR-1
Communication
Durable, idempotent event delivery
An event arriving during an outage is delivered once after recovery — no loss, no duplicate work
P0
TBD
PR-2
Operations
Parallel execution
≥ 10 concurrent sessions per project, including ≥ 3 concurrent builds of 6–13 GB each (Slang production; revise for larger codebases)
P1
TBD
PR-3
Workflow
No duplicate external side effects
A fixer killed just after posting a PR comment does not re-post it when respawned
P1
NO
PR-4
Observability
Cost attribution
Cost per merged change, reportable per identity
P1
TBD
PR-5
Operations
Activation latency
Measure current wake latency, agree a target, identify the speed-of-light path to it
P2
TBD

2.4 Reliability and Observability Requirements
ID
Category
Capability required
Acceptance criteria
Pri
Status
NF-1
Observability
Engine-independent session telemetry: drill from fleet view to one session's full transcript — the exact prompt as sent over the wire, harness-injected system prompt and tool definitions included
The same drill-down works identically for Claude- and Codex-backed sessions
P0
TBD
NF-2
Observability
Engine capability parity: every requirement holds on each supported engine, or the divergence is documented per row
Gates (SR-4) fire identically on every engine; known gaps are listed, not discovered
P0
NO
NF-3
Knowledge
Version-controlled skills and workflows, zero-downtime updates: hosted in external repos, version-pinned per workload, pulled at session start; installing or updating never stops any other component
Bumping a skill version updates that workload's next session; running sessions and all other workloads are untouched; a broken reference fails deploy visibly
P0
TBD
NF-4
Observability
Outcome accounting: track each artifact to its final outcome — merged, resolved by a human, triage-only, not actionable
Win-rate (merged ÷ actionable) per project per week; a human superseding an agent's fix counts as a human win
P1
NO
NF-5
Operations
Restart recovery: active work and pending interactions survive platform restarts
A restart mid-task loses no work; parked questions resume
P1
YES
NF-6
Operations
Runaway protection: detect and stop uncontrolled loops or spend
A looping workload is parked before material spend, with one actionable human alert
P1
YES
NF-7
Operations
Safe platform upgrades: state backed up before migration; restore path exists
A live fleet upgrades without silent skips or state loss; a failed migration restores
P1
TBD
NF-8
Operations
Workspace lifecycle: reclaim old workspaces only after preserving required artifacts and records
Old workspaces are reclaimed with work products saved first; storage pressure never stops the fleet
P2
TBD

3. Decisions Requested from the NemoClaw Team
1.  Validate the current status of every requirement.
2.  Confirm whether each P0 requirement belongs in NemoClaw or in an integration layer owned by Slang Coworkers.
3.  Confirm which requirements hold uniformly across agent engines (NF-2, FR-10).
4.  Assign an owner and delivery plan to every P0 item marked NO or TBD.
5.  Define the smallest end-to-end milestone that runs one existing Slang Coworkers workflow on NemoClaw.
6.  Use that milestone to validate the architecture, security boundaries, telemetry, scale targets, and remaining gaps.
The immediate goal is an agreed capability map and an owned P0 closure plan, not a redesign of Slang Coworkers.
4. References
Slang Coworkers overview — nvidia.atlassian.net/wiki (Slang Coworkers)
Slang Coworkers dashboard — nv/slang-coworkers
NemoClaw Internal Workflow Architecture, working draft

---
We want to read the hermes documetnation if its already possible or not --
However if not : we would like to plan to implmeent it --
Since we have nanoclaw (slang-cpu-coworkers) we can probably /onboard-project <path/to/hermes> -- Wherever it should : rsync to 2:slang-cpu-coworkers pane at corredct location --
---
The idea is to create mcp to use deepwiki (since oss project) and create a hermes-reader/writer and basic onbaordign profile to make it work
---
I would like us to reconstruct the whole pane [Image #35] inside coworkers :
---
And then have it implement requiremetns and test those features in loop (verification loop closed)
---
We need to ask / implemnet to use podman to ensure this works
---
can you create a plan and visual html how we should proceed it
