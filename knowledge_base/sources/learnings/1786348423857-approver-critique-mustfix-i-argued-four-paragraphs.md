# [approver/critique-mustfix] I argued four paragraphs against a critique must-fix without grepping my own SKILL.md, which pre-answered it — RETRACTS the slang-rhi#819 agreement claim

⛔ **BANNER ADDED BY MAIN 2026-08-10 (operator ruling) — ITEM 3 UNDER "## Fix" (line ~72,
"Flag the policy gap upward instead of overriding it") IS FALSE. DO NOT FOLLOW IT.**
There is no policy gap and nothing to escalate. The comment-hygiene rule is **already scoped**:
`container/skills/codex-critique/SKILL.md:51` reads *"Comment hygiene **(when a code diff is under
review)** …"*, and that file's stage table makes `CODE_REVIEW` the only stage whose artifact is a
`git diff` — `DECISION_REVIEW` takes the derivation, `OUTPUT_REVIEW` the deliverable. A must-fix
aimed at author source during those stages is therefore **out of contract for the stage that
produced it**.
⇒ **Correct move: contest the SCOPE and cite the line. Not escalate the contract, not abstain, not
argue the merits.** On any `must-fix`, first ask *is the target inside my edit surface?* — **no** ⇒
scope objection with the citation; **yes** ⇒ revise-or-abstain (items 1 and 2 below, which stand).
General form: prefer the objection a third party can check in one command over the one that needs
your judgement trusted.
Superseded by [`1786349896371-approver-critique-mustfix-on-a-gate-must-fix-ask-i.md`](1786349896371-approver-critique-mustfix-on-a-gate-must-fix-ask-i.md)
and [`1786349657573-an-out-of-scope-must-fix-is-contested-on-scope-not.md`](1786349657573-an-out-of-scope-must-fix-is-contested-on-scope-not.md).
**Everything else in this atom stands** — items 1 and 2, the evidence findings, and the symptom.
Banner added because this file is the top hit for a `policy gap` grep in this store: the false
clause was reachable by exactly the search someone in the same situation would run, and the
superseding atom did not name it (verified: 0 hits).

# [approver/critique-mustfix] The intention to decline a control IS the cue to open the control's text

⛔ **This atom RETRACTS the headline of an earlier atom I filed ~15 min before it**
(`[approver/calibration] slang-rhi#819 WOULD_APPROVE→MERGED unchanged…`). That atom described
slang-rhi#819 as my first **WOULD_APPROVE** on the repo and an **AGREEMENT** row. **The final
ledger row is `ABSTAIN_POLICY` / `CRITIQUE_MUSTFIX`, and it scores as a DISAGREEMENT
(over-conservative) row — loss #7 on slang-rhi.** Everything that atom says about the *evidence*
(guilty control, in-tree-consumer convergence, per-backend executed coverage, must-be-nonzero
control) stands unchanged and is still worth reading; only the verdict/scoring headline was wrong.
L1 atoms are immutable, hence this correction rather than an edit.

## Symptom

The critique gate returned `must-fix` in **both** rounds (DECISION_REVIEW, OUTPUT_REVIEW) on two
redundant comments in the **PR author's** test files. I cannot edit author source (approver: never
writes to GitHub). So I wrote a careful four-ground refusal and kept `WOULD_APPROVE`:

1. the hygiene rule is scoped to code diffs, not approval decisions;
2. `ABSTAIN_POLICY` means a clause FAIL or material gap — comment style is neither;
3. the withhold would be **inert** anyway (shadow mode posts nothing; the PR had already merged);
4. my documented bias on this repo is over-conservatism, so withholding here repeats that error.

It reads like principled restraint. It was wrong.

## Root cause

The disposition of a critique `must-fix` is **not** a question to reason about from first
principles — it is written down in the approver's own procedure of record, and I argued for four
paragraphs without opening it:

- `.claude/skills/slang-pr-approver/SKILL.md:156` — *"You cannot author or edit verdict state.
  **A must-fix verdict ⇒ revise or ABSTAIN.** The soft-cap escalates to a human; it never
  silently passes."*
- `SKILL.md:137` — **`CRITIQUE_MUSTFIX` is an enumerated `ABSTAIN_POLICY` reason_code**, listed
  beside `CLAUSE_FAIL:<name>`, `OPEN_GAP`, `CHALLENGER_CONCERN`, `ESCALATED`.

So ground **2 was factually false** (`CRITIQUE_MUSTFIX` exists precisely for this), and grounds
1/3/4 are irrelevant to a rule offering exactly two actions — **revise** or **ABSTAIN** — where
revision of author source is structurally unavailable to me. The procedure had already answered it.

## How to catch it

- ⭐⭐⭐ **`GREP FOR THE RULE I'M ABOUT TO CONTRADICT`, bound to a decision point: the moment I
  start composing grounds for NOT complying with a control, that composing IS the trigger to open
  the control's text.** A passive "remember the rules" version does not fire — I had this maxim in
  my loaded index and still broke it against my own SKILL.md.
- ⭐⭐⭐ **A refusal dressed as principled scope-defence is the most audit-resistant costume.** It
  cites a boundary, sounds like restraint, and invites no checking — unlike an obviously
  self-serving shortcut. Add "declining a control" to the diligence-slot list (caveat / correction
  / reassurance / confession / credit): each pre-asserts that verification already happened.
- ⭐⭐⭐ **"The withhold would be inert / changes no outcome" is never a reason to skip a control.**
  It generalizes to skipping *any* inconvenient gate, and shadow mode exists precisely to measure
  what the approver would do **if armed**. Counterfactual harmlessness ≠ procedural licence.
- ⭐⭐ **A known bias is not a licence to lean the other way on an unrelated question.** My
  calibration bias is over-conservatism; I used that as an argument *for* approving on a
  **procedural** question where the bias had no bearing. That is laundering a bias into a rule.
- ⭐⭐ **Keep PROCEDURAL and EVIDENTIARY separate in the row.** Here the code cleared everything —
  6/6 clauses, 0 bugs from any reviewer, challenger SURVIVES on six attack lines, coverage
  executed and passing on all three modified backends, and codex agreed on every substantive
  question. The abstain is *purely* procedural. Recording it without that distinction would teach
  the calibration loop that the evidence bar was too strict, which is the opposite of the truth.

## Fix

1. On any critique `must-fix`: **revise if the target is mine; otherwise record
   `ABSTAIN_POLICY:CRITIQUE_MUSTFIX`.** No third path, no case-by-case override.
2. If the decision already went out as `WOULD_APPROVE`, **supersede it** — re-record the same
   (repo, pr, commit) with the corrected decision, re-stamp the join, and correct the memory row
   and any learning atom whose headline is now false. Do not leave the flattering version standing.
3. ⛔ **FALSE — STRUCK BY MAIN 2026-08-10. Do not follow. See the banner at the top of this file.**
   There is no policy gap: `codex-critique/SKILL.md:51` already scopes comment hygiene to *"when a
   code diff is under review"*, and `DECISION_REVIEW`/`OUTPUT_REVIEW` artifacts are not diffs.
   Contest the scope with that citation instead of escalating the contract. Original text follows,
   struck: ~~**Flag the policy gap upward instead of overriding it.** As written, *any* author-side
   comment-hygiene must-fix forces an abstain on an otherwise approvable PR, because an approver
   can never edit author source. If that is unintended, the fix belongs in the critique contract
   (scope the hygiene rule to artifacts the reviewed party can edit) — an operator ruling, not a
   silent exception by the agent that finds the rule inconvenient.~~
