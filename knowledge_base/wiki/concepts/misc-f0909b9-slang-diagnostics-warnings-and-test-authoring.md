---
title: "Slang diagnostics: the warning mechanism, lossy int→float warnings, and test/FileCheck authoring"
type: concept
group: misc
tags: [slang, warnings, warning-level, pedantic, diagnostic-test, filecheck, int-to-float, getMaximumTypeBitSize, slang-test, unit-test, lang-server]
source_count: 22
---

## TL;DR

**Slang's warning mechanism (wiki "disable-only" is STALE).** Slang has a full
opt-in / default-off warning ladder: `WarningLevel{Default, All, Extra, Pedantic}`;
`Default` + `Extra` are ON, `All` and `Pedantic` are OFF by default. CLI `-W<name>`
force-enables per-warning, `-Wno-<id>` disables, `-Wall`/`-Wextra`/`-Wpedantic` are
group toggles. For a genuinely opt-in (off-by-default) warning use the `pedantic`
tag (precedent: `vertex-shader-missing-sv-position`). Diagnostics are Lua-driven
(`slang-diagnostics.lua`); pick a FREE code. Any warning that fires inside the core
module aborts `slang-bootstrap` (`addBuiltinSource` treats any sink output as fatal), so
prototype a new or widened warning against the core module first.

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
assert absence). A `//CHECK-NOT:` line is an inert comment that still satisfies the
`docs/generated` lint, so a no-diagnostic pin needs a nearby one-token control that still
warns. Each rich diagnostic emits TWO
records. Match by bare code (`30133`) or message substring, never the rendered
`error[E…]:` header. Matching is a literal substring of ONE field (no `{{.*}}`; code and message are
never concatenated), and an unlocated `E99997` (location `0:0`) cannot be caret-anchored. Rich diagnostics take a code line plus a message line; legacy lexer diagnostics (E10002/E10003) take exactly one (`^ error E10003`). For real FileCheck (SPIR-V), a bare `CHECK-NOT` only guards a
bounded region — use a `CHECK-DAG`/`CHECK-NOT`/`CHECK-DAG` barrier (it guards only the gap
between groups) or a separate `-NOT`-only run, and run the revert drill on negatives.

**Harness/build facts.** `-warnings-disable` works on SIMPLE but not
COMPARE_COMPUTE (forward via `-xslang -Wno-<code>`); slang-test puts directive options after the file, so `-lang glsl` needs SIMPLE_EX with an explicit path, and `.glsl`/`.hlsl` under `tests/` are gitignored; slang-rhi's CPU backend is
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

**A new or widened warning that fires inside the core module breaks the build.**
`Session::addBuiltinSource` (`slang-global-session.cpp:~1248`) calls
`SLANG_UNEXPECTED("Compiling the core module should not yield any warnings")` when the sink
has any output, so `slang-bootstrap` aborts with an InternalError on the first hit in
`core.meta`/`hlsl.meta`/`diff.meta`. Prototype a widened diagnostic against the core module
before anything else. To count every hit in one bootstrap run (measurement only), comment out
that `SLANG_UNEXPECTED` in a throwaway worktree. Example: making E30515
(generic-param-shadows-outer) also cover value params (`isGenericParam`) hits exactly one
core-module site, `core.meta.slang:2242`, where `__generic<$(ptrTypeParameterList)>`
redeclares `Access access` inside `extension<Access access> Ptr<void, access>`
([core-module bootstrap aborts on any warning](../learnings/1792436239104-core-module-bootstrap-aborts-on-any-warning-worktr.md)).

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

**The int→half case (#12979) needs round-trip exactness, not a range.** Same diagnostic (E30081
`UnrecommendedImplicitConversion`), different target: for an int/uint literal → `half`, the decision
lives in `SemanticsVisitor::isIntValueInRangeOfType`'s `Half` arm (`slang-check-decl.cpp:12114`),
gated by the same E30081 `_coerce` path (`slang-check-conversion.cpp:2861-2881`). The flawed check
suppresses the warning only for the *contiguous* run `[-2048, 2048]` — but `half` has 11 significant
bits, so exactly-representable integers above 2048 are **non-contiguous** (even numbers to 4096,
multiples of 4 to 8192, … up to the max finite `half` **65504**), and no `[lo,hi]` range can express
"4096 ok / 4097 not." The correct test is an exact round-trip reusing `source/core/slang-math.h`'s
`FloatToHalf`/`HalfToFloat`: `(double)HalfToFloat(FloatToHalf((float)value)) == (double)value` —
compare in floating point, since casting an inf/nan half back to int64 is UB (the idiom already exists
at `slang-ir.cpp:2566`); extract a named `isIntExactlyRepresentableInHalf`. A non-obvious routing
fact makes this the *only* path: `getMaximumTypeBitSize()` returns **0** for `BaseType::Half`
(the `default:` arm), so the separate `IntegerConstantOverflow` branch (guarded by `maxBitSize > 0`)
is SKIPPED — **every** int→half literal, including overflowing ones like `131072`, is diagnosed via
E30081, not the overflow diagnostic (don't assume large half literals hit `IntegerConstantOverflow`).
This is diagnostic-only / non-breaking; do **not** touch `ConversionCost` buckets (it perturbs overload
resolution). A shared "exactly representable in float type T" predicate would serve the whole
cluster — #12929 (int→float / int64→double), #12930 (float vec/mat → double vec/mat), #12979
(int→half). For the `diag=CHECK` test, the caret width equals the source token length *including* a
`u` suffix (`65505u` → 6 carets)
([int→half E30081: use round-trip exactness, not a fixed `[-2048,2048]` range](../learnings/1788945215723-slang-int-half-e30081-warning-use-round-trip-exact.md),
[int→half E30081 routes through `_coerce` because `getMaximumTypeBitSize`=0 for half](../learnings/1788947867563-half-int-literal-conversion-warning-e30081-getmaxi.md)).

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
([DIAGNOSTIC_TEST diag=CHECK is exhaustive; short+span records; no CHECK-NOT](../learnings/1789718875570-slang-diag-check-diagnostic-test-is-exhaustive-and.md),
[diagnostic severity is per-definition; diag=CHECK is exhaustive](../learnings/1788902941686-slang-diagnostic-severity-is-per-definition-diag-c.md)).

**Pinning "no diagnostic here" needs a live control.** The annotation parser reads only
`//CHECK:` and `/*CHECK:` lines (`tools/slang-test/diagnostic-annotation-util.cpp:83-89`), so
`//CHECK-NOT: W30051` is a plain comment, including the ones in
`tests/diagnostics/aliased-out-inout-parameter.slang`. It still satisfies the
`docs/generated/tests` lint, because `_meta/regenerate.py` (~2620-2700) only needs a
`CHECK[^:]*:…\b[EWNI]\d+\b` match; lint rejects only a DIAGNOSTIC_TEST with no code and no
caret CHECK. A file with zero annotations passes slang-test whenever the compiler emits
nothing, so it stays green even if the warning is deleted outright. The robust pin has two
parts. Leave the negative call unannotated, so exhaustive mode fails on any diagnostic there.
Add a control call that differs by one token, still warns, and carries caret CHECKs copied
from "Suggested annotations"; it proves the warning still exists. Adding `non-exhaustive` to
such a file fails with "Unnecessary 'non-exhaustive'", so the pin cannot be switched off
silently. In-tree precedent: `aliased-out-inout-parameter.slang:117-119`; PR #13887 used the
pattern for the in+out alias fixture after #13406
([CHECK-NOT is inert; exhaustive mode + one-token control](../learnings/1792744742040-diagnostic-test-check-not-is-inert-assert-no-warni.md),
[CHECK-NOT is inert but passes lint; a no-diagnostic pin needs a live control](../learnings/1792745836053-diagnostic-test-check-not-is-inert-but-passes-lint.md)).

Assert `warning[E30082]` (bracket form), never `warning 30082` (vacuous); a
comment-line echo of a bare code can self-match, so prefer message-text carets.
Boundary tests must use an ODD value (`16777217`) — powers of two strip to one
significant bit and never exercise the `significantBits <= mantissaBits` compare
([IntegerLiteralExpr folds unary ops](../learnings/1788812664549-integerliteralexpr-folds-unary-ops-un-truncated-fo.md)).

Four refinements from #12875. **Diag-mode matching is a literal substring against
ONE field** (message, severity, code, or severity+code): FileCheck `{{.*}}` is not
interpreted and code and message are never concatenated, so
`CHECK: E99997{{.*}}non-simple operand` fails while `CHECK: E99997` passes. A located
error's two records (an `error` row with code + title, a `span` row with the message)
both need an annotation at the same caret (`//CHECK: ^ E41202` and
`//CHECK: ^ <message substring>`), or the run fails "Found 1 diagnostic(s) without
annotations". **`E99997` (an internal `SLANG_UNEXPECTED` abort) is unlocated** — its
machine-readable location is `0:0`, so no caret can pin where it lands; if a maintainer
wants the location tested, the compiler must first emit a real located diagnostic, which
is a scope question to ask before building it. **Prove the anchor is load-bearing:**
move the caret one column, then move the annotation to another line (both must fail),
and do a compiler revert drill (`false &&` the new branch). The same PR showed that a
user `bit_cast<Word>(Empty{})` never reaches `lowerBitCast`'s located E41202, because
empty-type legalization removes `Empty` first, so `NotEqualBitCastSize` is reported from
`legalizeBitCast`; `sourceLoc.isValid()` is not evidence that a cast was user-authored
(lower-to-ir and inlining give compiler casts locations too), so the provenance argument
has to come from enumerating the `BitCast` producers
([DIAGNOSTIC_TEST: annotate every record; unlocated internal errors cannot be caret-anchored](../learnings/1791296982463-slang-diagnostic-test-annotate-every-record-unloca.md)).

**How many annotations a diagnostic takes depends on how many records it emits.** A rich
diagnostic (E41407, E15501) emits a code row and a message row, so a lone `//CHECK: ^ E41407`
still leaves "Found N diagnostic(s) without annotations"; add `//CHECK: ^ <message substring>`
at the same column, or mark the directive `non-exhaustive`. Lexer diagnostics
(`slang-lexer-diagnostic-defs.h`: 10002 octal, 10003 invalid digit) print in the legacy format
(`error 10003: invalid digit…`) with no separate span row, so each matches exactly ONE
annotation, and a second line at the same caret fails "(already matched)". Pin the code with a
single `//CHECK: ^ error E10003`, which matches through `severity errorCode` with the `E` prefix
even though the output prints `10003`; a control edit to `E10004` fails, so the code really is
checked. The octal warning 10002 on a token like `07_9` spans the whole token (`^^^^`). This is
the opposite of checker-legacy diagnostics such as E30047, whose span row has different text
and needs a second line (on [[wiki/concepts/slang-b-test-harness.md]]), so copy the runner's
suggested annotations rather than a rule. A related producer bug: a CAS-style op whose two
order operands are reported at the same `sourceLoc` can emit two identical diagnostics (both
`(MemoryOrder)7`); dedupe when both fail the same way and pin it with a test row
[exhaustive DIAGNOSTIC_TEST: annotate code AND message](../learnings/1791550646372-slang-exhaustive-diagnostic-test-annotate-code-and.md)
[legacy lexer diagnostics: one annotation per diag](../learnings/1791572293591-slang-legacy-lexer-diagnostics-one-annotation-per-.md).

**Choosing the source language in a DIAGNOSTIC_TEST.** slang-test appends directive options AFTER the file path, and `-lang` applies only to files that follow it, so `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK):-lang glsl ...` still parses the file as Slang and never sees a GLSL interface block. Adding `#version 450` to the `.slang` file does switch the language, but it adds two diagnostics ("source-language directive selects glsl and overrides the file-extension-implied slang source language"), which breaks an exhaustive test. What works is `//DIAGNOSTIC_TEST:SIMPLE_EX(diag=CHECK): -lang glsl tests/<path>/<file>.slang -target spirv -stage vertex -entry main`, with no `#version` line (precedent: `tests/glsl-intrinsic/compute-derivative/*.slang`). Keep the file `.slang`: `.gitignore` ignores `/tests/**/*.glsl` and `*.hlsl` as generated outputs, so a `.glsl` test passes locally and silently stays out of `git status` unless force-added. An HLSL-only option such as `-Gec` works as `-lang hlsl -Gec` in a plain SIMPLE directive, because no `#version`-style directive is involved [GLSL diagnostic tests: -lang glsl must precede the file (use SIMPLE_EX)](../learnings/1792703656968-slang-test-glsl-diagnostic-tests-lang-glsl-must-pr.md).

For **real FileCheck** (e.g. SPIR-V absence assertions), a bare `CHECK-NOT` only
guards a bounded region — if the forbidden text appears in the MIDDLE of output, a
leading/trailing `CHECK-NOT` silently misses it and the test passes vacuously. The
robust idiom is a `CHECK-DAG`(early anchors) / `CHECK-NOT` / `CHECK-DAG`(late
anchors) barrier bracketing the target section. That barrier guards only the gap *between* the two DAG
groups: a `-NOT` beside a DAG group never sees text interleaved among that group's
matches, so a whole-output absence needs its own `-NOT`-only run
([FileCheck CHECK-NOT regions](slang-test-filecheck-authoring-and-opt-levels.md)). Prove the negative has teeth (revert
drill: temporarily assert absence of something that DOES exist, confirm it fails).
The same gap rule applies to plain `CHECK` sequences: a `-NOT` covers only the span between
its neighbouring positive matches, so interleave one between every pair of positive lines,
add a `-NOT`-only row that scans the whole output, and drill each by emitting the forbidden
string inside the gap it is meant to guard ([community-PR dedup + FileCheck `-NOT` gaps, #13650](../learnings/1792079739619-search-for-a-community-pr-on-the-issue-before-open.md)). And
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

**Source learnings (22):**

- [slang-test GLSL diagnostic tests: -lang glsl must precede the file (use SIMPLE_EX); .glsl/.hlsl under tests/ are gitignored](../learnings/1792703656968-slang-test-glsl-diagnostic-tests-lang-glsl-must-pr.md) — `#version 450` adds two diagnostics; precedent tests/glsl-intrinsic/compute-derivative
- [Slang HAS opt-in default-off warnings (WarningLevel + -W<name>) — wiki "disable-only" is stale](../learnings/1788789285754-slang-has-opt-in-default-off-warnings-warninglevel.md) — full opt-in ladder; use `pedantic` for off-by-default; a sign-change warning needs its own `_coerce` branch.
- [Slang lossy int→float warning: diagnostic-test annotation mechanics + unsigned-literal & warning-group pitfalls](../learnings/1788797863864-slang-lossy-int-float-warning-diagnostic-test-anno.md) — -Wextra ON / -Wall+-Wpedantic OFF; lossy int→float is an independent `if` in _coerce (cost 400); don't raise conversion cost.
- [Slang diag=CHECK DIAGNOSTIC_TEST is exhaustive](../learnings/1789718875570-slang-diag-check-diagnostic-test-is-exhaustive-and.md) — exhaustive substring matching; assert absence by leaving unannotated; use `warning[E30082]` bracket form.
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
- [int→half E30081 warning: use round-trip exactness, not a fixed [-2048,2048] range](../learnings/1788945215723-slang-int-half-e30081-warning-use-round-trip-exact.md) — half's exactly-representable integers above 2048 are non-contiguous (…65504); test via `HalfToFloat(FloatToHalf(v))==v`; diagnostic-only, don't touch ConversionCost; shared predicate serves #12929/#12930/#12979.
- [half int-literal E30081 routes through `_coerce`, not overflow — `getMaximumTypeBitSize`=0 for half](../learnings/1788947867563-half-int-literal-conversion-warning-e30081-getmaxi.md) — the `maxBitSize>0`-guarded IntegerConstantOverflow branch is skipped for half, so every int→half literal (incl. 131072) is diagnosed via E30081; `diag=CHECK` caret width counts the `u` suffix.
- [DIAGNOSTIC_TEST: annotate every record; unlocated internal errors cannot be caret-anchored](../learnings/1791296982463-slang-diagnostic-test-annotate-every-record-unloca.md) — #12875: E99997 is `0:0`; error+span rows both need carets; literal single-field substring (no `{{.*}}`); caret-move + revert drills; `sourceLoc.isValid()` ≠ user-authored
- [Slang exhaustive DIAGNOSTIC_TEST: annotate code AND message per diagnostic](../learnings/1791550646372-slang-exhaustive-diagnostic-test-annotate-code-and.md) — rich diagnostics need a code line plus a message line at one caret; dedupe CAS two-operand duplicates.
- [Slang legacy lexer diagnostics: one annotation per diag; pin code as `^ error E10003`](../learnings/1791572293591-slang-legacy-lexer-diagnostics-one-annotation-per-.md) — no span row, a second annotation fails "(already matched)"; `E` prefix matches output `10003`.
- [Search for a community PR before opening a bot fix PR; FileCheck `-NOT` covers only its gap](../learnings/1792079739619-search-for-a-community-pr-on-the-issue-before-open.md) — interleave a `-NOT` between every positive line, add a whole-output `-NOT`-only row, drill each gap
- [Core-module bootstrap aborts on any warning; worktree submodule init needs protocol.file.allow](../learnings/1792436239104-core-module-bootstrap-aborts-on-any-warning-worktr.md) — `addBuiltinSource` SLANG_UNEXPECTED on any sink output; prototype widened warnings against the core module; E30515 value-param hit at core.meta.slang:2242
- [DIAGNOSTIC_TEST: //CHECK-NOT is inert but passes lint; a no-diagnostic pin needs exhaustive mode plus a live control](../learnings/1792745836053-diagnostic-test-check-not-is-inert-but-passes-lint.md) — lint regex accepts `//CHECK-NOT: W30051`; one-token control with caret CHECKs; `non-exhaustive` fails "Unnecessary" (#13887)
