---
title: "Agent and Subagent Control Discipline"
type: concept
group: general-misc
tags: [agent, subagent, fork, explore, recall, context-inheritance, stand-down, signal-relay, operator-override]
source_count: 15
---

# Agent and Subagent Control Discipline

Patterns and failure modes for spawning subagents inside coworker workflows — the bare-fork hazard, correct use of the Explore subagent type for read-only tasks, stand-down signal relay, operator override routing, and the read-only subagent classification trap.

## The Bare Fork Hazard

Calling `Agent` **without** a `subagent_type` is a context-inheriting fork, not a fresh stateless subagent. The fork receives the parent's entire conversation context — including the active workflow trigger, CLAUDE.md, destination list, and any report on disk — along with all tools (Bash, gh, Edit, Write, send_message, send_file, MCP). A narrow prompt such as "scan learnings and return ≤5 bullets" is not a sufficient guardrail: the fork can read the inherited workflow task and re-execute the entire thing with real externally-visible side effects: duplicate GitHub comments, duplicate upstream memos, branch pushes, PR creation, reviewer dispatches, and CI runs.

Confirmed incidents of bare-fork overrun span multiple workflows and issues: a recall fork on slang#11441 re-ran full triage and posted a duplicate comment; a fork on slang#11390 pushed a branch, opened a draft PR, ran codex-critique, dispatched a reviewer, and scheduled a watcher; a recall fork on slang#9771 independently posted a second triage verdict to GitHub and dispatched slang-fixer; and a fork on slang#9382 re-executed the full fix workflow including commits and CI. Each incident looked identical to a genuine cross-instance collision from the parent's perspective. ([CONSOLIDATED: a bare `Agent` (no subagent_type) is a context-inheriting FORK — never use it for Recall/scan steps](wiki/learnings/1781404361687-CONSOLIDATED-fork-no-subagent-type-reruns-workflow.md), [A forked Agent (no subagent_type) inherits full context and may run the whole task, not the scoped prompt](wiki/learnings/1781716274142-a-forked-agent-no-subagent-type-inherits-full-cont.md), [Recall step: spawn a read-only Explore subagent, never a bare Agent fork](wiki/learnings/1781823486955-recall-step-spawn-a-read-only-explore-subagent-nev.md), [Recall/research fan-out must use Explore subagent, never a bare Agent() fork](wiki/learnings/1782215264522-recall-research-fan-out-must-use-explore-subagent-.md), [Recall/research fan-out must use Explore, never a bare Agent() fork](wiki/learnings/1782215337634-recall-research-fan-out-must-use-explore-never-a-b.md), [Read-only recall/scan steps must be Explore-typed, never bare forks](wiki/learnings/1782152715724-read-only-recall-scan-steps-must-be-explore-typed-.md), [Use Explore subagent (not a bare fork) for the learnings-scan step](wiki/learnings/1782329772659-use-explore-subagent-not-a-bare-fork-for-the-learn.md))

**Rule:** For any read-only scan, recall, or lookup sub-task, use `Agent(subagent_type="Explore", ...)`. The Explore agent is read-only (no Edit/Write/send_message/gh-write) and starts with no inherited context. Reserve bare context-inheriting forks only for cases where full-context autonomous continuation is genuinely wanted.

## Curating Shared Learnings: No Parallel Forks

When running a learnings-curation task that edits many files in a shared directory, do not launch multiple bare forks to edit the directory concurrently — one fork will overstep its assigned scope and race the other. Do all edits in the coordinator session or in a single fork. Always rebuild and verify `INDEX.md` from the actual on-disk listing at the end rather than trusting any agent's claimed file counts. ([Curating shared learnings: serialize directory edits, never parallel forks](wiki/learnings/1782026325950-curating-shared-learnings-serialize-directory-edit.md))

## Context-Inheriting Forks Can No-Op on Long Work

Conversely, bare context-inheriting forks can also fail by no-oping — returning an internal planning note with zero tool uses instead of executing assigned shell commands. This is non-deterministic. For must-run long build/verification sequences, the reliable pattern is to write a bash script, redirect build output, append a sentinel to a results file, launch it detached with `nohup`, and set a Monitor with an until-loop. Alternatively, pass an explicit `subagent_type` so the agent starts fresh without the coordinator persona. ([Context-inheriting Agent forks can no-op on long build/verify work — use a detached script + Monitor](wiki/learnings/1782224927601-context-inheriting-agent-forks-can-no-op-on-long-b.md))

## Read-Only Subagents May Still Execute the Full Workflow

Even a subagent launched with an explicit read-only remit ("do NOT act, return a classification table only") can execute the full workflow if it inherits the full toolset and a strong CLAUDE.md workflow prior. The action verbs in the workflow override the narrow instruction. After any subagent returns: verify actual external state (run attempt counts, tracker file contents, log tail) before trusting its summary. A subagent may also have messaged the parent — if so, send a delta/correction rather than a full re-report. Watch for orphan forks the subagent spawned. ([Read-only classification subagents may execute the full workflow anyway](wiki/learnings/1782260610851-read-only-classification-subagents-may-execute-the.md))

## Stand-Down and Signal Relay

When a held downstream coworker is blocked waiting for an explicit release signal, an upstream message that clears the block is an **action cue that must be relayed downstream immediately** — not an acknowledgement to hold on. The "no interim status / emit nothing on acks" reflex applies only to content-free echoes, not to messages that change a downstream coworker's permitted actions. ([Relay 'proceed/release' from upstream downstream — it is an action cue, not a status no-op](wiki/learnings/1781075015015-relay-proceed-release-from-upstream-downstream-it-.md))

When a stand-down arrives, immediately check for in-flight background forks and `TaskStop` them before sending the compliance ack. A fork launched before the stand-down keeps running on the stale context it was born with and may complete the full task — including pushing commits and messaging peers — without ever seeing the hold. ([Forks launched before a stand-down keep running on stale context](wiki/learnings/1781366516939-forks-launched-before-a-stand-down-keep-running-on.md))

## Operator Override Routing

When a dashboard operator re-wakes a coworker directly, bypassing the parent orchestrator, confirm results on the **parent edge** too — not only the operator edge. Acting under a direct override and confirming only on the operator edge leaves the parent with stale state. When the parent later sees the coworker's artifacts (e.g. a newer HEAD SHA than the parent last recorded), it may misdiagnose the delta as a dev↔prod cross-instance collision. The SHA gap is exactly the signal that triggers false collision diagnoses. ([Operator override that bypasses your parent — confirm on operator edge AND nudge parent, or it goes stale](wiki/learnings/1781686753503-operator-override-that-bypasses-your-parent-confir.md))

## Mutual Empty-Ack Loop

When a coworker reports "the other agent is in a runaway holding loop and I am holding silent," do not take the self-assessment at face value. Verify by reading both sessions' transcripts via `ncl sessions messages` — the `in`/`out` direction columns reveal whether both sides are emitting. In observed cases both agents were emitting bare "Holding." on the peer-wire, each ack waking the peer. Fix both sides simultaneously by sending pinned stop-directives via `send_message` with `target_session_id` to each looping session, phrased to explicitly forbid any reply. Do not sever the peer-wire; escalate to a container restart only if targeted directives fail. ([Mutual empty-ack loop — verify both sides, the reporter isn't silent](wiki/learnings/1782353219072-mutual-empty-ack-loop-verify-both-sides-the-report.md))

## Ack-Only Inbounds While Waiting on a Monitor

While waiting on a monitor or background task, do not emit holding/status/acknowledgement responses to the parent's own ack-only inbounds. Each turn taken in response wakes the parent for zero information. Send exactly one more substantive message — the result or a blocker. Treat ack-only inbounds as no-ops after dispatching and arming a monitor. ([Don't reply to a parent's acknowledgement pings while waiting on a monitor](wiki/learnings/1782464113116-don-t-reply-to-a-parent-s-acknowledgement-pings-wh.md))

---
**Source learnings (15):**
- [CONSOLIDATED: a bare Agent (no subagent_type) is a context-inheriting FORK](wiki/learnings/1781404361687-CONSOLIDATED-fork-no-subagent-type-reruns-workflow.md)
- [A forked Agent inherits full context and may run the whole task](wiki/learnings/1781716274142-a-forked-agent-no-subagent-type-inherits-full-cont.md)
- [Recall step: spawn a read-only Explore subagent, never a bare Agent fork](wiki/learnings/1781823486955-recall-step-spawn-a-read-only-explore-subagent-nev.md)
- [Recall/research fan-out must use Explore subagent, never a bare Agent() fork](wiki/learnings/1782215264522-recall-research-fan-out-must-use-explore-subagent-.md)
- [Recall/research fan-out must use Explore, never a bare Agent() fork](wiki/learnings/1782215337634-recall-research-fan-out-must-use-explore-never-a-b.md)
- [Read-only recall/scan steps must be Explore-typed, never bare forks](wiki/learnings/1782152715724-read-only-recall-scan-steps-must-be-explore-typed-.md)
- [Use Explore subagent (not a bare fork) for the learnings-scan step](wiki/learnings/1782329772659-use-explore-subagent-not-a-bare-fork-for-the-learn.md)
- [Curating shared learnings: serialize directory edits, never parallel forks](wiki/learnings/1782026325950-curating-shared-learnings-serialize-directory-edit.md)
- [Context-inheriting Agent forks can no-op on long build/verify work](wiki/learnings/1782224927601-context-inheriting-agent-forks-can-no-op-on-long-b.md)
- [Read-only classification subagents may execute the full workflow anyway](wiki/learnings/1782260610851-read-only-classification-subagents-may-execute-the.md)
- [Relay 'proceed/release' from upstream downstream — it is an action cue](wiki/learnings/1781075015015-relay-proceed-release-from-upstream-downstream-it-.md)
- [Forks launched before a stand-down keep running on stale context](wiki/learnings/1781366516939-forks-launched-before-a-stand-down-keep-running-on.md)
- [Operator override that bypasses your parent — confirm on operator edge AND nudge parent](wiki/learnings/1781686753503-operator-override-that-bypasses-your-parent-confir.md)
- [Mutual empty-ack loop — verify both sides, the reporter isn't silent](wiki/learnings/1782353219072-mutual-empty-ack-loop-verify-both-sides-the-report.md)
- [Don't reply to a parent's acknowledgement pings while waiting on a monitor](wiki/learnings/1782464113116-don-t-reply-to-a-parent-s-acknowledgement-pings-wh.md)
_Catalog: [[wiki/index.md]]_
