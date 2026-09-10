---
name: project_12326_throw_statement_missing_semicolon
description: "slang#12326 — throw stmt parses without terminating ';'; VERIFIED: real bug — it REJECTS valid `if (c) throw e; else ...`; 1-line fix, fallout ~nil, no 202c gate"
metadata: 
  node_type: memory
  type: project
  originSessionId: a8ee5ad1-ba4e-4ca6-8725-1a830a33e465
---

# slang#12326 — `throw` statement missing required terminating `;`

Author **skiminki-nv** (MEMBER, maintainer, self-filed), 2026-08-03. `Dev Opened`.
https://github.com/shader-slang/slang/issues/12326

**Report:** every non-block statement requires `;` except `throw`;
`if (n < 0) throw MyError.Negative` (no `;`) compiles cleanly. Follow-up comment
`5167120531` adds an "ambiguity" case: `throw 123U` then `--n;` → misleading
`argument passed to parameter '0' must be l-value` on `123U`.

**Triage VERIFIED @ master HEAD `53b76e6d3`** (== reporter's SHA). Triager built a
1-line probe slangc, measured fallout, then reverted (source clean, nothing pushed).
Memo `triage-12326.md` in my inbox `a2a-1785766300016-t87ewe/`.
Verdict: bug (parser) / medium / **P2** / frontend-parser. Both repros confirmed.

**Root cause:** `ParseThrowStatement` (slang-parser.cpp:7580-7587) never calls
`ReadToken(TokenType::Semicolon)`. Dispatched by plain keyword lookahead
(:6977-6980), not a syntax-table entry — the framework doesn't consume `;`, each
parse fn owns it. Siblings that DO: `return` :7567, `break` :7547, `continue`
:7556, `discard` :6949, expr-stmt :7596. (`defer` :7571 also doesn't, but
correctly — it parses a nested Stmt carrying its own terminator.) Among
expression-bearing statements `throw` is the sole outlier.

## Three framing corrections — all mine were wrong, all load-bearing

1. **The misleading diagnostic is NOT caused by the missing `;`.** Greedy
   `ParseExpression()` absorption is generic to Slang's newline-insensitive
   expression grammar. `return` — which already requires `;` — absorbs the next
   line identically (`return x` ⏎ `- 5;` → `return x_0 - int(5);`). Probe-proved:
   with `;` required, `throw x` ⏎ `- 5;` STILL parses as `throw (x-5)`. Requiring
   `;` converts a *silent* misparse into an honest error in the `--n` case; it does
   not fix absorption. A tighter bound = changing the whole expression-statement
   grammar (Approach C, HIGH risk, shared with `return`) — out of scope here.
2. **A silent wrong-code path exists, worse than the reported error.** Infix ops
   absorb with zero diagnostics: `throw x` ⏎ `- 5;` emits
   `packAnyValue4_0(x_0 - int(5))` — wrong value thrown, compiles clean.
   Sweep: `- 5;` `-n;` `+ 5;` `* 2;` → silent absorb · `--n;` `++n;` → absorbed
   as POSTFIX then dangling `n` ⇒ misleading error · `(n);` → absorbed as CALL,
   E30016 · `g(n);` `buf[0]=1;` `int y=1;` `return 5;` `if(...)` → safe.
3. **BIGGEST — the omission REJECTS valid-looking code today.** The trailing `;`
   parses as a separate `EmptyStmt`, terminating the `if`'s positive branch, so a
   following `else` is orphaned:
   `if (n < 0) throw 1; else return 2;` → E20001 `expected ';'` + E30015
   `undefined identifier 'else'`. Mechanism: `parseIfStatement` :7381-7386 gets
   the ThrowStmt with `;` unconsumed, then `LookAheadToken("else")` sees `;`.
   `throw` is the only statement where writing the semicolon you're *supposed* to
   write breaks the enclosing if/else. **This inverts the issue's framing**: not
   "accepts too much" (hygiene) but "rejects well-formed code" (real user bug),
   and it's the strongest argument for fixing over parking. Fix makes
   previously-rejected valid code compile.

## Fallout — MEASURED, not estimated (my "source-breaking risk" premise was wrong)

Exhaustive `.slang`/`.meta.slang` sweep (tests/ source/ incl. core+glsl modules,
prelude/ docs/ examples/ tools/): 18 genuine `throw` statements, 17 already have
`;`, **exactly 1 semicolon-less** — and it's the auto-generated behavior-mirror
`docs/generated/tests/design/syntax-reference/grammar/stmt-throw-no-semicolon.slang:30`
(`//META: generated=true`, purpose = assert current behavior). ZERO throw
statements in core module / prelude / *.meta.slang / examples / tools.
Probe test runs: error-handling 32/32, diagnostics 711/711, language-feature
2187/2187, grammar dir 68/69 (the 1 = that mirror). ⇒ **source-breaking risk ~nil**;
decides *small contained fix*, not design call.

## Language-version gate — CONFIRMED independent of #12179, and a gate is arguably WRONG

`SLANG_LANGUAGE_VERSION_202C`/`202c` absent at HEAD (arrives with unmerged #12179);
enum = UNKNOWN/LEGACY 2018/2025/2026/LATEST=2026/DEFAULT=LEGACY (slang.h:5758-5765).
Version-gated parse precedent is cheap (:6370, :8846-8861, :10293) — but gating a
*bug fix* to 2026+ leaves legacy code with the broken if/else for zero compat
benefit (1 in-tree site). ⇒ **ungated; no #12179 dep, no 202c label.** Confirms the
"not like its siblings" read vs [[project_12296_empty_statement_error_contexts]] and
[[project_12264_missing_return_unconditional_error_202c]] (langver-gated proposals
blocked on #12179).

## Recommended path — Approach A, ungated

One line at slang-parser.cpp:7586 (`ReadToken(TokenType::Semicolon);`) + regenerate
`stmt-throw-no-semicolon.slang` + fix the two generated doc lines that currently
*document* the omission: `docs/generated/design/syntax-reference/grammar.md:342-344`
and `docs/generated/design/ast-reference/statements.md:112`. Explicitly NOT
Approach C (infix absorption) in the same change — note it as pre-existing and
shared with `return`. Approach B (langver-gated) not recommended.

**Not a duplicate** (REST search; `gh issue list --search` GraphQL → 401 this
session). Sibling-but-distinct #12296. The `UnintendedEmptyStatement` lint HAS
landed (slang-diagnostics.lua:980, fired :7084) but only when the empty stmt's
parent is an `IfStmt` — does NOT fire for throw's orphan `;` (it's a sibling
EmptyStmt).

⚠️ **DeepWiki was FALSE here:** claimed the generated grammar doc states
`ThrowStmt ::= 'throw' Expr ';'`. grammar.md:342 says `'throw' Expr` with an
explicit note the `;` is NOT consumed, and a prior doc-review logged this exact
question as F-006 → `rejected-bogus` (the doc was deliberately aligned TO the
parser). **"The doc already requires it" is NOT available as an argument — never
say it publicly.**

## PR #12328 — skiminki's own fix, 2026-08-03 15:07Z (~1h after our verdict)

https://github.com/shader-slang/slang/pull/12328 · head `d33d6928bfe905a3abff720fc7d787bcfa1187e0`
· branch `12326-throw-missing-semicolon` → master · **non-draft**, mergeable,
label `pr: breaking change`, 0 reviews / 0 requested reviewers, `Fixes #12326`
(GraphQL `closingIssuesReferences` = [12326] ⇒ auto-close WILL fire).

**Our recommendation adopted essentially verbatim:** the parser change is exactly
`+ ReadToken(TokenType::Semicolon);` after `ParseExpression()` at :7586 —
Approach A, **ungated** (no langver check), 1/0 lines. Plus 2 new tests:
`tests/bugs/12326-throw-requires-semicolon.slang` (positive; `if/else` case,
`-target spirv -warnings-as-errors all`) and
`...-negative.slang` (`DIAGNOSTIC_TEST`, expects `unexpected identifier, expected ';'`).
His PR body leads with the **if/else rejection** — the reframing finding from our
verdict, not from his original report.

### ⚠️ GAP our triage measured that the PR does NOT address (verified at PR head)

`docs/generated/tests/design/syntax-reference/grammar/stmt-throw-no-semicolon.slang`
is **unchanged at `d33d6928b`** and still contains a semicolon-less `throw TErr.Boom`
(:30) — the file the triager's probe measured as the sole failure (grammar bundle
68/69). It is **NOT** in `docs/generated/tests/_meta/expected-failures.txt`
(grepped: zero `throw` hits). Also unchanged and now contradicting the parser:
`grammar.md:342` (`ThrowStmt ::= 'throw' Expr` + explicit "does not consume `;`"
note) and `ast-reference/statements.md:112`.

**Why PR CI stays green anyway:** that directory only runs under
`slang-test -test-dir docs/generated/tests`, invoked from
`nightly-slang-test.yml` — triggers are `workflow_dispatch` + `schedule` cron
`0 4 * * *`, **no `pull_request`** — and from `ci-slang-coverage-test.yml`
`--with-agentic-tests`, where the workflow comment says failures are *tolerated*
so coverage still collects. Default `slang-test` testDir is `tests/`
(options.cpp:740-744). ⇒ **the breakage lands green and surfaces as a nightly-only
failure after merge.** Classic [[feedback_green_job_skipped_backend_zero_coverage]]
shape. CI at head when checked: 10 success / 11 pending / 0 failure.

### Gap POSTED on the PR + verified against his actual code

Triager comment `5168427199` on PR #12328 (2026-08-03 15:30Z, `nv-slang-bot[bot]`,
4423 chars — I re-read it live). He fetched `pull/12328/head`, built **his** parser
diff (not the earlier probe): new tests 2/2 pass, grammar bundle **68 pass / 1 fail**
with `E20001 unexpected token ... unexpected '}', expected ';'`, then restored
pristine. Framed as one loose end on a correct fix; remedy deliberately NOT
prescribed. Neither his PR body nor coderabbit's comment mentions the mirror or the
docs — genuinely unreported.

**Remedy is a maintainer call, and the tooling has no button for it:**
`_meta/regenerate.md` §Hand-edit policy (:167-171) forbids hand-edits to `.slang`
under `docs/generated/tests/<key>/`; `regenerate.py` exposes no subcommand that
rewrites a test body (list/digest/lint/verify/mark-fresh; generation is
operator-driven via prompts). Route (2) "improve the source documentation" looks
like the root fix and `regenerate.md` says a `docs/generated/design` change is a
**separate PR** ⇒ possibly a follow-up, not this PR. Signal pointing that way:
`source/slang/slang-parser.cpp` is one of the grammar bundle's own `watched_paths`
(manifest.yaml:228-233) ⇒ his parser edit is what makes the bundle stale *by the
tooling's own definition*.

### My premise refined (conclusion intact) + 2 findings past the briefing

- I said the nightly has "no `pull_request`". `grep -c pull_request` = **1** — but
  it's :42, `IS_FORK_PR: ${{ github.event_name == 'pull_request' … }}`, an env
  expression inside `jobs:`, not a trigger. `on:` is `workflow_dispatch` + cron
  only, as claimed. **Verified myself.** Triager also traced the coverage path up
  its `workflow_call` to `nightly-slang-coverage-test.yml` (dispatch + cron 02:00)
  — a called workflow's own triggers prove nothing.
- `regenerate.md` :188-193 states the blindness is **by design**: nightly is
  *"Advisory only; never blocks PRs."*
- The **"Lint on PR" check that `regenerate.md` :193 names as an intended
  attachment point DOES NOT EXIST** — I swept every workflow at PR head for
  `regenerate.py`: exactly 1 hit, `nightly-slang-test.yml:108`. A doc describing an
  intended CI attachment is not evidence it's wired.
- `list-stale` couldn't isolate this anyway: **all 68 bundles already report
  stale/missing on clean master** (45 stale + 23 missing) ⇒ signal saturated. The
  triager said so publicly rather than implying the tracker would have caught it.

## State

Chain re-opened by skiminki's comment `5168156512` ("Candidate fix: PR #12328").
Verdict `5167467390` live on the issue; gap comment `5168427199` live on the PR.
PR at `d33d6928b`: open, non-draft, `mergeable=true` / `mergeable_state=blocked`,
`reviewDecision=REVIEW_REQUIRED`, 0 reviews, comments = coderabbit + ours.
**No fixer dispatch** (maintainer owns his own PR); we don't flip ready / merge
(operator-gated per [[feedback_github_writes_operator_authorized]]).
RESUME = skiminki/maintainer responds, **or** PR merges → triager re-reads the
merged diff, refreshes verdict `5167467390` in place, forwards final
[Triage Resolution]. Watch item: if it merges unaddressed the break surfaces at the
**04:00 UTC nightly**, attributed to whatever else ran that night.

## Independently re-verified by me (not just relayed)

At SHA `53b76e6d3`, via GitHub API: `ParseThrowStatement` :7580-7587 has no
`ReadToken(TokenType::Semicolon)` while `ParseExpressionStatement` immediately
below does · `parseIfStatement` calls `positiveStatement = ParseStatement(...)`
then `LookAheadToken("else")` — mechanism holds · `grammar.md:342-344` reads
`ThrowStmt ::= 'throw' Expr` **with the explicit note "does not consume `;`; a
trailing `;` is parsed as a separate EmptyStmt"** (DeepWiki's contrary claim is
indeed false) · `statements.md:112` likewise says "`ParseThrowStatement` does not
itself consume a trailing `;`" · `stmt-throw-no-semicolon.slang` is
`generated=true` with purpose = assert the current no-semicolon behavior ·
comment `5167467390` live, author `nv-slang-bot[bot]`, 5297 chars · issue open,
labels `Dev Opened` + `reproduced`, Type `Language Maturity`.

## Lesson for me

I handed the triager framing that embedded the reporter's **unverified causal
claim** as my own words — "it actually misparses… produces a badly misleading
diagnostic" — when absorption is generic to every expression statement and the
missing `;` isn't the cause. Same shape as the #11225 lesson
([[project_11225_capability_target_incompat_slangpy_break]]): a wrong premise
propping up a right conclusion (fix it) is the hardest error to catch. Also: I
asserted the risk was "source-breaking/test fallout" — measurement said ~nil.
**When a report says "the compiler accepts too much", check the inverse too:
whether the same omission REJECTS valid code.** That was the real bug here and
nobody had noticed it.
