---
title: "Two different counts sharing a value is how a wrong number survives an audit — match the number to its SYMBOL and UNIT, not its value"
type: learning
topic: misc
source: learnings/1785946240156-two-different-counts-sharing-a-value-is-how-a-wron.md
---

# Two different counts sharing a value is how a wrong number survives an audit — match the number to its SYMBOL and UNIT, not its value

# A wrong count hid behind a correct one with the same value

**Situation (slang#12339 triage, 2026-08-05).** My memo cited a non-zero control: "`git grep
findIncludingNonIncludedSourceFile` at master = 0 hits (non-zero control `isIncludedFile` in the same file = **9**)".
A reviewer, while *accepting* my work, mentioned it had measured that control as **7**.

**The reviewer was right.** Measured three ways: `grep -c` = **7 matching lines**, `grep -o | wc -l` = **8
occurrences**, `git grep -c` = 7. My "9" was a subagent's count **of a different symbol**, carried across into a
claim it never belonged to.

**What nearly buried it.** My published GitHub comment *did* contain a bare "9" — and that one was **correct**, a
different claim entirely (`getInitiatingSourceLoc` "has 9 uses" = 9 matching lines = 8 call sites + 1 accessor
definition). So the audit path was: see 9 in the artifact → verify 9 → it checks out → stop. **The wrong number was
protected by a right number that happened to share its value.**

**Rules.**
1. **Match a number to its SYMBOL, not its value.** "Is there a 9 here and is 9 right?" is the wrong question.
   "Which symbol is this 9 counting, and is *that* 9 right?" is the right one. Two counts in one document can share
   a value and have nothing to do with each other.
2. **State the unit.** `grep -c` counts **matching lines**, not occurrences. Here they differed for *both* symbols
   (7 vs 8, and 9 vs 10). A bare count is ambiguous exactly where a reader would re-derive it and get a different
   number.
3. **Say whether a count includes the definition.** "9 uses of `getInitiatingSourceLoc`" = 8 call sites + 1 accessor
   definition. Fine to publish, misleading if a reader treats all 9 as consumers.
4. **Sweep the defect class, not the instance.** After fixing the one control, I re-verified every other count in the
   document. All held — but that was *measured*, not assumed, and it's where a second bad carry-over would live.
5. ⭐**Audit hardest when the challenge arrives wrapped in praise.** The discrepancy was one number inside a message
   that agreed with my conclusions and said "nothing owed". A number that differs from mine is a **measurement, not
   a courtesy** — and it is never easier to skim past than when everything around it is agreement.

**The saving grace was structural, not diligence:** a non-zero control's only job is to prove the instrument fires,
and 7 ≠ 0 does that as well as 9 would — so the conclusion never depended on the wrong value, and I had published no
control counts at all. Verify that ("did it reach the artifact?") rather than assuming it, because the *next* wrong
carry-over may sit on a load-bearing figure.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785946240156-two-different-counts-sharing-a-value-is-how-a-wron.md`_
