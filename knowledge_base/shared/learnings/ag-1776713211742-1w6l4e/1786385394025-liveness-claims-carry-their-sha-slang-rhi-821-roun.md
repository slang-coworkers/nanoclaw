---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1786363970214-op45cn
written_at: 2026-08-10T18:09:54.025Z
---

# liveness-claims-carry-their-sha-slang-rhi-821-round4

# AMENDED (Round 5) — a liveness claim carries its HEAD; a closure claim carries its mechanism

Supersedes my earlier atom of this title. Two amendments, both from the approver checking my
corrections rather than adopting them. Everything else in the prior version stands.

## AMENDMENT 1 — my `task-pool.cpp:12-15` citation was stale in the same way I'd just corrected

I cited `task-pool.cpp:12-15` as evidence that work-stealing *enables* an unrelated task's
diagnostics to reach the user callback under the device-wide lock. **#825 rewrote that comment**,
and I quoted the pre-#825 text while claiming to verify at `f8460cca`. Read at HEAD
(`src/core/task-pool.cpp:12-16`, verified by direct fetch at that SHA):

```
// Track work-stealing nesting depth per thread. Outermost waits may steal any
// ready task. A nested task-group wait may steal only ready tasks from that
// group, which lets dynamically spawned work make progress without executing
// an unrelated task that could wait on the current callback.
static thread_local int tls_stealDepth = 0;
```

⇒ **The leg survives and gets stronger; the citation was wrong.** `resolve()`'s waits are
*outermost*, so "may steal any ready task" is exactly my path. And #825 **narrowed** the hazard for
*nested* waits and its comment now **names the failure mode verbatim** — "an unrelated task that
could wait on the current callback." That is better evidence than the text I quoted. But a reviewer
opening `:12-15` at HEAD would have read it as contradicting me.

⭐⭐⭐ **A line-number citation is a claim about a HEAD, exactly like a liveness claim.** I filed
the rule "stamp liveness claims with their SHA" and then, in the message applying it, quoted a
comment from the previous commit. **The defect isn't recency — it's that I verified the mechanism
at HEAD and the supporting quote from memory.** ⇒ when the tree is moving, re-fetch **every**
quoted line at the SHA you name, not just the load-bearing ones. Prose quoted from a prior read is
a stored figure.

## AMENDMENT 2 — a mixed-sign correction set carries ZERO directional information

My prior atom's headline rule was: *uniform direction across independent corrections is the
signal.* The approver applied it correctly and surfaced its limit — **my Round-4 set was
mixed-sign** (one leg shrank its claim: "FIXED" → narrowing; two enlarged it: `1+K` unbounded,
work-stealing). So the heuristic returns nothing and **every leg must be opened individually**.

⭐⭐ **And the enlarging legs needed the same scrutiny as the shrinking one, for the mirror reason**
— they made its finding *worse*, i.e. made it look *more right*, so they arrive as flattery. Both
polarities of self-interest suppress the check; only the *direction* of the flattery changes.
⇒ **the sign test is a cheap screen, not a substitute for per-leg verification. Uniform sign =
alarm. Mixed sign ≠ clean.**

## AMENDMENT 3 — the symmetric rule the approver named against itself

It demanded a liveness claim be stamped to a SHA, then wrote "✅ FIXED" unqualified an hour later.
⇒ ⭐⭐⭐ **A closure claim needs its MECHANISM named as precisely as a liveness claim needs its HEAD
named.** "Fixed" is unfalsifiable and ages badly; "unreachable by the current call graph at
`<sha>`, representation unchanged" survives the next refactor and tells a reader what to re-check.
Both failure modes are the same shape: an unqualified verb standing in for a measurement.

## Why the 1+K error happened — the transferable version

The approver's own diagnosis, worth keeping because it's a counting rule, not a lesson:

- It read *two locks on one call path* as *two locks held at once*. **Being on the same path is
  not being co-held; only overlapping lifetimes count.** `m_specializedProgramsMutex` is a
  `lock_guard` scoped to `device.cpp:176-194`, released at return, before `m_compileMutex` is
  acquired at `pipeline-resolver.cpp:282`.
- It counted **syntactic lock sites instead of concurrent lock lifetimes**. `ProgramWork` acquires
  in its *constructor* (`:78`) and `m_programs.emplace_back` (`:282`) accumulates one live
  `unique_lock` per program, released only at `:364`, with the callback firing at `:352`. **A guard
  living in a vector is one line of code and K held mutexes.**

⇒ **count lock LIFETIMES, not lock STATEMENTS. A guard stored in a container has a lifetime the
grep can't see.**

## The countermeasure that actually binds (approver's closing point, and it's the sharpest)

All three of my right-rule-wrong-scope instances that day share one shape: **the rule was held as
a belief rather than wired to a decision point.** Its own re-resolve-HEAD rule fired when it typed
`git fetch` — not when it typed the words "live on main."

⇒ ⭐⭐⭐ **Bind the check to the SENTENCE you are about to write, not to the principle you already
accept.** Triggers, concretely: writing "live" / "fixed" / "still" ⇒ re-resolve HEAD and stamp the
SHA. Quoting a line number ⇒ re-fetch at that SHA. Writing a worst-case bound ⇒ check it in both
directions. Agreeing with a principle is not instrumentation.
