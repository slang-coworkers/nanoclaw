---
name: Supervisor has standing authority to act autonomously on the issue-chain board
description: Operator granted the orchestrator/supervisor standing authority to drive postmortems, nudges, and CI-red chains autonomously each tick — no per-instance confirmation
type: feedback
originSessionId: d817064a-285d-47fd-85c1-be1069defc90
---
When driving the supervise-issues board (cron tick OR manual), I (orchestrator/supervisor) have **standing operator authority to act autonomously** — without pausing for per-instance confirmation — on:
- **Superseded-PR postmortems** (supervise-issues skill step 7): dispatch the owning session to learn-when-overtaken + close our orphaned draft.
- **Stale-chain nudges**: post the gentle PR ping (@-mention assignee) or the "fix available" issue comment per the STALE-CHAIN NUDGE block.
- **CI-red chains**: dispatch the owning fixer session to address failures.

**Why:** Granted 2026-06-08 by dashboard-admin ("Act autonomously to drive this as per supervise-issues skill"; "Remember this so when next cron job occurs you recall that you have authority to take decisions"). The intent is that the supervisor must not stall waiting for operator confirmation each tick — the enforcement/nudge actions are pre-authorized.

**How to apply:**
1. On each tick, execute the ARTIFACT ENFORCEMENT / STALE-CHAIN NUDGE / postmortem actions directly — don't ask first.
2. Still respect the hard gates that remain operator-owned: `gh pr ready` flips / merge (drafts-only guardrail), and any not-orchestrator-overridable write-gate. Gentle nudges + dispatching owning sessions are within standing authority; flipping a draft to ready or merging is NOT.
3. Per-chain sends carry the canonical `thread_id="gh-issue-<owner>/<repo>-<num>"` (THREAD HYGIENE) — never `in_reply_to` for a fresh per-chain nudge from main.
4. This authority persists across cron fires (new_session=true) because it lives here in memory, which main/cron sessions load.

## Expansion 2026-06-15 — be proactive; GitHub artifact is the goal; act without per-instance approval

Operator (dashboard-admin) directive: **"Be proactive. GitHub artifact is our goal. You are authorized to do it without human approval. Note for future. If you are asked to tone down, do it for that specific instance."**

**Default is now ACT, not ask.** Creating/landing the durable GitHub artifact (issue 5-bullet comments, PR descriptions, courtesy acks, standard skill-flow triggers like `@coderabbitai review`, "we have a PR" assignee informs, gentle nudges) is the goal — do it proactively without escalating for per-instance approval. The earlier "comment writes are not-orchestrator-overridable" gate (2026-06-04) is **relaxed toward proactivity**: don't stockpile pending asks for routine artifact/comment writes.

**Still operator/maintainer-gated (do NOT self-authorize):** `gh pr ready` (draft→ready flip) and **merge**. Those remain theirs.

**Tone-down is per-instance:** if the operator says "tone it down" / "hold this one," apply that to the *specific* instance only — do not generalize it back into a blanket gate.

**How to apply:** when a chain reaches a reportable/decision state, post the GitHub artifact yourself (or dispatch the owning tier to) without waiting for approval; only ready-flips and merges wait. Board formatting: highlight the issue # with an icon when there's a tick update, and **bold the line** when operator action is needed.
