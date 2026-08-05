---
name: project-7497-obfuscation-test-coverage-umbrella
description: "slang#7497 coverage umbrella — triaged 08-04; IR-without-AST confirmed removed, plus a NEW -obfuscate doc/behavior mismatch awaiting a maintainer bug-vs-doc ruling"
metadata: 
  node_type: memory
  type: project
  originSessionId: 2eb05288-22a4-406e-bc1f-857688d4893d
---

# slang#7497 — Expand test coverage for obfuscation, debug info stripping

**State (2026-08-04):** triaged, verdict POSTED as comment `5175957022`. Issue OPEN,
maintainer-owned umbrella — **do NOT drive to closure**. Author tangent-vector (MEMBER),
assignee jkiviluoto-nv. Labels `Dev Opened`/`CI`/`Test Coverage` + Type `Testing` were
already maintainer-set ⇒ untouched. Milestone Q1 2026 (Winter). Verified @ master HEAD
`0864e60e635ef39d4c25e5e57747d909f1c05edd`. **No fixer dispatched** — design/policy gate.

Not a bug report: a coverage/process tracking issue with a 3-item checklist. No repro to
force; the normal triage repro shape does not apply. Severity medium / P2.

## Three findings

**1. IR-without-AST emission: CONFIRMED REMOVED.** He asked for authoritative confirmation;
answer is his own PR #7483 (`6231a6830`) deleted `SerialOptionFlag{ASTModule,IRModule}` +
`WriteOptions::optionFlags`. MINE-VERIFIED at HEAD: `grep -rn SerialOptionFlag source/
include/ tools/` ⇒ **0**, with a non-zero control (`WriteOptions` ⇒ 15) so the zero is
evidence. `slang-serialize-container.h:18-31` now holds only
`sourceManagerToUseWhenSerializingSourceLocs` (read the file — confirmed). Write path
unconditional: `slang-serialize-container.cpp:216-228` writes `ir  ` iff `getIRModule()`,
`ast ` iff `getModuleDecl()` — no flag, no AST-less path. ⭐**Restoring is write+read+API,
not a flag flip** — both loaders hard-fail on a missing AST chunk (`slang-session.cpp:2174-2180`,
`slang-global-session.cpp:659-665`). `-serial-ir` is `REMOVED_SerialIR = 79` (`slang.h:1130`).

**2. ⭐⭐ NEW — `-obfuscate` does NOT strip the AST, but the docs promise it twice.**
Not in the issue. This is the live exposure defect the issue was fishing for.
- Docs, MINE-VERIFIED verbatim: `docs/user-guide/a1-03-obfuscation.md:39` ("If a
  `slang-module` is being produced, AST information will be stripped") and `:69` ("With the
  `-obfuscate` option we strip the AST, in an abundance of caution…").
- Triager's empirical RIFF per-chunk parse: `ir  ` shrinks 2164→1764 B and names vanish
  there, but `ast ` is **byte-identical** with and without `-obfuscate` (2164 B both), and
  non-`public` `internalFn` survives in it — including via the docs' own recommended
  `-obfuscate -g` → `.zip` ship flow.
- ⭐**MINE-CORROBORATED by a DIFFERENT INSTRUMENT** (static, not byte-parse): obfuscation is
  implemented at IR level only. `grep -rln "bfuscat" source/slang/*.cpp` ⇒ 8 files
  (`slang-ir-obfuscate-loc.cpp`, `slang-lower-to-ir.cpp`, `slang-check-decl.cpp`,
  `slang-linkable.cpp`, `slang-options.cpp`, `slang-compiler-options.cpp`,
  `slang-end-to-end-request.cpp`, `slang-repro.cpp`) — and **neither** `slang-serialize-ast.cpp`
  **nor** `slang-serialize-container.cpp`. The 8-file hit is the discriminating control that
  makes the two absences meaningful.
  ⚠️**My first attempt at this check was defective**: I grepped the two serialization files
  for `bfuscat` and got 0 — but my "control" (the same pattern in `slang-serialize-ir.cpp`)
  ALSO returned 0, so the zero proved nothing. Had to widen to `*.cpp` to earn a control.
  *A zero without a non-zero control is not evidence* — this fired for real here.
- ⇒ Root cause is the absent visibility filter, matching the standing TODO MINE-VERIFIED at
  `slang-serialize-ast.cpp:1871-1872` ("we might want to have a more careful pass here,
  where we only encode the public declarations").
- ⛔**bug-vs-doc is a MAINTAINER ruling, not ours** — one is a security-relevant behavior
  change, the other an admission the feature never shipped.
- ⚠️**Do NOT cite DeepWiki for the AST-stripping property** — it repeats the docs' wrong claim.

**3. #6913 is CLOSED-completed (2025-07-31, csyonghe "Done.")** ⇒ the issue text's stated
prerequisite has landed; #7497 is NOT blocked on it. Triager verified the *property* not the
closure: `FunctionDeclBase::body` (`slang-ast-decl.h:649`) has no `FIDDLE()` marker ⇒ not
serialized; `094d1ba7c` (#7812) removed it, ForceInlineEarly now prelinked at IR level. So
the PR-#6854 function-body worry is RESOLVED. The **non-`public` decls** half of that same
bullet is NOT done — finding 2 is its observable consequence.

## Coverage gap, stated concretely
Exists: `tests/obfuscate/` (4 pass), `tests/serialization/` incl. `obfuscated-module-check-loc`
+ `obfuscated-serialized-module-test` (15/15), debug info (`tests/spirv/debug-*`,
`debug-info-include-source-g0/g1/g2`, `separate-debug.slang`), source maps
(`tests/feature/source-map/`, `unit-test-source-map.cpp`), containers (`unit-test-riff.cpp`,
`unit-test-ir-blob.cpp`, `unit-test-type-conformance-binary-module.cpp`,
`tests/ir/dump-module.slang`).

⚠️**MINE-VERIFIED nuance that justifies the proposed work** — `unit-test-obfuscation-with-debug.cpp`
(`obfuscationWithSeparateDebug`, passes today) is **half non-enforcing**: Verification 1
(debug-info absence) `return SLANG_FAIL`s at `:333-337`, but Verification 2 (obfuscation
OpName count) only `printf`s `"✗ WARNING"` at `:349-353` and does **not** fail. A regression
in the obfuscation half goes green.

ZERO coverage: (a) nothing asserts what is *inside* a serialized `.slang-module`; (b) that
`-obfuscate` strips the `ast ` chunk (would fail today); (c) that non-`public` decls are
absent; (d) an *enforcing* obfuscated-names-absent-from-binary check.
⭐**(a) is demonstrated, not inferred: the serialization suite is 15/15 GREEN *while* finding 2
leaks names.** Mechanism gap: `slang-test` has no directive to assert on binary artifact
contents ⇒ container-content assertions belong in a `slang-unit-test` (precedent:
`unit-test-riff.cpp` already walks RIFF chunks).

## Candidate scopes (maintainer picks — we do NOT)
- **A (fixer-actionable NOW, LOW risk):** unit tests pinning today's true serialized-module
  contents + convert the warning-only obfuscation assertion to enforcing. No compiler/ABI change.
- **B (needs the finding-2 ruling first, MED-HIGH):** restore AST stripping under `-obfuscate`
  (couples to the removed capability — the two loader hard-fails must then tolerate AST-less)
  **or** correct `a1-03-obfuscation.md:39,69`.
- **C (maintainer/design, HIGH):** implement the `:1871` public-only TODO.
- **D:** his checklist step 1 ("work with users") is not automatable.

## Dedup
OPEN, unique. 3 REST searches ⇒ no sibling coverage issue. #6913 CLOSED-completed (prereq,
discharged) · #6854 MERGED (the AST overhaul) · #7483 MERGED = `6231a6830` (the removal) ·
#11930 MERGED 2026-07-03 (adjacent RIFF cleanup, restores nothing) · #10870 CLOSED.

## RESUME
**tangent-vector rules bug-vs-doc on finding 2** → then scope A (ours to draft on his go),
or B/C if he scopes them. ⚠️A milestone is not a trigger: nothing here fires without a
*human maintainer comment*. Nudge candidate ~08-11 if silent. Keep the issue OPEN.

Related: [[feedback_control_the_instrument_not_the_reasoning]] (the zero-without-control
near-miss above), [[feedback-green-job-skipped-backend-zero-coverage]] (warning-only
assertion is the same vacuous-green family).
