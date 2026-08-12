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

## TERMINAL — MERGED 08-11T09:13:48Z as `ec47ea72b`; defect SHIPPED; join = LOSS

`jkiviluoto-nv` APPROVED 08:53:46Z, author self-merged 09:13:48Z at head `1a0129a67d3a` (R3).
**No R3 decision exists** — the approver re-resolved live state on my dispatch, found the PR
terminal ~37 min earlier, and logged `no-op: superseded by merge` rather than minting a row for a
terminal head. ⭐⭐**Correct: a dispatch is a CLAIM about state, not state — my R3 dispatch was
stale when I sent it and I did not check.**

**Verified by me on `origin/master` after the merge** (not a PR ref): `:1433` still drops
`parts[4]`, `:1435` still last-wins, `:1523` still `catalog.get(code)`;
`git merge-base --is-ancestor ec47ea72b origin/master` → YES. **The defect is live on master**;
all 3 collisions reproduce and the lint still emits the laundering remediations.

⭐⭐⭐**THE CLAIM SPLIT, AND ONLY HALF WAS EVER TESTED:** *"the defect is real"* SURVIVED (two
independent edges + live on master); *"material enough not to ship as-is"* was **REFUTED by a
maintainer**. Both edges spent every round proving the mechanism; **nobody tested the severity
claim until a human did.** ⇒ **Detection and severity are separately falsifiable — verifying
detection to exhaustion tells you nothing about placement.**

Approver's calibration test, adopted after the loss and worth carrying: **"does this hurt anyone if
every human ignores it?"** Here no — laundering requires someone to *follow printed advice* in a
warn-only lint with no CI gate ⇒ `ABSTAIN_POLICY:CHALLENGER_CONCERN`, not BLOCK. Reserve BLOCK for
harm needing no human action (wrong codegen, ABI break, data loss, red gate). ⚠️**Policy-level, not
a judgement slip:** the procedure mandates BLOCK on any 🔴 and Devin reported 🔴 ⇒ fix "what counts
as 🔴 in test-only tooling".

**My read of the author was right and the approver's wasn't:** R3 (+105/−6) addressed **four**
advisory findings, deferring only the structural re-keying — the expected shape (cheap fixes land,
re-keying a lookup doesn't). ⇒ **the BLOCK added no information the ABSTAIN wouldn't have.**
Two unpersisted decisions on this PR (R2 BLOCK + the join; `record_human_verdict` withdrawn by
design, so joins have nothing to stamp onto either).

✅**Join artifact NOW on my edge** — the approver `send_file`d it after I flagged that
`approver-decisions/` named *its* filesystem, and said so explicitly (*"this is the copy that
exists on your edge"*). Durable set for this PR, all three unpersisted:
`slang-12455-656583bb2adb-decision.md` (23.5 KB, annotated through terminal state),
`…-clauses.json`, `slang-12455-JOIN-merged-1a0129a67d3a.md` (5.9 KB). Its merged-master
verification table independently matches mine: join LIVE at `:1523`, `parts[4]` LIVE at `:1433`,
and `lint` on master still emits all three *"refresh … with `catalog-digest <code>`"* lines.
⇒ ⭐⭐**Naming the filesystem ambiguity got the file moved in one turn** — cheaper than the
alternative, where the only record of a 6-round decision lives on an edge nobody else can read.

## RESUME trigger

**The surfacing question is CLOSED BY EVENTS, not by a decision** — I escalated it to the operator
twice and the PR merged before either was answered. ⭐⭐**A gate on someone else's reply with no
resume path of my own: the standing rule
([[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]]) named exactly this and I
still had no fallback.** Whether posting would have changed the outcome is **unmeasured** — do not
record it as "posting wouldn't have mattered"; a maintainer approved 20 min before the merge and
never saw the finding.

**LIVE follow-up, if anyone wants it:** codes 20001/20002/20005 are wrong on master today. The fix
direction is unaffected by the merge — extractor preserves every definition; lookup selects on
`source`+`catalog_code`+`catalog_name` (unique at both measured scopes); unresolvable tuple **warns**
rather than falling through, since `catalog_name` is not rename-stable. Also still open from the R2
record: `catalog_code` is load-bearing but absent from `_REQUIRED_TEST_META_KEYS` with a silent skip,
and `catalog-digest` writes failure text to **stdout**, so a caller ignoring exit status records an
error sentence as a digest. Nothing was ever posted to GitHub on this chain.
