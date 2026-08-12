---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786493941468-gnl11t
written_at: 2026-08-12T01:00:03.182Z
---

# [approver/challenger-miss] "moved verbatim" refutes a regression, not a latent bug in NEW sibling code

**Symptom (slang#12466, "autodiff through abstract properties").** The challenger nearly recorded WOULD_APPROVE. A CodeRabbit "Major" said "Initialize converted BorrowIn arguments — apply to BOTH the differential-pair AND AnyValue paths" in `maybeUnpackArg` (`slang-ir-typeflow-set.cpp`). I cleared it as a delta-window false positive by proving the *AnyValue* branch was moved **verbatim** from `slang-ir-lower-dynamic-dispatch-insts.cpp`. The DECISION_REVIEW codex critique returned must-fix: I had checked the wrong branch.

**Root cause.** Two distinct errors compounded:
1. **Scope of the rebuttal.** "Code X was moved verbatim" refutes only a *regression* claim about X. The finding also targeted a **PR-NEW sibling branch** (the differential-pair path, `pr.diff:375-401`, absent pre-PR — pre-PR `maybeUnpackArg` had only AnyValue + TaggedUnion branches). A verbatim-move proof about one branch says nothing about a newly-added branch beside it. When a reviewer says "apply to BOTH the A and B paths", clearing A does not clear B.
2. **IR-type predicate.** The new branch creates a `tempVar` for a pointer-typed diff-pair param, initializes it ONLY for `IRBorrowInOutParamType`, but ALWAYS registers a write-back. `IRBorrowInParamType` and `IRRefParamType` ARE `IRPtrTypeBase` but are NOT `IRBorrowInOutParamType` (`slang-ir-insts.lua:335-395`: `BorrowInParam`/`RefParam` sit directly under `PtrTypeBase`; only `OutParam`/`BorrowInOutParam` under `OutParamTypeBase`). So a `BorrowIn`/`Ref` diff-pair arg gets an uninitialized pair + a spurious write-back to a read-only borrow.

**How to catch it.** (a) When a bot finding names TWO code paths ("both the X and Y path"), verify EACH independently — a verbatim-move / precedent argument only covers the path it was run against. (b) A "this is just moved/pre-existing code" rebuttal is valid ONLY for the exact lines that moved; diff the moved region against baseline AND separately audit any new branch added in the same hunk. (c) For any `emitVar`+conditional-init+unconditional-writeback shape gated on a pointer *subtype*, enumerate the full sibling set of that base (`grep` the insts.lua subtree): init-guard and writeback-guard must cover the SAME direction set. (d) Green CI is not coverage of the suspect branch — the new tests here exercised only `In` (by-value) and `BorrowInOut` (init'd correctly); the `BorrowIn`/`Ref` path was never run, so a passing suite says nothing about it.

**Fix / outcome.** Reachability of the `BorrowIn`/`Ref` diff-pair path was unprovable from artifacts, and no verified live trigger existed (the identical init-only-for-BorrowInOut shape is long-standing in the AnyValue path, possibly an established idiom) → recorded **ABSTAIN_POLICY : CHALLENGER_CONCERN** (plausible trigger + real blast radius + uncertainty ⇒ conservative-lean abstain, per the skill; not BLOCK, not WOULD_APPROVE). The two-tier critique gate did its job: DECISION_REVIEW converted a would-be false approve into an abstain. Repo: shader-slang/slang, PR 12466, head f983d487a1d6.
