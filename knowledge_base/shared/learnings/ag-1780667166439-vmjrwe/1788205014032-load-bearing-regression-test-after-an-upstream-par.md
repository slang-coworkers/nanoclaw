---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786701797724-j3vwpf
written_at: 2026-08-31T19:36:54.032Z
---

# Load-bearing regression test after an upstream partial fix (slang#12540/#12569)

When a maintainer says a regression test "no longer demonstrates why the fix is needed" because an upstream PR landed, the fix is usually: make the two code paths **behaviorally distinct** so a wrong choice is *observable*, then prove it with a revert drill.

Concrete case: slang#12540 — a generic `__EnumType` extension forwarding `IValue.getValue()` to `T.__Tag`. Two separate bugs shared one root cause (the enum-ext witness table and `int`'s own `IValue` table dedup onto one node once `lowerEnumType` erases the enum to `int`; `IRInstKey` ignores table entries):
- Upstream **#12569** (`cloneInst`: don't graft entries onto a dedup-hit hoistable inst) cured the **crash** form (E55201 / self-referential entry).
- But the **dedup itself remains** — the merged node keeps `int`'s `getValue`, silently dropping the extension's. My follow-up fix: an **optional conformance-identity operand (operand 1) on `IRWitnessTable`** = the conformance mangled name, so distinct named source conformances don't GVN-merge. `getConcreteType()` stays operand 0.

Why the pure-forwarding test was inadequate: when the extension's `getValue` is behaviorally identical to `int`'s (both return the tag value unchanged), the merge is invisible — the test passes with OR without the fix. Making the extension return `... + 1` makes it observable: enum interface dispatch must be 43, int dispatch 7, direct enum call 43. **Revert drill:** WITHOUT the operand the buffer is `42,7,43` (interface dispatch misdispatches to `int::getValue`); WITH it, `43,7,43`. That divergence is the proof the operand is load-bearing.

General rule: a regression whose two conformances/implementations are behaviorally identical cannot distinguish a correct fix from a no-op. Always give the paths distinct observable outputs and run the revert drill.

Process gotcha: a build subagent that launches `cmake --build` with `run_in_background` and then ends its turn does NOT block until completion — its own monitors notify the (now-idle) subagent, not you. Either instruct the subagent to run the build synchronously (foreground, so it truly blocks and reports), or orchestrate it yourself with a detached script that writes a DRILL_DONE sentinel + a `Monitor` (Bash background waiters cap at 10 min; Monitor allows up to 60). Running the same revert-drill from two actors on one worktree risks git-checkout races, though ninja's build lock serializes concurrent builds on the same dir.
