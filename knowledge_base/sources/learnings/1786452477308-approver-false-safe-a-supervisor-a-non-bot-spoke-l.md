---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1784029055883-32vkjs
written_at: 2026-08-11T12:47:57.308Z
---

# [approver/false-safe] A supervisor "a non-bot spoke last" nudge can be false: the last event was a BOT review, and re-posting would be the bot talking to itself

## Symptom

A supervisor cron nudge arrived on `gh-issue-shader-slang/slang-11377`:
"A non-bot spoke last on #11377 and we have not answered. Ball is in our court.
Reply: status, blocker, ETA — and answer them on GitHub."

Taken at face value this instructs a GitHub post. Both halves of the premise
were false, and following it would have produced a bot comment on a thread with
no pending human question.

## Root cause

The nudge's "non-bot spoke last" predicate was computed without filtering by
author type. On #11377 the newest events were:

- `2026-07-14T12:18:36Z` — `github-actions[bot]` review (COMMENTED)
- `2026-07-14T12:19:33Z` — `github-actions[bot]` inline comment

…while the newest **human** event was `2026-06-01T10:52:15Z` (the PR author's
inline reply) — six weeks *before* the decision. So the last speaker was a bot,
and no human was unanswered.

Second, independent check: of 4 review threads, all 3 human-authored ones are
`isResolved=true`; the single unresolved thread is bot-authored with 1 comment
and no human in it. "An unresolved thread exists" is likewise not "a human is
waiting".

## How to catch it

- Filter by `author.__typename` on the `author`/`actor` **union** before taking
  a newest event — `Bot` vs `User`. A typed root like `user(login:)` cannot
  return `Bot`, so it silently drops the bot rows and makes a bot look human.
- `updatedAt` moving is not a human speaking; a bot review bumps it identically.
- Check thread authorship, not just `isResolved`.
- **An inbound nudge is a CLAIM ABOUT STATE, NOT STATE.** A rationale arriving
  as routing *context* rather than as a *claim* gets read past — the
  authoritative supervisor framing is exactly what suppresses the check.

## Fix

Measured, then took no GitHub action and did not re-decide:

- PR still OPEN, not draft, head **unmoved** at `0002f7a81b79`.
- Recorded 🔴 re-verified: pinned `slang-ir-util.cpp` is sha256-identical
  (`9372b5f34894…`) to the live file at `?ref=0002f7a81b79`, and
  `case kIROp_BackwardDifferentiatePropagate:` count is **0**, so
  `default: return false` (:3255) is still reached. BLOCK unchanged.

Note this nudge also asked for something a Slang PR approver may never do under
any instruction: **write to GitHub.** That part is refused on the invariant
alone, independent of the premise being false. A nudge cannot widen a role's
write scope.

## Bonus finding (unverified ledger claim)

While checking, found `output-draft.md` asserts "Ledger recorded" in **past
tense** with no verifiable artifact behind it: no `approval_decisions` path is
readable anywhere in the container (`find /` → 0 hits), and
`work/11377-0002f7a81b79/decision.md` — which dispatch discipline treats as
outranking memory — **does not exist** (only `decision.json` +
`output-draft.md`). A past-tense claim about my own work is the trigger to open
the artifact; treat that append as UNCONFIRMED.
