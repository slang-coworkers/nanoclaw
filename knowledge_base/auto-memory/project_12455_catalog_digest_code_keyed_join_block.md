---
name: project_12455_catalog_digest_code_keyed_join_block
description: "slang PR #12455 (jvepsalainen-nv) tests _meta digest recompute. Approver BLOCK @656583bb2adb, RED_BUG:regenerate.py:1502 — code-keyed digest join + dropped `source` column; 3 of 19 drift warnings are collisions whose remediation launders correct digests. Mechanism VERIFIED on my edge; two supporting FIGURES REFUTED. Ledger append denied (19th PR, FIRST BLOCK)."
metadata: 
  node_type: memory
  type: project
  originSessionId: 09d8014c-6187-483a-a8b4-e8b3882ffb19
---

# slang#12455 — code-keyed catalog-digest join · BLOCK verified, arithmetic not

**PR:** shader-slang/slang#12455, author `jvepsalainen-nv` (MEMBER), *"tests _meta: recompute
diagnostics-catalog digests instead of skipping them"*. **Head decided against:**
`656583bb2adbca32f62002e4791781617ca0a1ae` (R2). R1 was `478ba463` — derived as BLOCK but never
recorded, because the `synchronize` landed mid-critique, so there is no stale row to reconcile.

**Durable records (the ONLY ones — ledger append denied):**
`/workspace/agent/approver-decisions/slang-12455-656583bb2adb-decision.md` (annotated by me) and
`…-clauses.json`. Both copied off `/workspace/inbox/`, which has no retention guarantee.

## The defect — MECHANISM CONFIRMED on my own edge

Verified by subagent at the pinned SHA (detached fetch, `rev-parse` == the SHA, imported the PR's
own parser rather than reimplementing). Script is **`docs/generated/tests/_meta/regenerate.py`** —
the approver's path (`tests/_meta/`) is wrong, **its line numbers are exact**.

- `:1502` `entry = catalog.get(code)`, `code` from `:1498` alone. Nothing in 1492-1517 reads the
  test's own `doc_ref` or `catalog_name` (`catalog_name` occurs in the whole file only at a :1419
  comment and a :4107 selftest fixture).
- `:1431-1433` binds `parts[0..3]` + `parts[5:]`; **`parts[4]` — the `source` column, declared in
  the snapshot header at `:1414` — is never bound**, and `rows[code]` makes duplicate codes
  silently last-wins.
- Codes 20001 / 20002 / 20005 each have exactly 2 definitions: the **lua** one the test names
  (`slang-diagnostics.lua`) and the **JSON-parser** one the snapshot kept
  (`slang-json-diagnostic-defs.h`). Independent re-join over all 341 committed catalog tests:
  **19 mismatches — 3 pure wrong-row joins, 16 genuine same-name drift.**
- Why it is 🔴 and not a nit: the warning instructs refreshing via `catalog-digest <code>`
  (`:1511-1515`), which would **overwrite three currently-correct digests with unrelated
  diagnostics'** — the laundering the function's own docstring (`:1471-1474`) exists to prevent.
  The approver's decisive control: it recomputed each committed digest from the test's *own* lua
  entry and all three reproduce exactly ⇒ **the tests are right, the new check is wrong.**

## Blast radius is STRUCTURAL, not 3 warnings — the framing a fixer needs

Both edges independently measure the colliding-code set as **invariant across every regex
variant**: **15 codes — `10000`, `20001`-`20012`, `39999`, `99999`.** Only **3** produce visible
wrong-row warnings today. ⇒ **the join is structurally wrong for 15 codes; 3 happen to manifest.**
Whether the other 12 are safe by absence (no committed test) or by luck (test resolves to the
surviving row anyway) is **unmeasured by either edge** — do not state it either way.
⭐⭐**"3 spurious warnings" reads cosmetic and invites a 3-line patch; "the join is wrong for 15
codes, 3 currently visible" is the same fact and gets the producer fixed.** The approver's own fix
direction (extractor preserves every definition; lookup selects on `source`+`catalog_code`+
`catalog_name`) already covers this — the framing is what was missing.

## ⛔ TWO SUPPORTING FIGURES IN THE DECISION RECORD DO NOT REPRODUCE

- *"61 definitions collapse onto 15 code values"* — **REFUTED as stated.** An exhaustive search
  over all 2^9 source subsets × 3 framings found **no scope** producing 15/61. Correct: **56 defs
  on 15 codes** for the 4 sources `catalog.txt` draws from (41 lost to last-wins); 91 on 24 at the
  879-scope; 122 on 29 across all 906. The **15 is right for the 4-source scope; the 61 is not.**
- *"879 parsed definitions"* — **PARTIAL.** Reproducible only by excluding
  `slang-capability-diagnostic-defs.h` (27 defs), an exclusion the record does not state. All 9
  sources = **906**; the 4 catalog-relevant sources = **812**. The uniqueness of
  `source`+`catalog_code`+`catalog_name` **holds at both** (906/906, 812/812) — so the *fix
  direction* survives its own bad arithmetic.
- ✅CONFIRMED: 695 catalog rows / 695 distinct codes (header self-declares it).

⇒ ⭐⭐⭐**A verdict can be right while its supporting figures are unreproducible, and the figures
are what a reviewer will spot-check first.** Relaying them unverified would have spent the
approver's credibility on the one part of its report that was wrong. See
[[feedback_a_stored_claim_re_shipped_as_a_live_finding]].

### FINAL STATE of the collision figure: **UNRECONCILED between two edges. Carry neither.**

The approver first claimed `61 on 15` "reproduces exactly" and explained my 56 as the same
measurement with "last-wins applied differently". ⭐⭐⭐**That dissolves in one subtraction: with
15 colliding codes the two conventions differ by exactly 15 (D vs D−15), and 61−56=5.** Both
pairs are internally consistent under the *same* convention (56/41 and 61/46) ⇒ **we were counting
identically over DIFFERENT SETS.** Totals also differ (my 812 vs its 795, gap 17). The approver
retracted "reproduces exactly" and named its own move: *"a plausible-sounding category that
dissolved the disagreement instead of resolving it — refutable in one subtraction I didn't do"*,
plus *"re-running my own method and getting my own number is repetition, not replication."*
⇒ ⭐⭐⭐**A RECONCILIATION IS A CLAIM WITH ARITHMETIC IN IT — range-check it like any figure.**

⛔**MY OWN SYMMETRIC ERROR:** I published *"correct: 56 on 15"* to the operator, which was a
**single unreplicated subagent measurement** stated as a correction. **I range-checked the
approver's number and shipped my own unchecked** — the same asymmetry, one turn later. Corrected
upstream to "unreconciled; carry the mechanism and the three named codes."

Method spec published so it can be diffed, not re-argued (approver's edge): files =
`slang-diagnostics.lua` + `slang-{json,lexer,misc}-diagnostic-defs.h`; a definition = one macro
invocation (795 invocations == 795 distinct `(code,name)` pairs at this scope, so the definition
convention is *not* the gap). Two disclosed sweep defects: its glob
`source/compiler-core/slang-*-diagnostic-defs.h` never saw five further defs files under `tools/`
(**a scope decision disguised as a path**), and its strict regex **missed 35 single-line
`err(...)` definitions**. ⭐⭐**The collision figures were invariant across all three regex
variants; only the TOTAL was fragile** — so robustness-under-variation discriminated which half of
the report to trust. Deliberately **no third measurement**: a crude count from me would be a third
unreconciled number on a figure the verdict does not rest on.

## Clause record — a waiver recorded as evidence

`clauses.json` says 6/6 pass, but `ci_green_on_sha` is `"pass"` with evidence *"policy does not
require CI green"* — **hardcoded `pass` at `eval-clauses.py:183-184` when `require_ci_green` is
false**, while the schema's own `unevaluable` sits empty. The approver then measured its own
corpus: **257 of 269 `clauses.json` files (95%) carry this vacuous pass** ⇒ "6/6" has meant six
passes and five verifications across essentially its whole decision history. Failure direction is
**toward more approval**. Fix adopted for future runs: `not_applicable`, reported as
"5 evaluated + 1 waived by policy". **The 257 existing rows cannot be retro-corrected — any
metric over them must discount that clause.** ⇒ ⭐⭐**Reading a field and aggregating it are
different decision points; a rule that guards the read does not guard the sum.**

## Ledger — 19th PR, and the FIRST BLOCK

`record_decision` returned *"Decision recorded: …= BLOCK"*; the host denied it with branch-1 text
(`no approval-ledger writers are configured`). ⭐⭐⭐**Every prior dropped decision was
`ABSTAIN_POLICY`; this is the first `BLOCK` — the one class that would have changed an outcome
under enforcement**, so the severity across instances of this config defect is *not uniform* and a
cumulative count hides that. Full mechanism, the union recipe's three failure directions, and the
operator action: [[feedback_record_decision_ok_proves_emission_not_persistence]].

## RESUME trigger

**Open question I own:** the public review surface on the PR says *"0 bugs, 2 gaps"* while the
shadow decision is BLOCK with verified line numbers, so **the author is iterating against a clean
signal and cannot see this defect.** The approver is architecturally barred from posting. Awaiting
an operator decision on whether to surface it and through whom — do not post a defect claim on a
human's PR unauthorized. Two advisory items for whoever does surface it: R2's self-test trim lost
coverage of four properties, and the PR's own prose (`regenerate.py:4092-4093` comment + commit
message + PR-body verification table) still claims coverage the diff no longer carries.
