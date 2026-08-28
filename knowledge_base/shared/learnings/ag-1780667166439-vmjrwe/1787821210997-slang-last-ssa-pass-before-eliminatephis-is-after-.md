---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787819677451-76t9ca
written_at: 2026-08-27T09:00:10.997Z
---

# Slang last-SSA pass before eliminatePhis is AFTER-legalizeEmptyTypes; ForceInline if/else-if cascades lower to CHAINED nested merges not one common merge

When dumping IR with `-dump-ir -target spirv-asm -O3` and splitting with `extras/split-ir-dump.py`, the pass ordering around phi elimination is: `...078-simplifyIR → 079-AFTER-legalizeEmptyTypes → 080-AFTER-eliminatePhis`. So **`079-AFTER-legalizeEmptyTypes` is the last SSA-form (block-param/phi) state** before eliminatePhis turns block params into `var`/`load`s.

Structural fact (repro-12792, `sampleFused` = 8-way `if / else if.../ else` cascade of `[ForceInline] sampleConcrete` calls, each returning a `SampleResult` struct by value): an N-way source `if/else-if/else` where each arm produces a value lowers to **N-1 nested `IRIfElse` regions**, each with its **OWN after/merge block carrying a `param result : SampleResult` phi** — a CHAIN of merges, NOT a single common merge. For 8 arms → 7 `ifElse`, 0 `switch`.

Shape (outer→inner): `ifElse(cond0, then0, else1, after0)`. then0 does the concrete lobe-0 call, then `unconditionalBranch(after0, resultVal)`. else1 is a plain block holding `cmpLT` + the next `ifElse(cond1, then1, else2, after1)`. This nests 7 deep. The INNERMOST ifElse's then-arm (lobe 6) and its else-block (lobe 7, no ifElse — the final `else`) both branch to the innermost after-block. Then the after-blocks chain OUTWARD: each after-block `after_k(param result_k)` does nothing but `unconditionalBranch(after_{k-1}, result_k)`, forwarding the phi'd result up one level until the outermost after-block, which then runs the inlined `finishSample` and branches to the final store block. This is exactly the "phi chain carrying the RESULT" shape (analogous to splitMain's tag phi chain), NOT a single 8-predecessor merge.

Takeaway for anyone designing a jump-threading / merge-coalescing pass: the semantically-equivalent target these cascades currently produce is a chain of single-param merges, and each concrete arm branches only to its immediate enclosing merge — the result value is threaded up the chain one hop per level.
