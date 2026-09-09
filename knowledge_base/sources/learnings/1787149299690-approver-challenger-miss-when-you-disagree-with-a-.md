---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786957699438-ha65lx
written_at: 2026-08-19T14:21:39.690Z
---

# [approver/challenger-miss] When you disagree with a human + all bots on a silent-miscompile claim, BUILD IT — a rebuilt compiler settled slang#12569 in ~15 min

**Context:** shader-slang/slang#12569 (`cloneInst` guard: skip grafting children onto a GVN dedup-hit hoistable inst, fixing #12540's witness-table self-dispatch E55201). Across three heads I flagged a CHALLENGER_CONCERN: the guard only PICKS a dedup survivor, it doesn't fix the root false-merge (`IRInstKey::operator==`, slang-ir.h:1962, excludes witness-table ENTRIES from the GVN key), so a *transforming* forwarding extension can silently misdispatch. By the final head `eafe1b4accf6` I was disagreeing with a HUMAN APPROVE + primary github-actions[bot] (🟡 "behaviorally correct for all hoistable-with-children ops") + CodeRabbit + Devin (0/0) + green CI — all on a claim that the compiler *silently miscompiles*.

**The move that mattered:** instead of re-asserting the concern a third time from reasoning, I MEASURED it. The lab container had a prebuilt slangc at a pre-fix checkout. I applied the PR's exact 12-line guard, `cmake --build --preset debug --target slangc` (incremental, a few min), and ran three cases as `-cpu` COMPARE_COMPUTE / emitted-C++ inspection, then `git checkout` reverted the edit:
- PURE forwarding (`return tag.getValue()`), interface dispatch → 42 (PASS — the PR's own test; correct only by coincidence, `asuint(bits)` == the forward).
- TRANSFORMING (`return tag.getValue() + 1`, expected 43), interface dispatch → emitted `consume_0(int(42))→int_getValue_0→asuint` = **silently 42**, `+1` dropped, no diagnostic.
- Direct-call control (`MyEnum::value.getValue()`) → emitted code computes 43 (never instantiates the merged table).
- PRE-FIX, transforming variant, dispatch → LOUD `E99997: circularity during codegen`.
Proof: the fix converts a loud compile error into a silent wrong answer for that class.

**Transferable rules:**
1. **A reasoned challenger concern that survives a human + multiple bot approvals is exactly the case to ESCALATE TO EMPIRICS, not to re-argue.** If the repo has a build (check `build/*/bin/` first — slang ships prebuilt), constructing the minimal counterexample and running it is often <15 min and converts "I think" → "I measured." The bar for overriding N reviewers should be evidence, and evidence is cheap here.
2. **The equivalence-repro blind spot is systemic:** the PR author, the primary reviewer, CodeRabbit, and Devin ALL only exercised the pure-forwarding case, where a dedup-survivor guard is coincidentally right. When a fix responds to a false-merge by selecting a survivor, the decisive test is a variant where the two merged entities are observationally DIFFERENT (here, add `+1`).
3. **ABSTAIN vs BLOCK when you've proven wrong output:** don't claim "not a bug" (it is — you measured it). Keep it ABSTAIN on PROCEDURE (Step-2 had no 🔴; a Step-3 challenger concern maps to CHALLENGER_CONCERN, not BLOCK) AND on substance being a maintainer tradeoff — here the delivered PR's own program is correct/green and the only pre-fix-tested variant already failed loudly, so no previously-*working* program regressed; but loud-error→silent-miscompile is a regression in kind. Codex OUTPUT_REVIEW caught me overstating "no bug" and "regresses no working program" — scope claims to exactly what you tested.
4. **Leave the tree clean:** apply-measure-revert; remove temp `tests/*.slang`; the measurement is the deliverable, not the edit.
