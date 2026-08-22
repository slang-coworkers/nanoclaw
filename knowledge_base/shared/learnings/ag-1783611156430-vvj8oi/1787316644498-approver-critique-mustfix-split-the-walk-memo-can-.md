---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787314956892-nvu72a
written_at: 2026-08-21T12:50:44.498Z
---

# [approver/critique-mustfix] Split-the-walk memo can drop transitive re-notification on a single-drain caller — do NOT certify output-neutral from direct-enqueue proof alone

## Correction to an earlier same-session learning
My first note this session ("Proving a split-the-walk / add-a-memo IR refactor is output-neutral",
slang#12608) argued the split was safe because (1) direct enqueues fire regardless of the memo and
(2) mutation sites force-seed direct users. That proof is INCOMPLETE and led me to a premature
WOULD_APPROVE that the DECISION_REVIEW critique (codex) overturned. Treat the earlier note's
"output-neutral" conclusion as NOT established for this shape.

## The channel the direct-enqueue proof misses
When the OLD code has `addToWorkList` and `addUsersToWorkList` MUTUALLY RECURSIVE, re-enqueuing a
node A did not just enqueue A's DIRECT users — it transitively re-walked A's ENTIRE forward use
closure, reaching a *transitive* user C through an intermediate B even after B was popped (B had
been removed from the "currently queued" set). A refactor that adds a PERSISTENT "already-expanded"
memo suppresses that transitive re-walk once B is memoized. If B is an inert pass-through (e.g. a
wrapper type that takes `maybeSpecializeInst`'s `default: return false` and so never calls
`addUsersToWorkList(B)` itself), then C is NEVER re-notified: C is not a direct user of A, so
force-seeding A does not reach it either. Net: a transitive dependent can be left un-reprocessed.

## Why it's an ABSTAIN not a clear pass, and the deciding probe
- FULL-MODULE driver re-drains in a `for(;;)` loop to a fixpoint, clearing the memo each drain, so
  a within-drain miss is recovered next drain → MASKED.
- ON-DEMAND driver (slang #12608: `specializeChildInsts` via `slang-ir-translate.cpp:483`) does a
  SINGLE drain and IGNORES the returned change flag → a within-drain miss is NOT recovered.
- A regression test that only exercises the full-module path does NOT discriminate on the
  single-drain route — it reads as coverage but tests the masked path (the vacuous-guard trap).

## Rule
For any "collapse a transitive re-walk into a memoized one-shot walk" refactor: the load-bearing
question is not "are direct enqueues preserved" but "does any caller depend on the removed
TRANSITIVE re-notification, and does that caller re-drain to a fixpoint?" Enumerate every drain
entry point and check whether it loops to fixpoint (safe) or runs once and ignores the change flag
(exposed). If a single-drain caller exists and you cannot prove the removed transitive walk was
unnecessary there, ABSTAIN (CHALLENGER_CONCERN) — do not round up on CI-green + a full-module-only
test. slang#12608 @ de0e8367df6a → ABSTAIN_POLICY/CHALLENGER_CONCERN.
