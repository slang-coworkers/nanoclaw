---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788909922352-iihrqk
written_at: 2026-09-09T00:43:23.700Z
---

# Slang :: -qualified operator-name references: fix + PR-gate/comment-hygiene gotchas (#12971/#12976)

# `Namespace::operator+` parse gap — fix + process gotchas

**Fix (slang#12971 → PR #12976).** Explicit operator-symbol references (`operator+(a,b)`,
`x.operator()(v)`, `ns.operator+(...)`) already worked because `parseAtomicExpr` (bare) and
`parsePostfixExpr` (`.`-member) both route the name-read through the shared `ParseDeclName`
production (`slang-parser.cpp:1421`). The ONLY gap was the `::`-qualified form: `parsePostfixExpr`'s
`case TokenType::Scope` reads the name via `ParseStaticMemberName`, whose fallback was
`expectIdentifier` — never saw the `operator` escape. **One-line fix:** change that fallback to
`return ParseDeclName(parser);` (its non-operator branch is itself `expectIdentifier`, so plain
`Type::ident` is unchanged; the `__subscript::`→`operator[]` special case stays, checked first).

Post-fix semantics fall out for free: `ns::operator+` resolves like `ns::add` (namespace member
lookup on the bare symbol Name "+"). A *type-member* operator via `::` (`Vec2::operator+`) correctly
gets `E30100` (static-ref-to-non-static-member) — parses fine, semantic non-starter — so lock the
NAMESPACE `::` form as the positive regression, not a type-member one.

**Process gotcha 1 — the critique delivery gate.** In prod, `gate-critique-on-deliver.sh` blocks
`gh pr create` AND `gh pr edit --body` until codex `/codex-critique` has recorded PLAN_REVIEW,
CODE_REVIEW, and OUTPUT_REVIEW rounds with OUTPUT_REVIEW=approve. An ad-hoc `mcp__codex__codex` call
does NOT count — you must use the skill's verbatim developer-instructions (the tracker checks sentinel
lines) and tag `STAGE:` in the prompt. It re-hashes attested artifacts at send time, so editing any
file after an approve means re-running that stage. Budget for this before opening the PR.

**Process gotcha 2 — comment hygiene is strictly enforced, even in test files.** codex flags as
must-fix: change-history narration ("newly", "prior to the fix", "for the first time", "already worked
pre-fix"), and comments that restate the adjacent line. Write TIMELESS invariants ("X must diagnose
Y"), keep change-history in the PR body/commit only. Also don't overclaim a test-coverage analogy:
`subscript-accessor-reference.slang` covers E30100/E30027, NOT the operator-specific E20008.

**Other:** `--force-with-lease` fails with "stale info" in a fresh worktree that lacks
`refs/remotes/origin/*`; use explicit `--force-with-lease=<branch>:<remote-sha>` (get sha via
`git ls-remote`). DIAGNOSTIC_TEST CHECK lines must be in EMISSION order (parse-phase errors before
semantic), and `non-exhaustive` lets you match specific codes and ignore follow-ons.
