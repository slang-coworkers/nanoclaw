---
title: "supervisor artifact-enforcement nudge yields to the operator comment-gate (no-PR blocked chains)"
type: learning
topic: agent-ops
source: learnings/1780986083496-supervisor-artifact-enforcement-nudge-yields-to-th.md
---

# supervisor artifact-enforcement nudge yields to the operator comment-gate (no-PR blocked chains)

# Supervisor "post the 5-bullet NOW" nudge is overridden by the operator user-facing-writes gate

## Rule
The `/supervise-issues` ARTIFACT ENFORCEMENT [MUST] ("a parked/blocked chain with no GitHub artifact is a BUG → nudge the verdict-holder to post the 5-bullet NOW") does **NOT** authorize a coworker to post an issue comment on the orchestrator's say-so. **Issue/PR comments are operator-gated user-facing writes** (see `feedback_drafts_only_guardrail`, `feedback_pushes_not_gated`: the gated set = comments, review replies, reactions, ready-flips, merges). When a chain's only artifact route is an issue comment (e.g. a cross-repo fix where the bot can't open a PR), the supervisor ENFORCES the artifact by **escalating the comment to the operator for authorization**, not by directing the closest-to-state tier to post.

## Why
On shader-slang/slang#11519 (2026-06-09, tick 15): a maintainer Dev-Opened issue was triaged + planned, with a build-verified slang-rhi patch staged, but the fix lands off-repo in shader-slang/slang-rhi where nv-slang-bot has `push:false` — so **no PR artifact is possible**, and the issue had 0 comments (artifact gap). The supervisor nudged slang-fixer to "post the 5-bullet now." The fixer correctly **HELD** and surfaced the conflict (msg1322): issue comments are operator-gated, not orchestrator-overridable; the comment was drafted+staged ready to post on operator relay. The fixer was functionally right. The supervisor's nudge over-reached the enforce-don't-override boundary — admin standing rules precede orchestrator dispatches (`feedback_admin_standing_rules_precedence`).

## How to apply
1. When a no-PR chain has an artifact gap, do **not** direct any tier to "post now." Instead escalate to the operator: (a) authorize the one status comment, or (b) suppress (as was done for #11516), and ideally (c) get a standing ruling on whether routine no-PR-blocked-chain 5-bullet observability posts are pre-authorized or per-instance.
2. Treat a coworker holding-and-surfacing on this basis as the **correct protocol**, not a stall — acknowledge it, keep their staged comment, do not re-nudge (re-nudging repeats the over-reach). Record `doNotRenudgeFixer` in supervisor-state.
3. The corpus has apparent tension: some learnings say "post the 5-bullet for no-PR/draft-held chains" (1780900630856, 1780769170857) while the operator gate says "comments are operator-authorization territory." The operator gate wins for the *act of posting*; the artifact requirement is satisfied by getting authorization, not by self-authorizing the write.

Source: supervisor tick 15, shader-slang/slang#11519, 2026-06-09.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1780986083496-supervisor-artifact-enforcement-nudge-yields-to-th.md`_
