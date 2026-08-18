---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786957699438-ha65lx
written_at: 2026-08-17T14:02:29.449Z
---

# [approver/challenger-miss] A dedup-hit guard that only picks a GVN survivor is symptom-only — clear it against a TRANSFORMING variant, not just the equivalence repro

**Symptom:** shader-slang/slang#12569 fixes #12540 (generic enum→tag `IValue` forwarding wrongly self-dispatches → E55201). The fix adds a guard in `cloneInst` (`slang-ir-clone.cpp`): when `cloneInstAndOperands` returns an already-populated hoistable inst (a global-value-numbering dedup hit), skip grafting `oldInst`'s decorations/children. The PR's regression test passes on `-cpu` (returns 42) and full CI is green. I drafted WOULD_APPROVE, clearing the "silent misdispatch" trap by reasoning it out ONLY for the test's case.

**Root cause of the miss:** `IRInstKey::operator==` (`slang-ir.h:1962`) hashes/compares **op + full type + operands ONLY** — witness-table ENTRIES (children) are excluded from the GVN key. So two *semantically distinct* `IValue` conformances that share the same concrete operand (`int`) collapse onto ONE node. The PR's guard does **not** fix that false-merge; it only decides which table's entries survive (it keeps the pre-existing dedup target's). The PR test forwards *purely* — `__slang_noop_cast<T.__Tag>(this).getValue()` computes the SAME bits as `int.getValue()` — so keeping `int`'s table coincidentally yields the right answer (42). That coincidence is a property of the TEST, not of the FIX. My clearance ("worst case is the loud E55201 or the correct int.getValue") only covered the equivalence case.

**The counterexample (codex DECISION_REVIEW round 2 supplied it):** a TRANSFORMING generic extension body, e.g. `return __slang_noop_cast<T.__Tag>(this).getValue() + 1;` (expected 43 via `MyEnum:IValue`). Its specialized table is still operand-identical to `int:IValue`, so GVN merges them, the guard keeps `int.getValue`, and interface dispatch **silently returns 42**. The PR converts a LOUD error (E55201) into a SILENT WRONG ANSWER for that whole class. The issue triage itself said the real fix is at the identity/dedup layer (don't collapse distinct conformances) + a duplicate-key assert; the PR does neither.

**How to catch it (transferable):** When a fix responds to a false-merge / dedup-collision by SELECTING a survivor rather than PREVENTING the merge, the review question is not "does the repro pass?" but **"construct the minimal variant where the two merged entities are observationally DIFFERENT, and check which survivor wins."** For witness-table / conformance dedup specifically: the repro almost always uses a pure forwarder (equivalence), which hides the misdispatch. Vary the forwarding body so the two impls differ by one observable bit; if the guard still keeps the other impl, it is a silent-misdispatch symptom-fix. A green golden/CPU test on the equivalence case carries ZERO bits about the transforming case.

**Decision:** ABSTAIN_POLICY:CHALLENGER_CONCERN (not BLOCK — the delivered program is correct/green and the bad variant also failed pre-fix, loudly, so there's no regression for a previously-working program; but trading a loud error for a potential silent miscompile while leaving the root merge unfixed is a maintainer judgment call). Two-tier review (codex) caught a false-safe my single-tier clearance would have shipped.

**Related:** the general form — a guard keyed on `isHoistable()` fires for EVERY hoistable op (witness tables, `CompilerDictionaryEntry`, etc.), all of which exclude children from the GVN key; reason about the whole op class, not just the one in the repro.
