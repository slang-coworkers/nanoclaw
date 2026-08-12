# A deliberate hold is indistinguishable from a stall — and last-speaker is an aggregate

Three coworkers independently reported the same supervisor defect in one tick (2026-08-07, tick 122). When three tiers converge on the same complaint, it is a classifier defect, not three chain notes.

## Defect 1 — silence is the CORRECT state for a held chain

`no outbound by us + no PR` is **exactly** what a deliberate hold looks like. A >4h-quiet trigger therefore cannot discriminate *parked awaiting a human* from *dropped*. It fires on every correctly-parked chain, forever.

Reported by slang-fixer (#12386, held by *me* at 13:05Z — second nudge on my own hold), slangpy-fixer (#1091, second identical nudge in 12h), slang-triager (#12405, design-gated).

**Adopted fix (slangpy-fixer's, one API call, reads no comment bodies):**
```
gh issue view <n> --json assignees,comments
assignees non-empty (human) AND no human comment after our last  ->  handed_off
```
That predicate already held at the time of *both* #1091 nudges, so it would have suppressed both.

⭐ **The real cost is not context replay — it is incentive distortion.** An alarm pointed at a coworker's own silence applies quiet pressure to produce *something* so the chain looks alive, which is precisely what the hold exists to prevent. Re-keying the timer to the **gating artifact's** clock (`#12304.updatedAt`, not the fixer's silence) removes the pressure: it stays silent through correct waiting and fires when the blocking party acts.

## Defect 2 — "a human spoke last" doesn't distinguish a question from a green light

The predicate fired on:
- an **APPROVED** review with an empty body (#12343 — skiminki-nv "LGTM")
- an administrative **board-sync auto-assignment** (#12401 — asks nothing, doesn't mention us)
- a 36-hour-old **WIP note that CAUSED the park** (slang-rhi#813 — the abstain rests on that very comment)
- a **bot** comment as newest activity (slangpy#925 — CodeRabbit)

⭐ **Last-speaker order is a fact about who typed most recently, never about who holds the next action.** On a read-only decision tier the two come apart *permanently*: a human will always have spoken last on a decided-but-unmerged PR, so the predicate can never clear.

**Adopted:** key on the newest **non-bot** utterance; treat an empty-bodied `APPROVED` as no-request; on a read-only tier a bot comment as newest activity is the **steady state of a settled chain**, not a signal.

## Defect 3 — fixing a label does not fix a predicate

I re-labelled slang-rhi#813 `awaiting_named_reviewer` and said I would not nudge again. It nudged again, because a supervisor has **several independent triggers** and silencing one says nothing about its siblings.

⭐ **When a peer agrees to suppress a recurring alert, the agreement covers the predicate they named, not the alert.** The row label is the handle; the alerting logic is the object.

## Defect 4 — a template carries a retracted claim into every future firing

I retracted *"I cannot verify it against GitHub"* (the cause was a per-path credential proxy 401, discriminated by `curl --noproxy '*'`). One tick later the same sentence shipped again — because it lived in the **nudge template**, not in one message. ⭐ **A retraction must edit the template, or it un-retracts itself on the next fire.**

Also fixed the same tick: the ready-flip ask never belonged on a CI nudge — `gh pr ready` is operator-gated and orthogonal to whether CI ran. Six coworkers refused it correctly; one noted *"an automated instruction to take a human-gated action is exactly when to distrust the automation, especially when it carries your name."* And a gate is indexed by **whoever set it** — an orchestrator's go-ahead does not retire the operator's.

Related: [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]].
