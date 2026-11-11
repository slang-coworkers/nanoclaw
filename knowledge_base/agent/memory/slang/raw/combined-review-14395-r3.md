---
type: source
description: "slang-reviewer R3 combined review of PR #14395 at 5447ca14b (stage 1 of #14375), 2026-11-10 04:42Z: REQUEST_CHANGES (small), 0 bugs / 8 gaps / 3 questions (inout input/output model mismatch, ownership invariant under extern/export, undocumented breakage, AST marker duplicates Module::getGlobalVaryings()). Verbatim memo; distilled into slang/14334-hull-domain-patch-location-mismatch.md."
okf_synth: exempt
---
# Combined PR Review — shader-slang/slang#14395 (pr, R3)

## Reviewer A — Correctness (nv-slang-bot)

**Verdict**: 🔴 Has issues — 0 bugs, 8 gaps, 3 questions

The PR makes each `EntryPoint` own every module-scope `in`/`out`/`inout` variable of its module. `validateEntryPoint` checks those variables like parameters, and new front-end rules restrict the idiom (E30626/W30627/E31401/E30629/W30628/E38208/W38044/E38049). The main problems:
- **Model mismatch**: the checker treats module-scope `inout` as input+output, but lowering and layout treat it as output-only.
- **Ownership invariant**: the "can name only its own module's varyings" claim doesn't hold under `extern`/`export` linking.
- **Undocumented breakage**: the user guide misses several breaking effects (multi-file `slangc` modules, mixed-stage modules, HLSL rejection).
- **Duplicate source of truth**: a new AST marker duplicates `Module::getGlobalVaryings()`.
- **Tests**: E38049 tests omit the case that must stay silent.

<details>
<summary>Changes Overview</summary>

**Ownership model** (`slang-entry-point.h`, `slang-entry-point.cpp`, `slang-module.h`, `slang-check-shader.cpp` `_collectShaderParams`, `slang-check.h`)
- What changed: `Module::_collectShaderParams` now records non-core module-scope varyings in `Module::m_globalVaryings`, using the new `isGlobalVaryingVar` predicate. `EntryPoint::create` copies that list into `EntryPoint::m_globalVaryings`, so every entry point owns all varyings of its module whether or not it uses them.

**Declaration-level rules** (`slang-check-decl.cpp`, `slang-ast-modifier.h`, `slang-diagnostics.lua`)
- What changed: `checkAndMarkGlobalVaryingVarDecl` adds rules for module-scope varyings:
  - E30626: rejected in HLSL and Slang 2025+.
  - W30627: warned in legacy Slang.
  - E31401: rejected inside namespaces.
  - E30629: rejected with non-`SV_` semantics.

  It also tags the `ModuleDecl` with `HasLegacyGlobalVaryingsModifier`. `checkModule` warns about two or more `[shader]` functions in such a module (W30628), and `visitImportDecl` rejects importing such a module (E38208).

**Entry-point validation** (`slang-check-shader.cpp`)
- What changed: `validateEntryPoint` now also runs the system-value, depth-output, varying-type and SV_Position checks on owned varyings. A module-scope varying error is followed by a note naming the owning entry point. E58001 ("must return void") is now reported at check time. W38044 warns about varying parameters on an entry point that owns varyings. The param/varying direction helpers are factored out (`validateSystemValueSemanticForDirections`, `validateVaryingTypeOfDecl`).

**Composition check** (`slang-parameter-binding.cpp`)
- What changed: `generateParameterBindings` now runs `diagnoseEntryPointsSharingGlobalVaryings`, which reports E38049 when two entry points of one program come from the same module that has varyings. It runs once per target.

**Docs** (`docs/entrypoint-validation.md`, `docs/user-guide/11-language-version.md`)
- What changed: the validation scope now includes owned module-scope varyings. The legacy and 2025 sections describe the new restrictions.

**Tests** (14 new diagnostic tests plus 5 `TEST_IGNORE_FILE` helpers; `gh-5027.slang` and `uninitialized-globals.slang` gain `-warnings-disable`)
- What changed: each new diagnostic ID is covered, including the import path and the precompiled-import path.

</details>

<details>
<summary>Findings (11 total)</summary>

| Severity | Location | Finding |
|----------|----------|---------|
| 🟡 Gap | `source/slang/slang-check-shader.cpp:2029` | Module-scope `inout` is input+output in the checker but output-only in lowering and layout |
| 🟡 Gap | `docs/user-guide/11-language-version.md:42` | Breaking effects not documented: multi-file `slangc` module, mixed-stage modules, HLSL rejection, stale E38050 title |
| 🟡 Gap | `source/slang/slang-entry-point.h:254` | "Can name only its own module's varyings" doesn't hold under `extern`/`export` linking |
| 🟡 Gap | `tests/diagnostics/global-varying-composed-overlap.slang:9` | E38049 untested for different stages and for the different-module negative; weak FIELDS check; inaccurate `-no-codegen` comment |
| 🟡 Gap | `source/slang/slang-check-decl.cpp:5555` | `collectShaderAttributedFuncs` copies `_discoverEntryPointsImpl`'s walk; its namespace/include/generic branches are untested |
| 🟡 Gap | `source/slang/slang-ast-modifier.h:145` | `HasLegacyGlobalVaryingsModifier` duplicates `!Module::getGlobalVaryings().isEmpty()` |
| 🟡 Gap | `source/slang/slang-check-shader.cpp:2421` | Depth-output conflict breaks the stated rule for the ownership note |
| 🟡 Gap | `tests/diagnostics/vertex-missing-sv-position-global.slang:31` | `USE_INDIRECT_GLSL` run doesn't exercise the case the exemption exists for |
| 🔵 Question | `source/slang/slang-entry-point.cpp:39` | Will `EntryPoint::m_globalVaryings` ever diverge from the module's list? If not, forward instead of copying |
| 🔵 Question | `source/slang/slang-check-decl.cpp:590` | E31401: technical restriction or policy? Its justification contradicts the legacy-Slang policy above it |
| 🔵 Question | `source/slang/slang-check-shader.cpp:2773` | W38044 mixes a style rule (parameters) with a lowering rule (result) |

</details>

<sub>reviewed: 5447ca14baca024c1a8be3bfd159b44ffcb7bf48 · diff sha256 6b4c41ab9e9c</sub>

---

### `source/slang/slang-check-shader.cpp:2029`

🟡 **Gap**: The checker treats a module-scope `inout` as input and output, but lowering and layout treat it as output only

`getGlobalVaryingDirections` sets `isInput` for `InOutModifier`. The parser creates only that one modifier for `inout` (`slang-parser.cpp:11154`), and `InOutModifier : public OutModifier` (`slang-ast-modifier.h:388`). So the rest of the pipeline sees an output only:
- **Lowering** (`slang-lower-to-ir.cpp:3237-3244`): `else if (as<OutModifier>(mod)) { builder->addSimpleDecoration<IRGlobalOutputDecoration>(inst); } else if (as<InModifier>(mod)) { ... }`. A module-scope `inout` gets only `IRGlobalOutputDecoration`, so `translateGlobalVaryingVar` never adds it to `inputVars`.
- **Layout** (`slang-parameter-binding.cpp:728-735`): only an `InModifier` gets `getVaryingInputRules()`. Everything else, `inout` included, takes the `getVaryingOutputRules()` branch.

**Example**: `inout float4 gPosition : SV_Position;` with `void main() { gPosition = gPosition * 2; }`, built with `-entry main -stage vertex`.
- Before this PR: it lowered to an output-only position and compiled.
- Now: it fails with E30702 "system value semantic 'SV_Position' cannot be used as input in 'vertex' shader stage", for an input that codegen never creates.
- The input-direction call also adds input-side requirements to `entryPointInferredCaps`.
- `tests/diagnostics/global-varying-inout.slang` locks in this behavior.

**Suggestion**: pick one model for module-scope `inout`:
- fix the producer, so that lowering and layout give it both the input and output decoration/layout; or
- make `getGlobalVaryingDirections` match lowering (output only); or
- reject module-scope `inout` outright, since GLSL has no global `inout`.

Then update the test and this function's comment ("an `inout` variable both, as for an `inout` parameter").

---

### `docs/user-guide/11-language-version.md:42`

🟡 **Gap**: The user guide doesn't say what "module" means for `slangc`, or that mixed-stage modules now fail even one entry point at a time

The bullet ends with "a program cannot contain two entry points from that module", which suggests that compiling one entry point at a time still works. Several breaking effects of keying ownership on the module are not documented:

1. **Multi-file `slangc` runs.** `slangc` groups every `.slang` input into one translation unit (`slang-options.cpp:1751`: "All of the input .slang files will be grouped into a single logical translation unit").
   - Example: `vs.slang` declares `out float4 gPos : SV_Position;`, and the command is `slangc vs.slang fs.slang -entry vsMain -stage vertex -entry fsMain -stage fragment`.
   - `fsMain` now owns `gPos` and gets E30702/E58001 plus E38049. Before the PR this compiled.
2. **Mixed-stage modules.** Take a module with `out float4 gPos : SV_Position;` (used by the VS) and `out float4 gColor : SV_Target;` (used by the FS).
   - `-entry vs` alone also fails, because `vs` owns `gColor` and the owned-varying system-value check rejects it.
   - An HLSL-style fragment entry point that returns a value gets E58001.
   - The PR body lists this as a risk; the guide does not.
3. **HLSL rejection.** HLSL source is rejected in every version (`case SourceLanguage::HLSL: ... GlobalVaryingNotSupported{.language = "HLSL", ...}`). This bullet says "accepted with a deprecation warning", and the 2025 bullet doesn't mention HLSL.

Also:
- The rules described as applying "in every language version, including GLSL source" appear only under the legacy section, so readers of the 2025 or GLSL sections won't find them.
- E38050's title, "type cannot be used as entry-point varying parameter or return type" (`slang-diagnostics.lua:4978`, `docs/entrypoint-validation.md:120`), is now also emitted for module-scope varyings.

**Suggestion**:
- Move the ownership rules into a version-independent paragraph. State three things there:
  - "module" includes all `.slang` inputs of one `slangc` invocation;
  - a module whose varyings carry stage-specific semantics can only hold entry points of one stage;
  - HLSL rejects module-scope varyings (E30626).
- Update the E38050 title and doc row.
- Add a `SIMPLE_EX` test over two `.slang` inputs to lock in whichever multi-file behavior is intended.

---

### `source/slang/slang-entry-point.h:254`

🟡 **Gap**: The claim that an entry point can only name its own module's varyings doesn't hold under `extern`/`export` linking

The argument that "checking the owned list is therefore conservative" rests on the `import` ban in `visitImportDecl`. Two things break it:
- Link-time `extern`/`export` resolution needs no `import`. For example, `tests/serialization/extern/extern-test.slang` links `module-a.slang-lib` through `-r`.
- `translateGlobalVaryingVar` gives an entry point every linked global it reaches, whatever module declares it (`slang-ir-translate-global-varying-var.cpp:41-57`).

**Example**:
- `a.slang`: `out float4 gColor : SV_Target; export void writeColor() { gColor = 1; }`, built with `-o a.slang-lib`.
- `main.slang`: `extern void writeColor(); [shader("vertex")] float4 vs() : SV_Position { writeColor(); return 0; }`, built with `-r a.slang-lib`.

The result:
- `vs` owns nothing, so none of the new front-end checks run.
- After linking, `gColor` (an `SV_Target`) is an output of `vs`, and only the IR-level E58001 catches part of the problem.
- Two entry points from different modules that both reach `gColor` also escape E38049.

**Suggestion**: either narrow the claim ("complete for code reached without `extern` linkage"), or close the gap, for example by rejecting `export` declarations in a module that declares module-scope varyings, next to the import ban.

---

### `tests/diagnostics/global-varying-composed-overlap.slang:9`

🟡 **Gap**: E38049 is only tested with two vertex shaders from one module; the case that must stay silent is untested

`diagnoseEntryPointsSharingGlobalVaryings` groups entry points by `entryPoint->getModule()`. The COMPOSED and TWO_TARGETS runs only cover two vertex entry points in one module, found by discovery. Not covered:
- **Different stages, one module.** Entry points of two stages selected with explicit `-entry vs -stage vertex -entry fs -stage fragment`, which is the common GLSL-style multi-stage file. The FS run in `global-varying-several-entry-points.slang` stops at checker errors (`slang-compile-request.cpp:842`) before the layout step where E38049 is reported, so it never reaches this check.
- **Different modules (negative case).** A VS and an FS from different modules must produce no E38049. An example is two `-lang glsl` translation units, one with `layout(location=0) out vec4 v;` and one with `in vec4 v;`. If the grouping key were wrong, the standard GLSL VS+FS workflow would break with no failing test.

Related test-quality points:
- **`global-varying-user-semantic.slang:34`.** `//FIELDS: OpEntryPoint Vertex` doesn't show that the field semantics were honored. Adding `//FIELDS-DAG: OpDecorate %{{.*}} Location 0` and `Location 1` would.
- **`global-varying-entry-point-checks.slang:4`.** The comment says "`-no-codegen` stops compilation before IR", which is inaccurate. `executeActionsInner` always runs `generateIR()` and layout (`slang-compile-request.cpp:871-882`). The diagnostics come from the checker because checker errors return at :842.

**Suggestion**: add a different-stage E38049 run with explicit `-entry` flags and a two-module run that expects no diagnostics, then fix the two points above.

---

### `source/slang/slang-check-decl.cpp:5555`

🟡 **Gap**: `collectShaderAttributedFuncs` copies entry-point discovery's container walk, and only its top-level path is tested

This walk unwraps `GenericDecl` and recurses into `NamespaceDeclBase`, `FileDecl` and `StructDecl`, the same walk as `Module::_discoverEntryPointsImpl` (`slang-module.cpp:351-357`: `as<NamespaceDeclBase>(globalDecl) || as<FileDecl>(globalDecl) || as<StructDecl>(globalDecl)`). W30628 is only meaningful if it sees the same functions that discovery turns into entry points; if discovery gains a container kind, this copy silently drifts.

Every W30628 test uses top-level, non-generic `[shader]` functions, so the namespace, `__include`, struct and generic branches are never exercised. The documented negative case is also untested: one `[shader]` function plus a function with only `[numthreads]` should not warn.

**Suggestion**: share one traversal helper with `_discoverEntryPointsImpl`, or at least cross-reference the two. Add one run with a `[shader]` function inside a namespace or an `__include`d file that expects W30628, and one run with `[shader]` plus a `[numthreads]`-only function that expects no W30628.

---

### `source/slang/slang-ast-modifier.h:145`

🟡 **Gap**: `HasLegacyGlobalVaryingsModifier` is a second source of truth for `!Module::getGlobalVaryings().isEmpty()`

The comment gives three reasons for the marker; two of them don't need it.
- **Import check (`visitImportDecl`).** `importedModule` is already available there, and every path that returns one has already run `_collectShaderParams`:
  - source modules: `checkTranslationUnit` calls it right after `checkModule` (`slang-check.cpp:200-202`);
  - precompiled modules: `loadSerializedModuleContents` calls it on load (`slang-session.cpp:2642`).

  So `!importedModule->getGlobalVaryings().isEmpty()` answers the import question for both, and serializing the marker adds nothing.
- **W30628 (`checkModule`).** This is the only consumer that runs before the list exists, and that ordering is self-imposed. `diagnoseShaderFunctionsSharingGlobalVaryings` could run after `_collectShaderParams` in `checkTranslationUnit`.

As written, the two forms agree only because `checkAndMarkGlobalVaryingVarDecl` and `_collectShaderParams` happen to use the same predicate, while CLAUDE.md asks for one representation per value. The name also needs a paragraph to explain that "Legacy" does not mean the legacy language version.

**Suggestion**: drop the modifier, have `visitImportDecl` read `importedModule->getGlobalVaryings()`, and emit W30628 after `_collectShaderParams`. If the marker has to stay, name the one consumer that needs it and drop the import and serialization reasons.

---

### `source/slang/slang-check-shader.cpp:2421`

🟡 **Gap**: The depth-output conflict is an exception to the stated rule for the ownership note, and the stated reason doesn't explain it

The comment says the ownership note follows "the errors whose message does not name the entry point". E30705 ("…'SV_DepthGreaterEqual' conflicts with the earlier 'SV_Depth'") does not name the entry point, so by that rule it should get the note. The reason given for skipping it, that it "is reported at a semantic rather than at a declaration", doesn't follow: the note's span sits on the varying, not on the error.

**Example**: a module declares `out float gDepth : SV_Depth;` and `out float gDepthGE : SV_DepthGreaterEqual;`, and a fragment shader writes only `gDepth`. The user gets a depth conflict about a variable their shader never touches, and nothing says the entry point owns it. That is exactly the situation the note exists for.

**Suggestion**: if the real reason is that `collectDepthOutputSemantics` loses which declaration contributed each semantic, say so in the comment. Otherwise, keep track of the contributing declaration and emit `GlobalVaryingOwnedByEntryPoint` when it is a module-scope varying.

---

### `tests/diagnostics/vertex-missing-sv-position-global.slang:31`

🟡 **Gap**: The `USE_INDIRECT_GLSL` run doesn't test the case the indirect-`glsl` exemption exists for

With a plain `import`, this module can't name `gl_Position` itself; its entry point can only write it through a function in the helper module. That is presumably why `doesModuleDependOnGLSLModule` counts indirect dependence (`slang-check-shader.cpp:2867-2870`, used at `:2917`).

But `helperColor()` never writes `gl_Position`. This run therefore expects the pedantic warning to be suppressed for a vertex shader that really has no position, which locks in a missed warning rather than the case the exemption is for.

**Suggestion**: have the helper write `gl_Position` (e.g. `void setPosition() { gl_Position = float4(0, 0, 0, 1); }`) and call it from `main`. Mention the callee case in the comment at `slang-check-shader.cpp:2867`.

---

### `source/slang/slang-entry-point.cpp:39`

🔵 **Question**: Will `EntryPoint::m_globalVaryings` ever differ from the module's list, for example in a later stage of #14375?

`EntryPoint::getGlobalVaryings` is documented as "every module-scope varying declared in the module of its function". That is exactly `getModule()->getGlobalVaryings()`, which `EntryPoint::getModule()` already gives access to.

The copy adds two things:
- **An unenforced ordering precondition.** The comment states it, but nothing checks it. An entry point created before `_collectShaderParams` runs silently owns nothing, and every new check passes without checking anything.
- **An unchecked dereference.** This line dereferences `Slang::getModule(...)` unconditionally, while the surrounding validation code treats the module as optional (`SharedSemanticsContext::createForOptionalModule`).

Decision needed:
- If a later stage will make an entry point's list differ from its module's (for example, a list based on what the entry point reaches), say so in the doc comment.
- If not, replace the field with a forwarding accessor (`getModule() ? getModule()->getGlobalVaryings() : <empty list>`). That removes both the duplicate data and the precondition.

---

### `source/slang/slang-check-decl.cpp:590`

🔵 **Question**: Is E31401 a technical restriction or only policy? Its justification contradicts the sentence just above it

Only legacy Slang behaves differently because of E31401:
- HLSL and Slang 2025+ already reject every module-scope varying (E30626).
- GLSL has no namespaces.

Legacy Slang is exactly where, per the previous sentence, the idiom is kept with a deprecation warning. So "rejecting it does not affect the code that the idiom is kept for" doesn't hold. Concretely:
- A legacy-Slang varying inside a namespace was accepted before this PR, because the base `_collectShaderParams` already reaches namespaces through `isGlobalDecl` (`return as<NamespaceDeclBase>(parentDecl) != nullptr || ...`). It is now a hard error rather than W30627.
- In HLSL and Slang 2025+, the same declaration gets both E31401 and E30626.

Decision needed:
- If a namespaced varying can't be owned and checked like a top-level one, state the technical reason and add a test that fails without the rule.
- If it is only policy, say plainly that it is a new error for legacy Slang. Consider making it a warning there, and skipping it where E30626 already fires.

---

### `source/slang/slang-check-shader.cpp:2773`

🔵 **Question**: Which rule does W38044 enforce: a style rule, or a lowering requirement?

The comment applies a style rule to parameters ("a varying parameter mixes two ways of declaring them") but a lowering rule to the result ("a result is restricted only where lowering requires it"). Neither side is consistent with the other:
- Lowering handles varying parameters too: `translateGlobalVaryingVar` adds the existing entry-point parameter layouts into the struct it builds for the module-scope inputs (`slang-ir-translate-global-varying-var.cpp:80-118`).
- A non-void result on an entry point that owns only module-scope inputs mixes the two styles just as a varying parameter does.

A reader can't tell why `float4 color : COLOR` as a parameter warns but `float4 main() : SV_Target` as a result does not.

Decision needed:
- If W38044 is a style warning, the result of an entry point that owns only inputs should warn too.
- If it is a lowering restriction, parameters that lowering already handles should not warn.

Either way, please state one rule that covers both parameters and the result.

## Reviewer B — Devin Review

# Devin Review

## AI Analysis

Module-scope in/out variables now belong to every entry point of their module. The checker validates them like entry-point parameters, and misuse produces new diagnostics.

Records module-scope varyings on the module and copies them into each entry point.
Runs system-value, depth, varying-type and SV_Position checks over owned varyings.
Rejects varyings in HLSL and Slang 2025, warns in legacy Slang, and rejects module imports.
Errors when a composed program holds two entry points from one varying-declaring module.
Show less

Summary: Stage 1 of #14375 (checker plus composed-program check), per maintainer comments 6697604956, 6753868655 and 6754813607. Each EntryPoint owns every module-scope in/out of its module, with no call-graph walk, and validateEntryPoint checks them like parameters. New: E30626, W30627, W30628, E30629, E31401, W38044, E38208, E38049.

Root cause: validateEntryPoint (slang-check-shader.cpp:2285 at base) built its input/output list from function parameters only.

Tests: 14 new or rewritten diagnostic tests. Debug suite: 11925/11928 (the 3 known fp8 CUDA INVALID_PTX failures).

Risk: New errors for global varyings in HLSL/Slang 2025+ or with user semantics, for importing any module that has them (GLSL dialect too), and for E58001/E30702 on a module's other-stage entry points.

Part of #14375. Related: #14335, #13892.

🤖 Generated by an automated Slang coworker — may be inaccurate. A human maintainer should verify.

Show less

Loading diffs…

This may take a few moments for large PRs

Info
Chat

## Vulnerabilities

(none reported)

## Bugs

(none reported)

## Flags

(none reported)

## Informational

(none reported)

## Reviewer C — Clarity

# PR 14395 Clarity Workflow Candidates

## PR Summary

**Title:** Check module-scope varyings against the entry points of their module (head `5447ca14`, +1141/−108, 31 files).

**What the description says:** Stage 1 of #14375. Each `EntryPoint` owns every module-scope `in`/`out` of its module, with no call-graph walk, and `validateEntryPoint` checks them like parameters. The description lists eight new diagnostics (E30626, W30627, W30628, E30629, E31401, W38044, E38208, E38049), 14 new or rewritten tests, and a risk note about new errors.

**What the diff does:**

1. Adds an ownership model. `Module::getGlobalVaryings()` holds the module's non-builtin `in`/`out`/`inout` globals, which `_collectShaderParams` fills. `EntryPoint::create` copies that list into each entry point, and `HasLegacyGlobalVaryingsModifier` on the `ModuleDecl` mirrors it during checking and serialization.
2. Extends `validateEntryPoint` so the system-value, depth-output, varying-type, SV_Position and must-return-void (E58001, previously IR-only) checks also run over owned varyings. It adds a "belongs to entry point" note and the W38044 mixing warning, and refactors the per-direction helpers.
3. Adds language policy in `checkAndMarkGlobalVaryingVarDecl`: GLSL accepts module-scope varyings, legacy Slang deprecates them, and HLSL and Slang 2025+ reject them. In every language they must be at the top level of the module and may not have a user semantic.
4. Adds composition rules: importing a module that has varyings is an error (`visitImportDecl`), several `[shader]` functions in such a module get a warning (`checkModule`), and two entry points from such a module in one program are an error (`generateParameterBindings`, reported once per target).
5. Updates the user guide and `entrypoint-validation.md`, and adds many focused diagnostic tests.

**Mismatches and value:** The title and description present the change as "check varyings like parameters". The diff also introduces user-visible policy that is close to breaking: import bans, a one-entry-point-per-program limit, language-version rejection, and new warnings that existing GLSL-mode tests had to disable. The risk note acknowledges this only briefly, and the description doesn't follow the repository's five-part format (motivation, solution, change summary, vocabulary, process report). The value is real: diagnosing GLSL-style I/O at the front end with a declaration-based ownership model that needs no call-graph walk is a sound direction, and the tests are thorough.

## Review Body

> Claude Opus 5.5-authored clarity review:
>
> This is a substantial PR (about 1.1k added lines across the checker, entry-point and module types, parameter binding, diagnostics, docs, and 20 test files). It introduces a new concept, entry-point ownership of module-scope varyings, together with eight diagnostics that enforce it. The implementation is careful and the tests are unusually thorough and well-commented, so it doesn't feel rough. Where it falls short is in making the model checkable: the soundness argument is spread across many sites, and several places keep the same fact in sync by comment rather than by construction. I'd call it close to merge-ready once the points below are addressed or explained.
>
> ## Main Concerns
>
> - **One source of truth.** "This module declares module-scope varyings" is stored both as `HasLegacyGlobalVaryingsModifier` and as `Module::m_globalVaryings`, and each entry point holds a third copy. The selection predicate is written out at two sites. The stated reason for the marker (serialization) doesn't seem to hold, because `_collectShaderParams` runs again on binary load.
> - **Which checks apply to owned varyings.** "Checked like parameters" is implemented as a second loop added to four checks, and the comment that lists which checks apply leaves out several others in `validateEntryPoint` (compute dispatch-ID type, non-varying-stage rules, generic-struct capabilities). Please state the rule.
> - **Where program-level validation lives.** E38049 is a target-independent property of the composed program, but it runs in per-target layout and is reported once per target, and a test now pins that duplication.
> - **Diagnostic policy consistency.** The rule for attaching the ownership note is stated inside one check's comment, its exemption for the depth-output conflict doesn't match the rule as stated, and the note is triggered by an error-count delta.
> - **Terminology and docs.** Code says "global varying", messages say "module-scope varying", and E58001 says "global output variables". The user guide puts the version-independent rules (import ban, one entry point per program) under the `legacy` bullet.
>
> Smaller items: the SV_Position comment's rationale conflicts with the behavior its test pins, the W38044 exemption claim about builtin parameter types needs checking, and a few test headers would benefit from saying which rule each run pins. Separately, given how user-visible the new restrictions are, the PR description would help reviewers more if it followed the repository's five-part format and walked through the design choices (ownership by declaration, the import ban, the composition check placement).

## Kept

### C001: No stated rule for which entry-point checks apply to module-scope varyings

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: invariant
- Location: `source/slang/slang-check-shader.cpp:2400-2407`
- GitHub link: https://github.com/shader-slang/slang/pull/14395/files
- Overlap decision: Keep
- Overlap rationale: The only candidate about the applicability rule across `validateEntryPoint`; the per-loop candidates address different local issues.
- Scope decision: Direct
- Scope rationale: The comment and the parallel loops it describes are added by this PR and embody its central claim.

Context:

```cpp
    // The module-scope varyings that the entry point owns are inputs and outputs of the entry point
    // just as its parameters are. The system-value, depth-output, varying-type and SV_Position
    // checks below cover them along with the parameters. Checks that concern only parameters
    // (passing modes, uniform classification, generic type requirements) do not apply.
    const auto& globalVaryings = entryPoint->getGlobalVaryings();
    List<EntryPointVaryingDirections> globalVaryingDirections;
    for (auto globalVarying : globalVaryings)
        globalVaryingDirections.add(getGlobalVaryingDirections(globalVarying));
```

Proposed comment:

> The PR's model is that owned module-scope varyings are "inputs and outputs of the entry point just as its parameters are", but this comment lists both sets of checks by example rather than by a rule, so I can't tell whether the rest of `validateEntryPoint` was considered. Some checks here look at entry-point I/O but are neither listed nor applied to module-scope varyings: the compute `SV_DispatchThreadID` type check (`isValidThreadDispatchIDType`), the stage-specific geometry/mesh output checks, the non-varying-stage rule that requires a system-value semantic, and the generic-struct capability collection over signature types. "Generic type requirements" is even listed as parameter-only, though a module-scope `in Foo<int> g;` is now part of the signature in the same way.
>
> Can you state the rule that decides whether a check applies (for example "everything that inspects a varying's type or semantic applies; everything that inspects passing mode or uniformity does not") and make sure every check in the function falls on the right side? Each of the four affected checks now loops over params and then repeats the loop for `globalVaryings`. If the rule were built into the representation, such as one list of `(decl, directions)` entry-point varyings, "checked like parameters" would hold by construction rather than by remembering to add a second loop.

Notes:
The PR's central claim ("validateEntryPoint checks them like parameters") is upheld by four separate parallel loops. The comment's list of checks that apply / don't apply leaves out several checks in the same function. The test `entry-point-param-with-global-varyings-stages.slang` COMPUTE run shows a module-scope `in` in a compute shader drawing no varying-stage diagnostic other than W38044.

### C002: Marker modifier and module list are two synchronized representations of one fact

- Status: Revise
- Confidence: Medium
- Scope: Direct
- Category: invariant
- Location: `source/slang/slang-ast-modifier.h:145-150`
- GitHub link: https://github.com/shader-slang/slang/pull/14395/files
- Overlap decision: Keep
- Overlap rationale: Absorbs the duplicated-predicate candidate; the per-entry-point copy is now handled by a separate candidate at its own site.
- Scope decision: Direct
- Scope rationale: The modifier, the module list, and both predicate sites are introduced by this PR.

Context:

```cpp
// `checkAndMarkGlobalVaryingVarDecl` adds the marker while declarations are checked, so that
// `checkModule` can read it before `Module::_collectShaderParams` builds the list of the
// module's varyings (`Module::getGlobalVaryings`). Both select declarations with the same test,
// so the marker and a non-empty list describe the same modules. `visitImportDecl` reads the
// marker to reject an import of such a module; being part of the AST, the marker is serialized
// with a precompiled module.
```

```cpp
        // slang-check-decl.cpp, SemanticsDeclModifiersVisitor::visitVarDecl
        if (isGlobalVaryingVar(decl) && !isFromCoreModule(decl))
            checkAndMarkGlobalVaryingVarDecl(decl);

                // slang-check-shader.cpp, Module::_collectShaderParams
                if (isGlobalVarying && !isFromCoreModule(globalVar))
                    m_globalVaryings.add(globalVar);
```

Proposed comment:

> The fact "this module declares module-scope varyings" is stored twice, as `HasLegacyGlobalVaryingsModifier` on the `ModuleDecl` and as a non-empty `Module::m_globalVaryings`. A comment is what keeps them consistent ("Both select declarations with the same test"), and the test itself, `isGlobalVaryingVar(x) && !isFromCoreModule(x)`, is copied into both `SemanticsDeclModifiersVisitor::visitVarDecl` and `Module::_collectShaderParams`. If one copy later changes, the two representations diverge without any error.
>
> The stated justification also doesn't fully cover the marker. `_collectShaderParams` runs after checking a source module and again when a binary module is loaded (just before `_discoverEntryPoints` in `slang-session.cpp`), so `visitImportDecl` could get the same answer from `importedModule->getGlobalVaryings()` without relying on the marker being serialized. The only consumer that seems to need the marker is the `checkModule`-time W30628 check. Could you either reduce this to one source of truth, or explain why both are needed and keep them from diverging structurally, for example with one named predicate for "a module-scope varying an entry point can own" used at both sites?

Notes:
CLAUDE.md "One canonical representation per value". Verified at base: `module->_collectShaderParams(sink)` in the binary-module load path of `slang-session.cpp`, and `_collectShaderParams` after `checkModule` in `slang-check.cpp`. Revised during consolidation to absorb FG004 and to hand the per-entry-point copy to FG010.

### C003: Program-composition legality check hosted in per-target layout, with duplicated diagnostics pinned by a test

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: organization
- Location: `source/slang/slang-parameter-binding.cpp:4496-4499`
- GitHub link: https://github.com/shader-slang/slang/pull/14395/files
- Overlap decision: Keep
- Overlap rationale: The only candidate about where the composition check runs; the test duplication is folded in here rather than raised separately.
- Scope decision: Direct
- Scope rationale: The call, its comment, and the `TWO_TARGETS` test are all added by this PR.

Context:

```cpp
    // Laying out a program is the one step that code generation, `-no-codegen` checking and
    // reflection all take once the program's entry points are fixed, so the check runs here. It
    // runs once per target, so a compile for several targets reports it once for each.
    diagnoseEntryPointsSharingGlobalVaryings(program, sink);
```

```slang
//DIAGNOSTIC_TEST:SIMPLE(diag=TWO_TARGETS):-target spirv-asm -target glsl -warnings-disable 30627
/*TWO_TARGETS:
     ^^^^^^^^ two entry points of a program come from a module with module-scope varyings
     ...
     ^^^^^^^^ two entry points of a program come from a module with module-scope varyings
```

Proposed comment:

> "Two entry points of one program come from a module with module-scope varyings" is a property of the composed program and doesn't depend on the target, yet the check sits in `generateParameterBindings` and reports the same error once per target. The new `TWO_TARGETS` run in `global-varying-composed-overlap.slang` then makes the duplication expected behavior. The comment explains why layout is a convenient hook, but not why there is no target-independent point where a program's entry-point set is fixed (composite creation or linking) where the check could run once. If layout really is the only reliable hook, please say why the other candidates don't work. Also consider whether the duplicated error should be pinned by a test, since that makes it harder to deduplicate later.

Notes:
The code comment and test treat the per-target duplication as intended, so this is an explainability/organization ask rather than a bug claim.

### C004: Note-attachment policy is stated inside one check's comment and does not match the depth-output case

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: comments
- Location: `source/slang/slang-check-shader.cpp:2418-2422`
- GitHub link: https://github.com/shader-slang/slang/pull/14395/files
- Overlap decision: Keep
- Overlap rationale: Concerns where the policy is stated and whether it is consistent; the error-count trigger candidate concerns the mechanism and stays separate.
- Scope decision: Direct
- Scope rationale: The policy, the note, and its exemptions are introduced by this PR.

Context:

```cpp
    // An error about a module-scope varying is followed by a note that names the entry point that
    // owns it, because the entry point may not use the varying at all. The note follows the errors
    // whose message does not name the entry point: this error and the system-value errors below.
    // The varying-type errors name the entry point in their message, and the depth-output conflict
    // is reported at a semantic rather than at a declaration, so neither has the note.
```

Proposed comment:

> This paragraph defines a policy for the whole function (which module-scope-varying errors get the "belongs to entry point" note), but it sits inside the comment for the must-return-void check, so a reader of the later checks won't find it. The policy also doesn't match its own exception. The stated rule is that the note follows errors "whose message does not name the entry point", and `MultipleDepthOutputSemantics` ("a fragment entry point can declare at most one depth output, but 'SV_Depth' conflicts with …") doesn't name the entry point either. The reason given for exempting it ("reported at a semantic rather than at a declaration") concerns the location, not the message, and an entry point can get that conflict from a module-scope `out` it never writes, which is exactly the confusing case the note exists for. Can you state the rule once, where it applies to all the checks, and either make the depth-output case follow it or explain why it is a principled exception?

Notes:
See `global-varying-multiple-depth-semantics.slang` MIXED run, where the conflict is reported at `gDepth`'s semantic.

### C005: Two names for one concept ("global varying" vs "module-scope varying")

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: terminology
- Location: `source/slang/slang-check-decl.cpp:1677-1679`
- GitHub link: https://github.com/shader-slang/slang/pull/14395/files
- Overlap decision: Keep
- Overlap rationale: The modifier-naming candidate concerns the "Legacy" qualifier, not the global/module-scope split.
- Scope decision: Direct
- Scope rationale: The PR introduces the new term, its identifiers, and the new diagnostics, and newly emits E58001 from the front end.

Context:

```cpp
/// GLSL-style shaders read their inputs and write their outputs through such variables instead of
/// through entry-point parameters. Identifiers in the code call them "global varyings"; comments
/// and diagnostic messages call them "module-scope varyings".
bool isGlobalVaryingVar(VarDeclBase* decl)
```

Proposed comment:

> This comment documents that the PR uses two terms for one concept: identifiers say "global varying" (`isGlobalVaryingVar`, `getGlobalVaryings`, `HasLegacyGlobalVaryingsModifier`, `GlobalVaryingOwnedByEntryPoint`), while comments and the new diagnostics say "module-scope varying". The existing E58001, which the front end now emits for these declarations, says "global output variables". A reader therefore has to remember a mapping, and the user sees two terms in one compile (E58001 next to the new "belongs to entry point" note). Is there a reason the code and the messages can't use the same term? If the split is deliberate (for example "global" for consistency with `translateGlobalVaryingVar`), please say why it is worth the cost, and consider aligning the E58001 message now that the front end reports it for module-scope varyings.

Notes:
The doc comment acknowledging the split is evidence of the smell. E58001 is pre-existing, but this PR newly emits it from `validateEntryPoint` (slang-check-shader.cpp:2429) next to the new note.

### C006: User guide puts version-independent rules under the legacy language version

- Status: Keep
- Confidence: High
- Scope: Direct
- Category: organization
- Location: `docs/user-guide/11-language-version.md:37-43`
- GitHub link: https://github.com/shader-slang/slang/pull/14395/files
- Overlap decision: Keep
- Overlap rationale: The only documentation-placement candidate.
- Scope decision: Direct
- Scope rationale: The bullet is added by this PR.

Context:

```md
- Module-scope `in`/`out`/`inout` variables (GLSL-style global varyings) are accepted with a deprecation
  warning. They are intended for the GLSL dialect only; declare entry-point inputs and outputs as
  parameters instead. In every language version, including GLSL source, each entry point owns all of
  the module-scope varyings of its module and is checked against them like parameters. Such a
  variable must be at the top level of its module and cannot have a user semantic, a module that
  declares them cannot be imported, and a program cannot contain two entry points from that module.
```

Proposed comment:

> This bullet is in the list of `legacy` behaviors, but most of it describes rules that "in every language version, including GLSL source" apply: the ownership model, the top-level restriction, the user-semantic ban, the import ban, and the one-entry-point-per-program restriction. A reader of the 2025 section, or a GLSL user who never reads about `legacy`, won't find them, and a reader of the legacy section may think they are legacy-only. GLSL source doesn't have a Slang language version, so "in every language version, including GLSL source" also mixes two axes. Can you separate the per-version policy (legacy warns, 2025+ rejects, GLSL accepts) from the version-independent rules, which probably belong in a section on entry-point inputs/outputs or GLSL compatibility, linked from both version bullets?

Notes:
The import ban and the one-entry-point restriction are the most user-visible behavior changes in the PR, and they are documented only here.

### C007: Ownership soundness argument is re-derived at each enforcement site

- Status: Revise
- Confidence: Low
- Scope: Direct
- Category: comments
- Location: `source/slang/slang-entry-point.h:241-258`
- GitHub link: https://github.com/shader-slang/slang/pull/14395/files
- Overlap decision: Keep
- Overlap rationale: The representation candidate is about stored state; this one is about where the prose argument lives.
- Scope decision: Direct
- Scope rationale: All of the restating comments are added by this PR.
- Judgment decision: Revise
- Judgment rationale: The concern is credible: six sites restate parts of one argument, and this API doc comment carries an implementation proof. The comment was shortened so it reads as a consolidation request rather than a rewrite demand.

Context:

```cpp
    /// The IR pass `translateGlobalVaryingVar` gives an entry point the module-scope varyings that
    /// it reaches. Apart from the builtins of the `glsl` module, such as `gl_Position`, which no
    /// entry point owns, each of those is one that the entry point owns: a module that declares
    /// module-scope varyings cannot be imported (`visitImportDecl`), so an entry point can name
    /// only the varyings of its own module. Checking the owned list is therefore conservative. A
    /// program also cannot contain two entry points of one such module
    /// (`diagnoseEntryPointsSharingGlobalVaryings`), so each varying has at most one owner in a
    /// program.
    List<VarDeclBase*> const& getGlobalVaryings() { return m_globalVaryings; }
```

Proposed comment:

> This is the clearest statement of why ownership-by-declaration is sound. It depends on three enforcement points: the import ban, the composition ban, and the core/`glsl` exclusion. Each of those sites (`HasLegacyGlobalVaryingsModifier`, `visitImportDecl`, `diagnoseShaderFunctionsSharingGlobalVaryings`, `diagnoseEntryPointsSharingGlobalVaryings`, `Module::getGlobalVaryings`) restates part of the argument in its own words. Could the model and its invariants be stated once, here or in a short design note, with the other sites pointing back to it? Then a reader can check the argument in one place and see which site enforces which part, and the accessor's doc comment can stay focused on the contract callers rely on.

Notes:
Low confidence; content is correct, concern is dispersion and documentation-vs-implementation comment balance.

### C008: SV_Position comment's rationale conflicts with the behavior its test pins, and the `glsl`-import test is an unnamed proxy

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: correctness smell
- Location: `source/slang/slang-check-shader.cpp:2860-2870`
- GitHub link: https://github.com/shader-slang/slang/pull/14395/files
- Overlap decision: Keep
- Overlap rationale: The test-comment candidate for the same test file asks for per-branch explanations, a different problem.
- Scope decision: Direct
- Scope rationale: The comment rewrite and the new module-scope SV_Position logic are added by this PR.

Context:

```cpp
    // We deliberately skip the check when the entry point has no outputs
    // at all: a void return type, no `out`/`inout` parameters, and no
    // module-scope outputs. An output parameter or a result counts as an
    // output in every module, because an entry point that declares outputs
    // in its signature is expected to declare SV_Position there as well.
    // A module-scope output can supply SV_Position too, but it counts as
    // an output only when the module does not import the `glsl` module
    // (directly or through other imports). ...
```

```cpp
            if (hasGlobalOutputs && !doesModuleDependOnGLSLModule(module))
                hasOutputs = true;
```

Proposed comment:

> The comment says signature outputs count "because an entry point that declares outputs in its signature is expected to declare SV_Position there as well", but the code accepts `SV_Position` from a module-scope output when the signature has outputs, and the `PARAM_OUTPUT` run of `vertex-missing-sv-position-global.slang` (`out vec4 position : SV_Position;` with `void main(out vec4 color : COLOR)`) pins that behavior. Which is the intended rule?
>
> Separately, `doesModuleDependOnGLSLModule(module)` stands in for "this entry point may write `gl_Position`, which is not in its owned list". Neither the condition nor a name says that, so a reader has to reconstruct it from the comment's last sentence. A named predicate for the property being approximated, plus a statement of when the approximation is wrong (for example, a module that imports `glsl` but never writes `gl_Position`), would make the case analysis checkable.

Notes:
Verified against the test: PARAM_OUTPUT expects `OFF`.

### FG001: Error-count delta as the trigger for the ownership note

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: control flow
- Location: `source/slang/slang-check-shader.cpp:2474-2488`
- GitHub link: https://github.com/shader-slang/slang/pull/14395/files
- Overlap decision: Keep
- Overlap rationale: Distinct from the policy-placement candidate; this concerns the mechanism that decides when the note is emitted.
- Scope decision: Direct
- Scope rationale: The loop and its error-count trigger are added by this PR.

Context:

```cpp
            for (Index i = 0; i < globalVaryings.getCount(); ++i)
            {
                const auto errorCountBefore = sink->getErrorCount();
                validateSystemValueSemanticForDirections(
                    &visitor,
                    sink,
                    globalVaryings[i],
                    globalVaryingDirections[i],
                    stage,
                    scope,
                    &entryPointInferredCaps);
                if (sink->getErrorCount() != errorCountBefore)
                {
                    sink->diagnose(Diagnostics::GlobalVaryingOwnedByEntryPoint{
```

Proposed comment:

> The note is attached whenever the sink's error count changed during `validateSystemValueSemanticForDirections`, which is a proxy for "a system-value error about this varying was reported". It isn't obvious that the proxy is exact. `validateSystemValueSemantic` can report several errors for one varying (one per struct field, or once per direction for an `inout`) followed by a single note. It can also report errors that aren't about the semantic's stage at all, such as `MaximumTypeNestingLevelExceeded`. And whether a warning promoted to an error changes the count isn't obvious from here. Can you state what the note is meant to follow and why the error-count delta captures exactly that, or restructure so the note is tied to the specific diagnostics it explains?

Notes:
Implicit coupling to `DiagnosticSink` error counting.

### FG002: W38044 comment mixes the rule, its exemptions, and an unrelated result discussion; the exemption claim is not obviously true

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: comments
- Location: `source/slang/slang-check-shader.cpp:2768-2784`
- GitHub link: https://github.com/shader-slang/slang/pull/14395/files
- Overlap decision: Keep
- Overlap rationale: No other candidate covers the W38044 block.
- Scope decision: Direct
- Scope rationale: The warning, its exemptions, and the comment are added by this PR.

Context:

```cpp
    // ... Uniform parameters are
    // allowed, including resources, which the auto-uniform classification above has already made
    // uniform, and so are builtin parameter types such as `TriangleStream<T>`, which have no
    // module-scope equivalent. The warning restricts the parameter list only. A result is
    // restricted only where lowering requires it: the "must return void" check above rejects a
    // result when the entry point owns module-scope outputs, which lowering turns into the result.
    // When the entry point owns only module-scope inputs, its result lowers as an ordinary output.
    if (globalVaryings.getCount() != 0)
    {
        for (auto param : entryPointFuncDecl->getParameters())
        {
            if (param->hasModifier<HLSLUniformModifier>())
                continue;
            if (isBuiltinParameterType(param->getType()))
                continue;
```

Proposed comment:

> I can't verify the exemption from this comment alone. `isBuiltinParameterType` accepts every non-scalar/vector/matrix `BuiltinType`, which includes mesh outputs (`OutputVertices`/`OutputIndices`) and patch types, not just stream outputs. GLSL mesh and tessellation shaders do declare those as module-scope `out`/`in` arrays, so "have no module-scope equivalent" isn't obviously true for the whole set. Can you state the rule that defines the exempt set and check that `isBuiltinParameterType` matches it? The last four sentences are about results and the must-return-void check rather than this warning. They read as a justification of why results aren't warned about, so a short "results are covered by the must-return-void check above" may be all that's needed here.

Notes:
`MeshOutputType` and `HLSLStreamOutputType` both derive from `BuiltinGenericType`, and `HLSLPatchType` from `BuiltinType`, so all pass `isBuiltinParameterType`.

### FG003: The "top level" test relies on `ModuleDecl` not being a `NamespaceDecl`

- Status: Keep
- Confidence: Low
- Scope: Direct
- Category: control flow
- Location: `source/slang/slang-check-decl.cpp:600-601`
- GitHub link: https://github.com/shader-slang/slang/pull/14395/files
- Overlap decision: Keep
- Overlap rationale: The namespace-policy candidate concerns why the restriction exists, not how "top level" is tested.
- Scope decision: Direct
- Scope rationale: The check is added by this PR.

Context:

```cpp
        if (as<NamespaceDecl>(getParentDecl(decl)))
            getSink()->diagnose(Diagnostics::GlobalVaryingNotAtTopLevel{.decl = decl});
```

Proposed comment:

> `isGlobalVaryingVar` accepts a parent that is any `NamespaceDeclBase` or `FileDecl`. This test treats "top level" as "parent is not a `NamespaceDecl`", which is correct only because `ModuleDecl` derives from `NamespaceDeclBase` and not from `NamespaceDecl`. The PR defines "top level" in prose ("directly in the module or in an `__include`d file") but not in code. A positively phrased check, parent is the `ModuleDecl` or a `FileDecl`, would match that definition directly and not depend on a reader knowing the AST class hierarchy.

Notes:
Low confidence; the current code is correct.

### FG005: `HasLegacyGlobalVaryingsModifier` needs a paragraph explaining what "Legacy" does not mean

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: naming
- Location: `source/slang/slang-ast-modifier.h:140-152`
- GitHub link: https://github.com/shader-slang/slang/pull/14395/files
- Overlap decision: Keep
- Overlap rationale: The terminology candidate concerns "global" vs "module-scope"; this concerns the misleading "Legacy" qualifier.
- Scope decision: Direct
- Scope rationale: The modifier is introduced by this PR.

Context:

```cpp
// Marks a module that declares GLSL-style module-scope varyings (see `isGlobalVaryingVar`). The
// builtin core and `glsl` modules never carry it. "Legacy" names the GLSL-style idiom, which Slang
// deprecates, not the legacy language version: a module in any source language, GLSL included,
// gets the marker.
FIDDLE()
class HasLegacyGlobalVaryingsModifier : public Modifier
```

Proposed comment:

> The doc comment has to explain that "Legacy" in the name doesn't refer to the `legacy` language version, and that the marker is set on GLSL modules too, which aren't legacy in any sense. When a name needs a disclaimer, the name is pulling against established vocabulary, and this PR touches `legacy` language-version behavior directly. Can the name say only what the marker records, that the module declares module-scope varyings, without the "Legacy" qualifier?

Notes:
If the marker is eliminated per the representation candidate, this becomes moot.

### FG006: `collectShaderAttributedFuncs` duplicates the entry-point discovery traversal without referencing it

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: API shape
- Location: `source/slang/slang-check-decl.cpp:5552-5574`
- GitHub link: https://github.com/shader-slang/slang/pull/14395/files
- Overlap decision: Keep
- Overlap rationale: No other candidate covers this helper.
- Scope decision: Direct
- Scope rationale: The helper is added by this PR.

Context:

```cpp
/// Appends to `outFuncs` every function in `containerDecl` that has a `[shader(...)]` attribute,
/// including functions in namespaces, `__include`d files and non-generic structs, in declaration
/// order.
static void collectShaderAttributedFuncs(ContainerDecl* containerDecl, List<FuncDecl*>& outFuncs)
{
    for (auto memberDecl : containerDecl->getDirectMemberDecls())
    {
        auto innerDecl = memberDecl;
        if (auto genericDecl = as<GenericDecl>(innerDecl))
            innerDecl = genericDecl->inner;
        ...
        else if (
            as<NamespaceDeclBase>(memberDecl) || as<FileDecl>(memberDecl) ||
            as<StructDecl>(memberDecl))
```

Proposed comment:

> This walk has the same shape as `Module::_discoverEntryPointsImpl`: unwrap a `GenericDecl`, then recurse into `NamespaceDeclBase`, `FileDecl`, or a (non-generic) `StructDecl`. Presumably that's because the warning should cover the functions that discovery would consider. The doc comment lists "non-generic structs" as a fact without saying where the restriction comes from, and nothing links the two walks. If discovery's traversal changes, this warning drifts. Can you either share the traversal, or state that it mirrors `_discoverEntryPointsImpl` and why it has to?

Notes:
Reuse / single source of truth. Verified the traversal shape in `slang-module.cpp` at base.

### FG010: Per-entry-point copy of the module's list creates an unchecked ordering dependency

- Status: Revise
- Confidence: Medium
- Scope: Direct
- Category: invariant
- Location: `source/slang/slang-entry-point.cpp:35-39`
- GitHub link: https://github.com/shader-slang/slang/pull/14395/files
- Overlap decision: Keep
- Overlap rationale: Now owns the "why copy at all" question that was moved out of the representation candidate.
- Scope decision: Direct
- Scope rationale: The copy and the comment are added by this PR.

Context:

```cpp
    // The entry point copies the list of its module, which `Module::_collectShaderParams` fills
    // before either caller, `Module::_discoverEntryPointsImpl` or `findAndValidateEntryPoint`,
    // creates an entry point. ...
    entryPoint->m_globalVaryings = Slang::getModule(funcDeclRef.getDecl())->getGlobalVaryings();
```

Proposed comment:

> Each `EntryPoint` stores its own copy of its module's list, and only this comment guarantees that the copy is taken after `Module::_collectShaderParams` has filled it. If a future caller creates an entry point earlier, the copy is silently empty, which looks the same as "the module has no varyings", and every new check turns off without an error. Why does the entry point copy the list rather than return its module's `getGlobalVaryings()` when queried (with placeholders, which have no function, returning an empty list)? If the copy is intentional, for example because a later stage will narrow ownership per entry point, please say so. Otherwise, delegating would remove the ordering dependency.

Notes:
Revised during consolidation to take over the per-entry-point-copy question from C002.

### FG011: `_collectShaderParams` comment phrase is hard to parse

- Status: Revise
- Confidence: Low
- Scope: Direct
- Category: comments
- Location: `source/slang/slang-check-shader.cpp:3308-3313`
- GitHub link: https://github.com/shader-slang/slang/pull/14395/files
- Overlap decision: Keep
- Overlap rationale: The predicate-duplication part of this region is covered by the representation candidate; this one concerns only the wording.
- Scope decision: Direct
- Scope rationale: The comment is rewritten by this PR.
- Judgment decision: Revise
- Judgment rationale: Dropped the partial-list concern because `_collectExistentialSpecializationParamsForShaderParam` reports an error before returning, so a truncated list only arises on an already-failed compile; the wording concern stands.

Context:

```cpp
                // We record two kinds of global variable as shader parameters: global shader
                // parameters, and module-scope varyings, which the program-scope layout and
                // reflection list alongside them. Other globals, such as `static` and
                // `groupshared` variables, are skipped. `isGlobalShaderParameter` excludes
                // module-scope varyings, so the two tests do not overlap.
```

Proposed comment:

> "which the program-scope layout and reflection list alongside them" is hard to parse. I think it means module-scope varyings are added to `m_shaderParams` so that layout and reflection see them, even though `isGlobalShaderParameter` says they aren't shader parameters. Could you say that directly? The distinction between the "shader parameter" list and `isGlobalShaderParameter` is exactly what a reader needs here.

Notes:
Low.

### FG012: Front-end E58001 now overlaps the IR pass's check, and nothing points between them

- Status: Keep
- Confidence: Low
- Scope: Contextual
- Category: comments
- Location: `source/slang/slang-check-shader.cpp:2413-2416`
- GitHub link: https://github.com/shader-slang/slang/pull/14395/files
- Overlap decision: Keep
- Overlap rationale: The terminology candidate mentions the E58001 message text; this concerns the split between the two checks.
- Scope decision: Contextual
- Scope rationale: The PR changes the de facto role of the IR-pass check by moving most of its cases to the front end; the comment is anchored on the PR's new comment.

Context:

```cpp
    // A GLSL-style entry point writes its outputs through module-scope varyings and returns `void`.
    // IR lowering repackages those outputs as the entry point's result, so a result of its own has
    // nowhere to go. The IR pass reports the same error for outputs declared by the builtin `glsl`
    // module, which are not in the entry point's list.
```

Proposed comment:

> After this PR, the `EntryPointMustReturnVoidWhenGlobalOutputPresent` check in `translateGlobalVaryingVar` can only fire for `glsl`-module builtins, since owned outputs are now rejected in the front end. This comment says so, but the IR site still reads as the general check. Naming `translateGlobalVaryingVar` here, and adding a short note at the IR site pointing back, would let a maintainer looking at either check find the other.

Notes:
Contextual; `slang-ir-translate-global-varying-var.cpp` is not touched by the PR.

### FG013: W30628 headline is a noun phrase, not a statement of the problem

- Status: Keep
- Confidence: Low
- Scope: Direct
- Category: terminology
- Location: `source/slang/slang-diagnostics.lua:3993`
- GitHub link: https://github.com/shader-slang/slang/pull/14395/files
- Overlap decision: Keep
- Overlap rationale: No other candidate covers diagnostic headline wording.
- Scope decision: Direct
- Scope rationale: The diagnostic is added by this PR.

Context:

```lua
warning(
    "shader-functions-share-global-varyings",
    30628,
    "several '[shader]' functions in a module with module-scope varyings",
```

Proposed comment:

> The other new headlines state what is wrong ("… is not supported", "… must be declared at the top level", "cannot import …"), but this one is a fragment that leaves the user to infer the consequence. Something like "'[shader]' functions in a module with module-scope varyings cannot be entry points of the same program" would state the problem in the headline rather than leaving it to the span text.

Notes:
Low; user-facing wording.

### FG014: GLSL branches of `vertex-missing-sv-position-global.slang` have no explanation

- Status: Keep
- Confidence: Low
- Scope: Direct
- Category: comments
- Location: `tests/diagnostics/vertex-missing-sv-position-global.slang:50-66`
- GitHub link: https://github.com/shader-slang/slang/pull/14395/files
- Overlap decision: Keep
- Overlap rationale: The SV_Position code candidate concerns the rule in the compiler; this concerns test readability.
- Scope decision: Direct
- Scope rationale: New test file in this PR.

Context:

```slang
#elif !defined(PARAM_OUTPUT)
out vec4 color;

void main()
{
    gl_Position = vec4(0, 0, 0, 1);
    color = vec4(1);
}
#else
out vec4 position : SV_Position;

void main(out vec4 color : COLOR)
```

Proposed comment:

> The `USE_IMPORT_GLSL` and `USE_INDIRECT_GLSL` branches each say what they demonstrate, but the two GLSL branches don't, and the `PARAM_OUTPUT` branch is the only one testing the subtle case: a signature output with `SV_Position` supplied by a module-scope output in a module that depends on `glsl`. With six runs selected through nested `#elif`s, a short note per branch saying which rule it pins would make the file reviewable on its own.

Notes:
Low.

### FG015: Why the compute run of the stages test uses `-lang glsl`

- Status: Keep
- Confidence: Low
- Scope: Direct
- Category: comments
- Location: `tests/diagnostics/entry-point-param-with-global-varyings-stages.slang:7`
- GitHub link: https://github.com/shader-slang/slang/pull/14395/files
- Overlap decision: Keep
- Overlap rationale: No other candidate covers this test.
- Scope decision: Direct
- Scope rationale: New test file in this PR.

Context:

```slang
//DIAGNOSTIC_TEST:SIMPLE(diag=GEOMETRY):-target spirv -entry main -stage geometry -no-codegen -warnings-disable 30627
//DIAGNOSTIC_TEST:SIMPLE_EX(diag=COMPUTE):-lang glsl tests/diagnostics/entry-point-param-with-global-varyings-stages.slang -target spirv -entry main -stage compute -no-codegen -DUSE_COMPUTE
```

Proposed comment:

> The geometry run stays in Slang with W30627 disabled, while the compute run switches to `-lang glsl`. The header doesn't say whether GLSL is essential to the compute case (for example, to show that W38044 also fires in GLSL source) or just a way to avoid W30627. If GLSL coverage is the point, please say so in the header, since it is a user-visible consequence (`uninitialized-globals.slang` had to disable W38044 for the same reason).

Notes:
Low.

### FG016: Several-entry-points test doesn't explain why E38049 is absent from the no-`-entry` run

- Status: Keep
- Confidence: Low
- Scope: Direct
- Category: comments
- Location: `tests/diagnostics/global-varying-several-entry-points.slang:8-12`
- GitHub link: https://github.com/shader-slang/slang/pull/14395/files
- Overlap decision: Keep
- Overlap rationale: The composition-placement candidate concerns the compiler code; this concerns a test header's account of what it expects.
- Scope decision: Direct
- Scope rationale: New test file in this PR.

Context:

```slang
// Without `-entry`, every `[shader]` function becomes an entry point, so loading the module
// reports the same errors. The vertex entry point compiles on its own.

//DIAGNOSTIC_TEST:SIMPLE(diag=FS):-target spirv -entry fsMain -stage fragment -no-codegen -warnings-disable 30627,38044
//DIAGNOSTIC_TEST:SIMPLE(diag=FS):-target spirv -no-codegen -warnings-disable 30627,38044
```

Proposed comment:

> In the second run, both `vsMain` and `fsMain` are entry points of one program from a module with module-scope varyings, which is exactly what E38049 rejects, yet the expectations are identical to the single-entry run. Presumably the front-end errors stop compilation before layout, but the header says only "reports the same errors". Because the PR's parameter-binding comment says `-no-codegen` reaches layout, please say why E38049 doesn't appear here.

Notes:
Low.

### FG017: The namespace restriction only changes legacy Slang, which the comment does not say

- Status: Keep
- Confidence: Low
- Scope: Direct
- Category: comments
- Location: `source/slang/slang-check-decl.cpp:587-593`
- GitHub link: https://github.com/shader-slang/slang/pull/14395/files
- Overlap decision: Keep
- Overlap rationale: The top-level-test candidate concerns the code expression; this concerns the policy justification.
- Scope decision: Direct
- Scope rationale: The function and its comment are added by this PR.

Context:

```cpp
    /// Module-scope varyings are a GLSL idiom: Slang and HLSL entry points declare their inputs and
    /// outputs as parameters. We therefore reject them in HLSL and in Slang 2025 and later, and
    /// warn about them in legacy Slang. We also restrict them to the top level of the module, in
    /// every language version. The restriction is a policy that keeps the deprecated idiom to the
    /// form that GLSL code has: GLSL has no namespaces, so a varying inside a namespace can only
    /// come from Slang or HLSL code, which declares parameters instead, and rejecting it does not
    /// affect the code that the idiom is kept for.
```

Proposed comment:

> HLSL and Slang 2025+ already reject every module-scope varying, and GLSL has no namespaces, so the only observable effect of E31401 is that a namespaced varying in legacy Slang becomes an error rather than the W30627 warning. Stating that effect directly would be shorter and would make the policy easier to evaluate than the current argument. Is there a reason beyond policy, such as IR lowering or ownership mishandling namespaced varyings, that makes it an error rather than part of the deprecation warning?

Notes:
Low.

## Dropped

### FG004: The same selection predicate is written out at two sites that must agree

- Status: Drop
- Confidence: Medium
- Scope: Direct
- Category: invariant
- Location: `source/slang/slang-check-shader.cpp:3322-3323`
- Overlap decision: Merged into C002
- Overlap rationale: C002 now carries the duplicated `isGlobalVaryingVar(x) && !isFromCoreModule(x)` predicate and the shared-predicate remedy, so a separate comment would repeat it.
- Scope decision: Direct
- Scope rationale: Preserved for audit; dropped for overlap, not scope.

Proposed comment:

> The marker and `m_globalVaryings` are documented as describing the same modules because "both select declarations with the same test", but that test is copied rather than shared: `isGlobalVaryingVar(x) && !isFromCoreModule(x)` appears here and in `SemanticsDeclModifiersVisitor::visitVarDecl`. A single named predicate for "a module-scope varying that an entry point can own" would keep one source of truth.

### FG007: `diagnoseShaderFunctionsSharingGlobalVaryings` doc repeats itself and states an unasserted precondition

- Status: Drop
- Confidence: Low
- Scope: Direct
- Category: function contract
- Location: `source/slang/slang-check-decl.cpp:5576-5597`
- Overlap decision: Keep
- Overlap rationale: No overlap.
- Scope decision: Direct
- Scope rationale: In scope.
- Judgment decision: Drop
- Judgment rationale: The sole caller checks the marker on the immediately preceding commented line in `checkModule`, and reporting one pair is an obvious reading of the five-line body. The remaining value is too small to spend reviewer attention on.

Proposed comment:

> The contract makes "which declares module-scope varyings" a precondition but doesn't assert it, the two sentences about why `[shader]` is the signal say much the same thing, and it doesn't say that only one warning (second function vs first) is reported.

### FG008: `validateVaryingTypeOfDecl` parameter `kind` is a diagnostic noun phrase, not a kind

- Status: Drop
- Confidence: Low
- Scope: Direct
- Category: naming
- Location: `source/slang/slang-check-shader.cpp:2075-2083`
- Overlap decision: Keep
- Overlap rationale: No overlap.
- Scope decision: Direct
- Scope rationale: In scope.
- Judgment decision: Drop
- Judgment rationale: The helper's doc comment already explains `kind` with concrete examples ("parameter 'color'", "module-scope varying 'gColor'"), so a reader is not left uncertain.

Proposed comment:

> `kind` is the free-form prefix of the diagnostic's context string, not a classification; a name such as `declDescription`, or deriving it from `decl`, would make that clear.

### FG009: `EntryPointVaryingDirections` states an invariant that its default value violates

- Status: Drop
- Confidence: Low
- Scope: Direct
- Category: type contract
- Location: `source/slang/slang-check-shader.cpp:31-38`
- Overlap decision: Keep
- Overlap rationale: No overlap.
- Scope decision: Direct
- Scope rationale: In scope.
- Judgment decision: Drop
- Judgment rationale: Both producers always set a flag (verified in `checkEntryPointParamPassingMode`'s exhaustive switch and in `getGlobalVaryingDirections`), and both consumers assert the invariant. The remaining concern is wording pedantry with little reader benefit.

Proposed comment:

> The type comment says at least one flag is set, but a default-constructed value has neither; consider phrasing it as a postcondition of the producers.

## slang-reviewer verification (local, head 5447ca14b, R3)

**Verdict: REQUEST_CHANGES (small).** There is one regression: E30629 (f48c77027) rejects user semantics on module-scope varyings for every target. Master compiles them correctly for HLSL and Metal. A tested remedy keeps them working where they work today and rejects them where they cannot work (`remedy-14395-r3.patch`). Apply it verbatim, or drop E30629, and correct the statement on #14375 that the maintainer's keep-or-drop question rests on. The other findings are gaps and clarity items.

- **The clarity pass (5447ca14b) changes no behaviour.** I verified this across 142 files and 540 commands: every TEST line of the 91 module-scope-varying tests, the PR's tests and my R1–R3 probes, plus spirv/hlsl/metal whole-module runs. Pre-clarity 4d2a0d6d3 and 5447ca14b match in exit code, diagnostic codes and severities, diagnostic locations, and output bytes. The diagnostic set in `slang-diagnostics.lua` (name, code, severity) is identical apart from the `global-varying-not-at-top-level` rename.

### Maintainer requirements, from [6758025498](https://github.com/shader-slang/slang/issues/14375#issuecomment-6758025498) and [6754813607](https://github.com/shader-slang/slang/issues/14375#issuecomment-6754813607) (tangent-vector), checked live 2026-11-10 04:3xZ

| # | Requirement | Status | Evidence |
|---|---|---|---|
| T1 | W38044 stays a warning, "since it works on top-of-tree and I want to avoid breaking users" | met | unchanged |
| T2 | Respect explicit `layout(location=…)` with two-phase binding per entry point | stage 2 (deferred) | Assigned to stage 2 in 6758120339; no objection so far. |
| T3 | W30628 stays a warning; E38049 stays an error, even where it rejects previously allowed cases | met | unchanged |
| T4 | "User-defined semantics on global varyings should probably be allowed to work just fine … we don't need to fix all of that downstream code in the same pass" | **missed (head) / met (patch)** | E30629 rejects them on every target, including HLSL and Metal, where master emits them correctly. The keep-or-drop question in 6758120339 rests on 6755918550 ("failed in IR with E49999 … on master too"), which holds only for SPIR-V/GLSL, and only when the varying is reached. |
| 6754813607 | Both `-entry fsMain` errors stay. A warning is acceptable only if (1) the code was previously allowed and (2) it needs no new downstream checks. Goal: no front-end error ⇒ no back-end varying error or ICE | met (patch) | The patch keeps the front-end error exactly where the back end fails (SPIR-V/GLSL E49999) or miscompiles (WGSL), and allows what master compiles correctly. |
| T5 | Self-review for clarity before asking for a human review | in progress | This round. |

The fixer's self-check says R4 is partial, pending tangent-vector. **I disagree:** at head, R4 is missed for HLSL/Metal, because the premise given to the maintainer is wrong. The rest matches.

### Tests (local, L40S, Release, `-DSLANG_ENABLE_DXIL=OFF`, own base build at b85caf928)

- Full suite at head: **11705/11708** (3263 ignored). The only failures are the 3 known `fp8-cuda*` tests. CI run 42752570780 is gated.
- Remedy: PR tests 43/43, and full suite **11709/11712**, with the same 3 failures.
- Drill: run with the PR-head build (4d2a0d6d3, which already has E30629), the rewritten `global-varying-user-semantic.slang` fails 5 of its 6 rows. The HLSL and Metal rows show the regression.

### Findings

**B1 🔴 (me; A, B and C missed it): E30629 breaks HLSL and Metal compiles that work on master.**
- Probes in `runs/probe-14395/r3/`. On master b85caf928:

  | Probe | spirv/glsl | hlsl | metal | wgsl |
  |---|---|---|---|---|
  | `in float4 gTex : TEXCOORD0;` read by a fragment shader | E49999 | ✅ `float4 main(float4 gTex_0 : TEXCOORD0)` | ✅ `[[user(TEXCOORD0)]]` | emits `fn main( gTex_0 : vec4<f32>)` with no `@location`; naga rejects it ("Entry point arguments … must all have bindings") |
  | vertex `out float4 gCol : COLOR0` + `in float3 inPos : POSITION` (void) | E49999 | ✅ `COLOR0` / `POSITION` | ✅ | invalid |
  | the same global, unused | ✅ | ✅ | ✅ | ✅ |

- At head, all of these are E30629 on every target.
- The PR's justification ("Lowering to IR treats the semantic … as a system value", in the code comment and the test header) and the issue comment 6755918550 describe only the SPIR-V/GLSL path.
- That conflicts with T4 and T1's "avoid breaking users", and with condition (1) of 6754813607.
- **Remedy (`remedy-14395-r3.patch`, tested):**
  - E30629 moves from `checkAndMarkGlobalVaryingVarDecl` into `validateEntryPoint`, as `diagnoseGlobalVaryingUserSemantic`, next to the owned-varying type check.
  - It fires only when a target is Khronos (SPIR-V/GLSL) or WGPU, and it names the target ("… not supported when targeting spirv").
  - It carries the ownership note, as the other owned-varying errors do. The target-gated `kEntryPointVaryingTypeRules` (`isSPIRV`) are the precedent.
  - Results: HLSL and Metal output is **byte-identical to master** for all three probes. SPIR-V, GLSL and WGSL give E30629, where master gave E49999 or invalid WGSL.
  - One behaviour change remains: an *unused* user-semantic global on SPIR-V/GLSL, which master compiles, is now E30629. That is the module-ownership consequence the maintainer accepted for E30702 in 6754813607.
  - The test gains HLSL, Metal, GLSL and WGSL rows. The docs line is narrowed to "for SPIR-V, GLSL and WGSL targets".
- **Ask:**
  1. Apply the patch verbatim (or drop E30629 entirely).
  2. Correct 6755918550/6758120339 on #14375 with the table above, so tangent-vector decides on accurate facts.

**Gaps from A (non-blocking; the fixer may apply or explain them):**
- **G1 (A):** `EntryPoint::getGlobalVaryings` doc (`slang-entry-point.h:251-258`): the claim "an entry point can name only the varyings of its own module" relies on the import ban. Link-time `extern`/`export` resolution needs no `import` (A's example: `-r a.slang-lib`). Narrow the claim, or ban `export` in modules with varyings. The same comment also says "Apart from the builtins of the `glsl` module": the core module's `in __builtin*` globals are builtins too.
- **G2 (A):** no test of E38049 for two *different-stage* entry points that both pass validation, selected with explicit `-entry` (for example a vs and an fs that both only read `in` globals without SV semantics). The FIELDS check in `global-varying-user-semantic.slang` doesn't show the field semantics were honoured (add Location 0/1). The `-no-codegen` comment in `global-varying-entry-point-checks.slang` is inaccurate: checker errors return before IR.
- **G3 (A, C-C006):** the user guide still omits that several `.slang` files on one `slangc` command form one module (R2 probe `tu-vs`/`tu-fs`). It also puts version-independent rules under the legacy bullet.
- **G4 (A, C-C002):** `HasLegacyGlobalVaryingsModifier` duplicates `!getGlobalVaryings().isEmpty()`. Its comment gives serialization as a reason, but `_collectShaderParams` re-runs on binary load (`slang-session.cpp:2642`). The actual need is W30628 in `checkModule`, before the list exists; say that.
- **G5 (A):** the `USE_INDIRECT_GLSL` run doesn't exercise the case the exemption exists for (see A's section).
- **Declined by the fixer, accepted:** the `inout` direction (IR stage), deriving the list from the module (C002), and the ownership note on E30705 (C007). Each is a behaviour change, and none blocks stage 1. Please record the `inout` mismatch as a stage-3 item in the #14375 plan.

**Side find (relayed through the fixer to slang-triager):**
- On master b85caf928, **any** module-scope varying, even an unused `in float4 g;` beside a compute entry point, makes `-target cuda` and `-target cpp` segfault (rc 139).
- A plain fragment shader with no globals fails cleanly instead (rc 255).
- `-dump-ir` stops after `replaceGlobalConstants` (`slang-emit.cpp:1191`), before the next dumped pass.
- No duplicate found (issue and PR search).
- This is pre-existing; head behaves the same, after W30627. Probe: `runs/probe-14395/r3/cs-glob.slang`.

**Disagreements:** A, B and C did not find B1; they agree on the rest. My view of R4 differs from the fixer's self-check, as explained above.

Patch: `remedy-14395-r3.patch` (applies on 5447ca14b with `git am`). Probes: `runs/probe-14395/r3/`; equivalence corpus: `runs/probe-14395/r3/equiv.py` / `equiv.out`.

## Result (machine-readable)

```json
{"verdict":"REQUEST_CHANGES","bugs":0,"gaps":8,"questions":3,"diff_hash":"6b4c41ab9e9c58b96d116b7847d02b68bc18e9c5854b0130003466b30f091d8f","reviewers_complete":true}
```
