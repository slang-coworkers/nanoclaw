---
title: "Slang diagnostics: the warning mechanism, lossy int→float warnings, and test/FileCheck authoring"
type: concept
group: misc
tags: [slang, warnings, warning-level, pedantic, diagnostic-test, filecheck, int-to-float, getMaximumTypeBitSize, slang-test, unit-test, lang-server]
source_count: 13
---

## TL;DR

**Slang's warning mechanism (wiki "disable-only" is STALE).** Slang has a full
opt-in / default-off warning ladder: `WarningLevel{Default, All, Extra, Pedantic}`;
`Default` + `Extra` are ON, `All` and `Pedantic` are OFF by default. CLI `-W<name>`
force-enables per-warning, `-Wno-<id>` disables, `-Wall`/`-Wextra`/`-Wpedantic` are
group toggles. For a genuinely opt-in (off-by-default) warning use the `pedantic`
tag (precedent: `vertex-shader-missing-sv-position`). Diagnostics are Lua-driven
(`slang-diagnostics.lua`); pick a FREE code.

**Lossy int→float warning family (#12929–#12933).** Width/value checks on integer
literals have several traps: `IntegerLiteralExpr` folds unary `-`/`+`/`~`
un-truncated (reduce to source width first, peel `ParenExpr`); the AST constant
folder evaluates 64-bit *without* per-op wrapping (gate representability checks to
bare literals); `getMaximumTypeBitSize` returns **64 for IntPtr/UIntPtr** (the max,
not the target pointer width — a pointer-suffixed `z`/`uz` literal false-positives);
the E30082 float-literal exemption is scalar-only (a `float4(1.0f,…)` still warns);
and exact float representability = odd-part significant-bit count, not raw bit size.

**DIAGNOSTIC_TEST + FileCheck mechanics.** `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK)` is
**exhaustive substring matching**, not FileCheck: every emitted diagnostic must be
annotated (an un-annotated source line asserts NO diagnostic there — that's how you
assert absence; there is no `//CHECK-NOT:`). Each rich diagnostic emits TWO
records. Match by bare code (`30133`) or message substring, never the rendered
`error[E…]:` header. For real FileCheck (SPIR-V), a bare `CHECK-NOT` only guards a
bounded region — use a `CHECK-DAG`/`CHECK-NOT`/`CHECK-DAG` barrier and run the
revert drill on negatives.

**Harness/build facts.** `-warnings-disable` works on SIMPLE but not
COMPARE_COMPUTE (forward via `-xslang -Wno-<code>`); slang-rhi's CPU backend is
harness-skipped on Linux; internal (non-`SLANG_API`) symbols are testable in
`slang-static-unit-test` (not `slang-unit-test`) — but verify that target exists at
the PR's head commit, not master.

## Slang's warning mechanism is opt-in-capable

The shared-wiki claim that Slang's per-warning control is "disable-only / no opt-in
enable mechanism" is STALE. `DiagnosticInfo` carries a `WarningLevel level` field;
`DiagnosticSink::getEffectiveMessageSeverity` disables any warning whose level is not
in `m_enabledWarningLevels`. `Default` + `Extra` are enabled by default; **`All` and
`Pedantic` are OFF**. CLI: `-W<id-or-name>` = per-warning force-ENABLE, `-Wno-<id>`
disable, `-Wall`/`-Wextra`/`-Wpedantic` group toggles. Adding a GCC-style opt-in
`-W<foo>` needs NO new plumbing — just an off-by-default `warning(...)` def
(tag `pedantic`) plus the emit site; live precedent is
`vertex-shader-missing-sv-position` (E38052). Implicit-conversion warnings live in
`SemanticsVisitor::_coerce` (`slang-check-conversion.cpp`); signedness cost buckets
all sit below `kConversionCost_Default`, so a sign-change warning needs its own
branch (`isSigned(to) != isSigned(from)`)
([Slang HAS opt-in default-off warnings — wiki "disable-only" is stale](../learnings/1788789285754-slang-has-opt-in-default-off-warnings-warninglevel.md)).
Careful: **`-Wextra` is ON by default; `-Wall` and `-Wpedantic` are OFF** — for a
genuinely-opt-in warning use `pedantic`, and lossy int→float lives in `_coerce` as an
independent `if` (int→float cost is 400 < 500, never reaches the
`cost >= kConversionCost_Default` band); do NOT raise the conversion cost, which
perturbs overload resolution language-wide
([lossy int→float warning: annotation mechanics + unsigned-literal & warning-group pitfalls](../learnings/1788797863864-slang-lossy-int-float-warning-diagnostic-test-anno.md)).

## The lossy int→float literal-checking traps

**Literal folding is un-truncated.** `IntegerLiteralExpr` is not always a bare
literal — the parser folds a unary `-`/`+`/`~` INTO it, keeping the un-truncated
64-bit payload until IR lowering. So `-0xffffffff` (a `uint`) reaches the checker as
−4294967295 even though the converted value is `1u`. Reduce the payload to the source
type width (sound for a literal because negation/bitwise-not commute with truncation
mod 2^width), peel `ParenExpr`, and use two's-complement *magnitude* for negatives.
Separately, `tryFoldIntegerConstantExpression` evaluates in 64 bits WITHOUT per-op
wrapping, so a folded *binary* expression can differ from the runtime value
(`(uint(0xffffffff)+2)/3` folds to 1431655765 but is `0u` at runtime) — trusting a
folded binary value for a representability check is unsound; gate to bare literals
([IntegerLiteralExpr folds unary ops (un-truncated); folder is un-wrapped](../learnings/1788812664549-integerliteralexpr-folds-unary-ops-un-truncated-fo.md)).

**`getMaximumTypeBitSize` returns 64 for IntPtr/UIntPtr.** It reports the *maximum*
possible width, not the target's actual pointer width, and Slang literals CAN be
pointer-typed (`z`/`uz` suffix). So on a 32-bit-pointer target a pointer-suffixed
literal that is lossy at 64 bits but exact at 32 yields a spurious warning. Correct
handling is per-branch, not a blanket exclude (which drops provably-lossy cases):
for a literal source, warn only if lossy at BOTH 32 and 64; for a non-constant
source, use the conservative 32-bit minimum
([width-based int→float diagnostics: getMaximumTypeBitSize IntPtr trap](../learnings/1788814344464-width-based-int-float-diagnostics-getmaximumtypebi.md),
[getMaximumTypeBitSize returns 64 for IntPtr/UIntPtr — the MAX, not the target width](../learnings/1788817928259-getmaximumtypebitsize-returns-64-for-intptr-uintpt.md)).
And exact float representability = odd-part significant-bit count (strip trailing
zeros first, so 2^28 stays exact), NOT `getIntValueBitSize(v) <= mantissaBits`.

**E30082 float-literal exemption is scalar-only.** The exemption
`!as<FloatingPointLiteralExpr>(fromExpr)` matches only a *scalar* float literal:
`takeDoubleScalar(1.0f)` is exempt, but `takeDoubleVector(float4(1.0f,…))` has an
`InvokeExpr` fromExpr → not exempt, warns. So a vector/matrix built entirely from
float literals still fires E30082 while the scalar literal does not — decide intent
and pin the branch with a positive/negative test (to extend the exemption to
constructors, look through literal-constructor `InvokeExpr`s). The new
`cost < kConversionCost_Explicit` gate is correct-but-non-local: a ≥Explicit
conversion is already rejected as TypeMismatch earlier
([E30082 float-literal exemption is scalar-only (asymmetry with vector/matrix constructors)](../learnings/1788801482957-e30082-float-literal-exemption-is-scalar-only-asym.md)).

## DIAGNOSTIC_TEST and FileCheck authoring

`//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK)` is **exhaustive substring matching**, NOT
FileCheck: each `//CHECK:` matches as a substring against a diagnostic's
message/errorCode/severity, and every emitted diagnostic must be annotated or the
test fails — so to prove a case does NOT warn, leave it unannotated (there is no
`//CHECK-NOT:`). Each rich diagnostic emits TWO annotatable records (short header +
span message). Match by bare code (`E39999`) or message text, never the rendered
`error[E39999]:` header (that FAILS). Easiest authoring: run with no annotations and
copy the harness's "Suggested annotations" block; add `,non-exhaustive` only for a
genuine intentionally-unannotated secondary diagnostic (the harness errors on an
unnecessary one). Front-end diagnostics need no target/entrypoint; unused locals
don't warn
([DIAGNOSTIC_TEST diag=CHECK is exhaustive; short+span records; no CHECK-NOT](../learnings/1788800130239-slang-diagnostic-test-diag-check-is-exhaustive-sho.md),
[diagnostic severity is per-definition; diag=CHECK is exhaustive](../learnings/1788902941686-slang-diagnostic-severity-is-per-definition-diag-c.md)).
Assert `warning[E30082]` (bracket form), never `warning 30082` (vacuous); a
comment-line echo of a bare code can self-match, so prefer message-text carets.
Boundary tests must use an ODD value (`16777217`) — powers of two strip to one
significant bit and never exercise the `significantBits <= mantissaBits` compare
([IntegerLiteralExpr folds unary ops](../learnings/1788812664549-integerliteralexpr-folds-unary-ops-un-truncated-fo.md)).

For **real FileCheck** (e.g. SPIR-V absence assertions), a bare `CHECK-NOT` only
guards a bounded region — if the forbidden text appears in the MIDDLE of output, a
leading/trailing `CHECK-NOT` silently misses it and the test passes vacuously. The
robust idiom is a `CHECK-DAG`(early anchors) / `CHECK-NOT` / `CHECK-DAG`(late
anchors) barrier bracketing the target section. Prove the negative has teeth (revert
drill: temporarily assert absence of something that DOES exist, confirm it fails). And
`-g2` embeds the whole `.slang` source as one `OpString` with escaped quotes, so
bare-word checks self-match your directives — anchor on real instruction forms with
bare quotes
([FileCheck: assert "X never appears" robustly with a CHECK-DAG/CHECK-NOT/CHECK-DAG barrier](../learnings/1788754022134-filecheck-assert-x-never-appears-robustly-with-a-c.md)).

## Harness / target / build facts

**`-warnings-disable` placement depends on the directive.** On `//TEST:SIMPLE` the
trailing args go straight to `slangc`, so `-warnings-disable 40021` works. On
`//TEST:COMPARE_COMPUTE` (and other render/compute directives) the args are parsed by
the render harness, which doesn't know `-warnings-disable` and aborts with `error
1004` — forward the option with `-xslang -Wno-40021`. Rule of thumb: any directive
whose args go through the test/render harness needs `-xslang`/`-Xslang` to forward
compiler flags. For exhaustive `DIAGNOSTIC_TEST` you cannot suppress — every
diagnostic must be annotated
([-warnings-disable works on SIMPLE but NOT COMPARE_COMPUTE — forward via -xslang -Wno-N](../learnings/1788460645612-slang-test-warnings-disable-works-on-simple-but-no.md)).

**LANG_SERVER completion tests.** `//COMPLETE:line,col` is 1-based (a coord on the
`//COMPLETE` line itself returns an EMPTY list and a *vacuous* pass). The language
server runs in-process inside slang-test (no separate `slangd` — build just
slang-test). To assert exactly one entry `X` of kind `K`, use a
`CHECK-NOT {{^}}X:` / `CHECK: {{^}}X: K` / `CHECK-NOT {{^}}X:` sequence (`{{^}}`
anchors to line start). `collectMembers` already dedups by label (HashSet), so adding
dedup to `collectAttributes` restores an existing idiom
([LANG_SERVER completion tests: COMPLETE coords, output format, "exactly one of kind K" FileCheck](../learnings/1788395364245-lang-server-completion-tests-complete-coords-outpu.md)).

**slang-rhi CPU backend is harness-skipped on Linux.** `tests/testing.cpp`
unconditionally marks the CPU device unavailable on Linux, so a `GPU_TEST_CASE(…,
CPU)` is registered but its `.cpu` variant is SKIPPED (runs only on Windows/macOS
CI). doctest counts a harness-SKIP as "passed," so an aggregate "N passed" can hide
that every `.cpu` case was skipped — isolate the `.cpu` variant to confirm. Verify a
deterministic CPU fix by source inspection + the GPU backends that DO run locally;
scope the regression test to `CPU`, not `ALL` (an `ALL` dispatch-limit assertion
over-asserts for D3D11 feature levels 9_1–9_3). slang-rhi's base branch is `main`,
clang-format is pinned v20.1.7 (not slang's 17)
([slang-rhi CPU backend is harness-skipped on Linux — CPU-scoped rhi tests can't run locally there](../learnings/1788475957247-slang-rhi-cpu-backend-is-harness-skipped-on-linux-.md)).

**Internal-symbol unit tests go in `slang-static-unit-test`.** To call an internal
(non-`SLANG_API`) `source/slang` entry point (`readSerializedModuleSerializationVersion`,
IR/AST builders), do NOT conclude "need a new SLANG_API shim + maintainer sign-off."
`slang-unit-test` is a shared library that reaches only *exported* symbols (the trap);
`slang-static-unit-test` links the compiler statically and exists specifically to call
non-exported entry points at link time — no ABI change, no sign-off (precedent:
`unit-test-ir-dce.cpp`). It also gives the typed fossil accessor, dissolving the
"brittle byte-poke" objection
([slang-static-unit-test is the module for testing non-exported source/slang symbols](../learnings/1788679074455-slang-static-unit-test-is-the-module-for-testing-n.md)).
Caveat: that target landed on master relatively recently, so a PR branch forked
before it (or far behind master) will NOT have it — confirm at the PR ref
(`gh api .../contents/tools/slang-static-unit-test?ref=<pr-head>`), not master or a
convenient local checkout at a different commit. Any claim about what's *present* (a
target, file, helper) must be checked at the exact reviewed ref
([verify recommended test-infra exists on the PR branch, not just master/your local checkout](../learnings/1788679995187-verify-recommended-test-infra-exists-on-the-pr-bra.md)).

**Source learnings (13):**

- [Slang HAS opt-in default-off warnings (WarningLevel + -W<name>) — wiki "disable-only" is stale](../learnings/1788789285754-slang-has-opt-in-default-off-warnings-warninglevel.md) — full opt-in ladder; use `pedantic` for off-by-default; a sign-change warning needs its own `_coerce` branch.
- [Slang lossy int→float warning: diagnostic-test annotation mechanics + unsigned-literal & warning-group pitfalls](../learnings/1788797863864-slang-lossy-int-float-warning-diagnostic-test-anno.md) — -Wextra ON / -Wall+-Wpedantic OFF; lossy int→float is an independent `if` in _coerce (cost 400); don't raise conversion cost.
- [Slang DIAGNOSTIC_TEST diag=CHECK is exhaustive; short+span records; no CHECK-NOT](../learnings/1788800130239-slang-diagnostic-test-diag-check-is-exhaustive-sho.md) — exhaustive substring matching; assert absence by leaving unannotated; use `warning[E30082]` bracket form.
- [E30082 float-literal exemption is scalar-only (asymmetry with vector/matrix constructors)](../learnings/1788801482957-e30082-float-literal-exemption-is-scalar-only-asym.md) — a float4(...) of literals still warns; pin the branch; the `< kConversionCost_Explicit` gate is correct-but-non-local.
- [IntegerLiteralExpr folds unary ops (un-truncated); folder is un-wrapped](../learnings/1788812664549-integerliteralexpr-folds-unary-ops-un-truncated-fo.md) — reduce a folded literal to source width, peel ParenExpr, use magnitude; gate representability to bare literals (folder doesn't wrap per-op).
- [Width-based int→float diagnostics: getMaximumTypeBitSize returns 64 for IntPtr/UIntPtr](../learnings/1788814344464-width-based-int-float-diagnostics-getmaximumtypebi.md) — a pointer-suffixed literal false-positives at width 64; per-branch handling, not a blanket exclude.
- [getMaximumTypeBitSize returns 64 for IntPtr/UIntPtr — the MAX, not the target width](../learnings/1788817928259-getmaximumtypebitsize-returns-64-for-intptr-uintpt.md) — literal source: warn only if lossy at both 32 and 64; non-constant: use the 32-bit minimum.
- [slang-test: -warnings-disable works on SIMPLE but NOT COMPARE_COMPUTE — forward via -xslang -Wno-N](../learnings/1788460645612-slang-test-warnings-disable-works-on-simple-but-no.md) — render/compute directive args go through the harness; forward compiler flags with -xslang.
- [FileCheck: assert "X never appears" robustly with a CHECK-DAG/CHECK-NOT/CHECK-DAG barrier](../learnings/1788754022134-filecheck-assert-x-never-appears-robustly-with-a-c.md) — a bare CHECK-NOT only guards a bounded region; bracket the target section and run the revert drill on negatives; -g2 self-match discriminator.
- [LANG_SERVER completion tests: COMPLETE coords, output format, "exactly one of kind K" FileCheck](../learnings/1788395364245-lang-server-completion-tests-complete-coords-outpu.md) — 1-based coords, in-process server, three-directive uniqueness idiom; collectMembers already dedups.
- [slang-rhi CPU backend is harness-skipped on Linux — CPU-scoped rhi tests can't run locally there](../learnings/1788475957247-slang-rhi-cpu-backend-is-harness-skipped-on-linux-.md) — a harness SKIP counts as "passed"; isolate the .cpu variant; scope regression tests to CPU not ALL.
- [slang-static-unit-test is the module for testing non-exported source/slang symbols](../learnings/1788679074455-slang-static-unit-test-is-the-module-for-testing-n.md) — static-linking executable reaches internal entry points; no ABI change or sign-off; typed fossil accessor.
- [Verify recommended test-infra exists on the PR branch, not just master/your local checkout](../learnings/1788679995187-verify-recommended-test-infra-exists-on-the-pr-bra.md) — a target present on master may 404 on a behind-master PR head; check presence at the exact reviewed ref.
