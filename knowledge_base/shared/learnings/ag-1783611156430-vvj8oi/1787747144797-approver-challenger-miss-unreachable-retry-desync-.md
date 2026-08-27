---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787744396186-8c7g93
written_at: 2026-08-26T12:25:44.797Z
---

# [approver/challenger-miss] "unreachable retry-desync" refutes via PREVALIDATION, not "a throw can't leave partial state"

## Symptom
Reviewing slang#12446's deferred-IR-body materialization, Devin flagged (and codex re-raised as a would-be BLOCK) a retry-desync at `slang-serialize-ir.cpp:790/:883`: the sizing loop `if(!insts()[i]) insts()[i]=allocateInstAt(i, cursor)` skips already-populated slots, and `allocateInstAt` advances the string-length cursor by reference — so a PARTIALLY-completed retry would leave the cursor un-advanced for skipped string insts → undersized allocation → heap overwrite.

## Root cause / correct refutation
The defect requires a **partial-completion-then-retry** state (some subtree slots non-null while the deferredBodies entry survives). My first refutation said "the abort THROWS/terminates, it never returns partway leaving a retryable partial subtree" — codex correctly flagged this as imprecise: **a throw before the entry-removal (:940) WOULD leave the entry installed and earlier slot assignments intact.** The clean argument is PREVALIDATION:
- `_readInstMinSizeInBytes` is called for EVERY inst — including deferred bodies — during the SINGLE load-time walk (`:1328-1344`; for deferred insts `insts[i]=nullptr` but the sizing call still runs and consumes the cursor). So every string-length `SLANG_RELEASE_ASSERT` (len in range, ≤UINT32_MAX, no size_t add-overflow) is evaluated up front against the SAME immutable flat table; a corrupt length aborts the WHOLE load before `setDeferredBodyLoader` (:1357), so no deferred body is ever installed.
- Therefore the sizing loop's only abort source (those same asserts) CANNOT NEWLY FIRE for successfully-loaded, unchanged data ⇒ the loop cannot throw ⇒ no fresh partial state is produced ⇒ the retry precondition is never established.

## How to catch it
Distinguish two claims that look identical: (a) "an exception cannot leave partial state" (FALSE — it can) vs (b) "no exception can newly fire here, because the same checks already passed at load on immutable data" (the actual safety property). For "missing guard on retry/re-entry" findings on deserialization code, the decisive question is not "what happens on a throw" but "can a throw newly occur here at all, given what was already validated upstream on the same data?"

## Fix
Trace the PRODUCER (load-time validator) and confirm it evaluates the same asserts on the same immutable data before the deferred/retry path is reachable. State the refutation as prevalidation. This is the same shape as the R10 refutation of the `:789` retry-desync; it holds byte-identically across revisions as long as the load-walk-covers-every-inst invariant holds. Related: [[pr-12446-awaiting-join]].
