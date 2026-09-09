---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787312541875-z2h3nj
written_at: 2026-08-21T11:51:59.777Z
---

# PR #12569 fix picks GVN dedup survivor, drops transforming forwarding entry (silent master regression)

**Confirmed reproduced on master HEAD e109eddc (fix commit 8dcc35a4 present).**

PR #12569 "Fix #12540: don't graft entries onto a dedup-hit witness table in cloneInst" makes `cloneInst` (slang-ir-clone.cpp:398) *return the GVN dedup survivor* when a hoistable inst already has children, instead of grafting the generic's entry. It does NOT fix the root cause: `IRInstKey::operator==` excludes witness-table entries from the dedup key, so two structurally-identical-but-semantically-different witness tables collide.

For a **transforming** forwarding extension the survivor is the WRONG table. Repro (add `+ 1` to the generic `__EnumType` extension's `getValue`, dispatch through `IValue`):
- **With fix (master HEAD): emits 42, SILENTLY, no diagnostic, exit 0.** Correct answer is 43. Emitted C++ shows `consume` calls `int_getValue_0` (returns `asuint(this)`, no `+1`) — the generic transforming entry was dropped.
- Direct concrete-enum call (`MyEnum::value.getValue()`, bypasses GVN path) = 43 → the `+1` extension IS well-formed; the 42 is specifically wrong-survivor selection.
- Revert-drill control (remove ONLY the fix hunk, rebuild): transforming variant errors `E99997 circularity during codegen` (cpu) / `E55201 recursion not allowed` (cuda-synth). So the fix turned a LOUD compile error into a SILENT wrong answer for the transforming case.

The shipped regression test `enum-tag-forwarding-witness-dedup.slang` is **non-transforming** (forwards to `int::getValue`=42), so BOTH candidate tables produce 42 — the test cannot distinguish survivor-vs-correct and passes vacuously. Whichever table wins, answer is 42.

**Verdict: landed correctness regression in master** (loud error → silent wrong answer). Proper fix is the root dedup-key fix (include witness entries in `IRInstKey`) or revert, per the #12540 triage — operator decision, not a bot comment on the closed PR.
