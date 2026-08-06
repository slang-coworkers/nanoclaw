---
name: project_12326_generated_mirror_nightly_break
description: "slang#12326 CLOSED by #12328 merged 08-05 06:37Z as HEAD 19d1d4065 — the pre-merge-flagged loose end is now LIVE: docs/generated mirror test stmt-throw-no-semicolon.slang + 2 stale doc lines + 2 README rows. First break fires nightly 04:00Z 08-06. Nightly was ALREADY red 4 nights (11 unexpected fails) ⇒ our +1 will be camouflaged"
metadata:
  node_type: memory
  type: project
  originSessionId: webhook-12361-followup
---

# slang#12326 close-out — the generated-mirror loose end is now live in master

**#12328 MERGED `2026-08-05T06:37:26Z`; issue #12326 CLOSED `06:37:27Z` `COMPLETED`.**
Merge commit = **`19d1d4065bcdbe2c1e0817f9ead7c4d245758e5d`** — which is *also* #12361's reporter SHA
and our clone HEAD. Shipped diff: `source/slang/slang-parser.cpp` (+1 line,
`ReadToken(TokenType::Semicolon)` after `ParseExpression()` in `ParseThrowStatement`) plus
`tests/bugs/12326-throw-requires-semicolon.slang` and `…-negative.slang`. Labeled a **breaking change**
in the commit body by the author.

## The loose end WAS flagged publicly pre-merge, and merged anyway

Our comment on PR #12328 (`nv-slang-bot[bot]`, before merge) named all four artifacts, with a built
counterfactual at the PR head `d33d6928b`: bundle went **68 pass / 1 fail**. ⇒ this is **not** a missed
call; it is a **flagged-and-accepted** loose end. The author replied on a different thread (caret
anchoring) and merged without addressing it. ⭐⭐**A pre-merge flag that the author doesn't answer is
not a resolved flag — it converts into an owed follow-up at merge, and nothing in CI will remind you.**

## MINE-verified on `origin/master` @ `19d1d4065` (08-05 08:00Z), all four still present

1. **`docs/generated/tests/design/syntax-reference/grammar/stmt-throw-no-semicolon.slang:30`** — bare
   `throw TErr.Boom` with no `;`. Its `//META: purpose=` is literally *"`ThrowStmt` parses as
   `'throw' Expr` without consuming a trailing `';'`"* ⇒ a **behavior mirror**, so updating it is not a
   semantic loss. Header says `//META: warning=Auto-generated … Do not edit by hand.`
2. **NOT gated:** `docs/generated/tests/_meta/expected-failures.txt` has **24 entries, zero matching
   `throw`** (`grep -n throw` → rc=1).
3. **Two stale doc lines**: `docs/generated/design/syntax-reference/grammar.md:440-442`
   (`ThrowStmt ::= 'throw' Expr` + *"(does not consume ';'; a trailing ';' is parsed as a separate
   EmptyStmt)"*) and `docs/generated/design/ast-reference/statements.md:124` (*"`ParseThrowStatement`
   does not itself consume a trailing `;`"*).
4. **Two README rows** also assert it — `…/grammar/README.md:85` and
   `…/ast-reference/statements/README.md:118` (the latter as an `internal-source-fact`).
5. **Only ONE semicolon-less `throw` remains in `tests/`** and it's the intentional negative
   (`tests/bugs/12326-throw-missing-semicolon-negative.slang:18`) ⇒ main suite is clean; the blast
   radius really is `docs/generated` only. (Control: 20 generated files contain `throw ` at all.)

## Timing + the camouflage problem

- `nightly-slang-test.yml`: `workflow_dispatch` + `cron: "0 4 * * *"`, **no `pull_request` trigger** ⇒
  PR CI structurally cannot see it. First run on the merged parser = **04:00Z 2026-08-06**.
- The 08-05 05:05Z run (sha `ff45b15ed`, **pre-merge**) shows `stmt-throw-no-semicolon.slang (cpu)`
  **passed** — confirming it is green today and will flip tomorrow.
- ⛔**The nightly is ALREADY RED and has been for 4 consecutive nights** (08-02/03/04/05 all
  `conclusion: failure`), most recently **99% (4552/4583), 185 ignored, 20 expected-fail, and 11
  UNEXPECTED failures** — nvapi guards, wgsl/metal append-buffer, ir-reference decorations, etc.,
  **none related to `throw`**.
  ⇒ ⭐⭐⭐**Our +1 failure lands in an already-failing job, so "nightly went red" will NOT be the
  signal — the run was red before and will be red after. Anyone triaging tomorrow sees 12 fails in a
  chronically-red job and has no reason to single ours out.** This is exactly the *"attributed to
  whatever else ran that night"* outcome our own PR comment predicted, made worse by the pre-existing
  redness. **A break that changes a count but not a status is effectively invisible.**

## Remedy — deliberately NOT prescribed by us

`_meta/regenerate.md` § Hand-edit policy: `.slang` files under `docs/generated/tests/<key>/` get
**no hand-edits**. Sanctioned routes: (1) improve the bundle prompt + re-run generation, (2) **improve
the source documentation** — and it says *"a docs/generated/design change is a separate PR"*, (3)
improve the manifest then `regenerate.py mark-fresh`. Route (2) looks like the root fix (the doc is the
mirror's source, and `slang-parser.cpp` is one of this bundle's `watched_paths`, so the parser edit is
what makes it stale by the tooling's own definition). But `regenerate.py` exposes no subcommand that
rewrites a test body (list/digest/lint/verify/mark-fresh only). ⇒ **which route, and whether it's a
follow-up PR, is a maintainer call.** Adding it to `expected-failures.txt` is a 4th option we did not
endorse — it would gate the symptom and leave two doc lines contradicting shipped behavior.

## RESUME

**Owed: a close-out that makes the loose end publicly trackable now that the PR is merged and the
flag went unanswered.** Options: comment on the closed #12326 / merged #12328, or file a follow-up
issue naming the 4 artifacts + the route decision. ⚠️**Do NOT hand-edit the generated `.slang`.**
⚠️Do not expect nightly redness to serve as the reminder (see camouflage above).
Triager offered to own this after the #12361 verdict.

Related: [[project_12326_throw_statement_missing_semicolon]] (the original chain),
[[project_12361_catchall_direct_throw_sccp_param_ice]] (same HEAD, unrelated cause),
[[feedback_green_job_skipped_backend_zero_coverage]] (vacuous-green family).
