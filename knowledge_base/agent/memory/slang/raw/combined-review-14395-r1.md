---
type: source
description: "slang-reviewer R1 combined review of PR #14395 (stage 1 of #14375, module-scope varying ownership checker), 2026-11-07 02:35Z: APPROVE_WITH_NITS, 0 bugs / 6 gaps (Q1 regression of the #14375 vs+fs repro, inout globals lowered out-only, stale docs, untested paths). Verbatim memo; distilled into slang/14334-hull-domain-patch-location-mismatch.md."
okf_synth: exempt
---
# Combined PR Review — shader-slang/slang#14395 (pr)

## Reviewer A — Correctness (nv-slang-bot)

**Verdict**: 🔴 Has issues — 0 bugs, 6 gaps

This PR is stage 1 (the checker) of #14375. It gives each `EntryPoint` every module-scope `in`/`out` variable of its module, runs the existing parameter checks in `validateEntryPoint` over that list, and adds five diagnostics: E30626, W30627, E31401, W38044 and E38208. It also moves the "must return void" check (E58001) into the checker. The gaps are:
- `inout` globals are checked as input+output but lowered as output only.
- Module-wide ownership now makes E58001 and E30702 fire on entry points that never reference the varying, and no multi-entry test covers this.
- Two docs are stale: the language-version page and the entry-point-validation design doc.
- Some new paths have no test: the implicit Slang 2025 upgrade, `__include`, and the W38044 exemptions.

The remaining inline comments are clarity points from the clarity pass.

<details>
<summary>Changes Overview</summary>

**Ownership model** (`slang-module.h`, `slang-entry-point.h`, `slang-entry-point.cpp`, `slang-check-shader.cpp` `Module::_collectShaderParams`, `slang-check.h`)
- What changed: `_collectShaderParams` now records module-scope varyings, found by the new `isGlobalVaryingVar`, into `Module::m_globalVaryings`. It skips modules that carry `FromCoreModuleModifier`. `EntryPoint::create` copies that list. Before, nothing on the AST linked an entry point to its globals; only the IR pass found them, by reachability.

**Entry-point validation over owned varyings** (`slang-check-shader.cpp` `validateEntryPoint`)
- What changed: owned varyings now go through these checks:
  - system-value semantic validation per direction, through the new `validateSystemValueSemanticForDirections`, which the parameter loop now shares;
  - depth-output conflicts;
  - `validateVaryingType`;
  - the pedantic vertex `SV_Position` warning, with a GLSL-module exception;
  - E58001, now reported in the checker;
  - W38044 for entry points that have varying parameters and also own module-scope varyings.

**Module-level rules and import check** (`slang-check-decl.cpp`, `slang-ast-modifier.h`, `slang-diagnostics.lua`)
- What changed: `checkGlobalVaryingVarDecl` adds `HasLegacyGlobalVaryingsModifier` to the module and reports:
  - E31401 for a varying inside a namespace;
  - E30626 in HLSL and Slang 2025+;
  - W30627 in legacy Slang.

  `visitImportDecl` reports E38208 when the imported module carries the marker.

**Tests** (`tests/diagnostics/*global-varying*`, `vertex-missing-sv-position-global.slang`, `execution-model/global-varying-system-value-stage.slang`, `gh-5027.slang`, `uninitialized-globals.slang`)
- What changed: seven new or rewritten diagnostic tests. Two existing tests disable the new warnings: `gh-5027.slang` disables W30627 and `uninitialized-globals.slang` disables W38044.

</details>

<details>
<summary>Findings (6 total)</summary>

| Severity | Location | Finding |
|----------|----------|---------|
| 🟡 Gap | `source/slang/slang-check-shader.cpp:2012` | `inout` globals are validated as input+output, but `lowerToIR` gives them only `IRGlobalOutputDecoration`; untested |
| 🟡 Gap | `source/slang/slang-check-shader.cpp:2357` | Module-wide ownership makes E58001/E30702 fire on entry points that never reference the varying; no multi-entry test |
| 🟡 Gap | `source/slang/slang-check-decl.cpp:611` | `11-language-version.md` omits the new 2025+ error and still says 2025/2026 "Breaking changes avoided" |
| 🟡 Gap | `source/slang/slang-check-shader.cpp:2766` | `entrypoint-validation.md` still says validation is "strictly limited to entry-point parameters and return types" |
| 🟡 Gap | `tests/diagnostics/global-varying-language-rules.slang:5` | No test for implicit 2025 upgrade (`module`/`public`) or for a varying in an `__include`d file |
| 🟡 Gap | `tests/diagnostics/entry-point-param-with-global-varyings.slang:6` | W38044 builtin-type exemption and compute-stage behavior not pinned by any exhaustive test |

**Clarity comments (15)**

| Location | Topic |
|----------|-------|
| `slang-check-shader.cpp:2351` | "checks below apply to them too" overstates coverage |
| `slang-ast-modifier.h:143` | Marker's reader and purpose undocumented; two core/GLSL exclusion predicates |
| `slang-check-decl.cpp:601` | E31401 rationale doesn't follow; parent check re-implements `getParentDecl` |
| `slang-check-decl.cpp:18845` | Import comment and E38208 message give different reasons |
| `slang-check-shader.cpp:2695` | W38044 rule incomplete (return value, ordering, GLSL) |
| `slang-check-shader.cpp:2803` | `SV_Position` asymmetry between `out` params and globals |
| `slang-check-shader.cpp:2029` | `isInput \|\| !isOutput` handles an impossible shape silently |
| `slang-check-shader.cpp:2776` | Duplicated varying-type setup; `EntryPointParamDirections` name |
| `slang-check-decl.cpp:622` | `default: break;` hides the GLSL case |
| `slang-check-decl.cpp:1658` | "global varying" vs "module-scope varying" terminology |
| `slang-check-shader.cpp:2838` | `globalOutputsCount` is a bool; eagerly computed |
| `slang-check-shader.cpp:2451` | `collectDepthOutputSemantics` contract stale |
| `slang-check-shader.cpp:3259` | "we know we have a global shader parameter" is now wrong |
| `slang-entry-point.cpp:35` | List copied instead of derived; ordering precondition unstated |
| `slang-diagnostics.lua:4979` | W38044 headline says "declares", span says "owns" |

</details>

<sub>reviewed: 3065810ca0cb20469dd16804d13bccbc19c8e9bd · diff sha256 1f8bb4d0675f</sub>

---

### `source/slang/slang-check-shader.cpp:2012`

🟡 **Gap**: `inout` module-scope varyings are checked as input+output, lowered as output only, and not tested

`getGlobalVaryingDirections` sets `isInput` for `InOutModifier`. It sets `isOutput` through `hasModifier<OutModifier>()`, which works because `class InOutModifier : public OutModifier` (slang-ast-modifier.h:388).

IR lowering of the same global uses the `if`/`else if` chain in `slang-lower-to-ir.cpp:3237-3244`, where `else if (as<OutModifier>(mod))` matches first. The global gets only `IRGlobalOutputDecoration`, so `translateGlobalVaryingVar` never treats it as an input. The checker now validates a direction that the IR never lowers.

**Example**:
```slang
inout float gDepth : SV_Depth;
[shader("fragment")] void main() { gDepth = 0.5; }
```
- `sv_depth` has only a fragment `set` accessor (core.meta.slang:5192-5196).
- The new Input validation therefore reports "system value semantic 'SV_Depth' cannot be used as input in 'fragment' shader stage".
- Before this PR, the same file lowered `gDepth` as an output and compiled.
- None of the new tests declares an `inout` global. The both-directions path and the `"input/output"` label at line 2776 have no test.

**Suggestion**: decide what `inout` means for a global, then make the checker and lowering agree:
- To treat it as both directions, emit both decorations in `lowerToIR`.
- To treat it as output only, drop the `InOutModifier` term here.

Either way, add a diagnostic test. Also add a one-line note that `inout` reaches `isOutput` through the `InOutModifier : OutModifier` subclassing; that explains why the two lines are asymmetric.

---

### `source/slang/slang-check-shader.cpp:2357`

🟡 **Gap**: Module-wide ownership makes E58001 (and the SV-stage checks) fire on entry points that never touch the varying; multi-entry modules are untested

Before this PR, E58001 came only from `translateGlobalVaryingVar`, and only for outputs the entry point references: `if (referencingEntryPointSet->contains((IRFunc*)entryPoint))` (slang-ir-translate-global-varying-var.cpp:43-46, 274-283). This block fires for any `out` global in the module.

Legacy Slang is only *warned* about module-scope varyings (W30627). Yet a legacy module can now fail with a hard error on an entry point that is otherwise valid.

**Example**:
```slang
out float4 vColor : COLOR;
[shader("vertex")]   void vs() { vColor = float4(1); }
[shader("fragment")] float4 ps() : SV_Target { return float4(1); }
```
- `ps` now gets "entry point must return 'void' when global output variables are present", although it never references `vColor`.
- In the same kind of module, `in uint vid : SV_VertexID;` makes a fragment entry point fail with E30702.
- The only multi-entry tests on master, `geometry-shader-global-array-12169.slang` and `glsl-readonly-buffer.slang`, pass only because their globals have no output and no SV semantic. No test pins the new behavior.
- The IR-side E58001 (slang-ir-translate-global-varying-var.cpp:277) has a narrower scope than this check. User globals can no longer reach it, and nothing says how the two relate.

**Suggestion**:
- Add a two-entry-point diagnostic test that pins the intended result for `ps` above.
- List E58001 next to E30702 in the PR's risk section.
- In the `EntryPoint::getGlobalVaryings` doc comment (slang-entry-point.h:241-244), say that this is the #14375 front-end ownership model and that `translateGlobalVaryingVar` still assigns varyings by reachability until stage 3.
- If the hard break in legacy Slang is not intended, make these warnings in legacy Slang for now, matching the existing W30627/E30626 split.

---

### `source/slang/slang-check-decl.cpp:611`

🟡 **Gap**: `docs/user-guide/11-language-version.md` omits the new 2025+ rule and still says 2025/2026 "Breaking changes avoided"

This branch makes module-scope `in`/`out` an error (E30626) in Slang 2025 and 2026; legacy Slang gets a deprecation warning (W30627). The language-version page is where version-gated behavior is documented, and it is now stale:
- The version table still reads `2025 | 202a | Stable | Breaking changes avoided`, and the 2026 row says the same.
- The "Slang 2025" section lists visibility, `module`, `volatile` and `$for`, but not this rule.

Code that used to compile is now rejected under `-std 2025`, and also in files the parser upgrades implicitly (`module`, `public`, `__include`). No doc explains why.

**Suggestion**:
- Under "Slang 2025", add a bullet: module-scope `in`/`out`/`inout` variables are rejected; declare them as entry-point parameters; GLSL source is unaffected.
- Under "The Legacy Slang Language", add a deprecation note.
- Reconcile the "Breaking changes avoided" remark for 2025/2026 with this PR's `pr: breaking change` label.

---

### `source/slang/slang-check-shader.cpp:2766`

🟡 **Gap**: `docs/entrypoint-validation.md` still says varying-type validation is "strictly limited to entry-point parameters and return types"

This loop now runs `validateVaryingType` on module-scope varyings. The new test expects "type 'matrix<int,2,2>' cannot be used as input global variable 'gIntMatrix' of entry point 'main'". `docs/entrypoint-validation.md` was not updated:
- The Scope section (lines 10-13) says "The validation performed here is **strictly limited to entry-point parameters and return types**".
- The Architecture section says the pass "walks each varying parameter type and the return type".
- "Uniform vs. Varying" says "Only varying parameters are checked."
- The doc's table copies the 38050 title "Type cannot be used as entry-point varying parameter or return type", which is now incomplete too.

**Suggestion**: extend the Scope and Architecture text to cover "the module-scope varyings the entry point owns", and optionally retitle 38050/38051 to match.

---

### `tests/diagnostics/global-varying-language-rules.slang:5`

🟡 **Gap**: No test covers the implicit upgrade to Slang 2025, or a varying with a `FileDecl` parent

**Implicit upgrade:** the 2025+ runs use only explicit `-std 2025` and `-std 2026`. The PR's risk section, and the comment in `import-module-with-global-varyings-helper.slang`, say users will mostly hit E30626 through `maybeUpgradeLanguageVersionFromLegacy`: a legacy file that adds a `module` declaration, a `public`, or an `__include`. That path depends on `_getModuleLanguageVersion` reading `module->getModuleDecl()->languageVersion` (slang-check-impl.h:1080), and no test covers it.

**`FileDecl` parent:** `checkGlobalVaryingVarDecl` exempts `FileDecl` parents from E31401 (`!as<FileDecl>(parentDecl)`, slang-check-decl.cpp:601), and `_collectShaderParams` walks `FileDecl`s. No test declares a varying in an `__include`d file.

**Suggestion**: add three runs:
- `module m;` followed by `in float4 gColor;`, expecting "not supported in Slang 2025 and later";
- the same with a `public` declaration instead of `module`;
- an `__include` of a `TEST_IGNORE_FILE` helper that declares `in float4 g;`, expecting E30626 and no E31401.

---

### `tests/diagnostics/entry-point-param-with-global-varyings.slang:6`

🟡 **Gap**: No exhaustive test pins the W38044 exemption for builtin parameter types, or the compute-stage behavior

**Builtin parameter types:**
- `if (isBuiltinParameterType(param->getType())) continue;` (slang-check-shader.cpp:2701) exempts `TriangleStream<T>`, `OutputVertices`, `InputPatch` and similar types.
- The only test that reaches it is `tests/cross-compile/geometry-shader-global-array-12169.slang`, which uses non-exhaustive `TEST:SIMPLE(filecheck=...)`. Deleting the exemption would fail no test.

**Compute stage:**
- A compute `SV_DispatchThreadID` parameter is not made uniform by the auto-uniform pass, so it gets W38044 whenever its module has any `in`/`out` global.
- The PR suppresses the warning in `uninitialized-globals.slang` (`-warnings-disable 38044`) instead of asserting it.
- It also fires unseen in `tests/bugs/gh-5339.slang`: a GLSL compute shader with `layout (location = 0) in highp vec2 v_texCoord;` and `void computeMain(uint3 dispatchThreadID : SV_DispatchThreadID)`.
- Compute has no stage varyings, yet these users are told their system-value parameter "will be an error in a future compiler release".

**Suggestion**:
- Add an exhaustive geometry-stage run in the 12169 shape: a `TriangleStream` parameter plus `in` globals, no annotations, so it fails if W38044 appears.
- Add a `-lang glsl -stage compute` run that pins whichever compute behavior the open Q4 settles on.

---

### `source/slang/slang-check-shader.cpp:2351`

The comment says "...so the checks below apply to them too", which overstates what the code does. Module-scope varyings get only the checks that are wired up by hand: system-value semantics, depth outputs, varying type, the vertex `SV_Position` warning, and E58001. Other checks still walk only `entryPointFuncDecl->getParameters()`:
- `collectGenericStructTypeUses` (below) misses a `[require(...)]` on `Foo` for `in Foo<int> gX;`.
- The compute `SV_DispatchThreadID` type check (`isValidThreadDispatchIDType`, above) skips `in int2 gId : SV_DispatchThreadID;`, although it checks the same declaration as a parameter.

Could the comment name the checks that apply to module-scope varyings and say why the rest don't? Alternatively, model "the entry point's inputs and outputs" (decl plus directions) as one list that every direction-aware check walks, so "checked like parameters" holds by construction.

---

### `source/slang/slang-ast-modifier.h:143`

The comment doesn't say who reads this marker, or why it is needed alongside `Module::getGlobalVaryings()`. That list is filled for source-checked modules (slang-check.cpp:202) and for serialized modules (slang-session.cpp:2642), and `visitImportDecl` already holds the imported `Module*`. If the marker exists for the stage-2 binding step in #14375, please say so here.

Related points:
- **Hidden side effect:** the modifier is attached inside `checkGlobalVaryingVarDecl`. A "check" function mutates the enclosing `ModuleDecl`, and neither its name nor the call site in `visitVarDecl` shows that.
- **Two exclusion predicates:** the core/GLSL exclusion is written two ways: `!isFromCoreModule(decl)` (slang-check-decl.cpp:580) and `!m_moduleDecl->hasModifier<FromCoreModuleModifier>()` (slang-check-shader.cpp:3256). Both exclude the GLSL module only because `glsl.meta.slang` is compiled through `Session::addBuiltinSource` with `m_isCoreModuleCode = true`. None of the three comments mention this.
- **Ambiguous wording:** "The core and GLSL modules never carry it" here, and "empty for the core and GLSL modules" in slang-module.h, read as if user modules written in `-lang glsl` were exempt. They do get the marker, and importing one triggers E38208. "The builtin core and `glsl` modules" would be unambiguous.

---

### `source/slang/slang-check-decl.cpp:601`

The doc comment's reasoning does not follow: "Every entry point of a module owns all of the module's varyings, so a varying must be declared at the top level". Namespace-scope varyings are owned the same way:
- `Module::_collectShaderParams` walks `NamespaceDecl`s and adds namespace-scope varyings to the same `m_globalVaryings`.
- `isGlobalVaryingVar` is documented as covering "a global or namespace-scope variable".

So ownership doesn't separate top-level from namespace-scope declarations. Please state the actual reason for E31401, for example the safety rule requested in #14375.

These three lines also re-implement part of `getParentDecl`/`isGlobalDecl`, but they unwrap only one `GenericDecl` level where those helpers loop, and no test reaches the generic branch.
- `isGlobalVaryingVar` already guarantees the parent is a `NamespaceDeclBase` or a `FileDecl`.
- So the condition reduces to "the parent is a `NamespaceDecl`", which is exactly what the diagnostic says.
- `as<NamespaceDecl>(getParentDecl(decl))` would make the check obviously match its message.
- It would also remove the generic branch. If a module-scope `in`/`out` `VarDecl` can have a `GenericDecl` parent, a test should show it.

---

### `source/slang/slang-check-decl.cpp:18845`

The comment and the diagnostic give different reasons for E38208:
- The comment says the imported varyings "would belong to no entry point".
- The diagnostic says they "belong only to the entry points declared in that module".

When the imported module declares its own `[shader(...)]` entry points, its varyings do belong to them, so the comment is false in that case. The actual rule seems to be that code in the importing module could read or write varyings from entry points that don't own them. Could both places state that rule precisely, and say whether a module with varyings but no entry points is covered by the same reasoning?

---

### `source/slang/slang-check-shader.cpp:2695`

From this block alone, it is unclear which entry-point inputs and outputs count as "mixing" the two styles:
- **Return value:** a non-void return value is also an HLSL-style output, but it isn't diagnosed. `entry-point-param-with-global-varyings.slang` has `in float4 gColor;` with `float4 main(...) : SV_Position` and expects no warning on the return. Is that exemption intended, and why?
- **Ordering:** the `HLSLUniformModifier` skip depends on the auto-uniform loop above having already marked resource-typed parameters as uniform (`Texture2D texture` in the test). The varying-type loop below states the same ordering dependency; this block doesn't.
- **GLSL source:** the warning also fires for GLSL, where module-scope varyings are the native style. That is why `uninitialized-globals.slang` now needs `-warnings-disable 38044`.

Whatever the answer to the open Q4, this comment should state the final rule.

---

### `source/slang/slang-check-shader.cpp:2803`

"In a module that imports the GLSL module it only supplies SV_Position" is hard to parse. I read it as: a module-scope output can satisfy the `SV_Position` requirement, but doesn't on its own make the entry point count as having outputs. If that's right, please say it that directly.

The stated reason, that the entry point may write `gl_Position` instead, applies just as well to `out` parameters in the same module. Yet the parameter loop above still sets `hasOutputs = true` unconditionally. So `void main(out vec4 color : COLOR) { gl_Position = ...; }` in a GLSL module still warns. If the asymmetry is intended, the comment should explain why parameters and module-scope outputs differ.

---

### `source/slang/slang-check-shader.cpp:2029`

The doc comment says the semantic is validated "once for each direction in `directions`", but the `|| !directions.isOutput` clause also validates it as an input when `directions` is empty. Neither producer can return an empty value:
- `checkEntryPointParamPassingMode` sets at least one flag on every `case`.
- `getGlobalVaryingDirections` is only called on declarations where `isGlobalVaryingVar` holds.

The clause carries over the old `else` default and silently treats an impossible shape as an input. Asserting `directions.isInput || directions.isOutput`, then validating exactly the directions present, would make the helper match its comment.

---

### `source/slang/slang-check-shader.cpp:2776`

This block repeats the parameter loop just above it line for line, including the nested ternary that maps `EntryPointParamDirections` to `"input"`/`"output"`/`"input/output"`. Only the location and the context string differ. Extracting a named helper, at least for the direction label, would keep the two loops in sync.

Relatedly, `EntryPointParamDirections` now also describes module-scope varyings, but it has no comment and its name still says "param". A rename (e.g. `EntryPointVaryingDirections`) or a one-line comment on the type would keep the name accurate.

---

### `source/slang/slang-check-decl.cpp:622`

The intended rule has three cases:
- GLSL accepts module-scope varyings silently.
- Legacy Slang warns.
- HLSL and Slang 2025+ report an error.

Only two of them appear as `case` arms. GLSL, the dialect this feature exists for, falls into `default:` along with every other `SourceLanguage` value, including `Unknown`. An explicit `case SourceLanguage::GLSL:` noting that it is the native dialect would make the rule visible. Then `default:` can either assert, or explain which other languages reach this point and why accepting them is correct.

---

### `source/slang/slang-check-decl.cpp:1658`

The PR uses one concept under several names:
- Identifiers say "global varying": `isGlobalVaryingVar`, `getGlobalVaryings`, `HasLegacyGlobalVaryingsModifier`, and the `global-varying-*` diagnostic ids.
- Comments and messages say "module-scope varying".
- `validateVaryingType` reports "global variable '…'", and the existing E58001 says "global output variables".

"Module scope" also means two things. Here it includes namespace scope ("a global or namespace-scope variable"), but `global-varying-not-at-module-scope` treats namespace scope as *not* module scope. That produces the message "module-scope varying '…' must be declared at the top level of its module". Please pick one term, define it once, and use a different word (e.g. "top level") for "directly in the module, not in a namespace".

---

### `source/slang/slang-check-shader.cpp:2838`

`globalOutputsCount` reads as a number, but it is a predicate meaning "module-scope outputs count as outputs for this check". At the use site, `if (globalOutputsCount) hasOutputs = true;` reads as "if there are any global outputs". A propositional name such as `doGlobalOutputsCountAsOutputs` would read correctly.

The value is also computed for every vertex entry point that lacks `SV_Position`, even when `globalVaryings` is empty, and computing it walks the transitive dependency list. Computing it only after finding the first module-scope output would avoid that.

---

### `source/slang/slang-check-shader.cpp:2451`

`collectDepthOutputSemantics` documents its `decl` as "an `out`/`inout` parameter or the entry-point function itself" (slang-check-shader.cpp:643-644). This call passes a module-scope `out` variable. It works because the function dispatches on `as<VarDeclBase>`, but please update that documented contract to include module-scope outputs.

---

### `source/slang/slang-check-shader.cpp:3259`

With `isGlobalVarying` now spelled out just above, the comment "At this point we know we have a global shader parameter" is visibly wrong for varyings. `isGlobalShaderParameter` returns `false` for `in`/`out` globals, yet they continue into `m_shaderParams`. Please say here that module-scope varyings are also recorded as shader parameters, and why (presumably for the existing global-scope layout and reflection). Then a reader knows each varying is meant to appear in both `m_shaderParams` and `m_globalVaryings`.

---

### `source/slang/slang-entry-point.cpp:35`

The documented contract is that an entry point owns exactly its module's varyings. Why, then, does `EntryPoint` keep its own copy instead of returning `getModule()->getGlobalVaryings()`?

The snapshot also adds an unstated ordering precondition: `Module::_collectShaderParams` must run before `EntryPoint::create`, or the entry point silently owns nothing. Both current callers satisfy it (slang-check.cpp:202; slang-session.cpp:2642, before 2654). The line above has a comment explaining its seed value; this one has none.

Please either derive the list from the module, or say why a snapshot is wanted (for example, a later stage widens ownership to transitive dependencies) and note the ordering requirement.

---

### `source/slang/slang-diagnostics.lua:4979`

The headline says the entry point "declares … module-scope varyings". An entry point doesn't declare them: the module does, and the entry point owns them. The span message already gets this right ("an entry point that also owns module-scope varyings"). Please match the headline to it, e.g. "entry point has varying parameters and also owns module-scope varyings". Otherwise, a user whose function never mentions the varying is told the function declared it.

## Reviewer B — Devin Review

# Devin Review

## AI Analysis

Module-scope in/out variables now belong to every entry point of their module and are validated like parameters. Imports of such modules are rejected, and HLSL and Slang 2025+ reject the varyings outright.

Record each module's global varyings and hand them to every entry point it declares.
Run the existing system-value, return-type, varying-type, and SV_Position checks over those varyings.
Add five diagnostics covering language rules, placement, mixing with parameters, and imports.
Show less

Summary: Stage 1 (checker) of #14375, per maintainer comment 6697604956. Each EntryPoint owns every module-scope in/out variable of its module, with no call-graph walk, and validateEntryPoint checks them like parameters. Five new diagnostics; layout and IR are unchanged.

Root cause: validateEntryPoint (slang-check-shader.cpp:2285 at base) built its input/output list from function parameters only.

Tests: 7 new or rewritten diagnostic tests; gh-5027 and uninitialized-globals disable the new warnings. Debug suite at head: 11906/11909 (the 3 known fp8 CUDA INVALID_PTX failures).

Risk: HLSL and Slang 2025+ (module/public/__include) files with global varyings now error, as do imports of them.

Open question (blocks merge): the scope of W38044, Q4 in #14375 — details in the explanation comment.

Part of #14375. Related: #14335, #13892.

🤖 Generated by an automated Slang coworker — may be inaccurate. A human maintainer should verify.

Show less
600 lines left
1
Record module-scope varyings on modules and entry points
0/5
2
Check and diagnose module-scope varyings during declaration checking
0/2
3
Apply entry-point signature checks to module-scope varyings
0/1
4
Update existing tests and add new diagnostic tests
0/10
Other Changes
0/2
End of changes
Chat about this PR
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

# PR 14395 Clarity Review Workflow

## PR Summary

**Title:** Check module-scope varyings against the entry points of their module. Head `3065810ca0cb`, +533/−67, 18 files.

**What the description says:** This is stage 1 (checker only) of #14375. Each `EntryPoint` owns every module-scope `in`/`out` variable of its module, with no call-graph walk, and `validateEntryPoint` checks those variables like parameters. There are five new diagnostics, and layout and IR are unchanged. HLSL and Slang 2025+ files with global varyings now fail to compile, and so do imports of such files. The scope of W38044 is an open question that blocks merge.

**What the diff does:** The diff matches the description.
- `Module::_collectShaderParams` records `m_globalVaryings` for non-core modules, and `EntryPoint::create` copies that list.
- `SemanticsDeclModifiersVisitor::visitVarDecl` calls the new `checkGlobalVaryingVarDecl`. It marks the module with `HasLegacyGlobalVaryingsModifier` and emits E31401 (namespace), E30626 (HLSL / Slang 2025+) or W30627 (legacy Slang).
- `visitImportDecl` emits E38208 for an import of a marked module.
- `validateEntryPoint` applies these checks to the owned varyings: system-value semantics (through the new shared `validateSystemValueSemanticForDirections`), depth-output conflicts, varying types, the vertex `SV_Position` warning (with a GLSL-module exception), a checker-side E58001 (non-`void` return with global outputs), and the new W38044 (varying parameters mixed with owned globals).
- There are seven new or rewritten diagnostic tests. Two existing tests disable the new warnings.

**Mismatches and observations:**
- The description doesn't use the five-part format that CLAUDE.md asks for. The key rationale is in the bot's explanation comment instead: the IR E58001 check "stays as a backstop", ownership is checker-only until stages 2 and 3, the language rules run per declaration because the source language is known only during translation-unit checking, and the maintainer requirements M1, M4 and M6 drive the design. Most of it isn't in code comments, which is the root of several candidates below.

**Value proposition:** Front-end checks now cover GLSL-style module-scope varyings, which until now only the IR pass looked at (and only through reachability). This sets up the module-membership ownership model that later stages will use for layout and IR.

## Review Body

> Claude Opus 5.5-authored clarity review:
>
> This is a medium-sized, well-scoped stage-1 change, and it does what the title says. `validateEntryPoint` now checks module-scope varyings like parameters, and the module-level rules each get a diagnostic. The mechanics are easy to follow. Extracting `validateSystemValueSemanticForDirections` is a real cleanup, and each new test opens with a comment saying what it expects. The code is close to merge-ready. The remaining gap is mostly the *why*. Much of the rationale is in the explanation comment and the linked design discussion rather than in the source, and a few of the in-code justifications don't hold up when read on their own.
>
> ## Main concerns
>
> - **The ownership model and how far it reaches.** "An entry point owns every module-scope varying of its module" is stated in four places. None of them says the rule is checker-only for now, while `translateGlobalVaryingVar` still assigns globals by reachability. As a result, the checker and the IR pass now apply different rules, and E58001 is diagnosed at two sites under different ownership definitions.
> - **Rationales that don't follow.** The namespace rule is derived from ownership, but ownership doesn't imply it. The import rule's comment says imported varyings "would belong to no entry point", while the diagnostic it emits says they belong to the imported module's entry points.
> - **Two representations of one fact.** `HasLegacyGlobalVaryingsModifier` and `Module::getGlobalVaryings()` both record "this module declares varyings", and their core-module filters are spelled differently.
> - **The vertex `SV_Position` exception for GLSL.** The comment is hard to parse, `globalOutputsCount` reads as a count, and nothing explains why "depends on the GLSL module" is the right condition.
> - **Terminology.** "Module-scope", "global", "legacy global" and "top level" are all used for one concept. The E31401 wording also contradicts the definition in `isGlobalVaryingVar`.
>
> The remaining comments are local: contract-vs-condition mismatches, an unstated ordering dependency, and two places that define "varying parameter" differently. Several of them would be resolved by moving rationale from the explanation comment into code comments.

## Kept

### C001: The ownership model is stated in pieces and overclaims its current reach

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: invariant
- Location: `source/slang/slang-entry-point.h:241-245`
- GitHub link: https://github.com/shader-slang/slang/blob/3065810ca0cb20469dd16804d13bccbc19c8e9bd/source/slang/slang-entry-point.h#L241-L245
- Overlap decision: Keep
- Overlap rationale: FG007 and FG012 touch related ownership details (the duplicated E58001 site, and the copy at creation), but this candidate is the only one about the model as a whole and how far it reaches.
- Scope decision: Direct
- Scope rationale: The accessor and its doc comment are new in this PR, and they introduce the ownership model.

Context:

```cpp
/// Get the module-scope varyings that belong to this entry point, in declaration order. They
/// are inputs and outputs of the entry point just as its varying parameters are. An entry
/// point owns every module-scope varying declared in the module of its function, whether or
/// not the function uses it.
List<VarDeclBase*> const& getGlobalVaryings() { return m_globalVaryings; }
```

Proposed comment:

> The ownership rule ("an entry point owns every module-scope varying of its module, whether or not it uses it") is now spread across this accessor, `Module::getGlobalVaryings`, `checkGlobalVaryingVarDecl`, and the comment in `visitImportDecl`, and none of them says how far the rule reaches today. "They are inputs and outputs of the entry point just as its varying parameters are" reads as if layout and IR use this list too. In this PR only `validateEntryPoint` reads it. `translateGlobalVaryingVar` still assigns globals to entry points by IR reachability (`referencingEntryPoints`), so the checker and the IR pass can now disagree. Consider a module with a vertex and a fragment entry point: the checker now checks the fragment's `in` globals as vertex inputs, while IR gives the vertex shader only the globals it reaches. Could one place (this declaration is a natural home) define the model, say that only the checker uses it so far, and point at the reachability-based IR pass? Then a maintainer can tell the intended end state from transitional behavior.

Notes:
The PR description says "layout and IR are unchanged" and the bot's explanation comment describes stages 2 and 3, but none of that context is in the code. Confirmed with `slang-ir-translate-global-varying-var.cpp:43-53`, which filters by `referencingEntryPoints`.

### C002: The top-level-only rule is justified by a non sequitur

- Status: Keep
- Confidence: High
- Scope: Direct
- Category: comments
- Location: `source/slang/slang-check-decl.cpp:587-591`
- GitHub link: https://github.com/shader-slang/slang/blob/3065810ca0cb20469dd16804d13bccbc19c8e9bd/source/slang/slang-check-decl.cpp#L587-L591
- Overlap decision: Keep
- Overlap rationale: FG004 is about the code that implements this rule and FG006 about the E31401 wording; this candidate is about the rule's stated rationale.
- Scope decision: Direct
- Scope rationale: The doc comment and the rule it justifies are new in this PR.

Context:

```cpp
/// Module-scope varyings are a GLSL idiom: Slang and HLSL entry points declare their inputs and
/// outputs as parameters. We therefore reject them in HLSL and in Slang 2025 and later, and
/// warn about them in legacy Slang. Every entry point of a module owns all of the module's
/// varyings, so a varying must be declared at the top level of the module rather than inside
/// a namespace.
```

Proposed comment:

> The last sentence derives the top-level-only rule from ownership ("Every entry point of a module owns all of the module's varyings, so a varying must be declared at the top level"), but the "so" doesn't follow. `_collectShaderParams` walks `NamespaceDecl`s, so a namespace-scope varying already ends up in `Module::getGlobalVaryings()` and is owned like any other. A reader can't tell what actually goes wrong for a namespaced varying: name mangling, binding or layout in a later stage, interface matching, or a policy decision from the design discussion. The rule is a hard error in every language, GLSL included, so could the comment state the real reason, ideally with a short example of what would break?

Notes:
Verified that `Module::_collectShaderParams` (`slang-check-shader.cpp`, base 3202-3205) adds `NamespaceDecl`s to its work list. The explanation comment lists this as maintainer requirement "M4", but the code comment gives no reason.

### C003: The import-rejection rationale contradicts the diagnostic it guards

- Status: Revise
- Confidence: Medium
- Scope: Direct
- Category: invariant
- Location: `source/slang/slang-check-decl.cpp:18844-18845`
- GitHub link: https://github.com/shader-slang/slang/blob/3065810ca0cb20469dd16804d13bccbc19c8e9bd/source/slang/slang-check-decl.cpp#L18844-L18845
- Overlap decision: Keep
- Overlap rationale: C004 is about the marker this check reads, not about the rationale for the rule.
- Scope decision: Direct
- Scope rationale: The comment, the check and the diagnostic are all new in this PR.

Context:

```cpp
// An entry point owns the module-scope varyings of its own module only, so the varyings of an
// imported module would belong to no entry point.
if (importedModuleDecl->hasModifier<HasLegacyGlobalVaryingsModifier>())
{
    getSink()->diagnose(Diagnostics::ImportedModuleHasGlobalVaryings{
```

Proposed comment:

> This comment says an imported module's varyings "would belong to no entry point", but the diagnostic it emits says they "belong only to the entry points declared in that module". Those are two different models. If the imported module has its own `[shader]` entry points, it's the second one. The real hazard seems to be that entry points in the *importing* module can reference varyings they don't own, as `return gHelperColor;` does in the new test. Could the comment state the invariant being protected, and why that justifies rejecting the whole `import`, even when the importer never references the varyings, rather than rejecting the uses? The header of `import-module-with-global-varyings.slang` repeats the "belong to no entry point" wording, so it would need the same fix.

Notes:
Revised during the coverage audit to mention the test header, which uses the same wording. Diagnostic text in `slang-diagnostics.lua` 38208: "module '~module:Name' declares module-scope 'in'/'out' variables, which belong only to the entry points declared in that module".

### C004: Two sources of truth for "this module declares module-scope varyings"

- Status: Revise
- Confidence: Medium
- Scope: Direct
- Category: API shape
- Location: `source/slang/slang-ast-modifier.h:140-143`
- GitHub link: https://github.com/shader-slang/slang/blob/3065810ca0cb20469dd16804d13bccbc19c8e9bd/source/slang/slang-ast-modifier.h#L140-L143
- Overlap decision: Keep
- Overlap rationale: The naming part ("legacy") is left to FG006; this candidate is only about having two representations.
- Scope decision: Direct
- Scope rationale: The modifier, the module list, and both filters that compute them are new in this PR.
- Judgment decision: Revise
- Judgment rationale: The explanation comment shows a marker was requested (maintainer requirement M6), so the comment shouldn't imply the marker is unwanted. The undocumented relationship to `Module::getGlobalVaryings()` and the two different spellings of the core-module exclusion are still real clarity gaps. Verified that `_collectShaderParams` runs before an imported module is used, on both the source path (`slang-check.cpp:200-202`) and the binary path (`slang-session.cpp:2642`).

Context:

```cpp
// Marks a module that declares legacy GLSL-style module-scope varyings (see
// `isGlobalVaryingVar`). The core and GLSL modules never carry it.
FIDDLE()
class HasLegacyGlobalVaryingsModifier : public Modifier
```

Proposed comment:

> This marker and `Module::getGlobalVaryings()` record the same fact, "this module declares module-scope varyings". They're computed in two places, with two spellings of the core-module exclusion: `isFromCoreModule(decl)` in `SemanticsDeclModifiersVisitor::visitVarDecl`, and `m_moduleDecl->hasModifier<FromCoreModuleModifier>()` in `_collectShaderParams`. The comment here says what the marker means but not why it exists alongside the list, or which of the two is authoritative. Its only reader, `visitImportDecl`, already holds the imported `Module*`, whose list is populated by then. If the marker is meant to be the durable, serialized record that importers check, please say so here and describe how the list relates to it. Ideally both would use the same core-module test, so a reader doesn't have to confirm by hand that the two can't disagree.

Notes:
Original raw text suggested the importer could read the list directly. Softened because the design discussion asks for a marker.

### C005: The vertex `SV_Position` exception for GLSL modules is hard to follow and its condition is unjustified

- Status: Revise
- Confidence: Medium
- Scope: Direct
- Category: comments
- Location: `source/slang/slang-check-shader.cpp:2799-2806`
- GitHub link: https://github.com/shader-slang/slang/blob/3065810ca0cb20469dd16804d13bccbc19c8e9bd/source/slang/slang-check-shader.cpp#L2799-L2806
- Overlap decision: Keep
- Overlap rationale: FG015's note on transitivity is merged in here. FG001 stays separate because it is a local naming problem.
- Scope decision: Direct
- Scope rationale: The comment, the GLSL-module helper, and the module-scope output loop are all new in this PR.

Context:

```cpp
// We deliberately skip the check when the entry point has no outputs
// at all: a void return type, no `out`/`inout` parameters, and no
// module-scope outputs. A module-scope output counts here like an
// output parameter, except that in a module that imports the GLSL
// module it only supplies SV_Position: GLSL-style entry points write
// the builtin `gl_Position`, which is not one of the entry point's
// module-scope varyings, so module-scope outputs alone cannot show
// that SV_Position is missing.
```

Proposed comment:

> `doesModuleDependOnGLSLModule` stands in for "this entry point may write `gl_Position`", but neither the helper nor this comment says why depending on the GLSL module is the right test for that. The helper's "directly or through the modules it imports" is also true only because `getModuleDependencyList()` is already transitive, which the one-level loop doesn't show. The key clause, "in a module that imports the GLSL module it only supplies SV_Position", is hard to parse. It seems to mean that in such a module a module-scope output can satisfy the SV_Position requirement but doesn't by itself make the entry point count as having outputs. Stating that two-way case split in plain terms, along with why a dependency on the GLSL module is the right condition for it, would let a reader check the four configurations in `vertex-missing-sv-position-global.slang` against the code. As written, a legacy Slang vertex shader whose outputs are all module-scope, and that transitively imports any module that imports `glsl`, silently loses the warning, and nothing says whether that's intended.

Notes:
Merged FG015 (transitivity of the dependency list).

### FG001: `globalOutputsCount` reads as a count, not a predicate

- Status: Keep
- Confidence: High
- Scope: Direct
- Category: naming
- Location: `source/slang/slang-check-shader.cpp:2838`
- GitHub link: https://github.com/shader-slang/slang/blob/3065810ca0cb20469dd16804d13bccbc19c8e9bd/source/slang/slang-check-shader.cpp#L2838
- Overlap decision: Keep
- Overlap rationale: C005 is about why the condition is right; this candidate is about the name of the local that stores it.
- Scope decision: Direct
- Scope rationale: The local variable is new in this PR.

Context:

```cpp
const bool globalOutputsCount = !doesModuleDependOnGLSLModule(linkage, module);
...
    if (globalOutputsCount)
        hasOutputs = true;
```

Proposed comment:

> `globalOutputsCount` reads like the number of global outputs, but it's a `bool` meaning "module-scope outputs count toward `hasOutputs`". At the use site, `if (globalOutputsCount) hasOutputs = true;` reads as "if there are any global outputs", which is a different condition. A predicate name would remove the misreading, e.g. one phrased as "global outputs count as outputs", or one named after the GLSL condition itself.

Notes:
None.

### FG007: The void-return rule has no rationale and duplicates the IR diagnosis

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: comments
- Location: `source/slang/slang-check-shader.cpp:2350-2368`
- GitHub link: https://github.com/shader-slang/slang/blob/3065810ca0cb20469dd16804d13bccbc19c8e9bd/source/slang/slang-check-shader.cpp#L2350-L2368
- Overlap decision: Keep
- Overlap rationale: C001 is about the ownership model in general; this candidate is about one specific rule and its duplicated diagnosis site.
- Scope decision: Direct
- Scope rationale: The comment and the checker-side E58001 check are new in this PR.

Context:

```cpp
// The module-scope varyings that the entry point owns are inputs and outputs of the entry point
// just as its parameters are, so the checks below apply to them too.
...
if (returnType && !returnType->equals(linkage->getASTBuilder()->getVoidType()))
{
    for (auto directions : globalVaryingDirections)
    {
        if (directions.isOutput)
        {
            sink->diagnose(Diagnostics::EntryPointMustReturnVoidWhenGlobalOutputPresent{
```

Proposed comment:

> The comment says the owned varyings "are inputs and outputs of the entry point just as its parameters are, so the checks below apply to them too". The check right after it, though, applies *only* to module-scope outputs: a non-`void` return is rejected when any owned varying is an output. Nothing here says why. A reader has to know that `translateGlobalVaryingVar` repackages global outputs into the entry point's return value. It also isn't stated that the IR pass still emits the same E58001 under a different ownership rule (reachability rather than module membership), now as a backstop. Please give this rule its own one-line reason and say which diagnosis site is authoritative. Minor: the inline `for`/`if`/`break` computes "owns some module-scope output", and a named boolean would read better. The vertex `SV_Position` block could reuse it too. Separately, this function now tests for `void` in two different ways: `equals(getVoidType())` here and `BaseType::Void` in the vertex block.

Notes:
IR site: `slang-ir-translate-global-varying-var.cpp:276-283`. The explanation comment says "the IR check stays as a backstop"; the code doesn't.

### FG008: Two different definitions of "varying parameter" in `validateEntryPoint`

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: invariant
- Location: `source/slang/slang-check-shader.cpp:2692-2702`
- GitHub link: https://github.com/shader-slang/slang/blob/3065810ca0cb20469dd16804d13bccbc19c8e9bd/source/slang/slang-check-shader.cpp#L2692-L2702
- Overlap decision: Keep
- Overlap rationale: No other candidate covers the W38044 parameter predicate.
- Scope decision: Direct
- Scope rationale: The W38044 block and its comment are new in this PR.

Context:

```cpp
// An entry point that owns module-scope varyings passes its inputs and outputs the GLSL way,
// so a varying parameter mixes two ways of declaring them. Uniform parameters and builtin
// parameter types such as `TriangleStream<T>` have no module-scope equivalent and are allowed.
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

> This block defines a varying parameter as "not `HLSLUniformModifier` and not `isBuiltinParameterType`", while the varying-type loop just below uses "not `HLSLUniformModifier` and not `isUniformParameterType`". The new test's `Texture2D texture` parameter passes here only because the auto-uniform loop above already added `HLSLUniformModifier` to it, and the comment doesn't mention that ordering dependency: it names only uniform parameters and `TriangleStream<T>`. Could the comment say that resource parameters are covered because the classification above has already made them uniform? Better, could both checks share one named predicate for "parameter passed as a varying", so the two sets can't drift apart? Minor: the note always names `globalVaryings[0]`. That's fine, but a word saying the note just points at one example varying would help.

Notes:
The auto-uniform loop is at base `slang-check-shader.cpp:2593-2601`.

### FG004: Hand-rolled generic-parent unwrap duplicates `getParentDecl`, and the condition is phrased negatively

- Status: Keep
- Confidence: High
- Scope: Direct
- Category: control flow
- Location: `source/slang/slang-check-decl.cpp:598-602`
- GitHub link: https://github.com/shader-slang/slang/blob/3065810ca0cb20469dd16804d13bccbc19c8e9bd/source/slang/slang-check-decl.cpp#L598-L602
- Overlap decision: Keep
- Overlap rationale: C002 is about why the rule exists; this candidate is about how it is implemented.
- Scope decision: Direct
- Scope rationale: These lines are new in this PR.

Context:

```cpp
auto parentDecl = decl->parentDecl;
if (auto genericParentDecl = as<GenericDecl>(parentDecl))
    parentDecl = genericParentDecl->parentDecl;
if (!as<ModuleDecl>(parentDecl) && !as<FileDecl>(parentDecl))
    getSink()->diagnose(Diagnostics::GlobalVaryingNotAtModuleScope{.decl = decl});
```

Proposed comment:

> These lines re-implement `getParentDecl` (`slang-syntax.cpp`), which skips *every* enclosing `GenericDecl`, but they skip only one level (`if` rather than `while`). `isGlobalDecl`, which `isGlobalVaryingVar` already used to admit this decl, uses `while`. A reader can't tell whether single-level unwrapping is deliberate. The negative test also hides the case being diagnosed. Since `isGlobalDecl` has already passed, the parent must be a `NamespaceDeclBase` or a `FileDecl`, so this fires exactly when the parent is a `NamespaceDecl`. Writing that directly (e.g. `as<NamespaceDecl>(getParentDecl(decl))`) would match the diagnostic text ("declared inside a namespace") and remove the question of when a varying even has a `GenericDecl` parent.

Notes:
`isGlobalDecl` is at base `slang-check-decl.cpp:1597-1605`. `getParentDecl` is at `slang-syntax.cpp:1239-1245`.

### FG006: One concept, several names: "module-scope", "global", "legacy global", "top level"

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: terminology
- Location: `source/slang/slang-check-decl.cpp:1658-1659`
- GitHub link: https://github.com/shader-slang/slang/blob/3065810ca0cb20469dd16804d13bccbc19c8e9bd/source/slang/slang-check-decl.cpp#L1658-L1659
- Overlap decision: Keep
- Overlap rationale: This candidate also covers the "legacy" naming from C004 and the "global variable" context string from FG009; FG013 is a separate verb choice in one diagnostic.
- Scope decision: Direct
- Scope rationale: The definition, the names and the diagnostic wording are all introduced by this PR.

Context:

```cpp
/// Is `decl` a module-scope varying, that is, a global or namespace-scope variable declared `in`,
/// `out` or `inout`?
```

Proposed comment:

> This doc defines "module-scope varying" to include namespace-scope variables. E31401 then tells users that a "module-scope varying ... must be declared at the top level of its module", which reads as a contradiction. The PR also uses three more names for the concept: `isGlobalVaryingVar` / `getGlobalVaryings` ("global"), `HasLegacyGlobalVaryingsModifier` ("legacy", an odd qualifier in GLSL sources, where these are the normal idiom), and the varying-type context `"global variable 'x'"`. Could the PR choose one term, define it once, and keep "top level of the module" visibly distinct from it? Code names can reasonably stay "global varying" to match `translateGlobalVaryingVar`, as long as the definition says that's the same thing.

Notes:
Pre-existing E58001 also says "global output variables".

### FG003: `validateSystemValueSemanticForDirections` doc doesn't match its fallback

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: function contract
- Location: `source/slang/slang-check-shader.cpp:2029`
- GitHub link: https://github.com/shader-slang/slang/blob/3065810ca0cb20469dd16804d13bccbc19c8e9bd/source/slang/slang-check-shader.cpp#L2029
- Overlap decision: Keep
- Overlap rationale: No other candidate covers this helper.
- Scope decision: Direct
- Scope rationale: The helper and its doc comment are new in this PR. The fallback was pre-existing inline code, but the PR turned it into a helper with a stated contract.

Context:

```cpp
/// Validates the system-value semantic of an entry-point input or output `decl` (a parameter or a
/// module-scope varying) for `stage`, once for each direction in `directions`.
...
    if (directions.isInput || !directions.isOutput)
```

Proposed comment:

> The doc says "once for each direction in `directions`", but `directions.isInput || !directions.isOutput` also validates as an input when *neither* direction is set. The old inline code had the same fallback in its trailing `else`, so the behavior isn't new. Now that it's a named helper with a stated contract, though, the `!directions.isOutput` arm needs an explanation. Can an empty `EntryPointParamDirections` reach this helper? `checkEntryPointParamPassingMode` sets at least one direction for every mode it doesn't treat as unexpected, and `isGlobalVaryingVar` requires `in` or `out`. If the empty case can't happen, an assertion plus `if (directions.isInput)` would match the doc. If it can, the doc should say an empty set is treated as an input, and why.

Notes:
None.

### FG002: `inout` handling relies on unstated subclassing and has no test

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: function contract
- Location: `source/slang/slang-check-shader.cpp:2012-2014`
- GitHub link: https://github.com/shader-slang/slang/blob/3065810ca0cb20469dd16804d13bccbc19c8e9bd/source/slang/slang-check-shader.cpp#L2012-L2014
- Overlap decision: Keep
- Overlap rationale: No other candidate covers the direction derivation for module-scope varyings.
- Scope decision: Direct
- Scope rationale: `getGlobalVaryingDirections` is new in this PR.

Context:

```cpp
directions.isInput =
    globalVarying->hasModifier<InModifier>() || globalVarying->hasModifier<InOutModifier>();
directions.isOutput = globalVarying->hasModifier<OutModifier>();
```

Proposed comment:

> The input test names `InOutModifier` explicitly, but the output test depends on `InOutModifier` deriving from `OutModifier`. To confirm the doc comment's "an `inout` variable both", a reader has to look up the modifier hierarchy. `isGlobalVaryingVar` depends on the same subclassing for its "`in`, `out` or `inout`" claim. Please make the `inout` case visibly symmetric, or say once that `InOutModifier` is an `OutModifier`. Separately, none of the new tests declares a module-scope `inout`, so the "both directions" path (system-value validation in both directions, the `"input/output"` varying-type label) has no coverage.

Notes:
Confirmed `class InOutModifier : public OutModifier` in `slang-ast-modifier.h`.

### FG011: `_collectShaderParams` comments now contradict the rewritten condition

- Status: Keep
- Confidence: Medium
- Scope: Contextual
- Category: comments
- Location: `source/slang/slang-check-shader.cpp:3249-3251`
- GitHub link: https://github.com/shader-slang/slang/blob/3065810ca0cb20469dd16804d13bccbc19c8e9bd/source/slang/slang-check-shader.cpp#L3249-L3251
- Overlap decision: Keep
- Overlap rationale: No other candidate covers `_collectShaderParams`.
- Scope decision: Contextual
- Scope rationale: The surrounding comments predate the PR, but the PR rewrote the condition between them and added the varying-specific branch, which makes the stale comments directly misleading.

Context:

```cpp
// We do not want to consider global variable declarations
// that don't represents shader parameters. This includes
// things like `static` globals and `groupshared` variables.
//
const bool isGlobalVarying = isGlobalVaryingVar(globalVar);
if (!isGlobalShaderParameter(globalVar) && !isGlobalVarying)
    continue;
...
// At this point we know we have a global shader parameter.
```

Proposed comment:

> The rewritten condition now makes explicit that varyings, which `isGlobalShaderParameter` rejects, also continue past this point. The surrounding comments still say the opposite: "We do not want to consider global variable declarations that don't represent shader parameters" above, and "At this point we know we have a global shader parameter" below. As a result, module-scope varyings now go into both `m_globalVaryings` and `m_shaderParams`, and nothing here says why a varying is also recorded as a shader parameter. This PR made the condition explicit and added the varying branch between it and that comment, so please update the comments to say what `m_shaderParams` is expected to hold for varyings.

Notes:
`isGlobalShaderParameter` returns false for `in`/`out` (base `slang-check-decl.cpp:1640-1645`).

### FG005: The language `switch` leaves GLSL and other languages to a silent `default`

- Status: Keep
- Confidence: Low
- Scope: Direct
- Category: control flow
- Location: `source/slang/slang-check-decl.cpp:622-623`
- GitHub link: https://github.com/shader-slang/slang/blob/3065810ca0cb20469dd16804d13bccbc19c8e9bd/source/slang/slang-check-decl.cpp#L622-L623
- Overlap decision: Keep
- Overlap rationale: C002 is about the namespace rule in the same function; this candidate is about the language case analysis.
- Scope decision: Direct
- Scope rationale: The `switch` is new in this PR.

Context:

```cpp
switch (getSourceLanguage())
{
case SourceLanguage::HLSL:
    ...
case SourceLanguage::Slang:
    ...
default:
    break;
}
```

Proposed comment:

> The doc covers HLSL (error) and Slang (error or warning); everything else falls into `default: break;`. That includes GLSL, the one language where these declarations are intended, and `SourceLanguage::Unknown`, which `getSourceLanguage()` returns when there's no translation unit. A reader can't tell whether every other language that reaches `default` is accepted on purpose. An explicit `case SourceLanguage::GLSL:`, plus a word on why the remaining languages are accepted (or an assertion that they can't reach here), would make the case analysis visibly complete.

Notes:
None.

### FG012: The per-entry-point copy silently depends on `_collectShaderParams` order

- Status: Revise
- Confidence: Low
- Scope: Direct
- Category: invariant
- Location: `source/slang/slang-entry-point.cpp:35`
- GitHub link: https://github.com/shader-slang/slang/blob/3065810ca0cb20469dd16804d13bccbc19c8e9bd/source/slang/slang-entry-point.cpp#L35
- Overlap decision: Keep
- Overlap rationale: C001 is about the model in general; this candidate is about when the stored copy is taken.
- Scope decision: Direct
- Scope rationale: The line is new in this PR.
- Judgment decision: Revise
- Judgment rationale: Storing the list on `EntryPoint` is a stated maintainer requirement (M1), so the comment no longer suggests deriving it on demand. The undocumented dependency on when the copy is taken is still real.

Context:

```cpp
entryPoint->m_globalVaryings = Slang::getModule(funcDeclRef.getDecl())->getGlobalVaryings();
```

Proposed comment:

> This copies the module's list when the `EntryPoint` is created, so it depends on `Module::_collectShaderParams` having already run for that module. That holds for today's callers (`_discoverEntryPoints` and the `-entry` lookup both run after checking), but nothing states or asserts it, and an `EntryPoint` created earlier would silently own nothing. A short note (or an assertion) stating that dependency would help, along with a word on why the list is stored per entry point if later stages are expected to let it diverge from the module's list.

Notes:
The explanation comment cites maintainer requirement "M1, the ordered list on EntryPoint".

### FG009: The varying-type loop duplicates the parameter loop's setup

- Status: Keep
- Confidence: Low
- Scope: Direct
- Category: control flow
- Location: `source/slang/slang-check-shader.cpp:2776-2777`
- GitHub link: https://github.com/shader-slang/slang/blob/3065810ca0cb20469dd16804d13bccbc19c8e9bd/source/slang/slang-check-shader.cpp#L2776-L2777
- Overlap decision: Keep
- Overlap rationale: The terminology part was moved to FG006; this candidate is only about the duplicated mapping.
- Scope decision: Direct
- Scope rationale: The loop is new in this PR, and it duplicates the existing parameter loop.

Context:

```cpp
ctx.direction =
    directions.isOutput ? (directions.isInput ? "input/output" : "output") : "input";
```

Proposed comment:

> This loop repeats the parameter loop's `VaryingTypeValidationContext` setup line for line, including the nested ternary that maps `EntryPointParamDirections` to `"input"`, `"output"` or `"input/output"`. That mapping now exists twice and could be a small named helper next to `EntryPointParamDirections`.

Notes:
None.

### FG013: W38044 headline says the entry point "declares" module-scope varyings

- Status: Keep
- Confidence: Low
- Scope: Direct
- Category: terminology
- Location: `source/slang/slang-diagnostics.lua:4978`
- GitHub link: https://github.com/shader-slang/slang/blob/3065810ca0cb20469dd16804d13bccbc19c8e9bd/source/slang/slang-diagnostics.lua#L4978
- Overlap decision: Keep
- Overlap rationale: FG006 is about the noun used for the varyings; this candidate is about the verb used for the entry point's relation to them.
- Scope decision: Direct
- Scope rationale: The diagnostic is new in this PR.

Context:

```lua
"entry point declares both varying parameters and module-scope varyings",
span { loc = "param:Decl", message = "'~param' is a varying parameter of an entry point that also owns module-scope varyings; ..." },
```

Proposed comment:

> The headline says the entry point "declares both varying parameters and module-scope varyings", but entry points don't declare module-scope varyings. The span text and the rest of the PR say the entry point *owns* them. Using "owns" (or "has") in the headline would match the model the other messages describe.

Notes:
None.

### FG014: `uninitialized-globals` silences W38044 without saying why it fires on a compute shader

- Status: Keep
- Confidence: Low
- Scope: Direct
- Category: comments
- Location: `tests/diagnostics/uninitialized-globals.slang:1`
- GitHub link: https://github.com/shader-slang/slang/blob/3065810ca0cb20469dd16804d13bccbc19c8e9bd/tests/diagnostics/uninitialized-globals.slang#L1
- Overlap decision: Keep
- Overlap rationale: C001 is about the model in the abstract; this candidate is about a concrete consequence that a test hides.
- Scope decision: Direct
- Scope rationale: The PR changed this run line.

Context:

```slang
//DIAGNOSTIC_TEST:SIMPLE_EX(diag=CHK): -lang glsl tests/diagnostics/uninitialized-globals.slang -target spirv -entry computeMain -warnings-disable 38044
```

Proposed comment:

> This test now needs `-warnings-disable 38044`. The compute entry point `computeMain` owns the file's `layout(location = …) in/out` globals, so its `SV_DispatchThreadID` parameter counts as a varying parameter alongside module-scope varyings. That's a non-obvious consequence of the ownership model (a compute shader owning stage `in`/`out` globals), and it's the W38044 scope question the description says blocks merge. Without a note, the run-line change looks like noise. A one-line comment on why the warning fires here would keep that consequence visible until the question is settled.

Notes:
None.

## Dropped

### FG015: `doesModuleDependOnGLSLModule` relies on the dependency list being transitive

- Status: Drop
- Confidence: Low
- Scope: Direct
- Category: function contract
- Location: `source/slang/slang-check-shader.cpp:1994-1995`
- Overlap decision: Merged into C005
- Overlap rationale: C005 already asks for the helper's role to be justified, and its comment now covers transitivity as well.
- Scope decision: Direct
- Scope rationale: The helper is new in this PR, but the concern is now posted through C005.

Proposed comment:

> The "directly or through the modules it imports" claim holds only because `getModuleDependencyList()` is already transitive; the loop body checks one flat list.

### FG010: "In declaration order" vs. the work-list walk

- Status: Drop
- Confidence: Low
- Scope: Direct
- Category: type contract
- Location: `source/slang/slang-module.h:378-380`
- Overlap decision: Keep
- Overlap rationale: No overlap.
- Scope decision: Direct
- Scope rationale: The doc comment is new, but the concern turned out to be moot.
- Judgment decision: Drop
- Judgment rationale: The work list reaches varyings outside the module's direct members only through `__include`d `FileDecl`s, which upgrade the file to Slang 2025 and so trigger E30626, and through `NamespaceDecl`s, which trigger E31401. So in an error-free program the list is in source order and the doc claim holds.

Proposed comment:

> `_collectShaderParams` doesn't produce strict declaration order. It walks a work list: the module's direct members first, then each `__include`d `FileDecl` and `NamespaceDecl` it reaches.

### FG016: Parallel `globalVaryings` / `globalVaryingDirections` arrays

- Status: Drop
- Confidence: Low
- Scope: Direct
- Category: API shape
- Location: `source/slang/slang-check-shader.cpp:2352-2355`
- Overlap decision: Keep
- Overlap rationale: No overlap.
- Scope decision: Out-of-scope
- Scope rationale: The new code follows the pre-existing `params` / `paramDirections` pattern in the same function, so the PR doesn't make it worse.

Proposed comment:

> Four later loops index these two lists in lockstep. A single list of (varying, directions) pairs would make the pairing structural.

## slang-reviewer verification (local, head 3065810ca)

**Verdict: APPROVE_WITH_NITS.** No reviewer found a bug (A 0, B 0, C 0, me 0). Every stage-1 requirement from tangent-vector is met, except M3, which is partial while Q4 is open. That matches the fixer's self-check.

The top concern is a disclosure and framing gap, not a code defect. The PR's stated default for Q1 is "no new diagnostic", but module ownership already rejects the fragment entry point of #14375's own repro, and master compiles it. A tested remedy patch (`remedy-14395-r1.patch`) adds a note naming the owning entry point to these errors and pins the repro shape. The other gaps are the `inout` direction, two stale docs, and some untested paths.

### Maintainer requirements (built from the live comments, not the fixer's list)

Sources: tangent-vector (MEMBER), [#14375 6697604956](https://github.com/shader-slang/slang/issues/14375#issuecomment-6697604956) (2026-11-06 22:40Z), and for the prerequisite scope, [#14335 6695608888](https://github.com/shader-slang/slang/pull/14335#issuecomment-6695608888). The bot's questions Q1–Q4 ([6698074996](https://github.com/shader-slang/slang/issues/14375#issuecomment-6698074996)) have no answer yet; I checked this live at 02:32Z.

| # | Requirement (quoted or close paraphrase) | Status | Evidence |
|---|---|---|---|
| M1 | `EntryPoint` records "an ordered list of global varying parameters that are deemed to 'belong' to it" | met | `slang-entry-point.h:236-246`, `slang-entry-point.cpp:35` |
| M2 | "moving the 'must return `void`' rule here" | met | `slang-check-shader.cpp:2357-2368` (E58001). The IR check remains and is still reachable for core/GLSL-module outputs: `import glsl;` plus a non-void fragment that writes `gl_FragDepth` gets the IR E58001 (probed). |
| M3 | "must have no function parameters" rule "(or at least … no varying function parameters)", as a warning saying it will become an error | partial (Q4) | W38044 `:2692-2707` covers varying parameters only, and only when the entry point owns globals. That is the maintainer's fallback wording. Uniform parameters are not warned, although globals could replace them. The `TriangleStream`/`InputPatch` exemption is needed. I agree with the fixer that Q4 decides this. |
| M4 | top-level module scope only, "ideally an error" | met (error) | E31401, `slang-check-decl.cpp:598-602` |
| M5 | HLSL → error; legacy Slang → warning ("GLSL dialect only … removed in a later release"); Slang 2025+ → error | met | `slang-check-decl.cpp:604-623`. Probes: `.hlsl`, `-std 2025/2026`, `public …`, `module m;` → E30626; legacy → W30627; `-lang glsl` → nothing. |
| M6 | marker attribute on the module decl; importing a marked module is "ideally an error"; the core and GLSL modules are exempt | met | `HasLegacyGlobalVaryingsModifier`; E38208 `slang-check-decl.cpp:18844-18851`. **Verified through a precompiled `.slang-module`:** the marker is serialized and E38208 fires. This closes the fixer's stated gap. `import glsl;` does not trigger E38208. |
| M7/M8 | ownership = all varyings of the entry point's module; no front-end call-graph walk | met | `_collectShaderParams` `:3246-3257`; no reachability code |
| M9 | core/GLSL-module varyings left out of front-end checking | met for stage 1 | `FromCoreModuleModifier` filter. The "could be marked up" part belongs to the IR stage. |
| M10 | "if … a warning [risks] unstable/undefined behavior … make those things an error" | applied, but not justified | The PR cites M14/M10 for E31401 and E38208. In stage 1, layout and IR are unchanged, so a warning would be safe today. Errors are still allowed, because the maintainer called both "ideally an error". The code comments should give that reason instead of the ownership non-sequitur (A, C). |
| M11 | staged, not one big PR | met | +533/−67, stacked PR 1 |
| — | binding: module→entry-point map, "overlaps/conflicts … ideally an error" | stage 2 | Not in this PR, but see G1: the checker already turns some overlaps into hard errors. |

**Fixer self-check comparison:** R3 partial agrees with me. For R13 the fixer says partial and I say met for stage 1, a minor difference. **Disagreement:** the explanation comment says the Q1 default is "No new diagnostic" and supports that with "both master tests still pass". The actual default is a hard error for the most common multi-stage shape (G1).

### Tests (local, L40S, Release, `-DSLANG_ENABLE_DXIL=OFF`, my own base build `wt-14395-base` at b85caf928)

- PR test files: 20/20 at head (1 dx11 row ignored). On base, 7/20 pass; the 13 new diagnostic rows fail. The GLSL, OFF and FRAGMENT pin rows pass on both, as expected.
- Drill: with the GLSL `SV_Position` exception removed, `vertex-missing-sv-position-global.slang.2` fails. The row pins the exception.
- Full `slang-test -use-test-server -server-count 8` at head: **11686/11689** (3263 ignored). Only the 3 known `fp8-cuda*` failures, which also fail on master.
- `slang-static-unit-test` (STATIC build): **61/0**.
- clang-format 17: clean.
- Corpus A/B: 91 test files with module-scope varyings, each TEST command, plus a whole-module compile. Outside the PR's own tests, the only differences are W30627 (and W38044 in `uninitialized-globals`). None of the existing tests compiles the second entry point of a multi-stage module that has outputs or SV globals, which is why the suite does not see G1.
- CI run 42323478137 is gated (`wait-for-human-priority`), so no CI lane has run.
- Remedy patch: PR + new tests 22/22; full suite **11688/11691** (the same 3 fp8 failures).

### Findings

**G1 🟡 (A gap 2, C001, me): module ownership rejects the fragment entry point of #14375's own repro, and the PR text says this default adds no new diagnostic.**
- Probe `s1.slang`, the issue's repro verbatim:
  ```slang
  out float4 gPos : SV_Position;
  out float3 vA;
  [shader("vertex")]   void vsMain(float3 p : POSITION) { gPos = float4(p, 1); vA = p; }
  [shader("fragment")] float4 fsMain(float3 vA_in) : SV_Target { return float4(vA_in, 1); }
  ```
  - On master, `-entry vsMain`, `-entry fsMain` and the whole-module compile all exit 0.
  - At head, `-entry fsMain` and the whole-module compile exit 255. The errors are E58001 ("must return void with global outputs") and E30702 ("'SV_Position' cannot be used as output in 'pixel' shader stage", with the caret on `gPos`). The message names neither `fsMain` nor the reason, and `fsMain` never uses `gPos`. W38044 also fires on both entry points.
  - The declaration-order variant from the issue fails the same way. So does my `vsfs-globals.slang`.
- **API users lose the whole module.** `loadModule` validates every `[shader]` entry point, so a vs+fs module like this one no longer loads, even for a host that only wants `vsMain`.
- This follows from the design (M7 + M2), so it is not a code bug. But Q1 on the issue asks only about two tests that "still pass" and says nothing about this shape. Under Q1's default the issue's expected behaviour ("`vA` gets Location 0 and matches the fragment input") can never be reached. The maintainer said "ideally an error … might need to be a warning for now", and stage 1 has no backend-safety reason for a hard error.
- **Ask:**
  1. Re-ask Q1 on #14375 with `s1.slang` and the API consequence.
  2. Add a Risk line that names E58001 as well as E30702.
  3. Apply the patch: a standalone note on E58001 and on E30702 raised for an owned global, saying "'gPos' belongs to entry point 'fsMain', which owns every module-scope varying of its module, whether or not it uses it", plus `tests/diagnostics/global-varying-several-entry-points.slang`, which pins this shape so that any Q1 answer shows up as a test diff.

**G2 🟡 (A, C-FG002): module-scope `inout` is checked as input+output but lowered as output only, and is untested.**
- `getGlobalVaryingDirections` (`:2009-2015`) marks `inout` as input. `lowerToIR` matches `OutModifier` first and gives the global only `IRGlobalOutputDecoration`.
- Probe: `inout float4 gX : SV_Position;` with a vertex `main`. Master exits 0 (output only). Head reports E30702 ("cannot be used as input in 'vertex'"), which is consistent with `inout` parameters (master gives the same E30702 for `void main(inout float4 p : SV_Position)`).
- **Ask:** decide which meaning stage 1 uses: both directions (the parameter-consistent, forward-looking choice) or output only (the current IR). Then add a test, and state the decision in a comment.

**G3 🟡 (A): two docs are stale.**
- `docs/user-guide/11-language-version.md`: the table says 2025 and 2026 are "Stable | Breaking changes avoided", and the Slang 2025 section has no bullet for this new error. This PR makes a breaking change in both stable versions; the maintainer asked for it, but the page should say so.
- `docs/entrypoint-validation.md:10` still says validation is "strictly limited to entry-point parameters and return types".

**G4 🟡 (A): untested paths.**
- The implicit 2025 upgrade: `module m;` and `public` both give E30626 in my probes, but only `-std` is tested.
- An `__include`d `FileDecl` parent.
- The W38044 builtin-parameter exemption: no exhaustive test pins it, so deleting it fails nothing.
- The compute `SV_DispatchThreadID` case: W38044 fires, and `uninitialized-globals` suppresses it instead of asserting it.

**Questions:**
- **Q-a (A security subagent; dropped by A's main pass; not reproduced by me).** A subagent claimed that `globalVarying->getName()->text` (`:2780`) can dereference null for a nameless `in float4 = …;` in the language server; the parameter loop guards the same case. Four nameless forms through the LANG_SERVER hover path at head did not crash (`runs/probe-14395/ls/`). Unconfirmed, so it is not in the patch. Mirroring the parameter guard would cost one line, if the fixer can show that a nameless varying actually reaches this point.
- **Q-b:** do E31401 and E38208 need to be errors in stage 1? (See M10 above.) The maintainer allows either, but the comment rationale should change.

**The three checks the fixer asked for:**
1. **The GLSL `SV_Position` exception** is correct, and the drill shows it is pinned. Explicit `import glsl;` in legacy Slang is covered too (probe: no W38052 at head). A non-GLSL module whose only outputs are globals now gets the pedantic W38052, as intended. The comment is hard to parse (A, C), and `globalOutputsCount` reads as a count; the patch renames it to `globalOutputsCountAsOutputs`. The asymmetry with `out` parameters in GLSL modules is pre-existing.
2. **Entry points are checked against varyings they do not use.** Confirmed: see G1 and `global-varying-system-value-stage.slang`. An unused SV global also adds its capability: an unused `in float3 gBary : SV_Barycentrics` makes WGSL fail with E36107 (master: exit 0), and adds W41012 on `sm_6_0` and `spirv_1_0`. This is consistent with an unused SV parameter.
3. **Slang 2025 upgrade → E30626.** Confirmed for `public` and `module m;`, and it matches M5. It is untested (G4). The E30626 text says "Slang 2025 and later" without saying why the file counts as 2025. Optional: a note naming `module`/`public`/`__include` as the trigger.

**Nits (from A and C; my patch adopts N1–N3):**
- N1 (A, C-FG004): the namespace test re-implements `getParentDecl` with a single-level unwrap. The patch uses `as<NamespaceDecl>(getParentDecl(decl))`.
- N2 (A, C003): the import comment says imported varyings "would belong to no entry point", but E38208 says they belong to the imported module's entry points. The patch rewrites the comment and the test header to name the actual hazard: the importer's entry points could use varyings they do not own.
- N3 (A, C-FG001): the `globalOutputsCount` rename.
- N4: the E31401 rationale does not follow from ownership (A, C002). The real reason is the maintainer's "ideally an error".
- N5: W38044's headline says "declares" where the span says "owns" (A, C-FG013).
- N6: `_collectShaderParams` still says "At this point we know we have a global shader parameter" (A, C-FG011).
- N7: the `validateSystemValueSemanticForDirections` contract and the `|| !isOutput` fallback (A, C-FG003).
- N8: the `collectDepthOutputSemantics` doc should include module-scope outputs (A).
- N9: "the checks below apply to them too" overstates; `isValidThreadDispatchIDType` and `collectGenericStructTypeUses` still walk parameters only (A).
- N10: the two spellings of the core-module test (`isFromCoreModule(decl)` vs `FromCoreModuleModifier`) (A, C004).
- N11: the PR description is in the short 4-section format. The repo CLAUDE.md asks for the five-part format, but the coworker gate enforces this one, so I am not counting it.

**Disagreements:** none between A, B and C. A rated G1 a gap and suggested legacy-Slang warnings as one option; I agree, with the decision left to the maintainer through Q1.

Remedy patch: `remedy-14395-r1.patch` (sent alongside; applies on 3065810ca with `git am`). Probes: `runs/A-14395-r1/probes-14395/` (s1.slang = #14375 repro).

## Result (machine-readable)

```json
{"verdict":"APPROVE_WITH_NITS","bugs":0,"gaps":6,"questions":0,"diff_hash":"1f8bb4d0675f8362434461b417e8d0065b0b981c5d5ad60cafc0111e4703e9e0","reviewers_complete":true}
```
