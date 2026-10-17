---
type: project
name: project_12326_throw_statement_missing_semicolon
description: "slang#12326 (CLOSED 08-05 by skiminki's #12328, Approach A ungated): `throw` parsed without its ';', which REJECTED valid `if (c) throw e; else ...`. Generated-mirror loose end resolved by #12444 (08-10). Durable lessons: check the inverse (does the omission reject valid code?), and don't adopt a reporter's causal claim as your own framing."
metadata:
  node_type: memory
  type: project
  originSessionId: a8ee5ad1-ba4e-4ca6-8725-1a830a33e465
---

# slang#12326 — `throw` statement missing required terminating `;` (CLOSED)

Self-filed by maintainer **skiminki-nv** 2026-08-03 (https://github.com/shader-slang/slang/issues/12326):
`if (n < 0) throw MyError.Negative` with no `;` compiled cleanly. Triaged P2, frontend-parser, at
`53b76e6d3` (verdict comment `5167467390`). **Fixed by his own PR #12328, merged 2026-08-05 06:37Z as
`19d1d4065`**, which adopted our recommendation verbatim. Condensed 2026-10-16 by okf-synthesis; the
merge/nightly close-out is [[project_12326_generated_mirror_nightly_break]].

## Root cause and fix

`ParseThrowStatement` (slang-parser.cpp ~:7580) never called `ReadToken(TokenType::Semicolon)`. Each
statement parse function owns its own `;`; `return`, `break`, `continue`, `discard` and expression
statements all consume it, and `throw` was the sole expression-bearing outlier. The shipped fix is that one
line, **ungated** (no language-version check), plus `tests/bugs/12326-throw-requires-semicolon.slang` and a
`…-negative.slang` diagnostic test. Labeled `pr: breaking change` by the author.

## The findings that reframed the issue

1. **The omission rejected valid code.** The trailing `;` parsed as a separate `EmptyStmt` that ended the
   `if`'s positive branch, so `if (n < 0) throw 1; else return 2;` failed with E20001 + E30015 (`else`
   orphaned; `parseIfStatement` saw `;` at `LookAheadToken("else")`). This was the real user bug, and
   skiminki's PR body led with it.
2. **The reported "misleading diagnostic" was not caused by the missing `;`.** Greedy expression absorption
   is generic: `return x` ⏎ `- 5;` absorbs the next line too. Requiring `;` turns the silent misparse in the
   `--n` case into an honest error but does not fix absorption (that would be an expression-grammar change
   shared with `return`, out of scope).
3. **A silent wrong-code path existed:** `throw x` ⏎ `- 5;` threw `x - 5` with no diagnostic.
4. **Fallout measured ~nil:** of 18 in-tree `throw` statements only one lacked `;`, and that was the
   generated behavior-mirror test. So no 202c language-version gate: gating a bug fix would leave legacy
   code with the broken if/else for no compat benefit (contrast [[project_12296_empty_statement_error_contexts]],
   [[project_12264_missing_return_unconditional_error_202c]], which are langver-gated proposals).

## Generated-mirror loose end (resolved)

The PR left `docs/generated/tests/.../grammar/stmt-throw-no-semicolon.slang` (a mirror asserting the old
behavior) and two generated doc lines contradicting the parser. The triager built the PR head and posted the
gap on #12328 (comment `5168427199`, bundle 68 pass / 1 fail) before merge; PR CI could not see it because
that directory runs only in the nightly (`workflow_dispatch` + cron, no `pull_request` trigger) and in the
failure-tolerant coverage job. It merged unaddressed. **Resolved by #12444 (merged 2026-08-10)**, which
replaced the mirror with `stmt-throw-requires-semicolon.slang` + `stmt-throw-missing-semicolon-rejected.slang`
(verified 2026-10-16: the old file is gone from master).

## Lessons

- **When a report says "the compiler accepts too much", check the inverse:** does the same omission reject
  valid code? Here it did, and nobody had noticed.
- **Don't hand a coworker the reporter's unverified causal claim as your own framing.** I wrote "it misparses
  … produces a badly misleading diagnostic" and called the change "source-breaking"; both premises were wrong
  while the conclusion (fix it) was right — the hardest error shape to catch (cf.
  [[project_11225_capability_target_incompat_slangpy_break]], [[feedback_label_dispatch_suspicions_as_hypotheses]]).
- **DeepWiki was false here:** it claimed the generated grammar doc said `ThrowStmt ::= 'throw' Expr ';'`;
  the doc had been deliberately aligned to the parser (no `;`). Verify DeepWiki doc claims against the file.
- **A green PR can carry a nightly-only break** when the affected tests only run outside `pull_request`
  ([[feedback_green_job_skipped_backend_zero_coverage]]). A doc that names an intended CI attachment point
  ("Lint on PR" in `regenerate.md`) is not evidence it is wired — it wasn't.
