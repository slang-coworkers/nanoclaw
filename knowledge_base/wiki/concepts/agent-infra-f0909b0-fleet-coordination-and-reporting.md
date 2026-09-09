---
title: "Fleet Coordination: Persisting Commitments, Report Honesty, and Task Plumbing"
type: concept
group: agent-infra
tags: [persistence, tracker, disposition, reporting, scheduled-task, thread-backpressure, stale-comment]
source_count: 6
---

## TL;DR

Commitments and dispositions that live only in chat evaporate on the next context/sweep;
report fields that exist in JSON but never in prose might as well not exist; and task/thread
plumbing has silent-skip failure modes. Persist to a durable store, audit every consumer, and
distinguish a config-skip from a transient error.

- **A conditional trigger for a future sweep ("check X next time, act if Y") must be written to
  the tracker/memory in the same turn** — chat history does not survive to the next sweep. Same
  class as "specified ≠ built."
- **A disposition settled in conversation evaporates on the next fresh context exactly like an
  unpersisted guard** — if anyone says "we settled this already," grep for where the rule should
  live and WRITE it there (e.g. a CLAUDE.local.md section), don't just acknowledge.
- **When you add an honesty field to a payload (`totalNonDraft`, `prsTruncated`), the fix isn't
  done until every consumer is audited** — the human-facing report is a consumer, and it's the one
  place field-passing failures are invisible until someone with independent ground truth calls it.
- **A scheduled task with a hardcoded absolute skill-script path silently skips in any group whose
  container installs that skill at a different path** — a missing-file exit 2 is indistinguishable
  from a transient error, so "post only if due" swallows it. Invoke by slash name; author/verify
  inside the owning group's container.
- **A `send_message` "Refusing to send to thread ... without in_reply_to" is backpressure on a
  long-lived session's deep inbound queue** — pass an explicit new `thread_id` to open a fresh
  thread; don't guess an `in_reply_to`. Rotate proactively for recurring heartbeat/sweep reports.
- **On PR-superseded/closed, fix your own stale issue comment's next-action, not just the git
  artifacts** — a 5-bullet comment pointing at a dead PR misleads readers; PATCH it in place (a
  correction, not a banned echo).

## Synthesis

### A commitment or disposition that lives only in chat is functionally unspecified

Three learnings share one root: state that decides future behavior must be written to a durable
store, or it evaporates when the conversation scrolls out of context. A "next sweep, check
condition X" instruction exchanged and confirmed in chat vanished when neither side wrote it to
`rerun-tracker.json`'s PR entry — a day later neither party could find it, triggering a chain of
misattribution before the transcript resolved it ([cross-sweep chat commitments must be persisted to tracker](../learnings/1786782427154-cross-sweep-chat-commitments-must-be-persisted-to-.md)).
When a sweep conversation produces a conditional trigger for a future sweep, write it into the
tracker entry (a `watch` field with condition + baseline) or a memory note in the same turn — it
is the same class of gap as "specified ≠ built."

The CI-babysitter learning generalizes this to *dispositions*: a rule settled across three sweeps
("idle-time alone is never a nudge trigger for an author-owned red") kept getting re-answered every
sweep because it lived only in chat — the recurring "consider a nudge" advice line was itself the
symptom ([CI babysitter: author-owned red disposition, now persisted](../learnings/1786918293889-ci-babysitter-author-owned-red-disposition-and-cle.md)).
Fixed by writing the rule into a CLAUDE.local.md section, plus a reporting-rule addendum (a clean
sweep with no new finding needs no message to parent at all). The general lesson: a disposition
settled in conversation evaporates on the next fresh context/sweep exactly like an unpersisted
guard — if parent (or anyone) says "we settled this already," the fix is to grep for where the
rule should live and write it there, not to acknowledge and move on. (This is the coordination-side
twin of the supervisor rule that fixing a classifier is only real once the disposition is persisted
to `supervisor-state.json`.)

### Audit every consumer of a payload, especially the human-facing report

Adding an honesty field to a data payload is not done until every consumer is audited. A
wake-payload script was correctly fixed to paginate `/pulls` fully and emit
`totalNonDraft`/`prsCap`/`prsTruncated` alongside the capped `prs` array — verified firing with
`totalNonDraft:110, prsTruncated:true` — yet two sweep reports in a row still told the parent "20
PRs checked" with no mention of the true 110 or the truncation, because the chat-report composition
never echoed the new fields ([sweep report must echo totalNonDraft/prsTruncated](../learnings/1787286325789-sweep-report-must-echo-totalnondraft-prstruncated-.md)).
The bug was fully fixed at the data layer; the omission was purely in the report format — the one
consumer where field-passing failures are invisible until someone with independent ground truth
(the parent's own live count) calls it out. Add a lint/checklist step: does my report literally
contain the words `totalNonDraft`/`prsTruncated` (or their content) when the script emits them? A
field that exists in JSON but never in prose might as well not exist for the reader. (This is the
same producer/consumer-starvation shape as the supervisor board-sync filter matched on a body the
fetch layer never populated.)

### Task and thread plumbing: silent skips and backpressure

Two learnings are about NanoClaw plumbing that fails quietly. A scheduled/recurring task that
invokes a skill via a hardcoded absolute script path (e.g.
`python3 /home/node/.claude/skills/<skill>/scripts/x.py`) silently skips in any group whose
container installs that skill at a different path — the `slang-pr-report` skill lives at
`/home/node/.claude/skills/...` in the Orchestrator but at `/workspace/agent/slang-skills/skills/...`
in the Maintainer, and a missing-file exit 2 is indistinguishable from a transient error, so
"post only if due" logic swallows it ([scheduled task with hardcoded skill script path silently skips](../learnings/1787548296286-scheduled-task-with-hardcoded-skill-script-path-si.md)).
`/workspace/**` and `/home/node/.claude/skills/**` are per-container, so you cannot validate another
group's task path from your own `ls`. Prefer invoking the skill by its slash name; if a path must be
hardcoded, author/verify it inside the owning group's container (`ncl tasks` is group-scoped from a
container), and make the exit-2 branch distinguishable from transient errors so it can't be swallowed.

Separately, a `send_message` rejected with "Refusing to send to thread ... without in_reply_to,"
citing hundreds of unresponded inbound rows, is **backpressure on a long-lived session's deep
inbound queue** — not a crash, and not something to paper over by guessing an `in_reply_to` seq
number (a session born 2026-07-07 had ~2 months of accumulated heartbeat/sweep traffic)
([sweep thread backpressure — rotate thread_id, don't guess in_reply_to](../learnings/1788168500995-sweep-thread-backpressure-rotate-thread-id-don-t-g.md)).
Pass an explicit new `thread_id` (e.g. `heartbeat-report-<date>`) to open a fresh thread on the same
destination — it bypasses the cap immediately. Durable cleanup (purging the old session) is an
operator action; `ncl sessions` is read-only. Rotate the thread proactively for recurring
heartbeat/sweep reports rather than waiting for the rejection.

### A superseded PR leaves a stale next-action in your own issue comment

When your PR is closed unmerged and superseded, cleaning up the git artifacts (worktree, fork
branch, sentinel) is not enough — the 5-bullet comment you posted on the issue when the PR opened
has a next-action that now points at your dead PR, and a reader lands there and chases it
([on PR-superseded/closed, fix your own stale issue comment's next-action](../learnings/1787851432506-on-pr-superseded-closed-fix-your-own-stale-issue-c.md)).
If you were the last commenter on the issue and no human has commented since, PATCH your own
PR-opened comment in place to redirect the next-action to the superseding PR — this is a stale-fact
correction, not a banned echo (the silence rule bans echoes, not corrections that change what a
reader would do). The maintainer's close note usually lives on the *PR*, not the *issue*, so it
doesn't cover the issue's own footprint. Rule of thumb for the `github.pr_closed` (merged=false)
handler: after cleanup, ask "does any GitHub comment I authored still assert a next-action against
this now-dead PR?" — if yes, edit it to point at the replacement.

**Source learnings (6):**
- [Cross-sweep chat commitments must be persisted to tracker, not left in transcript](../learnings/1786782427154-cross-sweep-chat-commitments-must-be-persisted-to-.md) — write a future-sweep conditional trigger into the tracker/memory the same turn; chat doesn't survive to the next sweep.
- [CI babysitter: author-owned red disposition and clean-sweep silence, now persisted](../learnings/1786918293889-ci-babysitter-author-owned-red-disposition-and-cle.md) — a disposition settled in chat evaporates like an unpersisted guard; grep for where the rule lives and write it there.
- [Sweep report must echo totalNonDraft/prsTruncated, not just the capped count](../learnings/1787286325789-sweep-report-must-echo-totalnondraft-prstruncated-.md) — audit every consumer of a new honesty field; the human report is a consumer; a field only in JSON is invisible to the reader.
- [Scheduled task with hardcoded skill script path silently skips per-container](../learnings/1787548296286-scheduled-task-with-hardcoded-skill-script-path-si.md) — skill install paths differ per container; exit-2 looks transient; invoke by slash name, author inside the owning container.
- [Sweep thread backpressure — rotate thread_id, don't guess in_reply_to](../learnings/1788168500995-sweep-thread-backpressure-rotate-thread-id-don-t-g.md) — a "refusing to send without in_reply_to" rejection is deep-queue backpressure; pass a new `thread_id`; rotate heartbeat/sweep threads proactively.
- [On PR-superseded/closed: fix your own stale issue comment's next-action, not just the worktree](../learnings/1787851432506-on-pr-superseded-closed-fix-your-own-stale-issue-c.md) — PATCH your PR-opened issue comment to redirect to the superseding PR; a stale-fact correction is not a banned echo.
