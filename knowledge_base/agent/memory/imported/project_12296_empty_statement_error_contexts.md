---
name: project_12296_empty_statement_error_contexts
description: "slang#12296 — make stray empty-statement an error/warning in if/for/while/catch/defer (202c language-hardening)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 993f609a-881f-4274-b517-c27342cfc289
---

# slang#12296 — empty statement as error in likely-error contexts

skiminki-nv (maintainer, self-filed) 202c language-design proposal. Extend the
existing `UnintendedEmptyStatement` warning (dx 20101 — fires today only for
`if` then/else) so a stray bare `;` in `for`/`while`/`do`/`catch`/`defer` bodies
becomes an ERROR under Slang 202c (or a WARNING at minimum). Rationale: stray
semicolon in these positions is almost always a bug; intended empty body → `{}`.

**Triage (2026-07-30):** feature (language-hardening) / medium / frontend
(parser+diagnostics) / P2. Not a bug, no repro. Verdict 5-bullet posted on issue
(comment 5134417072). Type `Language Maturity` + labels left human-set. Same
cluster as [[project_12284_cross_module_overload_silent_break_warning]] and
[[project_12222_lexer_lone_utf8_continuation_byte]] (skiminki self-filed 202c
maturity items).

**Feasibility:** low blast-radius — whole feature is one parser location
`Parser::ParseStatement` (slang-parser.cpp:7076-7089), keyed on parent type.
Stray `;` = `EmptyStmt`, intended `{}` = `BlockStmt` → cleanly separable. Other
contexts silent only because body-parse sites don't pass the parent.
Warning→error-by-version precedent = volatile modifier (:10284-10296).

**⚠️ Blocker:** the 202c-error form needs `SLANG_LANGUAGE_VERSION_202C`, which
does NOT exist in-tree — introduced by OPEN PR #12179 (same shared blocker as
sibling [[project_12264_missing_return_unconditional_error_202c]]). A pure-WARNING
form has no such dependency.

**State: PARKED** — maintainer design sign-off owns warning-vs-error, exact
context set, and `do;`/`do;catch` symmetry sub-cases (202c language call). NO
auto-fixer dispatch (self-filed 202c policy).

**RESUME:** dispatch slang-fixer when a maintainer says "make a PR" (and, for the
error form, #12179 merges). Fresh substantive human comment re-opens.
