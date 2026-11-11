---
type: source
description: "slang-reviewer R2 combined review of PR #14395 (stage 1 of #14375, module-scope varying ownership checker), 2026-11-10 00:46Z: APPROVE_WITH_NITS, 0 bugs / 6 gaps (user guide overstates legacy/GLSL safety, E38049 once per target, inout treated as input, dead CHECK-NOT, W30628 vs entry-point discovery). Verbatim memo; distilled into slang/14334-hull-domain-patch-location-mismatch.md."
okf_synth: exempt
---
# Combined PR Review — shader-slang/slang#14395 (pr, R2)

## Reviewer A — Correctness (nv-slang-bot)

**Verdict**: 🔴 Has issues — 0 bugs, 6 gaps

This PR makes every `EntryPoint` own all module-scope `in`/`out`/`inout` variables of its module. `validateEntryPoint` then checks those variables like parameters. The PR adds language-version and declaration rules (E30626, W30627, E31401, E38208, W30628) and composition rules (W38044, E38049). Six problems were found:
- The user guide says legacy Slang only warns about these variables and that GLSL is unaffected. Several of the new errors have no language or version check, so both statements are wrong.
- E38049 is reported once per target, from layout generation.
- The checker treats a module-scope `inout` as an input, but IR lowering never makes it one.
- One test assertion (`CHECK-NOT`) can never fail.
- W30628 and entry-point discovery disagree about which functions can become entry points.
- Several new paths have no tests.

There are also 9 clarity comments on the design and the comments.

<details>
<summary>Changes Overview</summary>

**Ownership model** (`slang-module.h`, `slang-entry-point.h`, `slang-entry-point.cpp`, `slang-check.h`, `slang-check-shader.cpp` `_collectShaderParams`)
- What changed: `Module::_collectShaderParams` now records the module's non-core global varyings in `m_globalVaryings`, using the new `isGlobalVaryingVar`. `EntryPoint::create` copies that list into each entry point. The IR (`translateGlobalVaryingVar`) still uses reachability.

**Entry-point validation of owned varyings** (`slang-check-shader.cpp` `validateEntryPoint`)
- What changed: owned varyings now go through the system-value, depth-output, varying-type and vertex `SV_Position` checks.
- New checker-level checks: E58001 (non-void result with owned outputs) and W38044 (varying parameters alongside owned varyings).
- A standalone note names the owning entry point.
- The system-value loop was refactored into `validateSystemValueSemanticForDirections`.

**Declaration and language rules** (`slang-check-decl.cpp`, `slang-ast-modifier.h`, `slang-diagnostics.lua`)
- What changed: `checkAndMarkGlobalVaryingVarDecl` marks the module with `HasLegacyGlobalVaryingsModifier` and applies the language rules:
  - E31401 for a varying inside a namespace;
  - E30626 in HLSL and in Slang 2025+;
  - W30627 in legacy Slang.
- `visitImportDecl` rejects importing a marked module (E38208).
- `checkModule` warns when a marked module has several `[shader]` functions (W30628).

**Program composition** (`slang-parameter-binding.cpp`)
- What changed: `generateParameterBindings` reports E38049 when two entry points of a program come from the same module and that module has global varyings.

**Docs** (`docs/entrypoint-validation.md`, `docs/user-guide/11-language-version.md`)
- What changed: the validation scope now covers owned module-scope varyings. Legacy is documented as a deprecation and 2025 as a rejection.

**Tests** (12 new diagnostic tests and 2 helpers under `tests/diagnostics/`; `tests/bugs/gh-5027.slang` and `tests/diagnostics/uninitialized-globals.slang` updated to disable the new warnings)

</details>

<details>
<summary>Findings (15 total)</summary>

| Severity | Location | Finding |
|----------|----------|---------|
| 🟡 Gap | `docs/user-guide/11-language-version.md:37` | Legacy "accepted with a deprecation warning" and "GLSL source code is unaffected" contradict E31401, E38208, E38049, E58001/E30702 and W38044 |
| 🟡 Gap | `source/slang/slang-parameter-binding.cpp:4494` | E38049 does not depend on the target but is reported once per target, and only at layout time |
| 🟡 Gap | `source/slang/slang-check-shader.cpp:2025` | Module-scope `inout` is checked as an input, but `addVarDecorations` gives it only `IRGlobalOutputDecoration` |
| 🟡 Gap | `tests/diagnostics/global-varying-include.slang:11` | The trailing `CHECK-NOT: E31401` cannot catch an E31401, which would print before E30626 |
| 🟡 Gap | `source/slang/slang-check-decl.cpp:5549` | W30628 ignores `[numthreads]`-only functions, which discovery still makes entry points (then E38049 at layout) |
| 🟡 Gap | `tests/diagnostics/import-module-with-global-varyings.slang:7` | No tests for: precompiled-module E38208, explicit or transitive `import glsl` exemption, `"output"` label, #14375 example without `-entry` |
| 💬 Clarity | `source/slang/slang-entry-point.h:241` | The ownership comment does not say why ownership is declaration-based, or what invariant links it to IR reachability |
| 💬 Clarity | `source/slang/slang-entry-point.cpp:37` | Copying the list per entry point creates an ordering precondition that nothing enforces |
| 💬 Clarity | `source/slang/slang-ast-modifier.h:140` | Two representations of "module has varyings", and the "Legacy" name doesn't match GLSL modules |
| 💬 Clarity | `source/slang/slang-parameter-binding.cpp:4471` | The `!getFuncDecl()` skip covers a case that cannot happen; assert instead |
| 💬 Clarity | `source/slang/slang-check-shader.cpp:2427` | The ownership note is attached to some errors only, and can repeat |
| 💬 Clarity | `source/slang/slang-check-shader.cpp:2725` | The W38044 comment's rule does not explain why a result is exempt |
| 💬 Clarity | `source/slang/slang-check-shader.cpp:2836` | The `SV_Position` exception for modules that import `glsl` applies to global outputs only, but its reasoning applies to all outputs |
| 💬 Clarity | `source/slang/slang-diagnostics.lua:4310` | "Module-scope" means both "top level or namespace" and "top level only" |
| 💬 Clarity | `source/slang/slang-check-decl.cpp:623` | The `Unknown` source-language case names no path that reaches it |

</details>

<sub>reviewed: 2792441f50a6f52cc33a897df3febca13aae2b0e · diff sha256 30f5df4569e6</sub>

---

### `docs/user-guide/11-language-version.md:37`

🟡 **Gap**: The legacy and GLSL bullets say less than the checker now enforces

The legacy bullet says module-scope varyings "are accepted with a deprecation warning". The 2025 bullet says "GLSL source code is unaffected". Several new diagnostics in this PR have no language or version check:

- **E31401** (`GlobalVaryingNotAtModuleScope`) is reported in `checkAndMarkGlobalVaryingVarDecl` before `switch (getSourceLanguage())`, so it fires in legacy Slang and in GLSL.
- **E38208**: `addModifier(moduleDecl, ...HasLegacyGlobalVaryingsModifier...)` also runs before the switch. `visitImportDecl` tests only `importedModuleDecl->hasModifier<HasLegacyGlobalVaryingsModifier>()`. So a legacy module with varyings cannot be imported, and neither can a user module compiled with `-lang glsl`.
- **E38049** (`diagnoseEntryPointsSharingGlobalVaryings`) applies to every module.
- **E58001 / E30702**: in legacy Slang these now fire for owned varyings that the entry point never touches.
- **W38044** fires on GLSL entry points. `entry-point-param-with-global-varyings-stages.slang` expects it under `-lang glsl`, and `uninitialized-globals.slang` had to disable it.

**Example**: this is the #14375 shape, in legacy Slang with no `module` declaration:
```slang
out float4 gPos : SV_Position;
[shader("vertex")]   void vsMain(float3 p : POSITION) { gPos = float4(p, 1); }
[shader("fragment")] float4 fsMain(float3 c : COLOR) : SV_Target { return float4(c, 1); }
```
- `-entry fsMain -stage fragment` compiled before, because `translateGlobalVaryingVar` finds no reachable outputs for `fsMain`. It now fails with E58001 and E30702.
- Without `-entry`, `_discoverEntryPointsImpl` validates both functions, and loading the module fails.
- The same applies to a precompiled `.slang-module` of this file. `loadSerializedModuleContents` calls `module->_discoverEntryPoints(sink, targets)` and then returns `SLANG_FAIL` if there were errors.

**Suggestion**: Pick one of these:
- List these errors in the legacy bullet.
- Make the ownership-derived errors warnings in legacy Slang, so that "accepted with a deprecation warning" holds.

Either way, replace "GLSL source code is unaffected" with an exact statement. GLSL does not get E30626 or W30627. The owned-varying entry-point checks, E31401, E38049, E38208 and W38044 all still apply to it.

---

### `source/slang/slang-parameter-binding.cpp:4494`

🟡 **Gap**: E38049 is reported once per target, and only at layout time

`diagnoseEntryPointsSharingGlobalVaryings` depends only on which entry points the program contains. It runs inside `generateParameterBindings(TargetProgram*)`, which runs once per target. Both compile drivers lay out every target before they check the error count:
```cpp
for (auto targetReq : getLinkage()->targets)
{
    auto targetProgram = m_globalAndEntryPointsComponentType->getTargetProgram(targetReq);
    targetProgram->getOrCreateLayout(getSink());
```
The snippet is from `slang-compile-request.cpp`; `slang-end-to-end-request.cpp` has the same loop. `DiagnosticSink` does not remove duplicate diagnostics.

**Example**:
- `slangc tests/diagnostics/global-varying-composed-overlap.slang -target spirv-asm -target glsl -warnings-disable 30627` prints E38049 and its note twice.
- Through the API, `createCompositeComponentType` of `vsFirst` plus `vsSecond` succeeds. The error appears only on the first `getLayout()` or code-generation call, and that call returns a null layout.

**Suggestion**: Report the composition error once, when the program is composed:
- for command-line builds, in `FrontEndCompileRequest::checkEntryPoints` or `createUnspecializedGlobalAndEntryPointsComponentType`, before `generateIR()`;
- for the API, in `CompositeComponentType::create`.

At minimum, run it once per `Program` rather than once per `TargetProgram`. A two-target run in `global-varying-composed-overlap.slang` would pin the count.

---

### `source/slang/slang-check-shader.cpp:2025`

🟡 **Gap**: The checker treats a module-scope `inout` as an input, but IR lowering never makes it one

`getGlobalVaryingDirections` sets `isInput` for `InOutModifier`. As a result, an `inout` global gets input-direction system-value checks and the "input/output" varying-type label. IR lowering decides the direction per modifier in `addVarDecorations` (`slang-lower-to-ir.cpp:3237-3244`):
```cpp
else if (as<OutModifier>(mod))
{
    builder->addSimpleDecoration<IRGlobalOutputDecoration>(inst);
}
else if (as<InModifier>(mod))
{
    builder->addSimpleDecoration<IRGlobalInputDecoration>(inst);
}
```
`InOutModifier` derives from `OutModifier`, so `inout` only ever gets `IRGlobalOutputDecoration`. `translateGlobalVaryingVar` therefore adds it to `outputVars` only and never creates an input for it. The checker is validating an input that generated code never has.

**Example**: take `inout float4 gPosition : SV_Position; void main() { gPosition = gPosition * 2; }` with `-stage vertex`.
- Before this PR it compiled, as a pure output.
- It now fails with E30702 "cannot be used as input in 'vertex'". `global-varying-inout.slang` locks that in.
- In a fragment shader, the checker accepts `SV_Position` as an input that is never loaded.

**Suggestion**: Make the checker and the IR agree. Any one of these would do:
- emit both decorations for `InOutModifier` in `addVarDecorations`;
- set `isInput` from `InModifier` only, which matches current codegen;
- reject module-scope `inout`, since GLSL has no `inout` globals.

Then test the chosen model in `global-varying-inout.slang`.

---

### `tests/diagnostics/global-varying-include.slang:11`

🟡 **Gap**: The `CHECK-NOT: E31401` can never fail

`checkAndMarkGlobalVaryingVarDecl` reports E31401 (`if (as<NamespaceDecl>(getParentDecl(decl))) ...`) before the language `switch` that reports E30626. A wrongly emitted E31401 would therefore print before E30626. FileCheck checks a trailing `CHECK-NOT` only between the previous `CHECK` match and the end of the output, so this line cannot catch it. The property the test exists for, that a varying in an `__include`d file counts as top level, is not actually tested.

The header comment is also inaccurate: it says "`__include` makes the module Slang 2025", but `module "global-varying-include";` already does that on its own (see the note in `global-varying-language-rules.slang`).

**Suggestion**: Do one of these, and fix the comment:
- move `// CHECK-NOT: E31401` above the `CHECK` line;
- switch to an exhaustive `//DIAGNOSTIC_TEST:SIMPLE(diag=...)` with plain-text annotations, so any extra diagnostic fails the test.

---

### `source/slang/slang-check-decl.cpp:5549`

🟡 **Gap**: W30628 counts only `[shader]` functions, but discovery also creates entry points from `[numthreads]`

`collectShaderAttributedFuncs` repeats the traversal in `Module::_discoverEntryPointsImpl`: it unwraps `GenericDecl` and recurses into namespaces, `FileDecl`s and `StructDecl`s. But it keeps only functions with `EntryPointAttribute`. Discovery also makes a function that has only `[numthreads]` into a compute entry point, and a `[patchconstantfunc]` function into a hull entry point:
```cpp
if (as<NumThreadsAttribute>(modifier))
{
    ...
    profile.setStage(Stage::Compute);
    canDetermineStage = true;
```

**Example**: a legacy module with `out float4 gPos : SV_Position;`, one `[shader("vertex")] void vs()` and one bare `[numthreads(1,1,1)] void cs()`.
- It gets no W30628.
- Compiled without `-entry`, both functions are discovered and the build fails with E38049 during layout.

None of the recursion cases (namespace, struct method, `__include`d file) is tested either.

**Suggestion**: Pick one:
- share the predicate and traversal with `_discoverEntryPointsImpl`, so "functions that may become entry points" means the same thing in both places;
- name the cases this walk leaves out in its doc comment.

The doc comment's "and types" also overstates the recursion, which only enters non-generic `struct`s. Add one module that covers the namespace, struct, `__include` and `[numthreads]` cases.

---

### `tests/diagnostics/import-module-with-global-varyings.slang:7`

🟡 **Gap**: Several new paths have no tests

- **E38208 for a precompiled module.** The comment on `HasLegacyGlobalVaryingsModifier` says the marker "is serialized with a precompiled module". Binary modules skip semantic checking, so on that path the serialized marker is the only signal. No test imports a `.slang-module` that has varyings. Use a new helper name for this test: `findOrImportModule` prefers a `.slang-module` over source, so precompiling this helper would silently turn the source-import test into a binary-import test.
- **The vertex `SV_Position` exemption for modules that import `glsl`** (`doesModuleDependOnGLSLModule`). It is tested only through the implicit `import glsl` that `-lang glsl` adds. An explicit `import glsl;` in legacy Slang, and an indirect import, are not tested.
- **The `"output"` label.** `getVaryingDirectionLabel` never produces `"output"` for a module-scope varying in any test; the tests cover only `"input"` (`gIntMatrix`) and `"input/output"` (`gMatrix`). An `out int2x2` global would cover it.
- **The #14375 example without `-entry`.** `global-varying-several-entry-points.slang` always passes `-entry`. Without it, `_discoverEntryPointsImpl` validates every `[shader]` function. That is the module-load behavior users of `loadModule` will hit, and no test covers it.

**Suggestion**: Add:
- a `//TEST:COMPILE:` step that precompiles a dedicated helper (with `-warnings-disable 30627`), then a diagnostic run that imports the `.slang-module` and expects E38208;
- `-DUSE_IMPORT_GLSL` and `-DOUT_TYPE` runs in the existing tests;
- a run of `global-varying-several-entry-points.slang` with no `-entry`.

---

### `source/slang/slang-entry-point.h:241`

💬 **Clarity**: The ownership comment doesn't give the reason or the invariant behind the design

This comment is the closest the PR comes to defining "owns", but it leaves out two things:

1. **Why ownership is module-wide rather than based on what the entry point references.** Several diagnostics now fire for varyings the entry point never touches, for example E58001 on `fsMain` in `global-varying-several-entry-points.slang`. The reason for choosing declarations over reachability belongs here.
2. **How this list relates to the set that `translateGlobalVaryingVar` turns into inputs and outputs.** Checking this list is enough only if:
   - every user-declared varying that the IR pass can reach is in the list, which E38208 and E38049 appear to guarantee; and
   - the only reachable varyings outside the list are `glsl`-module builtins, which is why the IR pass still reports E58001 too.

Please state that invariant here and name the checks that maintain it. The `visitImportDecl` comment could then refer to it instead of stopping at "could read or write an imported varying that it does not own".

---

### `source/slang/slang-entry-point.cpp:37`

💬 **Clarity**: The per-entry-point copy creates an ordering precondition that nothing enforces

`EntryPoint` copies the module's list when it is created, so the comment has to state a precondition: entry points must be created after `Module::_collectShaderParams` has filled the list. Nothing enforces that. An entry point created earlier would get an empty list, which looks exactly like "the module has no varyings" and silently turns off every new check.

Ownership is defined as "all varyings of the function's module". It is not clear what the copy gains over having `getGlobalVaryings()` return `getModule()->getGlobalVaryings()` on demand. The pass-through and deserialized dummy entry points have no module, so they would get an empty list. If the copy is intentional, please say why, and document `m_globalVaryings` the way its neighbors are documented.

---

### `source/slang/slang-ast-modifier.h:140`

💬 **Clarity**: "This module declares varyings" is now recorded twice

After this PR, that fact is stored both in this modifier (added by `checkAndMarkGlobalVaryingVarDecl`) and in `Module::m_globalVaryings` (filled by `_collectShaderParams`). The comment justifies the modifier by serialization. But `_collectShaderParams` also runs again when a binary module is loaded (`loadSerializedModuleContents`), so serialization alone doesn't explain why `visitImportDecl` cannot ask `importedModule->getGlobalVaryings()`.

The other reader of the modifier, at the end of `checkModule`, runs before `_collectShaderParams`, and the comment doesn't mention it. Please say which consumer actually needs the AST marker, and state that the two representations must agree (or derive one from the other).

The name is also misleading. "Legacy" suggests legacy Slang, but GLSL, HLSL and Slang 2025 modules all get the marker, and in GLSL these varyings are the native form. A name that describes what the module declares would match how the marker is used.

---

### `source/slang/slang-parameter-binding.cpp:4471`

💬 **Clarity**: The `!getFuncDecl()` skip handles a case that cannot happen

Only `EntryPoint::create` sets `m_globalVaryings`. `createDummyForPassThrough` and `createDummyForDeserialize` never call it, so their list is always empty, and `getGlobalVaryings().getCount() == 0` already skips them. The `!entryPoint->getFuncDecl()` test, and the doc sentence that justifies it ("pass-through and deserialized placeholders"), describe a case that never reaches the dictionary.

If an entry point with global varyings but no function declaration is impossible, assert that instead of skipping it silently. If it is possible, name the path that produces it.

---

### `source/slang/slang-check-shader.cpp:2427`

💬 **Clarity**: The ownership note is attached to some errors only, and can repeat

`GlobalVaryingOwnedByEntryPoint` is attached after E58001, and after system-value errors (detected by a change in `sink->getErrorCount()`). It is not attached after the varying-type errors (E38050/E38051) or the multiple-depth-output error, which are reported for the same module-scope varyings. It can also appear twice on one varying: in `global-varying-several-entry-points.slang`, `gPos` gets the identical "'gPos' belongs to entry point 'fsMain'" note two times.

That note is what tells a user why an unused varying is being checked. Please state the rule for attaching it and apply it the same way everywhere. One option is for the per-varying checks to return whether they reported something, instead of the caller comparing error counts.

---

### `source/slang/slang-check-shader.cpp:2725`

💬 **Clarity**: The W38044 comment doesn't explain why a result is exempt

The rule this comment states is that a varying parameter "mixes two ways of declaring" inputs and outputs. The last sentence then exempts the result when the entry point owns only module-scope inputs. A returned value alongside module-scope inputs mixes the two styles just as much as a varying parameter alongside module-scope outputs does: `vsMain(float3 p : POSITION)` in `global-varying-several-entry-points.slang` is that second case. Yet only the second case gets a warning.

"It is the entry point's one output" describes the exempt case but not why it is treated differently. The PR description lists the scope of W38044 as an open question. Please state the intended rule here in a form that covers both directions, so the warning and its exemptions follow from one principle.

---

### `source/slang/slang-check-shader.cpp:2836`

💬 **Clarity**: The reasoning for the `glsl` exception applies to every output, not just module-scope ones

The exception paragraph says that in a module that imports `glsl`, module-scope outputs "alone cannot show that SV_Position is missing", because the entry point may write `gl_Position`. The same reasoning holds for output parameters and the return value in such a module, yet those still set `hasOutputs`. A reader can't tell which rule is intended:
- "outputs cannot prove `SV_Position` is missing when `gl_Position` might be written", which would cover parameters too; or
- something that applies only to module-scope outputs.

The paragraph is also long for one condition. A named predicate for "this entry point may supply `SV_Position` through `gl_Position`", applied in one place, would make both the rule and its stand-in (the `glsl` import) explicit. It would also remove the loop-invariant `if (globalOutputsCountAsOutputs)` test from inside the loop.

---

### `source/slang/slang-diagnostics.lua:4310`

💬 **Clarity**: "Module-scope" means two different things in the new code

`isGlobalVaryingVar` defines a module-scope varying as one declared "either at the top level of its module or inside a namespace". This diagnostic then says a "module-scope varying ... must be declared at the top level of its module". Its name, `global-varying-not-at-module-scope`, uses "module scope" to mean top level only.

The new user-facing text also mixes "module-scope varying", "module-scope 'in'/'out' variables", and, in the varying-type context string in `validateEntryPoint`, "global variable 'x'". Please choose one term for the concept and one for "top level", and use them the same way in names, messages and comments.

---

### `source/slang/slang-check-decl.cpp:623`

💬 **Clarity**: The `Unknown` source-language case names no path that reaches it

The comment says a module-scope `in`/`out` declaration can arrive here with `SourceLanguage::Unknown` because it "is checked without a translation unit". `getSourceLanguage()` returns `Unknown` when `getShared()->getTranslationUnitRequest()` is null. The comment doesn't say which path checks a module-level `VarDecl` that way.

If such a path exists, the module still gets the marker (and so E38208 on import) while the varying's own language rule is skipped, which may be wrong for that module. If no such path exists, this is impossible input being ignored silently. Please name the concrete case, or assert.

## Reviewer B — Devin Review

# Devin Review

## AI Analysis

Module-scope in/out variables now belong to every entry point of their module and are validated like parameters. Imports of such modules are rejected, and HLSL and Slang 2025+ reject the varyings outright.

Record each module's global varyings and hand them to every entry point it declares.
Run the existing system-value, return-type, varying-type, and SV_Position checks over those varyings.
Add five diagnostics covering language rules, placement, mixing with parameters, and imports.
Show less

Summary: Stage 1 of #14375 (checker, plus the composed-program overlap check), per maintainer comments 6697604956 and 6753868655. Each EntryPoint owns every module-scope in/out variable of its module (no call-graph walk), and validateEntryPoint checks them like parameters. New: E30626, W30627, W30628, E31401, W38044, E38208, E38049.

Root cause: validateEntryPoint (slang-check-shader.cpp:2285 at base) built its input/output list from function parameters only.

Tests: 12 new or rewritten diagnostic tests. Debug suite: 11917/11920 (the 3 known fp8 CUDA INVALID_PTX failures).

Risk: HLSL and Slang 2025+ global varyings now error, as do imports of them. A program composing two entry points of one module with global varyings errors (E38049).

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



## Flags

(none reported)

## Informational

(none reported)

## Reviewer C — Clarity

# PR 14395 Clarity Workflow Candidates

## PR Summary

PR #14395, "Check module-scope varyings against the entry points of their module" (+892/−83, 27 files), is Stage 1 of #14375. It introduces an **ownership** model. Each `EntryPoint` owns every module-scope `in`/`out`/`inout` variable of its function's module, whether or not the function uses it. The list comes from `Module::getGlobalVaryings()` (filled in `_collectShaderParams`) and is copied onto the entry point in `EntryPoint::create`. `validateEntryPoint` then runs these checks over the owned list, as it does for parameters: system-value semantics, depth-output aggregation, varying-type rules, SV_Position, and E58001 "must return void".

The PR also adds language-level and module-level rules:

- **E30626 / W30627:** module-scope varyings are rejected in HLSL and Slang 2025+, and deprecated in legacy Slang.
- **E31401:** module-scope varyings may not be declared inside a namespace.
- **W30628:** warns when a module with varyings has several `[shader]` functions.
- **E38208:** importing a module that has varyings is an error.
- **W38044:** warns about varying parameters on an entry point that owns varyings.
- **E38049:** composing two entry points of such a module is an error. This one is raised from `generateParameterBindings`.

A new AST marker, `HasLegacyGlobalVaryingsModifier`, records on the `ModuleDecl` that the module declares varyings.

**Title/description vs. diff.** The description matches the diff in substance, and its Risk section discloses the HLSL/2025 rejection, the import error and E38049. Two things are not called out:

- A single fragment entry point compiled on its own now fails when a vertex shader in the same module writes `out` globals. This is `global-varying-several-entry-points.slang`, the motivating #14375 example.
- GLSL modules are affected by W38044, W30628, E38049 and the owned-varying checks. Yet the user-guide entry says "GLSL source code is unaffected".

**Value proposition.** The PR closes a real validation hole: module-scope varyings were invisible to `validateEntryPoint`. It does so with a simple, non-call-graph model that the maintainers requested.

**Generation coverage audit.** Every changed file was revisited after both generation passes:

- `docs/entrypoint-validation.md`: clear. Only a trivial ordering nit, dropped as FG015.
- `docs/user-guide/11-language-version.md`: C004.
- `slang-ast-modifier.h`: C003.
- `slang-check-decl.cpp`:
  - `checkAndMarkGlobalVaryingVarDecl`: FG008. Its language switch and `default:` comment are clear.
  - `isGlobalVaryingVar`: C005.
  - `collectShaderAttributedFuncs` / `diagnoseShaderFunctionsSharingGlobalVaryings`: C008.
  - The `checkModule` call site: FG012.
  - `visitImportDecl`: C010.
- `slang-check-shader.cpp`:
  - `EntryPointParamDirections` / `getVaryingDirectionLabel`: FG001.
  - `doesModuleDependOnGLSLModule`: FG003.
  - The E58001 check: FG004.
  - The SV-semantic note: C007.
  - Varying-type loop: FG005 and FG006.
  - `_collectShaderParams`: FG007.
  - Inspected and judged clear: `getGlobalVaryingDirections`, `validateSystemValueSemanticForDirections`, the depth-output collection and its comment, the W38044 block, and the SV_Position block.
- `slang-check.h`: trivial declaration.
- `slang-diagnostics.lua`: FG009, plus E31401's wording under C005.
- `slang-entry-point.{h,cpp}`: C001 and C002.
- `slang-module.h`: covered by C002 and C003.
- `slang-parameter-binding.cpp`: C006 and FG010.
- Tests:
  - FG011 (`global-varying-composed-overlap.slang`).
  - The `global-varying-several-entry-points.slang` header is covered by C007.
  - All other test headers were read and are clear.

No gaps remained after the second pass.

## Review Body

> Claude Opus 5.5-authored clarity review:
>
> This PR is substantial: about 900 lines, seven new diagnostics, and a new semantic rule that every entry point owns all module-scope varyings of its module. On the whole it is carefully written. Most new helpers have contract comments, the `validateEntryPoint` additions are introduced by a summary of which checks apply, and the tests have header comments that walk through concrete examples. The PR feels close in its mechanics. What still needs work is how clearly it explains the *model*, which is the part a future maintainer most needs to trust.
>
> ## Main concerns
>
> - **The ownership model is not reconciled with the IR.** The checker now says an entry point owns every varying in its module, while `translateGlobalVaryingVar` still uses reachability. And `gl_Position`-style builtins are "not owned" by anyone but are still treated as outputs by the IR. The code should state, once, why ownership is module-wide and what invariant connects the two models.
> - **One fact has three representations.** "This module's varyings" is held by `HasLegacyGlobalVaryingsModifier`, by `Module::m_globalVaryings`, and by a per-`EntryPoint` copy. Each is filled by a different code path, and the copy relies on an ordering that is described in a comment but not asserted. Please name the source of truth and explain why each extra copy is needed. The modifier's name ("Legacy") also conflicts with it being set on GLSL modules.
> - **The user-facing docs understate the impact.** "GLSL source code is unaffected" and "accepted with a deprecation warning" (legacy) both conflict with what the PR enforces.
> - **E38049 sits in an unexplained layer.** It is a property of the program, not the target, but it runs inside per-target parameter binding.
> - **Some logic is duplicated or diverges.** `collectShaderAttributedFuncs` re-walks the declarations the way entry-point discovery does, but with a narrower definition of a would-be entry point. The varying-type validation setup is copied from the parameter loop. Which diagnostics get the ownership note seems ad hoc.
> - **Terminology varies.** The same concept is called "global varying", "module-scope varying", "global variable" and "legacy global varyings", and E31401 calls a namespaced variable a "module-scope varying" that isn't at the top level of its module.
>
> The remaining inline comments are smaller points about naming, comments, and redundant guards.

## Kept

### C001: Checker ownership model and IR reachability model are not reconciled in the code

- Status: Keep
- Confidence: High
- Scope: Direct
- Category: invariant
- Location: `source/slang/slang-entry-point.h:241-246`
- GitHub link: https://github.com/shader-slang/slang/blob/2792441f50a6f52cc33a897df3febca13aae2b0e/source/slang/slang-entry-point.h#L241-L246
- Overlap decision: Keep
- Overlap rationale: Absorbs the fine-grained concern that this doc comment contains an IR implementation detail, and the `_collectShaderParams` "do not belong to any entry point" vs. E58001-comment tension; C002 and C003 address storage, not the model.
- Scope decision: Direct
- Scope rationale: The PR introduces both the ownership rule and this doc comment.

Context:

```cpp
    /// Get the module-scope varyings that belong to this entry point, in declaration order. They
    /// are inputs and outputs of the entry point just as its varying parameters are. An entry
    /// point owns every module-scope varying declared in the module of its function, whether or
    /// not the function uses it. Semantic checking uses this list; the IR pass
    /// `translateGlobalVaryingVar` still finds an entry point's global varyings by reachability.
    List<VarDeclBase*> const& getGlobalVaryings() { return m_globalVaryings; }
```

Proposed comment:

> This PR introduces a new rule — an entry point owns every module-scope varying of its module, used or not — but the code doesn't say why. It also doesn't say how that rule relates to the IR, which still decides an entry point's varyings by reachability (`translateGlobalVaryingVar`). That leaves the reader with two definitions of "the varyings of an entry point" and no stated relationship between them.
>
> For example, in `global-varying-several-entry-points.slang` the checker treats `gPos` and `vA` as outputs of `fsMain`, but the IR would never give `fsMain` those outputs. Similarly, the `_collectShaderParams` comment says that `glsl`-module builtins such as `gl_Position` "do not belong to any entry point". Yet the E58001 comment in `validateEntryPoint` relies on the IR treating exactly those builtins as entry-point outputs.
>
> Could the design be stated once, in a place that both the checker and IR comments can point to? It should cover:
>
> - why ownership is module-wide rather than based on use;
> - what invariant ties the two models together, for example "the IR's reachable set is always a subset of the owned set plus the builtin `glsl` varyings, so checking the owned set is conservative";
> - whether the IR is expected to move to the ownership list later.
>
> The note that the IR uses reachability is an implementation detail. It currently sits in the API doc comment of `getGlobalVaryings`, and it would fit better in that design note.

Notes:
The PR description says the module-wide rule comes from maintainer comments on #14375, but none of that rationale made it into the code.

### C002: `EntryPoint` keeps a copy of its module's varying list, guarded only by an ordering comment

- Status: Keep
- Confidence: High
- Scope: Direct
- Category: invariant
- Location: `source/slang/slang-entry-point.cpp:35-37`
- GitHub link: https://github.com/shader-slang/slang/blob/2792441f50a6f52cc33a897df3febca13aae2b0e/source/slang/slang-entry-point.cpp#L35-L37
- Overlap decision: Keep
- Overlap rationale: C003 is about the AST marker vs. the module list; this one is about the entry-point copy vs. the module list, at a different location and with a different remedy.
- Scope decision: Direct
- Scope rationale: New field, new accessor, and new initialization added by the PR.

Context:

```cpp
    // Every caller creates entry points after `Module::_collectShaderParams` has filled the
    // module's list.
    entryPoint->m_globalVaryings = Slang::getModule(funcDeclRef.getDecl())->getGlobalVaryings();
```

Proposed comment:

> By definition, `EntryPoint::m_globalVaryings` is exactly `getModule()->getGlobalVaryings()`: the header says an entry point owns every module-scope varying of its module. But it is stored as a copy taken at construction. Whether that copy is correct then depends on an ordering invariant that only this comment states: entry points must be created after `_collectShaderParams`. Nothing asserts that invariant. If it were ever broken, the entry point would silently own nothing, and every new check would quietly be skipped.
>
> Why does the entry point need its own snapshot, given that `EntryPoint::getModule()` already exists? If the snapshot is intentional, please state the reason. One possible reason would be that specialized or placeholder entry points must not see the module's list. If it isn't intentional, deriving the list from the module would remove the ordering dependency and leave one source of truth. Either way, the invariant should be checked, not only described.

Notes:
Entry-point creation sites: `slang-module.cpp` (`_discoverEntryPointsImpl`) and `slang-check-shader.cpp` (`findAndValidateEntryPoint`). Both currently run after `_collectShaderParams` (`slang-check.cpp` `checkTranslationUnit`, and `slang-session.cpp` deserialization).

### C003: Two independently computed representations of "this module declares varyings", and a misleading marker name

- Status: Revise
- Confidence: Medium
- Scope: Direct
- Category: API shape
- Location: `source/slang/slang-ast-modifier.h:140-145`
- GitHub link: https://github.com/shader-slang/slang/blob/2792441f50a6f52cc33a897df3febca13aae2b0e/source/slang/slang-ast-modifier.h#L140-L145
- Overlap decision: Merged into C003 (absorbs C009)
- Overlap rationale: C009 (the "Legacy" naming and the incomplete list of readers) is about the same declaration; one combined comment is clearer.
- Scope decision: Direct
- Scope rationale: New AST modifier introduced by the PR.
- Judgment decision: Revise
- Judgment rationale: `_collectShaderParams` runs on both the source path (`checkTranslationUnit`, after `checkModule`) and the deserialization path (`slang-session.cpp`), so `visitImportDecl` could use the imported module's list. The real constraint is that W30628 in `checkModule` runs before `_collectShaderParams`. The comment was reworded to ask for that reason rather than claim the marker is unnecessary.

Context:

```cpp
// Marks a module that declares legacy GLSL-style module-scope varyings (see
// `isGlobalVaryingVar`). The builtin core and `glsl` modules never carry it. Being part of the
// AST, the marker is serialized with a precompiled module, and `visitImportDecl` reads it to
// reject an import of such a module.
FIDDLE()
class HasLegacyGlobalVaryingsModifier : public Modifier
```

Proposed comment:

> The PR now has two representations of the same fact, "this module declares user module-scope varyings":
>
> - `HasLegacyGlobalVaryingsModifier`, which `checkAndMarkGlobalVaryingVarDecl` adds during modifier checking;
> - a non-empty `Module::getGlobalVaryings()`, which `_collectShaderParams` computes.
>
> The two are filled by separate code paths that only happen to apply the same filter (`isGlobalVaryingVar && !isFromCoreModule`). Nothing says they must agree, or which one is the source of truth.
>
> The comment justifies the marker by saying it is serialized with precompiled modules. But the deserialization path also runs `_collectShaderParams` (`slang-session.cpp`), so the imported module's list is already available when `visitImportDecl` runs. The constraint that seems to decide this is `checkModule`: its W30628 check runs before `_collectShaderParams` (`checkTranslationUnit`). If that is the reason, please say so, and state how the two representations relate.
>
> Two smaller points on the same declaration:
>
> - "Legacy" in the name contradicts the PR's own framing. `checkAndMarkGlobalVaryingVarDecl` also sets the marker on GLSL modules, which the PR describes as "the dialect that module-scope varyings belong to".
> - The comment names `visitImportDecl` as the only reader, but `checkModule` reads the marker too.

Notes:
Revised from the raw candidate, which suggested the marker might be unnecessary.

### C004: User-guide entries misstate who is affected

- Status: Keep
- Confidence: High
- Scope: Direct
- Category: comments
- Location: `docs/user-guide/11-language-version.md:52-54`
- GitHub link: https://github.com/shader-slang/slang/blob/2792441f50a6f52cc33a897df3febca13aae2b0e/docs/user-guide/11-language-version.md#L52-L54
- Overlap decision: Keep
- Overlap rationale: The only candidate on user-facing documentation.
- Scope decision: Direct
- Scope rationale: Both doc entries were added by the PR.

Context:

```md
- Module-scope `in`/`out`/`inout` variables (GLSL-style global varyings) are accepted with a deprecation
  warning. They are intended for the GLSL dialect only; declare entry-point inputs and outputs as
  parameters instead. See GitHub issue [#14375](https://github.com/shader-slang/slang/issues/14375).
...
- Module-scope `in`/`out`/`inout` variables (GLSL-style global varyings) are rejected. Declare entry-point
  inputs and outputs as parameters instead. GLSL source code is unaffected. See GitHub issue
  [#14375](https://github.com/shader-slang/slang/issues/14375) for details.
```

Proposed comment:

> These two entries (here and in the legacy section above) don't match what the PR implements, and this is the page users will read to learn what changed.
>
> - "GLSL source code is unaffected" is true only of the HLSL/Slang 2025 rejection. `checkAndMarkGlobalVaryingVarDecl` marks GLSL modules too. So GLSL modules get W30628, E38049 at composition, the owned-varying checks in `validateEntryPoint`, and W38044. For W38044, see `entry-point-param-with-global-varyings-stages.slang` and the `-warnings-disable 38044` this PR adds to `uninitialized-globals.slang`.
> - The legacy entry says these variables are "accepted with a deprecation warning". In legacy mode, however, the following are all errors:
>   - importing such a module (E38208);
>   - declaring one inside a namespace (E31401);
>   - composing two entry points of the module (E38049).
> - Under the "owns every varying of its module" rule, a fragment entry point beside a vertex shader's `out` globals now fails (E58001 and SV-semantic errors) even when it uses none of them, as in `global-varying-several-entry-points.slang`.
>
> Could these entries describe the ownership rule and the restrictions that apply in every language version, so users can predict which existing code will break?

Notes:
None.

### C005: One concept goes by several names, and "module-scope" is defined to include namespaces

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: terminology
- Location: `source/slang/slang-check-decl.cpp:1660-1666`
- GitHub link: https://github.com/shader-slang/slang/blob/2792441f50a6f52cc33a897df3febca13aae2b0e/source/slang/slang-check-decl.cpp#L1660-L1666
- Overlap decision: Keep
- Overlap rationale: FG006 asks for a concrete change to one message string. This candidate is about the definition itself and the contradiction in E31401, so both stay.
- Scope decision: Direct
- Scope rationale: The PR introduces the definition, the identifiers, and the diagnostic texts.

Context:

```cpp
/// Is `decl` a module-scope varying, that is, a variable declared `in`, `out` or `inout` outside
/// any function or type, either at the top level of its module or inside a namespace? (`inout`
/// counts because `InOutModifier` derives from `OutModifier`.)
///
/// GLSL-style shaders read their inputs and write their outputs through such variables instead of
/// through entry-point parameters. The code calls them "global varyings".
bool isGlobalVaryingVar(VarDeclBase* decl)
```

Proposed comment:

> This doc comment defines the concept under two names, "module-scope varying" in prose and "global varying" in code, and the rest of the PR adds more:
>
> - the diagnostics say "module-scope 'in'/'out' variables";
> - the varying-type context says "global variable" (`slang-check-shader.cpp`);
> - the AST marker says "legacy global varyings";
> - the existing E58001 says "global output variables".
>
> The definition also counts a varying "inside a namespace" as module-scope, yet E31401 says "module-scope varying '…' must be declared at the top level of its module". By this definition, that is a module-scope varying that isn't at module scope.
>
> Please pick one term and define it precisely enough to settle the namespace question: is it a varying anywhere outside functions and types, or one at the module's top level? Then use that term in the identifiers, the comments, and the diagnostic text.

Notes:
None.

### C006: A target-independent composition check sits in per-target layout generation

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: organization
- Location: `source/slang/slang-parameter-binding.cpp:4494`
- GitHub link: https://github.com/shader-slang/slang/blob/2792441f50a6f52cc33a897df3febca13aae2b0e/source/slang/slang-parameter-binding.cpp#L4494
- Overlap decision: Keep
- Overlap rationale: FG010 is about a guard inside the helper; this candidate is about where the helper is called from.
- Scope decision: Direct
- Scope rationale: The call and the helper are new.
- Judgment decision: Keep
- Judgment rationale: `TargetProgram::getOrCreateLayout` (`slang-parameter-binding.cpp`) caches `m_layout` per `TargetProgram` and calls `generateParameterBindings`, so the check runs once per target. The concern about the layer and the repeated diagnostics is supported. The wording hedges on the exact count of diagnostics.

Context:

```cpp
    auto program = targetProgram->getProgram();
    auto targetReq = targetProgram->getTargetReq();

    diagnoseEntryPointsSharingGlobalVaryings(program, sink);
```

Proposed comment:

> E38049 depends only on which entry points the program contains, not on the target. Yet it runs inside `generateParameterBindings`, which runs once per `TargetProgram` (`TargetProgram::getOrCreateLayout` caches its result only per target). Nothing explains why parameter binding and layout is the layer that owns this rule. With two targets, the same composition error appears to be reported once per target. A failure here also marks that target's layout as failed (`m_layoutHasErrors`), rather than marking the composition itself as invalid.
>
> Could you explain why this check lives here and not where the program is composed or linked? If layout is the only point that every composition path reaches, please say so in the comment, and say how duplicate diagnostics are avoided.

Notes:
None.

### C007: The rule for which diagnostics carry the ownership note is not stated

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: correctness smell
- Location: `source/slang/slang-check-shader.cpp:2425-2441`
- GitHub link: https://github.com/shader-slang/slang/blob/2792441f50a6f52cc33a897df3febca13aae2b0e/source/slang/slang-check-shader.cpp#L2425-L2441
- Overlap decision: Keep
- Overlap rationale: Absorbs the fine-grained concern about the over-general header comment in `global-varying-several-entry-points.slang`.
- Scope decision: Direct
- Scope rationale: New loop, new note diagnostic, and new test comment.

Context:

```cpp
            for (Index i = 0; i < globalVaryings.getCount(); ++i)
            {
                const auto errorCountBefore = sink->getErrorCount();
                validateSystemValueSemanticForDirections(
                    &visitor, sink, globalVaryings[i], globalVaryingDirections[i],
                    stage, scope, &entryPointInferredCaps);
                if (sink->getErrorCount() != errorCountBefore)
                {
                    sink->diagnose(Diagnostics::GlobalVaryingOwnedByEntryPoint{
                        .entryPoint = entryPointName,
                        .decl = globalVaryings[i]});
                }
            }
```

Proposed comment:

> The "'x' belongs to entry point 'main'" note matters for usability, because under the ownership rule an error can point at a varying that the entry point never mentions. But it is attached in only some places.
>
> - It is attached after system-value errors (detected by diffing the sink's error count) and after E58001.
> - It is not attached after the varying-type errors on module-scope varyings (`global-varying-entry-point-checks.slang` expects no note on `gIntMatrix`), after the depth-output conflict, or after warnings from `validateSystemValueSemantic`.
>
> The header of `global-varying-several-entry-points.slang` says "Each error carries a note that names the owning entry point", but that holds only for that file. What is the intended rule for when the note appears?
>
> Also, using an error-count delta to infer that the callee reported something about this declaration is indirect. It ties the note to errors only, and to whatever else the callee might report. A stated policy, with a mechanism that follows it directly, would make it clear whether the missing notes are intentional.

Notes:
None.

### C008: `collectShaderAttributedFuncs` copies entry-point discovery but with a different definition of an entry point

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: organization
- Location: `source/slang/slang-check-decl.cpp:5538-5559`
- GitHub link: https://github.com/shader-slang/slang/blob/2792441f50a6f52cc33a897df3febca13aae2b0e/source/slang/slang-check-decl.cpp#L5538-L5559
- Overlap decision: Keep
- Overlap rationale: Absorbs the fine-grained concern that generic functions are unwrapped but generic structs are not. FG012 is about the call site in `checkModule`, which is a separate issue.
- Scope decision: Direct
- Scope rationale: New helper and new warning.
- Judgment decision: Keep
- Judgment rationale: `Module::_discoverEntryPointsImpl` (`slang-module.cpp`) also discovers functions that have `[numthreads]` or `[patchconstantfunc]` but no `[shader]`. Those can become composed entry points (and so hit E38049), but they never count toward W30628.

Context:

```cpp
/// Appends to `outFuncs` every function in `containerDecl` that has a `[shader(...)]` attribute,
/// including functions in namespaces, `__include`d files and types, in declaration order.
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

> This traversal copies the shape of `Module::_discoverEntryPointsImpl` (`slang-module.cpp`): it unwraps `GenericDecl` and recurses into `NamespaceDeclBase`, `FileDecl` and `StructDecl`. But it uses a different idea of what a future entry point is.
>
> Discovery also treats functions with `[numthreads]` or `[patchconstantfunc]` and no `[shader]` as entry points, and those never count toward W30628 here. So a module with a `[shader("vertex")]` function and a bare `[numthreads]` compute function gets no W30628, yet composing the two would hit E38049.
>
> Is the narrower `[shader]`-only definition intentional? If so, the doc comment on `diagnoseShaderFunctionsSharingGlobalVaryings` should say why. If not, one shared definition of a "would-be entry point" would keep the warning and the composition error in agreement.
>
> A smaller related point: generic functions are unwrapped, but the recursion tests `memberDecl`, so generic structs are skipped. That list of cases should either be justified here or come from the shared definition.

Notes:
None.

### C010: The import rejection gives a possible hazard, not the invariant it protects

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: invariant
- Location: `source/slang/slang-check-decl.cpp:18893-18900`
- GitHub link: https://github.com/shader-slang/slang/blob/2792441f50a6f52cc33a897df3febca13aae2b0e/source/slang/slang-check-decl.cpp#L18893-L18900
- Overlap decision: Keep
- Overlap rationale: C001 asks for the overall model; this candidate asks for the local justification of the import rule, which is a separate request.
- Scope decision: Direct
- Scope rationale: New check and comment.

Context:

```cpp
    // An entry point owns the module-scope varyings of its own module only, so an entry point of
    // the importing module could read or write an imported varying that it does not own.
    if (importedModuleDecl->hasModifier<HasLegacyGlobalVaryingsModifier>())
    {
        getSink()->diagnose(Diagnostics::ImportedModuleHasGlobalVaryings{
```

Proposed comment:

> The comment gives a possible hazard (an entry point of the importing module *could* read or write an imported varying), but the rule rejects every such import unconditionally. That includes importers that have no entry points, and importers that never touch the varyings, so a reader can't tell whether the breadth is deliberate. Is the protected invariant "every module-scope varying that an entry point can name is one it owns"? If so, please state it here as the reason all such imports are rejected, and say why a narrower rule (for example, one based on actual references) isn't wanted.

Notes:
None.

### FG001: `EntryPointParamDirections` now also describes non-parameters

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: naming
- Location: `source/slang/slang-check-shader.cpp:31-38`
- GitHub link: https://github.com/shader-slang/slang/blob/2792441f50a6f52cc33a897df3febca13aae2b0e/source/slang/slang-check-shader.cpp#L31-L38
- Overlap decision: Merged into FG001 (absorbs FG002)
- Overlap rationale: FG002 (`getVaryingDirectionLabel` silently falls back to "input") depends on the same invariant, which this comment asks to make a property of the type.
- Scope decision: Direct
- Scope rationale: The PR adds the type comment, widens the type's role, and adds `getVaryingDirectionLabel`.

Context:

```cpp
/// The directions in which an entry-point input or output (a parameter or a module-scope varying)
/// passes data. `checkEntryPointParamPassingMode` and `getGlobalVaryingDirections` each set at
/// least one of them.
struct EntryPointParamDirections
{
    bool isInput = false;
    bool isOutput = false;
};

static const char* getVaryingDirectionLabel(EntryPointParamDirections directions)
```

Proposed comment:

> With this PR, `EntryPointParamDirections` also describes module-scope varyings (through `getGlobalVaryingDirections` and `globalVaryingDirections`). The new comment says so, but the name still says "Param", while the new helpers that use it are named for varyings (`getVaryingDirectionLabel`, `validateSystemValueSemanticForDirections`). The type's name should match its broader role, which is the directions of an entry-point input or output.
>
> Separately, the invariant "at least one flag is set" is stated by naming its two current producers. It would read better as a property of the type itself, because two consumers depend on it in different ways. `validateSystemValueSemanticForDirections` asserts it, while `getVaryingDirectionLabel` silently returns `"input"` when it is violated.

Notes:
None.

### FG003: The transitive claim in `doesModuleDependOnGLSLModule` relies on an unstated property

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: function contract
- Location: `source/slang/slang-check-shader.cpp:2005-2015`
- GitHub link: https://github.com/shader-slang/slang/blob/2792441f50a6f52cc33a897df3febca13aae2b0e/source/slang/slang-check-shader.cpp#L2005-L2015
- Overlap decision: Keep
- Overlap rationale: No other candidate covers this helper.
- Scope decision: Direct
- Scope rationale: New helper.

Context:

```cpp
/// Returns whether `module` imports the GLSL module, directly or through the modules it imports.
static bool doesModuleDependOnGLSLModule(Linkage* linkage, Module* module)
{
    const auto glslModuleName = linkage->getSessionImpl()->glslModuleName;
    for (auto dependency : module->getModuleDependencyList())
    {
        if (dependency->getNameObj() == glslModuleName)
            return true;
    }
    return false;
}
```

Proposed comment:

> The comment promises "directly or through the modules it imports", but the loop scans one flat list. The claim holds only because `getModuleDependencyList()` is transitively closed: `ModuleDependencyList::addDependency` copies in each dependency's own dependencies. A reader checking this function has to go and find that out. Please state the property here, or point to where it is guaranteed, so the transitive claim can be checked locally.
>
> A smaller question: `linkage` seems to be used only to look up the session's `glslModuleName`, which `module` can already reach. Is the separate parameter needed?

Notes:
None.

### FG004: Two idioms for "returns void" in the same function

- Status: Keep
- Confidence: Low
- Scope: Direct
- Category: control flow
- Location: `source/slang/slang-check-shader.cpp:2376`
- GitHub link: https://github.com/shader-slang/slang/blob/2792441f50a6f52cc33a897df3febca13aae2b0e/source/slang/slang-check-shader.cpp#L2376
- Overlap decision: Keep
- Overlap rationale: No other candidate covers this line.
- Scope decision: Direct
- Scope rationale: New condition added by the PR.

Context:

```cpp
    if (returnType && !returnType->equals(linkage->getASTBuilder()->getVoidType()))
```

Proposed comment:

> This tests whether the return type is void with `returnType->equals(linkage->getASTBuilder()->getVoidType())`. Later in the same function, the SV_Position check tests the same thing with `as<BasicExpressionType>(returnType)` and `BaseType::Void`. Are the two tests meant to be equivalent? If so, using one form (or a small named predicate) would save the reader from wondering where they differ, for example for a modified or aliased `void`.

Notes:
None.

### FG005: The varying-type validation setup is copied from the parameter loop

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: control flow
- Location: `source/slang/slang-check-shader.cpp:2797-2819`
- GitHub link: https://github.com/shader-slang/slang/blob/2792441f50a6f52cc33a897df3febca13aae2b0e/source/slang/slang-check-shader.cpp#L2797-L2819
- Overlap decision: Keep
- Overlap rationale: FG006 is about the wording of one string inside this block; this candidate is about its structure.
- Scope decision: Direct
- Scope rationale: New loop.

Context:

```cpp
        for (Index i = 0; i < globalVaryings.getCount(); ++i)
        {
            const auto globalVarying = globalVaryings[i];

            VaryingTypeValidationContext ctx;
            ctx.astBuilder = astBuilder;
            ctx.sink = sink;
            ctx.entryPointName = entryPointName;
            ctx.loc = globalVarying->loc;
            ...
            ctx.targets = targets.getArrayView();
            ctx.stage = stage;
            validateVaryingType(ctx, globalVarying->getType());
        }
```

Proposed comment:

> This loop repeats the parameter loop above almost line for line: the same seven `VaryingTypeValidationContext` fields, and the same `StringBuilder` code for a named or unnamed declaration. Only the location, the direction, and the context noun differ. With two copies, a reader has to diff them by eye to confirm that module-scope varyings really are checked like parameters, as the summary comment at the start of the global-varying section says. Any later change to the context would also have to be made twice. A helper that validates one entry-point input/output declaration, given its directions and a label, would make the equivalence visible.

Notes:
None.

### FG006: Varying-type messages call these "global variable", unlike every other new message

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: terminology
- Location: `source/slang/slang-check-shader.cpp:2810-2813`
- GitHub link: https://github.com/shader-slang/slang/blob/2792441f50a6f52cc33a897df3febca13aae2b0e/source/slang/slang-check-shader.cpp#L2810-L2813
- Overlap decision: Keep
- Overlap rationale: A concrete instance in user-facing text, separate from C005's request about the definition.
- Scope decision: Direct
- Scope rationale: New diagnostic context text.

Context:

```cpp
            if (auto globalVaryingName = globalVarying->getName())
                contextSb << "global variable '" << globalVaryingName->text << "'";
            else
                contextSb << "global variable";
```

Proposed comment:

> This produces messages like "type 'matrix<int,2,2>' cannot be used as input global variable 'gIntMatrix' of entry point 'main'". Every other new diagnostic and comment calls these "module-scope varyings". "Global variable" also suggests an ordinary `static` global rather than an `in`/`out` stage input or output. The context noun should use the same term as the rest of the PR's diagnostics.

Notes:
None.

### FG007: The rewritten `_collectShaderParams` comment no longer says what is filtered out

- Status: Keep
- Confidence: Low
- Scope: Direct
- Category: comments
- Location: `source/slang/slang-check-shader.cpp:3280-3285`
- GitHub link: https://github.com/shader-slang/slang/blob/2792441f50a6f52cc33a897df3febca13aae2b0e/source/slang/slang-check-shader.cpp#L3280-L3285
- Overlap decision: Keep
- Overlap rationale: C001 covers the "do not belong to any entry point" comment a few lines below; this candidate is about the filter comment above it.
- Scope decision: Direct
- Scope rationale: The PR replaced this comment and the condition.

Context:

```cpp
                // Module-scope varyings are recorded as shader parameters too, because the
                // program-scope layout and reflection still list them.
                //
                const bool isGlobalVarying = isGlobalVaryingVar(globalVar);
                if (!isGlobalShaderParameter(globalVar) && !isGlobalVarying)
                    continue;
```

Proposed comment:

> The old comment explained what this `continue` filters out (`static` and `groupshared` globals). The new one explains only why varyings are kept. A reader now has to look inside `isGlobalShaderParameter` to learn what is skipped, and that varyings are excluded from it. "Still list them" also suggests a transitional state. If program-scope layout and reflection are expected to stop listing module-scope varyings, please say so (or link the tracking issue). Otherwise, say why both kinds of declaration are recorded as `ShaderParamInfo`.

Notes:
None.

### FG008: The rationale for the namespace restriction doesn't say what would break

- Status: Keep
- Confidence: Low
- Scope: Direct
- Category: comments
- Location: `source/slang/slang-check-decl.cpp:587-591`
- GitHub link: https://github.com/shader-slang/slang/blob/2792441f50a6f52cc33a897df3febca13aae2b0e/source/slang/slang-check-decl.cpp#L587-L591
- Overlap decision: Keep
- Overlap rationale: C005 asks whether "module-scope" includes namespaces; this candidate asks why namespaced varyings are rejected at all.
- Scope decision: Direct
- Scope rationale: New check and doc comment.

Context:

```cpp
    /// Module-scope varyings are a GLSL idiom: Slang and HLSL entry points declare their inputs and
    /// outputs as parameters. We therefore reject them in HLSL and in Slang 2025 and later, and
    /// warn about them in legacy Slang. We also restrict them to the top level of the module in
    /// every language: they exist for the GLSL dialect, which has no namespaces, so a varying
    /// declared inside a namespace has no meaning to carry over.
```

Proposed comment:

> "A varying declared inside a namespace has no meaning to carry over" doesn't tell the reader what would go wrong if one were allowed. `isGlobalVaryingVar` and `_collectShaderParams` both accept namespace-scoped varyings, so nothing downstream obviously breaks. Which is it: a constraint from GLSL interface matching, from mangling or layout, or simply a policy choice to keep the deprecated surface small? Stating the actual reason would make E31401 easier to evaluate, and so would saying whether it applies in every language version. Today it does, even in legacy mode, where the varying itself only warns.

Notes:
None.

### FG009: New diagnostics are out of numeric order, and the note sits under an unrelated header

- Status: Keep
- Confidence: Low
- Scope: Direct
- Category: comments
- Location: `source/slang/slang-diagnostics.lua:3983-3996`
- GitHub link: https://github.com/shader-slang/slang/blob/2792441f50a6f52cc33a897df3febca13aae2b0e/source/slang/slang-diagnostics.lua#L3983-L3996
- Overlap decision: Merged into FG009 (absorbs FG014 and FG015 from the raw pass)
- Overlap rationale: Both are minor organization points in the same file; one comment is enough.
- Scope decision: Direct
- Scope rationale: New diagnostic entries.

Context:

```lua
warning(
    "shader-functions-share-global-varyings",
    30628,
    ...
)

warning(
    "deprecated-global-varying",
    30627,
```

Proposed comment:

> Two small organization points in this file:
>
> - W30628 is declared between E30626 and W30627, so the 3062x codes are out of numeric order.
> - The `global-varying-owned-by-entry-point` note is placed under the "GLSL Compatibility (58001-58003)" header, but it is also attached to system-value-semantic errors, which are not GLSL-compatibility diagnostics.
>
> Reordering the codes, and placing the note next to the diagnostics it accompanies (or under a header that describes it), would make the file easier to navigate.

Notes:
None.

### FG010: The `!getFuncDecl()` guard can never be the deciding condition

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: control flow
- Location: `source/slang/slang-parameter-binding.cpp:4471`
- GitHub link: https://github.com/shader-slang/slang/blob/2792441f50a6f52cc33a897df3febca13aae2b0e/source/slang/slang-parameter-binding.cpp#L4471
- Overlap decision: Keep
- Overlap rationale: Separate from C006, which is about where the helper is called from.
- Scope decision: Direct
- Scope rationale: New helper.

Context:

```cpp
        if (!entryPoint->getFuncDecl() || entryPoint->getGlobalVaryings().getCount() == 0)
            continue;
```

Proposed comment:

> Only `EntryPoint::create` fills `m_globalVaryings`. The pass-through and deserialized placeholders (`createDummyForPassThrough` and `createDummyForDeserialize`) always have an empty list. So `getGlobalVaryings().getCount() == 0` already excludes them, and the `!getFuncDecl()` half of the condition never decides anything. The doc comment presents that case as a separate category that gets skipped, which suggests a reachable path that doesn't exist. Either drop the redundant test and let the empty list carry the meaning, or, if an entry point with a null declaration can really have varyings, explain how.

Notes:
None.

### FG011: The test header ties "compiles on its own" to the wrong cause

- Status: Keep
- Confidence: Low
- Scope: Direct
- Category: comments
- Location: `tests/diagnostics/global-varying-composed-overlap.slang:1-2`
- GitHub link: https://github.com/shader-slang/slang/blob/2792441f50a6f52cc33a897df3febca13aae2b0e/tests/diagnostics/global-varying-composed-overlap.slang#L1-L2
- Overlap decision: Keep
- Overlap rationale: No other candidate covers this test.
- Scope decision: Direct
- Scope rationale: New test file.

Context:

```slang
// Every entry point owns all module-scope varyings of its module. Two vertex shaders in this module
// both write `gPos`, so each compiles on its own. A program that contains both entry points would
```

Proposed comment:

> "Two vertex shaders in this module both write `gPos`, so each compiles on its own" reads as though writing `gPos` were why each entry point compiles alone. Each compiles alone because a program with one entry point has only one owner for `gPos`, and ownership doesn't depend on use. Rewording to tie "compiles alone" to the ownership rule would also make the test's real point visible: the error appears only when both entry points are composed, whether or not either writes `gPos`.

Notes:
None.

### FG012: The W30628 call in `checkModule` has no comment of its own

- Status: Keep
- Confidence: Low
- Scope: Direct
- Category: comments
- Location: `source/slang/slang-check-decl.cpp:5804-5805`
- GitHub link: https://github.com/shader-slang/slang/blob/2792441f50a6f52cc33a897df3febca13aae2b0e/source/slang/slang-check-decl.cpp#L5804-L5805
- Overlap decision: Keep
- Overlap rationale: C008 is about the helper's definition; this candidate is about the ordering dependency at the call site.
- Scope decision: Direct
- Scope rationale: New call site.

Context:

```cpp
    // Furthermore, because a fully checked function will have checked
    // its body, this also means that all function bodies and the
    // declarations they contain should be fully checked.

    if (moduleDecl->hasModifier<HasLegacyGlobalVaryingsModifier>())
        diagnoseShaderFunctionsSharingGlobalVaryings(getSink(), moduleDecl);
```

Proposed comment:

> This call depends on ordering. `HasLegacyGlobalVaryingsModifier` is added while each varying's modifiers are checked, so it can be read only after the `ensureAllDeclsRec` loop above. The call is appended after the comment that describes that loop's postcondition and has no comment of its own. A short note saying why it runs here, and why only modules with the marker are scanned, would keep a future reordering of `checkModule` from silently disabling W30628.

Notes:
None.

## Dropped

### C009: The "Legacy" name of `HasLegacyGlobalVaryingsModifier` contradicts its use on GLSL modules

- Status: Drop
- Confidence: Medium
- Scope: Direct
- Category: terminology
- Location: `source/slang/slang-ast-modifier.h:145`
- Overlap decision: Merged into C003
- Overlap rationale: Same declaration as C003; a single combined comment is clearer.
- Scope decision: Direct
- Scope rationale: New declaration.

Proposed comment:

> "Legacy" in the name contradicts the PR's framing: `checkAndMarkGlobalVaryingVarDecl` also sets the marker on GLSL modules, where these variables are described as belonging to the dialect. The comment also names `visitImportDecl` as the only reader, but `checkModule` reads the marker too.

### FG002: `getVaryingDirectionLabel` silently falls back to "input"

- Status: Drop
- Confidence: Low
- Scope: Direct
- Category: function contract
- Location: `source/slang/slang-check-shader.cpp:40-45`
- Overlap decision: Merged into FG001
- Overlap rationale: Depends on the same "at least one direction" invariant that FG001 asks to make a property of the type.
- Scope decision: Direct
- Scope rationale: New helper.

Proposed comment:

> `getVaryingDirectionLabel` returns `"input"` when neither flag is set, while `validateSystemValueSemanticForDirections` asserts that this cannot happen. Please make the invariant consistent between the two.

### FG013: No helper for the language-version comparison

- Status: Drop
- Confidence: Low
- Scope: Direct
- Category: API shape
- Location: `source/slang/slang-check-decl.cpp:608`
- Overlap decision: Keep
- Overlap rationale: No overlap.
- Scope decision: Out-of-scope
- Scope rationale: Unsupported. Helpers exist only for 2026 and 202c (`isSlang2026OrLater`, `isSlang202cOrLater`); there is no 2025 helper to reuse.

Proposed comment:

> Consider using a shared `isSlang2025OrLater` helper here rather than comparing `getLanguageVersion()` directly.

### FG014: W38044 loop iterates `getParameters()` rather than `params`

- Status: Drop
- Confidence: Low
- Scope: Direct
- Category: control flow
- Location: `source/slang/slang-check-shader.cpp:2729`
- Overlap decision: Keep
- Overlap rationale: No overlap.
- Scope decision: Direct
- Scope rationale: Concrete lack of usefulness. Both sequences are identical, and the block comment already explains that it relies on the earlier auto-uniform classification adding `HLSLUniformModifier`.

Proposed comment:

> This loop walks `entryPointFuncDecl->getParameters()` and checks only `HLSLUniformModifier`, while the varying-type loop walks `params` and also checks `isUniformParameterType`.

### FG015: `entrypoint-validation.md` lists the walk order differently from the code

- Status: Drop
- Confidence: Low
- Scope: Direct
- Category: comments
- Location: `docs/entrypoint-validation.md:29-31`
- Overlap decision: Keep
- Overlap rationale: No overlap.
- Scope decision: Direct
- Scope rationale: Concrete lack of usefulness. The sentence lists what is validated, not the order, and nothing depends on the order.

Proposed comment:

> The doc lists parameters, then module-scope varyings, then the return type; the code validates the return type first.

## slang-reviewer verification (local, head 2792441f5, R2)

**Verdict: APPROVE_WITH_NITS.** No reviewer found a bug (A 0, B 0, C 0, me 0).
- The maintainer's answers in 6753868655 (N1–N6) are all met.
- R6 (per-entry-point validation keeps module ownership, so `-entry fsMain` on #14375's repro still fails) is an open question. The fixer has put it to tangent-vector ([6754526232](https://github.com/shader-slang/slang/issues/14375#issuecomment-6754526232)), and I agree it is partial rather than missed.
- The gaps are documentation, diagnostic placement, the definition W30628 uses, and tests.
- A tested patch (`nits-14395-r2.patch`) fixes the test items and the placeholder guard.

### Maintainer requirements, from [6753868655](https://github.com/shader-slang/slang/issues/14375#issuecomment-6753868655) (tangent-vector, MEMBER, 2026-11-09 23:05Z), checked live 2026-11-10

| # | Requirement | Status | Evidence |
|---|---|---|---|
| N1 | The strong overlap check is per program. Module checking warns for a module with global varyings and several `[shader]` functions | met | W30628 is in `checkModule` (`slang-check-decl.cpp:5804-5805`) and E38049 at program layout. |
| N2 | Core-module builtins are handled purely at IR level, with no per-module static-reference check | met | No reference check was added; the core and `glsl` modules are filtered out by `isFromCoreModule`. |
| N3 | Importing a marked module is an error | met | E38208, unchanged. A precompiled-module test is now in the patch. |
| N4 | The parameter rule applies only in a module with global varyings, to varying parameters only (uniforms allowed) | met | W38044, unchanged. |
| N5 | Module-level **warning (not error)** for at least 1 global varying plus more than 1 function declaration with `[shader]`; warning even for same-stage functions is acceptable | met | W30628. It fires for two vertex shaders (probe `two-vs.slang`, test `global-varying-composed-overlap`). See G3 for the `[numthreads]` difference. |
| N6 | Composed program: two entry points from the same module with global varyings is an **unconditional error** | met | E38049 in `generateParameterBindings` (`slang-parameter-binding.cpp:4494`). It also fires with `-no-codegen` and `-reflection-json` (probes). See G2 for duplicates. |
| R6 (fixer) | Should `-entry fsMain` on the repro still fail? | open (partial) | The fixer asked this in 6754526232. The maintainer's model (6697604956: "owns all", "checks them like parameters") implies the failure, and N5 is about the module-level `[shader]` count, not about entry-point validation. Do not take this out of draft until it is answered. |

The fixer's self-check (R1–R5 met, R6 partial) matches mine.

**R1 follow-ups:**
- The R1 patch is in (d61e863e7).
- The `inout` choice was made (both directions) and tested.
- The docs and the implicit-2025/`__include`/W38044-stage tests were added.
- Q1 was re-asked (6701407273).
- The null-name guard was added.
- **Not applied:** my R1 G1 ask #2. The PR's Risk line still doesn't name E58001/E30702 for multi-stage modules (G1 below).

### Tests (local, L40S, Release, `-DSLANG_ENABLE_DXIL=OFF`, own base build `wt-14395-base` at b85caf928)

- PR test files (14): 31/31 pass at head (1 dx11 row is ignored). On base, 9/31 pass and the 22 new rows fail.
- Full `slang-test -use-test-server -server-count 8` at head: **11697/11700** (3263 ignored). The only failures are the 3 known `fp8-cuda*` tests.
- `slang-static-unit-test` (STATIC build): **61/0**.
- Devin: 0 flags. CI run 42722687240 is gated.
- Nits patch: the PR tests plus the new ones pass 35/35. Full suite with the patch: **11701/11704**, with the same 3 fp8 failures.

### Findings

**G1 🟡 (A gap 1, C-C004, me): the user guide and the Risk line say less than the checker enforces.**
- `11-language-version.md` says legacy Slang accepts these variables "with a deprecation warning" and that "GLSL source code is unaffected". These errors and warnings ignore the language version:
  - E31401;
  - E38208, which also rejects importing a user **GLSL-dialect** module (probe `glslimp/useg2.slang`: a `.slang` file with `#version 450` and an `in` global; master compiles it, head gives E38208);
  - E38049;
  - E58001/E30702 on owned globals the entry point never uses;
  - W38044, which also fires under `-lang glsl`.
- **Several `.slang` files on one `slangc` command are one module** (probe `tu-vs.slang tu-fs.slang -entry vsMain … -entry fsMain …`). Master compiles them. Head reports E30702 for `fsMain`, which owns `tu-vs.slang`'s `gPos : SV_Position`, plus W30628.
- The PR Risk line names only HLSL/2025, imports and E38049.
- **Ask:** rewrite both doc bullets to state the ownership rule and the restrictions that apply in every version. Extend Risk to cover multi-stage modules (`-entry fsMain` and module load fail), the multi-file case, and user GLSL-module imports.

**G2 🟡 (A, C-C006, me): E38049 is reported once per target, and only when a layout is requested.**
- Probe `two-vs.slang -no-codegen`: 2 targets give 2 identical E38049 errors, and 3 targets give 3.
- Through the API, `createCompositeComponentType` succeeds, and the error appears on `getLayout()`.
- Reporting per target matches other parameter-binding diagnostics, and it makes every target's layout fail, which a once-per-sink dedup would not.
- **Ask:** pick one.
  1. Keep the check where it is. Add a one-line comment saying layout is the step that every composition path reaches, and add a two-target row that pins the count.
  2. Move it to composition (`CompositeComponentType::create` / `createUnspecializedGlobalAndEntryPointsComponentType`). That is a code change that needs another review.

**G3 🟡 (A, C-C008, me): W30628 and entry-point discovery count different functions.**
- This answers fixer check 3. `collectShaderAttributedFuncs` recurses into the same containers as `_discoverEntryPointsImpl`: namespaces, `FileDecl`s and `StructDecl`s. Both skip generic structs; the probe shows neither W30628 nor E38049 for a generic-struct member.
- Discovery also makes entry points from `[numthreads]` and `[patchconstantfunc]` functions that have no `[shader]`.
- Probe `numthreads-plus-vs.slang`: E38049 at layout, with no W30628 beforehand.
- N5 says "`[shader]`", but the maintainer also calls `[shader]` "evidence … neither necessary nor sufficient".
- **Ask:** count the same set that discovery creates, or say in the doc comment why `[shader]` alone is enough.

**G4 🟡 (A; drill-confirmed): the `CHECK-NOT: E31401` in `global-varying-include.slang` can never fail.**
- E31401 is reported before E30626, and FileCheck checks a `CHECK-NOT` only after the previous match.
- Drill: I forced E31401 for `FileDecl` parents. The PR's version of the test still passes (`r2/zz-include-orig-probe.slang`); the patched version fails.
- The test comment is also wrong: the `module` declaration already makes the file Slang 2025, so it isn't `__include` that does it.
- **The patch** turns the file into an exhaustive `DIAGNOSTIC_TEST`.

**G5 🟡 (A): new paths with no test. The patch adds all four.**
- **E38208 through a precompiled `.slang-module`:** `//TEST:COMPILE` plus a new helper, run exhaustively. Drill: with the `.slang-module` removed, the source path adds W30627, which fails the exhaustive run. So the test proves the binary path is taken.
- **The explicit `import glsl;` `SV_Position` exemption:** a new `-DUSE_IMPORT_GLSL` row in `vertex-missing-sv-position-global.slang`.
- **The `"output"` varying-type label:** `out int2x2 gIntOutMatrix` in `global-varying-entry-point-checks.slang`.
- **The #14375 repro without `-entry`:** a second FS row in `global-varying-several-entry-points.slang`, the `loadModule` path.

**Fixer check 2 — the placeholder skip (A-clarity, C-FG010, me):**
- `EntryPoint::create` is the only code that fills `m_globalVaryings`, and `createDummyForPassThrough`/`createDummyForDeserialize` never do. So `!getFuncDecl()` is never what decides to skip an entry point.
- The patch skips on the empty list and then `SLANG_ASSERT(entryPoint->getFuncDecl())`.
- Library-reference entry points (`m_extraEntryPoints`, created by `createDummyForDeserialize`) are therefore never checked by E38049. That is acceptable, because they have no AST. The patched comment says such placeholders own no varyings and are skipped.

**Questions:**
- **Q-a (A, carried over from R1 G2):** module-scope `inout` is now checked in both directions, consistently with `inout` parameters, and is tested. `lowerToIR` still marks it output only. Please record this as a stage-3 item in the #14375 plan, so that the checker and IR agree once IR reads the front-end layouts.
- **Q-b:** importing a user GLSL-dialect module with `in`/`out` globals is now E38208 (see G1). That follows from N3 as written, but the maintainer's carve-out named only "the core and GLSL modules", meaning the builtin ones. It is worth one line in the Risk section, or a question to the maintainer.

**Nits (C and A clarity; not in the patch):**
- C-C001/C002: the IR-vs-checker ownership comment and the ordering precondition on the copied list.
- C-C003: the `HasLegacyGlobalVaryingsModifier` name versus GLSL modules.
- C-C007: no rule says which diagnostics carry the ownership note.
- C-FG006: "global variable" in the varying-type messages.
- C-FG008: the namespace rationale doesn't say what would break.
- C-FG009: diagnostic codes are out of numeric order, and the note sits under the GLSL-compatibility header.
- C-FG011: the composed-overlap test header attributes "compiles on its own" to the wrong cause.
- C-FG012: the W30628 call has no comment.

**Disagreements:** none between A, B and C.

Patch: `nits-14395-r2.patch` (applies on 2792441f5 with `git am`). Probes: `runs/probe-14395/r2/`.

## Result (machine-readable)

```json
{"verdict":"APPROVE_WITH_NITS","bugs":0,"gaps":6,"questions":0,"diff_hash":"30f5df4569e63389b9797b81eba50d941a0724c3a24bf8ae4f2673c8e00d60a4","reviewers_complete":true}
```
