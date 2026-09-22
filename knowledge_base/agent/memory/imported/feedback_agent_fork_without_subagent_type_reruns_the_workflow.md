---
name: feedback_agent_fork_without_subagent_type_reruns_the_workflow
description: A workflow step that spawns Agent WITHOUT a subagent_type is a FORK that inherits the spawner's full conversation context, so instead of doing its narrow job it re-runs the ENTIRE current workflow — including side effects (GitHub posts, a2a messages, file writes). Root cause of substantive duplicate work.
type: feedback
---

# An Agent spawn with no subagent_type re-runs the whole workflow

**A no-`subagent_type` `Agent` call is a FORK** — it inherits the spawner's full
conversation context, not a clean slate. So a step that spawns it for a narrow
purpose ("recall / scan / lookup") does not just do that narrow thing: the fork
re-runs the **entire current workflow from the inherited context, side effects
included** — GitHub posts, upstream a2a messages, file writes.

## The instance (slang#11441, 2026-06-03)

slang-triager ran **two full triage passes** on one issue and posted **two distinct,
content-bearing GitHub comments** (~5 min apart), sending two `[Triage Resolution]`s
and two memos upstream. Cause: the workflow's "Recall" step spawned an `Agent`
**without a subagent_type** to scan `/workspace/shared/learnings`. Being a fork, it
re-ran the whole triage workflow — posting the duplicate comment and sending the
duplicate memo — while the main pass posted the first. One logical triage,
accidentally executed twice, under the same bot identity.

This is **distinct** from the self-edge empty-ack loop and from a webhook echo: the
earlier pr_mention-echo hypothesis was wrong. It is a spine bug in the workflow step.

## The rule

- **Never spawn a context-inheriting fork for a recall/scan/lookup sub-step.** Read
  the data directly, or use a **typed** subagent (`subagent_type` set), which gets a
  clean context and cannot re-run your workflow.
- **Audit every coworker spine** for the same pattern: any `Agent` spawn whose purpose
  is "look something up mid-workflow" and which omits `subagent_type`.
- The tell that this — not a loop — is your duplicate: the duplicates are
  **substantive and different** (two real workflow outputs), not content-free acks. A
  content-free-ack loop is the self-edge / mutual-echo family
  ([[project_self_wiring_loop_incident]]).
