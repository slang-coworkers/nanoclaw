# Combined PR Review — shader-slang/slang#14220 (pr)

## Reviewer A — Correctness (nv-slang-bot)

No bugs found. There are two gaps worth fixing before merge, plus four clarity comments.

All seven review passes completed (six specialist reviewers plus the clarity pass). Nothing was posted to GitHub.

---

**Verdict**: 🔴 Has issues — 0 bugs, 2 gaps

The PR gives unresolved `extern` function declarations SPIR-V `Import` linkage under `-incomplete-library`. It also makes `-target spirv-asm` accept them, and skips spirv-opt for unlinked modules that import symbols. The skip is keyed on any `Import` decoration in the output, not on `-incomplete-library`. That has two effects:
- Precompiled-module glue SPIR-V built with `SkipDownstreamLinking` / `-embed-downstream-ir` now goes unoptimized.
- Explicit `-Xspirv-opt` passes are dropped with no diagnostic, which contradicts the user guide.

<details>
<summary>Changes Overview</summary>

**Import linkage for unresolved externs** (`source/slang/slang-emit-spirv.cpp`)
- What changed: `emitFuncDeclaration` now adds `OpCapability Linkage` and `OpDecorate %f LinkageAttributes "<mangled>" Import` to any function declaration that has an `IRImportDecoration`. Before, such a declaration got no linkage at all.

**Optimizer gating** (`source/slang/slang-emit.cpp`)
- What changed: a new `doesSPIRVModuleImportSymbols` walks the emitted words up to the first `OpFunction`, looking for an `Import` `LinkageAttributes` decoration.
- If one is found and `needsLink` is false, `needsOptimization` is forced to false at every `-O` level and even when `-Xspirv-opt` arguments are given.

**Linker target allowlist** (`source/slang/slang-ir-link.cpp`)
- What changed: `doesTargetAllowUnresolvedFuncSymbol` now accepts `CodeGenTarget::SPIRVAssembly` next to `SPIRV` under `-incomplete-library`. `-target spirv-asm` therefore no longer reports E45001 for such externs.

**Tests** (`tests/library/incomplete-library-spirv-extern.slang`)
- What changed: new test with a loop and a no-loop entry point at `-O0` through `-O3` with spirv-asm FileCheck, plus binary `-target spirv` `COMPILE` runs.
- It also has an `-O2` case with no extern, checking that inlining still happens, and an E45001 negative case without `-incomplete-library`.

</details>

<details>
<summary>Findings (6 total)</summary>

| Severity | Location | Finding |
|----------|----------|---------|
| 🟡 Gap | `source/slang/slang-emit.cpp:3662` | Optimizer skip fires for any unlinked module with Import linkage, including `SkipDownstreamLinking` / `-embed-downstream-ir` glue modules, not only `-incomplete-library` |
| 🟡 Gap | `source/slang/slang-emit.cpp:3664` | Explicit `-Xspirv-opt` passes are silently dropped, contradicting `docs/user-guide/08-compiling.md:394` and the comment above |
| 💬 Clarity | `source/slang/slang-emit.cpp:3500` | Scanner re-derives from the output bytes what the emitter already knows, and duplicates `SpirvInstructionHelper` decoding |
| 💬 Clarity | `source/slang/slang-emit-spirv.cpp:4254` | Second Import-linkage site; its relation to the `DownstreamModuleImportDecoration` case and the matching Export producer are unstated |
| 💬 Clarity | `tests/library/incomplete-library-spirv-extern.slang:1` | Header describes pre-fix behavior and claims a `spirv-link` the test never runs |
| 💬 Clarity | `tests/library/incomplete-library-spirv-extern.slang:31` | CHECK lines don't tie the Import decoration to the declaration of `f` |

</details>

<sub>reviewed: d958b751ea68cfdc67002dc692baa8e41d3e151f · diff sha256 55f877fc4f8f</sub>

---

### `source/slang/slang-emit.cpp:3662`

🟡 **Gap**: The optimizer skip applies to any unlinked module with Import linkage, not only `-incomplete-library`

```cpp
const bool isUnlinkedIncompleteModule = !needsLink && doesSPIRVModuleImportSymbols(spirv);
```

This condition never checks `CompilerOptionName::IncompleteLibrary`. It is true for any module where `needsLink` is false and the binary contains an `Import` decoration. Slang already emits those outside `-incomplete-library`:

- `removeAvailableInDownstreamModuleDecorations` is called unconditionally from `emitSPIRVFromIR` (`slang-emit-spirv.cpp:12530`). It strips the bodies of functions that a precompiled SPIR-V module already provides, and tags them `DownstreamModuleImportDecoration`.
- `emitDecoration` then gives those functions `LinkageAttributes ... Import` (`slang-emit-spirv.cpp:6939-6950`).
- With `SkipDownstreamLinking` or `EmbedDownstreamIR`, `downstreamLinkingAllowed = !isPrecompilation && !codeGenContext->shouldSkipDownstreamLinking()` is false, so `needsLink` is false too.

**Example**: `tools/gfx-unit-test/precompiled-module-2.cpp` in `PrecompilationMode::ExternalLink` (`precompiledTargetModule2ExternalLinkVulkan`):
- It sets `SkipDownstreamLinking` and compiles an entry point that calls `helperFunc()` from a module precompiled to SPIR-V.
- The API default optimization level is `OptimizationLevel::Default` (`CompilerOptionSet::getDefault`).
- Before this PR that glue module went through spirv-opt. With this PR it is emitted unoptimized, and `-incomplete-library` is not involved.
- No test covers this path. `mainNoExtern` can't tell "skip on Import" apart from "skip on any linkage", because its output has no linkage decorations at all.

**Suggestion**: decide which set of modules is intended.
- **Only `-incomplete-library`:** gate on the option. This also keeps the scan, and its `SLANG_RELEASE_ASSERT`, off every ordinary unlinked SPIR-V compile:
  ```cpp
  const bool isUnlinkedIncompleteModule =
      !needsLink &&
      codeGenContext->getTargetProgram()->getOptionSet().getBoolOption(
          CompilerOptionName::IncompleteLibrary) &&
      doesSPIRVModuleImportSymbols(spirv);
  ```
- **Glue modules should skip spirv-opt too** (because the same SPIRV-Tools passes crash on their declarations):
  - Name the variable after the property it actually tests (e.g. `hasUnresolvedImports`).
  - List the `SkipDownstreamLinking` / `EmbedDownstreamIR` cases in the comment.
  - Add a test that pins this behavior.

---

### `source/slang/slang-emit.cpp:3664`

🟡 **Gap**: Explicit `-Xspirv-opt` passes are dropped without a diagnostic, contradicting the user guide

```cpp
!isUnlinkedIncompleteModule &&
(codeGenContext->getTargetProgram()->getOptionSet().getOptimizationLevel() !=
     OptimizationLevel::None ||
 spirvOptArgs.getCount() != 0);
```

The new term overrides `spirvOptArgs.getCount() != 0` as well as the `-O` level. Two existing statements are now false for an unlinked module that imports symbols:
- `docs/user-guide/08-compiling.md:394`: "because they are requested explicitly, they run even under `-O0`".
- The comment a few lines up in this function: `-Xspirv-opt <flag>` "must run the optimizer even at `-O0`".

**Example**: `slangc t.slang -target spirv -incomplete-library -entry mainNoLoop -stage compute -O0 -Xspirv-opt --strip-debug`, where `t.slang` calls an unresolved `extern`. The requested pass never runs, and nothing tells the user it was skipped. The same applies to `-O2`/`-O3`.

**Suggestion**:
- Either emit a warning or note when `-O<n>` / `-Xspirv-opt` is ignored because the module has unresolved imports, or keep running the explicitly requested passes.
- Either way, update `08-compiling.md` and the comment above.
- Splitting the expression into "optimization requested" and "safe to optimize" gives the exception a clear place to be stated:
  ```cpp
  const bool isOptimizationRequested =
      optionSet.getOptimizationLevel() != OptimizationLevel::None || spirvOptArgs.getCount() != 0;
  const bool needsOptimization = isOptimizationRequested && !isUnlinkedIncompleteModule;
  ```

---

### `source/slang/slang-emit.cpp:3500`

💬 **Clarity**: `doesSPIRVModuleImportSymbols` re-derives from the output bytes a fact the emitter already knows, and re-implements decoding that `SpirvInstructionHelper` already has

- **Rediscovery.** `SPIRVEmitContext` itself decides when to emit `LinkageAttributes ... Import`: in the new block in `emitFuncDeclaration`, and in the `kIROp_DownstreamModuleImportDecoration` case in `emitDecoration`. `emitSPIRVFromIR` has a single caller. Recovering that decision by parsing the binary is the "context rediscovery" pattern CLAUDE.md warns about. Folding both Import sources into one scan is also how the gate above ended up wider than `-incomplete-library`.
- **Duplicate decoding.** The scanner decodes opcode and word count by hand (`words[i] & 0xFFFF`, `words[i] >> 16`). `SpirvInstructionHelper`, a few lines up, already has `getOpCode` / `getWordCountForInst` / `visitInstructions`.
- **Inconsistent handling of malformed input.** The two decoders disagree: this one uses `SLANG_RELEASE_ASSERT(instWordCount != 0 && ...)`, while `visitInstructions` simply `break`s on a zero word count. As written, the scan and its release assert run on every SPIR-V compile where `needsLink` is false.

**Suggestion**:
- Preferred: have the emitter record that it emitted an Import (e.g. an out-flag from `emitSPIRVFromIR`, set where the decoration is emitted) and drop the scanner.
- If the scan stays because the bytes are exactly what spirv-opt will see, say so in the comment, together with the precondition that the buffer is a module `emitSPIRVFromIR` just produced. Reuse the `SpirvInstructionHelper` decoding rather than a second decoder.

---

### `source/slang/slang-emit-spirv.cpp:4254`

💬 **Clarity**: A second Import-linkage site whose relation to the first is unstated, and whose matching Export only the precompile flow produces

Two places now give a body-less function `LinkageAttributes ... Import`:
- this block, keyed on `IRImportDecoration` and named from its mangled name;
- the `kIROp_DownstreamModuleImportDecoration` case in `emitDecoration`, named from `IRExportDecoration`.

The comment does not say why this one lives in `emitFuncDeclaration` rather than as a `case kIROp_ImportDecoration:` in `emitDecoration`. Presumably it is because `IRImportDecoration` also appears on builtin variables (`slang-emit-spirv.cpp:6185`, `7892`, `8162`), but the reader has to guess. It also doesn't say what happens to a body-less function that has neither decoration.

The comment says "Another module defines the symbol, and a later `spirv-link` combines that module with this one". Slang produces that counterpart only in the precompile flow:
- `SpvLinkageTypeExport` is emitted only for `DownstreamModuleExportDecoration` (`slang-emit-spirv.cpp:6926`).
- Only `Module::precompileForTarget` adds that decoration (`slang-compiler-tu.cpp:168`).
- A plain `-target spirv` compile of the module that defines `f` emits no Export for it.

**Suggestion**:
- State why this placement differs from the downstream-import case, or share a small `emitImportLinkage` helper between the two sites.
- Name the exporting counterpart this Import is expected to resolve against.

---

### `tests/library/incomplete-library-spirv-extern.slang:1`

💬 **Clarity**: The test header describes pre-fix behavior and claims a link the test never performs

- **Pre-fix behavior.** "`mainLoop` and `mainNoLoop` reach two different SPIRV-Tools passes that cannot process a function declaration." With this PR, spirv-opt is skipped for both entry points, so neither reaches any pass. The intent seems to be: each shape crashed a different pass before the fix, and both are kept so the test catches a regression if optimization is ever re-enabled for modules with imports. Saying that directly tells the reader what the `-O1` / `-O2` split protects.
- **Unchecked link claim.** The header says the extern becomes "an import declaration that a later `spirv-link` resolves", but nothing checks that:
  - No directive links the output.
  - `shouldRunSPIRVValidation` returns false under `IncompleteLibrary`, so spirv-val doesn't run either.
  - The two `TEST:COMPILE` lines write `.spv` files that nothing reads.
- **Unexplained `COMPILE` lines.** They appear to exist to cover the binary `-target spirv` path, which is the one that crashed, as opposed to `spirv-asm`. A comment saying so would explain them.

**Suggestion**: reword the header to describe what the test checks: the Import form, no crash at every `-O` level, and the binary `-target spirv` path covered by the `COMPILE` lines. Alternatively, add a round trip that links the output against a provider exporting `_S1fp1pi_uu`.

---

### `tests/library/incomplete-library-spirv-extern.slang:31`

💬 **Clarity**: The CHECK lines don't tie the Import decoration to the declaration of `f`

- **Unbound id.** The decorated id is matched with a wildcard, and `CHECK: OpFunction` matches whichever `OpFunction` comes first after it. The test passes only because of section ordering and because `f` is the only declaration. It would not catch the decoration landing on the wrong id, or being emitted twice.
- **Indirect `OPT` check.** `OPT-NOT: OpFunctionCall` proves spirv-opt ran only as long as Slang's own IR pipeline leaves the call to `triple` in place.

**Suggestion**:
```
// CHECK: OpDecorate %[[F:[A-Za-z0-9_]+]] LinkageAttributes "_S1fp1pi_uu" Import
// CHECK-NOT: LinkageAttributes "_S1fp1pi_uu"
// CHECK: %[[F]] = OpFunction
// CHECK-NEXT: OpFunctionParameter
// CHECK-NEXT: OpFunctionEnd
// CHECK: OpFunctionCall %{{[A-Za-z0-9_]+}} %[[F]]
```
Also add a `-O0` run of `mainNoExtern` that expects `OpFunctionCall`. Then the `OPT` check shows that the call disappears only because spirv-opt ran.

## Reviewer B — Devin Review

# Devin Review

## AI Analysis

Slang now emits a body-less extern SPIR-V function as an import, and skips spirv-opt on such unlinked modules. Previously spirv-opt crashed on the unresolved declaration under -incomplete-library.

Emit OpCapability Linkage and LinkageAttributes ... Import for imported function declarations.
Detect imported symbols in the emitted SPIR-V before running the optimizer.
Skip spirv-opt only for unlinked modules that import symbols.
Add regression tests covering -O0 through -O3 and the non-library error.
Show less

Summary: With -incomplete-library -target spirv, a call to an unresolved extern function no longer crashes slangc in spirv-opt. The declaration gets OpCapability Linkage + LinkageAttributes "<mangled>" Import, so it passes spirv-val and links with spirv-link. Root cause: emitFuncDeclaration (slang-emit-spirv.cpp:4175) gave an [import] declaration no linkage, and createArtifactFromIR (slang-emit.cpp:3663) ran spirv-opt on it; SPIRV-Tools DBE/LSSE crash on declarations. Tests: New tests/library/incomplete-library-spirv-extern.slang (loop and no-loop, -O0..-O3, E45001 kept). library/modules/spirv/diagnostics/linkage/bugs/autodiff: 3757/3757 pass. Risk: spirv-opt is skipped only for unlinked modules that import symbols; tested linked SPIR-V outputs are byte-identical. spirv-asm accepts -incomplete-library externs, as spirv does.

Fixes #14212

🤖 Generated by an automated Slang coworker — may be inaccurate. A human maintainer should verify.

Show less
133 lines left
1
Emit Import linkage for imported function declarations
0/1
slang-emit-spirv.cpp
source/slang
+17
Viewed
All 4174 lines
5 lines
4175
    SpvInst* emitFuncDeclaration(IRFunc* irFunc)
4176
    {
5 lines
All 69 lines
5 lines
4246
        emitDecorations(irFunc, getID(spvFunc));
4247
 
4248
        // A declaration that still has an import decoration here, such as an `extern` function,
4249
        // is a symbol that the IR linker left unresolved, which it allows only under
4250
        // `-incomplete-library`. Another module defines the symbol, and a later `spirv-link`
4251
        // combines that module with this one. SPIR-V expresses this with Import linkage, which is
4252
        // also the only form in which it allows a function without a body.
4253
        //
4254
        if (auto importDecoration = irFunc->findDecoration<IRImportDecoration>())
4255
        {
4256
            requireSPIRVCapability(SpvCapabilityLinkage);
1
4257
            emitOpDecorateLinkageAttributes(
4258
                getSection(SpvLogicalSectionID::Annotations),
4259
                importDecoration,
4260
                getID(spvFunc),
4261
                importDecoration->getMangledName(),
4262
                SpvLinkageTypeImport);
4263
        }
4264
 
4265
        return spvFunc;
4266
    }
5 lines
All 8447 lines
2
Skip spirv-opt for unlinked modules that import symbols
0/1
3
Route SPIR-V assembly through the link step
0/1
4
Add regression tests for extern and non-extern modules
0/1
End of changes
Chat about this PR
Info
Chat

## Vulnerabilities

(none reported)

## Bugs

_The fetch script left this panel empty although the page showed "2 Bugs". The reviewer pulled the two entries below with a separate read-only browser session on the same page, 2026-11-03 ~01:45Z._

1. **Separate SPIR-V modules cannot resolve imports** (Potential Bug, `slang-emit-spirv.cpp:4257-4262`): "When a separately compiled function defines an imported extern, spirv-link cannot resolve the new LinkageAttributes Import. The definition receives no matching Export unless precompilation marks it IRDownstreamModuleExportDecoration."
2. **Required compiler-change rationale is absent** (Bug, Repo rule, `slang-emit.cpp:3662`): title only; the detail did not expand in the read-only session.

## Flags

(none reported)

## Informational

(none reported)

## Reviewer C — Clarity

The PR 14220 clarity review is done; nothing was posted to GitHub. I also didn't do a dry run of the posting script, because you said not to run that skill. I checked the canonical file against the script's format rules by reading its parsing code.

Out of 18 raw candidates, 12 are kept and 7 are dropped (merged, duplicate, superseded, out of scope, or not borne out). The canonical file follows in full.

# PR 14220 Clarity Workflow Candidates

## PR Summary

**Title:** Fix -incomplete-library SPIR-V crash on unresolved extern functions (fixes #14212)

**What the description says:** Under `-incomplete-library -target spirv`, a call to an unresolved `extern` function crashed slangc inside spirv-opt. The fix gives the declaration `OpCapability Linkage` plus `LinkageAttributes "<mangled>" Import`, and skips spirv-opt "only for unlinked modules that import symbols". `spirv-asm` now accepts `-incomplete-library` externs in the same way as `spirv`.

**What the diff does:**

1. `slang-emit-spirv.cpp`: `emitFuncDeclaration` emits Import `LinkageAttributes` (and requires the `Linkage` capability) for any function declaration that carries an `IRImportDecoration`.
2. `slang-emit.cpp`: a new `doesSPIRVModuleImportSymbols` decodes the emitted SPIR-V words, looking for an Import `LinkageAttributes` decoration. `createArtifactFromIR` then sets `needsOptimization` to false whenever `!needsLink` and the scan finds an import.
3. `slang-ir-link.cpp`: `SPIRVAssembly` joins `SPIRV` in the `-incomplete-library` arm of `doesTargetAllowUnresolvedFuncSymbol`.
4. A new test, `tests/library/incomplete-library-spirv-extern.slang`, covers loop and no-loop shapes at `-O0` through `-O3`, a no-extern case that must still be optimized, and the E45001 error without `-incomplete-library`.

**Mismatch / value notes:** The value is clear: a crash becomes valid, linkable SPIR-V. The description and the code comments frame the optimizer skip as an `-incomplete-library` behavior, but the condition is "unlinked and has Import linkage". That also covers precompiled-module glue under `SkipDownstreamLinking`, and `-embed-downstream-ir` blobs whose module calls into another precompiled module, because `removeAvailableInDownstreamModuleDecorations` always runs before SPIR-V emission. In those cases spirv-opt is now skipped at the default `-O1`. The description is also a short summary rather than the five-part format that `CLAUDE.md` asks for, and it never addresses the input-shape question for the new binary scan.

## Review Body

> Claude Opus 5.5-authored clarity review:
>
> This is a small, well-targeted fix. Emitting Import linkage for the declarations that `-incomplete-library` allows is the right representation, and the emitter change plus the new test are close to merge-ready. Most of the remaining work is in the optimizer-skip half of the PR, where the code and comments describe a narrower condition than the one the code actually tests.
>
> ## Main concerns
>
> - **The skip condition is broader than its name and comment.** `isUnlinkedIncompleteModule` is true for every unlinked module with Import linkage, whether or not `-incomplete-library` was passed. That includes precompiled-module glue built with `SkipDownstreamLinking`, and `-embed-downstream-ir` blobs whose module calls into another precompiled module. Both now lose spirv-opt at the default `-O1`. Please either justify that for each producer of Import linkage, or narrow the condition.
> - **Explicit optimizer requests are now silently ignored** for these modules. That contradicts the `-Xspirv-opt` "must run the optimizer" comment directly above, as well as the overview comment at the top of the downstream-compiler decision.
> - **The SPIR-V emitter now has two producers of Import linkage on function declarations**, with no stated invariant that keeps them mutually exclusive. Relatedly, the new scan recovers from the emitted binary a fact the emitter already knew; please say why the binary is the intended source of truth.
>
> ## Smaller items
>
> - Anchor the two claims about SPIRV-Tools behavior: that the optimizer crashes on declarations, and that the linker fails on any unresolved import. Then a future SPIRV-Tools bump can tell whether the workaround is still needed.
> - Document the export-side name contract that a "later `spirv-link`" depends on.
> - `doesSPIRVModuleImportSymbols` could reuse `SpirvInstructionHelper::SpvInstruction`, and `needsOptimization` would read better with the "requested" half named separately.
> - Test comments: say what the two `COMPILE` runs guard, tie the Import decoration to the bodiless declaration in the CHECK lines, and separate what the test verifies from background.
>
> The PR description would also benefit from the five-part format in `CLAUDE.md`. In particular, the input-shape question for the new binary scan would likely have surfaced the precompiled-module interaction above.

## Kept

### C001: The optimizer skip is keyed on "has Import linkage", but named and justified as "incomplete library"

- Status: Keep
- Confidence: High
- Scope: Direct
- Category: terminology
- Location: `source/slang/slang-emit.cpp:3662`
- GitHub link: https://github.com/shader-slang/slang/pull/14220/files
- Overlap decision: Keep
- Overlap rationale: Absorbs FG012, the narrower naming-only version; distinct from C005 (external-dependency claims) and C004 (overriding explicit requests).
- Scope decision: Direct
- Scope rationale: The variable, its comment, and the condition are all introduced by this PR.

Context:

```cpp
    // ... A module that imports symbols and is not linked here is an incomplete
    // library: its consumer links it and then optimizes the whole program, so we leave it
    // unoptimized. A module that is linked here has no imports left afterwards, because the link
    // fails on any import it cannot resolve.
    const bool isUnlinkedIncompleteModule = !needsLink && doesSPIRVModuleImportSymbols(spirv);
```

Proposed comment:

> The name `isUnlinkedIncompleteModule` and the comment above it treat "imports symbols and is not linked here" as meaning `-incomplete-library`, but the condition never consults that option, and other paths satisfy it too:
>
> - `emitSPIRVFromIR` always runs `removeAvailableInDownstreamModuleDecorations`. That turns every precompiled-module function into a declaration with `DownstreamModuleImportDecoration`, which `emitDecoration` emits as `LinkageAttributes ... Import`.
> - `needsLink` is false whenever `isPrecompilation` (`-embed-downstream-ir`) or `SkipDownstreamLinking` is set.
>
> So, for example, the glue module produced with `SkipDownstreamLinking` (the `ExternalLink` mode of `tools/gfx-unit-test/precompiled-module-2.cpp`), or a precompiled blob for a module that calls into another precompiled module, now silently skips spirv-opt at the default `-O1`. The stated justification, "its consumer links it and then optimizes the whole program", is true when Slang's own `createArtifactFromIR` links precompiled blobs. Under `SkipDownstreamLinking`, however, the consumer is the application, and nothing here says that it optimizes.
>
> Could the name and comment describe the condition that is actually tested (an unlinked module with Import linkage), and explain why skipping the optimizer is right for each producer of Import linkage? If it isn't right for the precompiled-module paths, the condition should be narrowed instead.

Notes:
Verified producers: `slang-ir-redundancy-removal.cpp:387` adds `kIROp_DownstreamModuleImportDecoration`; `slang-emit-spirv.cpp:12530` calls `removeAvailableInDownstreamModuleDecorations` unconditionally; `slang-emit-spirv.cpp:6939-6951` emits Import linkage for it; base `slang-emit.cpp:3580-3581` sets `downstreamLinkingAllowed = !isPrecompilation && !shouldSkipDownstreamLinking()`; the default optimization level is `OptimizationLevel::Default` (`slang-compiler-options.cpp:517-518`). The PR body's "Risk" line describes the condition accurately; the code comment is what narrows it.

### C004: The new skip silently overrides explicit optimizer requests and contradicts the comments above it

- Status: Keep
- Confidence: High
- Scope: Direct
- Category: comments
- Location: `source/slang/slang-emit.cpp:3664`
- GitHub link: https://github.com/shader-slang/slang/pull/14220/files
- Overlap decision: Keep
- Overlap rationale: Absorbs FG005 (the stale `-Xspirv-opt` comment) and adds the user-facing contract question; distinct from FG003, which concerns only expression structure.
- Scope decision: Direct
- Scope rationale: The overriding term is added by this PR, and it makes the adjacent pre-existing comments inaccurate.

Context:

```cpp
    // `-Xspirv-opt <flag>` selects individual optimizer passes explicitly, so it must run the
    // optimizer even at `-O0` (where the preset is empty). ...
    List<String> spirvOptArgs = ...;
    ...
    const bool needsOptimization =
        !isUnlinkedIncompleteModule &&
        (... getOptimizationLevel() != OptimizationLevel::None ||
         spirvOptArgs.getCount() != 0);
```

Proposed comment:

> The comment just above says that `-Xspirv-opt <flag>` "must run the optimizer even at `-O0`". The overview comment earlier in this function lists running the optimizer "when an optimization level above `None` is requested" as a reason to load the downstream compiler. This `!isUnlinkedIncompleteModule &&` term overrides both statements without any diagnostic. For example, `-incomplete-library -O3 -Xspirv-opt <pass>` on a module with an unresolved `extern` now succeeds and returns unoptimized SPIR-V.
>
> If ignoring an explicit optimizer request is the intended contract for these modules, those comments should state the exception, along with whether the user is told that their `-O`/`-Xspirv-opt` request was dropped. If it isn't intended, the explicit `-Xspirv-opt` case needs its own handling.

Notes:
In the PR version, the `-Xspirv-opt` comment occupies lines 3647-3652 and the overview comment 3587-3601; only 3652 onward is in the diff hunk, so the comment anchors on the overriding term.

### C002: Two independent paths now emit Import `LinkageAttributes` on function declarations

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: invariant
- Location: `source/slang/slang-emit-spirv.cpp:4254-4263`
- GitHub link: https://github.com/shader-slang/slang/pull/14220/files
- Overlap decision: Keep
- Overlap rationale: Supersedes FG006, whose narrower precondition question is covered by asking for the invariant that governs which declarations reach this block; distinct from C006, which covers the export-side name contract.
- Scope decision: Direct
- Scope rationale: The new block is added by this PR and creates the second producer.

Context:

```cpp
        emitDecorations(irFunc, getID(spvFunc));

        // A declaration that still has an import decoration here, such as an `extern` function,
        // is a symbol that the IR linker left unresolved, ...
        if (auto importDecoration = irFunc->findDecoration<IRImportDecoration>())
        {
            requireSPIRVCapability(SpvCapabilityLinkage);
            emitOpDecorateLinkageAttributes(..., importDecoration->getMangledName(), SpvLinkageTypeImport);
        }
```

Proposed comment:

> This block is now the second place that gives a function declaration `LinkageAttributes ... Import`. The `kIROp_DownstreamModuleImportDecoration` case in `emitDecoration`, reached through the `emitDecorations` call just above, already does so, taking the name from the function's `IRExportDecoration` rather than from an `IRImportDecoration`. The new comment explains why an `extern` declaration needs Import linkage, but not how this case relates to the existing one.
>
> What guarantees that a declaration never carries both an `IRImportDecoration` and a `DownstreamModuleImportDecoration`? If one ever did, it would get two `LinkageAttributes` decorations on the same id. And why does this case belong in `emitFuncDeclaration` rather than next to its sibling in the decoration switch? Presumably the reason is that `IRImportDecoration` also appears on non-function globals that must not get linkage. Stating the invariant that keeps the two producers mutually exclusive, or asserting it, would let a reader trust that every function declaration gets exactly one linkage decoration.

Notes:
Existing path: `slang-emit-spirv.cpp:6939-6951`. A gutted precompiled function keeps `IRExportDecoration` (the existing case dereferences it unconditionally), so a double decoration is probably impossible today. However, nothing at this layer states or checks that.

### C003: Whether the module imports anything is recovered by decoding the emitted binary

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: organization
- Location: `source/slang/slang-emit.cpp:3496-3500`
- GitHub link: https://github.com/shader-slang/slang/pull/14220/files
- Overlap decision: Keep
- Overlap rationale: Absorbs FG002 (the contract covers only the `OpDecorate` form) as a concrete instance of the decoder not being tied to the emitter; FG001 stays separate because it applies if the scan is kept.
- Scope decision: Direct
- Scope rationale: The helper and its doc comment are new in this PR.

Context:

```cpp
// Return whether the SPIR-V module `spirv` imports a symbol, that is, whether it has an
// `OpDecorate %x LinkageAttributes "<name>" Import`. ...
static bool doesSPIRVModuleImportSymbols(const List<uint8_t>& spirv)
```

Proposed comment:

> `doesSPIRVModuleImportSymbols` reconstructs, by decoding the emitted words, a fact the SPIR-V emitter already knew when it wrote the decoration. Both producers of Import linkage (the new block in `emitFuncDeclaration`, and the `kIROp_DownstreamModuleImportDecoration` case in `emitDecoration`) call `requireSPIRVCapability(SpvCapabilityLinkage)` at the point where they emit it.
>
> Scanning the binary has a real advantage: it catches every producer. But it also puts the "does this module import anything" contract in a hand-written word decoder, in a different file from the code that defines what is emitted. The decoder also covers less than its doc comment suggests: "whether the SPIR-V module imports a symbol" reads as a general query, but the body recognizes only a direct `OpDecorate`, not one applied through a decoration group. Could the PR say why the emitted binary is the intended source of truth for this decision, and scope the doc comment to Slang-emitted SPIR-V? The alternative would be to have the emitter report the decision where the decoration is created.

Notes:
This is the CLAUDE.md "context rediscovery" smell. It is framed as a request for justification because the binary scan is defensible.

### C005: The comment's claims about SPIRV-Tools behavior are not anchored anywhere a maintainer can check

- Status: Revise
- Confidence: Medium
- Scope: Direct
- Category: comments
- Location: `source/slang/slang-emit.cpp:3656-3661`
- GitHub link: https://github.com/shader-slang/slang/pull/14220/files
- Overlap decision: Keep
- Overlap rationale: Merges FG004 (the cross-component linker-option invariant) into one comment about this block's external-dependency claims.
- Scope decision: Direct
- Scope rationale: The comment is new in this PR and is the only justification for the new skip.

Context:

```cpp
    // The SPIRV-Tools optimizer assumes that every function it reaches has a body, and some of its
    // passes (dead-branch elimination, local single-store elimination) crash on an imported
    // function declaration. A module that imports symbols and is not linked here is an incomplete
    // library: its consumer links it and then optimizes the whole program, so we leave it
    // unoptimized. A module that is linked here has no imports left afterwards, because the link
    // fails on any import it cannot resolve.
```

Proposed comment:

> This comment rests on two claims about how SPIRV-Tools behaves, and neither is anchored anywhere a maintainer could check:
>
> - That spirv-opt "assumes that every function it reaches has a body", and that DBE and LSSE "crash" on an imported declaration. Nothing records which SPIRV-Tools version or upstream issue this refers to, or what the failure looks like (an assert, a null dereference, or invalid output). The workaround has a real cost, since these modules are never optimized, so whoever next bumps SPIRV-Tools needs a way to tell whether it is still required. An upstream issue link, or a pointer to the new regression test as the reproducer, would make the workaround's lifetime auditable.
> - That "the link fails on any import it cannot resolve", which is what justifies checking only `!needsLink` modules. That holds only because `glslang_linkSPIRV` in `source/slang-glslang/slang-glslang.cpp` leaves `spvtools::LinkerOptions` at its defaults: no partial linkage, and no library output. Naming where that is enforced would let a reader verify the claim, and would warn anyone who later enables partial linkage that doing so reintroduces the crash on the linked path.

Notes:
Verified that `slang-glslang.cpp:1135-1137` only calls `SetUseHighestVersion(true)`. Revised during consolidation to absorb FG004.

### C006: Import linkage relies on a name contract that nothing documents

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: API shape
- Location: `source/slang/slang-emit-spirv.cpp:4248-4252`
- GitHub link: https://github.com/shader-slang/slang/pull/14220/files
- Overlap decision: Keep
- Overlap rationale: Related to FG010, but this one concerns the emitter's user-facing contract, while FG010 concerns what the test claims to verify.
- Scope decision: Direct
- Scope rationale: The comment and the Import-linkage behavior are new in this PR.

Context:

```cpp
        // A declaration that still has an import decoration here, such as an `extern` function,
        // is a symbol that the IR linker left unresolved, which it allows only under
        // `-incomplete-library`. Another module defines the symbol, and a later `spirv-link`
        // combines that module with this one. ...
```

Proposed comment:

> "Another module defines the symbol, and a later `spirv-link` combines that module with this one" states the user-facing contract of this feature, but it leaves out the part a user needs. The import is named by Slang's mangled name (`_S1fp1pi_uu` for `extern uint f(uint)` in the new test), so the defining module must export exactly that name. In this emitter, ordinary Slang compiles emit Export linkage only for `DownstreamModuleExportDecoration` functions, that is, during precompilation. The defining side therefore has to be a precompiled Slang module, or hand-written SPIR-V that spells the mangled name. Could the comment say which producers are expected to supply the matching Export, and under what name? As written, a reader can't tell whether "a later `spirv-link`" is a supported workflow or an aspiration.

Notes:
The only Export `LinkageAttributes` producer in `slang-emit-spirv.cpp` is `kIROp_DownstreamModuleExportDecoration` (6926-6938), which is added only in `slang-compiler-tu.cpp:168` (precompilation).

### FG001: `doesSPIRVModuleImportSymbols` re-derives the instruction encoding instead of using `SpirvInstructionHelper::SpvInstruction`

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: API shape
- Location: `source/slang/slang-emit.cpp:3502-3521`
- GitHub link: https://github.com/shader-slang/slang/pull/14220/files
- Overlap decision: Keep
- Overlap rationale: Initially marked as a judgment call against C003. Resolved as Keep, because C003 asks for justification rather than removal, so the scan is likely to stay.
- Scope decision: Direct
- Scope rationale: The function body is new in this PR.
- Judgment decision: Keep
- Judgment rationale: C003 is phrased as "justify, or move to the emitter", and the binary scan is defensible, so this local reuse request remains actionable in the likely outcome. The `SpvInstruction` accessors map exactly onto the raw offsets used here.

Context:

```cpp
    const auto words = reinterpret_cast<const SpvWord*>(spirv.getBuffer());
    const Index wordCount = spirv.getCount() / Index(sizeof(SpvWord));
    Index i = SpirvInstructionHelper::SPV_INDEX_INSTRUCTION_START;
    while (i < wordCount)
    {
        const SpvOp opCode = SpvOp(words[i] & 0xFFFF);
        const Index instWordCount = Index(words[i] >> 16);
        ...
        if (opCode == SpvOpDecorate && instWordCount >= 5 &&
            words[i + 2] == SpvDecorationLinkageAttributes &&
            words[i + instWordCount - 1] == SpvLinkageTypeImport)
```

Proposed comment:

> This file already has a named decoder for these fields: `SpirvInstructionHelper::SpvInstruction`, with `getOpCode()`, `getWordCountForInst()`, and `getOperand(n)`. This function already borrows `SPV_INDEX_INSTRUCTION_START` from that class. Re-deriving `words[i] & 0xFFFF`, `words[i] >> 16`, and the raw offsets `words[i + 2]` and `words[i + instWordCount - 1]` gives the reader a second copy of the instruction encoding to check by hand.
>
> If the helper can't be used directly (it loads from an artifact, and `SpvInstruction` takes a non-const `SpvWord*`), please say so. Otherwise, writing the test in terms of `getOperand(1)` (the decoration) and `getOperand(wordCount - 2)` (the linkage type) would make the operand roles self-describing. The loop index `i` also spans the whole function; a descriptive name such as `wordIndex` would read better.

Notes:
`getOperand(index)` returns `word[index + 1]`, so `words[i + 2]` is `getOperand(1)` and `words[i + wc - 1]` is `getOperand(wc - 2)`.

### FG003: `needsOptimization` mixes "optimization requested" with "optimization unsafe", and the scan always runs

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: control flow
- Location: `source/slang/slang-emit.cpp:3663-3667`
- GitHub link: https://github.com/shader-slang/slang/pull/14220/files
- Overlap decision: Keep
- Overlap rationale: Adjacent to C004, but this concerns expression structure and the cost of the scan, not the user-facing contract.
- Scope decision: Direct
- Scope rationale: The expression is rewritten by this PR.

Context:

```cpp
    const bool isUnlinkedIncompleteModule = !needsLink && doesSPIRVModuleImportSymbols(spirv);
    const bool needsOptimization =
        !isUnlinkedIncompleteModule &&
        (codeGenContext->getTargetProgram()->getOptionSet().getOptimizationLevel() !=
             OptimizationLevel::None ||
         spirvOptArgs.getCount() != 0);
```

Proposed comment:

> `needsOptimization` now folds two separate decisions into one expression: whether optimization was requested (an `-O` level or `-Xspirv-opt` flags), and whether this module must not be optimized. Naming the first one, for example `isOptimizationRequested`, would let the final line read as "requested and safe". It would also let the `doesSPIRVModuleImportSymbols` scan run only when optimization was requested. At present the scan runs on every SPIR-V compile, including the `-O0` path that the earlier comments in this function work to keep cheap.

Notes:
Clarity is the primary concern; avoiding the unconditional scan is a secondary benefit.

### FG007: The purpose of the two `//TEST:COMPILE:` lines is not stated

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: comments
- Location: `tests/library/incomplete-library-spirv-extern.slang:15-16`
- GitHub link: https://github.com/shader-slang/slang/pull/14220/files
- Overlap decision: Keep
- Overlap rationale: No other candidate covers the binary-target runs.
- Scope decision: Direct
- Scope rationale: The test is new in this PR.

Context:

```slang
//TEST:COMPILE: tests/library/incomplete-library-spirv-extern.slang -target spirv -entry mainLoop -stage compute -incomplete-library -O1 -o tests/library/incomplete-library-spirv-extern-loop.spv
//TEST:COMPILE: tests/library/incomplete-library-spirv-extern.slang -target spirv -entry mainNoLoop -stage compute -incomplete-library -O2 -o tests/library/incomplete-library-spirv-extern-no-loop.spv
```

Proposed comment:

> These two runs repeat `mainLoop -O1` and `mainNoLoop -O2` for binary `-target spirv` and write `.spv` files that nothing reads, so the reader has to work out what they add over the eight `spirv-asm` runs. Presumably they cover the `CodeGenTarget::SPIRV` case of `doesTargetAllowUnresolvedFuncSymbol` (the `spirv-asm` runs depend on the newly added `SPIRVAssembly` case), each at the lowest `-O` level where its crash reproduces. A one-line comment saying what these runs guard, and why those two levels, would make the coverage self-explanatory.

Notes:
Other library tests already write outputs to `-o tests/library/...`, so the output path itself is not the concern.

### FG008: The CHECK lines don't tie the Import decoration to the bodiless declaration

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: comments
- Location: `tests/library/incomplete-library-spirv-extern.slang:30-34`
- GitHub link: https://github.com/shader-slang/slang/pull/14220/files
- Overlap decision: Keep
- Overlap rationale: No other candidate covers the precision of the FileCheck patterns.
- Scope decision: Direct
- Scope rationale: The test is new in this PR.

Context:

```slang
// CHECK: OpCapability Linkage
// CHECK: OpDecorate %{{[A-Za-z0-9_]+}} LinkageAttributes "_S1fp1pi_uu" Import
// CHECK: OpFunction
// CHECK-NEXT: OpFunctionParameter
// CHECK-NEXT: OpFunctionEnd
```

Proposed comment:

> These lines check three facts independently: the module has the `Linkage` capability; some id carries Import `LinkageAttributes`; and some `OpFunction` is followed directly by one parameter and `OpFunctionEnd`. They do not check that the bodiless declaration is the id that received the Import decoration, which is the property this fix establishes. Capturing the id, for example `OpDecorate %[[F:[A-Za-z0-9_]+]] LinkageAttributes ...` followed by `%[[F]] = OpFunction`, would state that link directly. Nothing explains that `_S1fp1pi_uu` is Slang's mangled name for `f(uint)`, either; a short note would help whoever has to update this check after a mangling change.

Notes:
The current checks probably pass for the right reason, because function declarations precede definitions in the module layout, but a reader has to reason about section order to see that.

### FG010: The test header asserts linkability and pass attribution that the test does not check

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: comments
- Location: `tests/library/incomplete-library-spirv-extern.slang:1-5`
- GitHub link: https://github.com/shader-slang/slang/pull/14220/files
- Overlap decision: Keep
- Overlap rationale: Related to C006 but scoped to what the test claims to verify.
- Scope decision: Direct
- Scope rationale: The test header is new in this PR.

Context:

```slang
// An entry point that calls a body-less `extern` function compiles to SPIR-V under
// `-incomplete-library` at every `-O` level, and the function becomes an import declaration that
// a later `spirv-link` resolves. `mainLoop` and `mainNoLoop` reach two different SPIRV-Tools
// passes that cannot process a function declaration (dead-branch elimination at `-O1` and up,
// local single-store elimination at `-O2` and up).
```

Proposed comment:

> The header presents two things as properties of this test: that the import is one "a later `spirv-link` resolves", and that each entry point reaches a specific SPIRV-Tools pass. Neither is checked here. No run links or validates the output (`shouldRunSPIRVValidation` is off under `-incomplete-library`), and nothing ties `mainLoop`/`mainNoLoop` to DBE or LSSE beyond the fact that they now compile. The pass attribution is useful background for why there are two entry points. The header would be easier to trust if it separated what the test verifies (every `-O` level compiles, and the bodiless declaration gets Import linkage) from the history that motivated those shapes.

Notes:
The PR body says that the output passes spirv-val and links with spirv-link; that was presumably checked manually.

## Dropped

### FG002: The helper's contract reads as a general SPIR-V query but recognizes only the form Slang emits

- Status: Drop
- Confidence: Low
- Scope: Direct
- Category: function contract
- Location: `source/slang/slang-emit.cpp:3496-3499`
- Overlap decision: Merged into C003
- Overlap rationale: Its point (the doc comment is broader than the `OpDecorate`-only body) is now a sentence in C003's request.
- Scope decision: Direct
- Scope rationale: New doc comment.

Proposed comment:

> "Whether the SPIR-V module `spirv` imports a symbol" reads as a general query about any SPIR-V module, but the body recognizes only a direct `OpDecorate`. It does not detect a `LinkageAttributes` decoration applied through `OpDecorationGroup`/`OpGroupDecorate`. Saying that the function is defined over Slang-emitted SPIR-V would keep it from being reused on modules where the answer could be wrong.

### FG004: "The link fails on any import it cannot resolve" depends on linker options in another component

- Status: Drop
- Confidence: Low
- Scope: Direct
- Category: invariant
- Location: `source/slang/slang-emit.cpp:3660-3662`
- Overlap decision: Merged into C005
- Overlap rationale: C005 now covers both external-dependency claims in the same comment block.
- Scope decision: Direct
- Scope rationale: New comment.

Proposed comment:

> Checking only `!needsLink` modules rests on the claim that "the link fails on any import it cannot resolve". That holds only because `glslang_linkSPIRV` leaves `spvtools::LinkerOptions` at its defaults; please say where that invariant is enforced.

### FG005: The `-Xspirv-opt` comment directly above is now inaccurate

- Status: Drop
- Confidence: High
- Scope: Contextual
- Category: comments
- Location: `source/slang/slang-emit.cpp:3652`
- Overlap decision: Duplicate of C004
- Overlap rationale: C004 raises the same stale-comment issue and adds the user-facing contract question.
- Scope decision: Contextual
- Scope rationale: Pre-existing comment made inaccurate by the new condition.

Proposed comment:

> This comment still says `-Xspirv-opt` "must run the optimizer", but the new condition below can now veto it; the comment should mention the exception.

### FG006: The emitter comment states an `-incomplete-library` precondition that nothing checks

- Status: Drop
- Confidence: Low
- Scope: Direct
- Category: invariant
- Location: `source/slang/slang-emit-spirv.cpp:4248-4254`
- Overlap decision: Superseded by C002
- Overlap rationale: C002's request for a stated or asserted invariant about which declarations reach this block covers the same ground, and FG006 has no concrete counterexample.
- Scope decision: Direct
- Scope rationale: New comment and block.

Proposed comment:

> The comment states that the linker allowed this unresolved symbol only because of `-incomplete-library`, but the emitter neither relies on that explicitly nor checks it. Is the precondition something this code depends on (and could assert), or only background?

### FG009: The `mainNoExtern` check doesn't show that it can distinguish optimized from unoptimized output

- Status: Drop
- Confidence: Low
- Scope: Direct
- Category: comments
- Location: `tests/library/incomplete-library-spirv-extern.slang:18-24`
- Overlap decision: Keep
- Overlap rationale: No overlap with another candidate.
- Scope decision: Direct
- Scope rationale: New test.
- Judgment decision: Drop
- Judgment rationale: Slang's own inliners (`ForceInliningPass`, `IntrinsicFunctionInliningPass`, and the others in `slang-ir-inline.cpp`) inline only force-inline, intrinsic, or type-legalization-required callees, so `triple` keeps its `OpFunctionCall` without spirv-opt and the check does discriminate. The test comment already says that the optimizer is what inlines it.

Proposed comment:

> `OPT-NOT: OpFunctionCall` proves that spirv-opt ran only if Slang itself leaves the call to `triple` in place when spirv-opt does not run; a matching `-O0` run would make that visible.

### FG011: `doesTargetAllowUnresolvedFuncSymbol` has no contract comment

- Status: Drop
- Confidence: Low
- Scope: Probably out-of-scope
- Category: function contract
- Location: `source/slang/slang-ir-link.cpp:1910`
- Overlap decision: Keep
- Overlap rationale: No overlap with another candidate.
- Scope decision: Out-of-scope
- Scope rationale: The function and its missing contract are pre-existing; the PR adds one case that obviously follows the existing `DXIL`/`DXILAssembly` and `MetalLib`/`MetalLibAssembly` pairing.

Proposed comment:

> `doesTargetAllowUnresolvedFuncSymbol` has no comment explaining how targets are classified (always allowed, allowed only under `-incomplete-library`, or never allowed).

### FG012: The name `isUnlinkedIncompleteModule` doesn't match its condition

- Status: Drop
- Confidence: Medium
- Scope: Direct
- Category: naming
- Location: `source/slang/slang-emit.cpp:3662`
- Overlap decision: Merged into C001
- Overlap rationale: C001 raises the same naming mismatch together with its behavioral consequences.
- Scope decision: Direct
- Scope rationale: New variable.

Proposed comment:

> The variable is true for any unlinked module with Import linkage, whether or not `-incomplete-library` was given, so "incomplete" names the motivating case rather than the condition.

## Coverage Audit

- `source/slang/slang-emit-spirv.cpp` (new block at 4248-4263): covered by C002 and C006. The two statements in the body mirror the existing `kIROp_DownstreamModuleImportDecoration` case and are obviously correct. The final comment sentence ("SPIR-V expresses this with Import linkage, which is also the only form in which it allows a function without a body") is accurate and sufficient.
- `source/slang/slang-emit.cpp`, `doesSPIRVModuleImportSymbols` (3496-3524): covered by C003 and FG001 (FG002 merged into C003). The `SLANG_RELEASE_ASSERT` on the word count checks the emitter's own output and follows the "fail loudly" rule. The `SpvOpFunction` early exit is justified by the doc comment's logical-layout sentence.
- `source/slang/slang-emit.cpp`, `createArtifactFromIR` (3655-3667): covered by C001, C004, C005, and FG003 (FG004, FG005, and FG012 merged or duplicated).
- `source/slang/slang-ir-link.cpp:1910`: the added `SPIRVAssembly` case obviously follows the existing binary/assembly pairs. The missing contract comment (FG011) is pre-existing and was dropped.
- `tests/library/incomplete-library-spirv-extern.slang`: the header is covered by FG010, the `COMPILE` runs by FG007, and the CHECK lines by FG008. The `-O0`..`-O3` `SIMPLE` matrix, the `NOLIB` diagnostic run, and the shader bodies are obviously clear. FG009 (the `OPT` block) was dropped after verification.

## Lead review (slang-reviewer) — independent verification

**Verdict: APPROVE_WITH_NITS.** 0 bugs, 2 gaps and 1 test gap, with a tested remedy patch attached (`pr14220-r1-remedy.patch`), plus comment nits. Head `d958b751e`, base `7f506f4c9`, diff sha256 `55f877fc4f8f…`.

Apply the patch verbatim and no new review round is needed. If you change its direction (for example, a warning instead of running the `-Xspirv-opt` passes), re-request review.

### Requirements

No human has commented on #14212 or #14220 (checked live 2026-11-03 02:33Z; only bots, and jkwak-work is the silent shepherd). The scope comes from the reporter, so these are **issue requirements**, not maintainer direction.

| # | Requirement (source) | Status | Evidence |
|---|---|---|---|
| IR1 | No crash for `c.slang` / `d.slang` with `-incomplete-library -target spirv` (issue body) | met | Base: `c` exits 139 at `-O1`..`-O3`, `d` at `-O2`..`-O3`. Head: both exit 0 at `-O0`..`-O3`. `slang-emit.cpp:3662-3667` |
| IR2 | Output has `OpCapability Linkage` and `f` as `LinkageAttributes … Import`, ready for `spirv-link` (issue Expected Behavior) | met | `slang-emit-spirv.cpp:4254-4263`. All 8 outputs pass `spirv-val --target-env spv1.5`. Linked with a hand-written exporter of `_S1fp1pi_uu`: valid for `vulkan1.2` before and after `spirv-opt -O`, with no Linkage left |
| IR3 | Without `-incomplete-library`, still `E45001` (issue body) | met | The test's `NOLIB` lane |

I agree with the fixer's self-check on triage B (key the skip on actual imports) and on triage C (Import only for `IRImportDecoration`). I disagree with "precompiled outputs unchanged". It holds for the linked outputs the fixer compared, but the precompiled SPIR-V of a module that imports another precompiled module now goes unoptimized. That change is also a crash fix nobody claimed (see G1).

### What I verified (facts)

- **Builds:** head Release build. For base I used `wt-14218-base` at `dd93102a4`, which differs from `7f506f4c9` only in `slang-session.cpp` (#14001, not on this path). I built SPIRV-Tools standalone (`spirv-val/link/opt/dis/as`) from `external/spirv-tools`.
- **New test:** 12/12 at head.
- **Full suite at head:** 11206/11209 at `-server-count 8`, with `libslang-llvm.so` present. The 3 failures are `fp8-cuda*`, which also fail on base (0/3). So there are 0 regressions. The `gfx-unit-test-tool` precompiled ExternalLink tests are not built in this config, so I did not run them.
- **Extern signatures:** `inout uint`, struct in/out, `float[4]`, `Texture2D<float4>` and `bool` all get Import at `-O0`..`-O2`, and the output passes spirv-val.
- **Debug info:** `-g2` and `-g2 -separate-debug-info` with the extern exit 0 at head and produce a valid main module plus a `.dbg.spv`; base exits 139.
- **`-emit-spirv-via-glsl`:** the same glslang "No function definition" error on base and head (out of scope).
- **Exporter side:** `export uint f(uint)` with `-incomplete-library -target spirv` gives `E57004` on both base and head (#6607). So Slang can supply the Export only from a precompiled module, or the user must supply other SPIR-V.
- **Remedy:**
  - Builds and passes clang-format 17.
  - New and changed tests pass 18/18.
  - `tests/library tests/spirv tests/modules`: 778/778 (30 ignored).
  - Reporter `c`/`d` outputs at `-O0`..`-O3` are byte-identical to head, and spirv-val is clean.
  - `-Xspirv-opt --strip-debug` now runs: 4 `OpName` become 0, and the output is still valid.
  - The `slang-emit-spirv.cpp` hunk is comment-only and was added after the build.

### Findings

- 🟡 **G1: the optimizer skip reaches beyond `-incomplete-library`; keep it, but name, document and test it.** (= A Gap 1 = C C001)
  - `isUnlinkedIncompleteModule` is true for any module that has an Import and is not linked here.
  - That includes `-embed-downstream-ir` precompiles of a module that imports another precompiled module. For example, `libB` imports `libA`, both precompiled. On base, precompiling `libB` exits **139 at the default `-O1`, with or without `-incomplete-library`**, and exits 0 at `-O0`. Head precompiles it fine, and a consumer links both and optimizes them to 0 `OpFunctionCall`.
  - So A's first option, gating on `-incomplete-library`, would bring that crash back. A's second option is right.
  - The existing precompiled tests never hit this crash because slang-test's `COMPILE` injects `-O0` (seen with `-v`).
  - The skip also covers the API-only `SkipDownstreamLinking` consumer: its SPIR-V is now returned unoptimized at `-O1`+. That belongs in the PR's Risk line.
  - Remedy:
    - Rename the variable to `hasUnresolvedImports`.
    - The comment lists the three producers.
    - Add a new `tests/library/precompiled-spirv-chain*.slang` test. Its `COMPILE` lines give `-O1` explicitly. Drill: the base `slang-test` itself segfaults (rc 139) on the test; head passes 3/3.
- 🟡 **G2: explicit `-Xspirv-opt` passes are silently dropped.** (= A Gap 2 = C C004; the fixer's ask 2)
  - Base runs `-O0 -Xspirv-opt --strip-debug` on `d.slang`: 4 `OpName` become 0. Head does not run it: `OpName` stays at 4, with no message.
  - That contradicts `docs/user-guide/08-compiling.md` ("they run even under `-O0`") and the comment just above the skip.
  - Remedy: skip only the `-O` preset. `optimizationLevel` becomes `None` when the module has imports, and the explicit passes still run. Add one sentence to `08-compiling.md`. Add new `XOPT` lanes at `-O0` and `-O2`; both fail on head and pass with the remedy.
- 🟡 **T1: the test does not bind the decoration to `f`, and the `OPT` check cannot fail for the right reason.** (= A clarity ×2, C FG007/FG008/FG010)
  - Remedy: `%[[F]]` binds the Import to the declaration and to the call, and `CHECK-NOT` catches a second LinkageAttributes.
  - A new `NOOPT` lane runs `mainNoExtern` at `-O0` and expects the call. At head, `-O0` has 1 `OpFunctionCall` and `-O2` has 0, so the `-O2` check really depends on spirv-opt.
  - The header is reworded to say what the test checks.
- 📝 **N1 (A clarity, C C002):** in `emitFuncDeclaration`, say that a precompiled-module function carries an export decoration and gets its Import from the `DownstreamModuleImportDecoration` case, so no function gets two. This is in the remedy.
- 📝 **N2 (A clarity, C C003/FG001), optional:** the binary scan rediscovers what the emitter already knows. I do not require changing it: the bytes are what spirv-opt will see, and `SpirvInstructionHelper` would need a copy of the blob. If you keep it, one comment line saying so is enough. Not in the remedy.
- 📝 **N3 (C C005/C006), PR description:** the description should say what the explanation comment already does:
  - the SPIRV-Tools crash site: `DeadBranchElimPass::FixBlockOrder` → `ReorderBasicBlocksInStructuredOrder` reads `blocks_[0]`;
  - that the export side must be a precompiled module or other SPIR-V (#6607);
  - the known limits (fixer ask 1 below).

### On the fixer's three asks

1. **Precompiled import plus an unresolved extern:** confirmed. Head exits 0 with no file and prints `SPIRV-TOOLS: Unresolved external reference to "_S1fp1pi_uu"`. Base wrote invalid SPIR-V at `-O0` and exits 139 at `-O1`. The silent exit 0 is the existing link-failure path (`slang-emit.cpp` returns `SLANG_FAIL` with no diagnostic); see side find S2. This is acceptable for this PR if it goes in the Risk line.
2. **`-Xspirv-opt`:** this is G2, with a tested remedy.
3. **`[Differentiable] extern` with `-target spirv-asm`:** confirmed. `fwd_diff(f)` fails with `E45001` (rc 255) on base and exits 139 on head. `-target spirv`, `hlsl` and `cuda` already exit 139 on base; `glsl` gives E45001. The crash does not depend on the target, so it is not this PR's code (side find S1). Acceptable as is.

### Devin (B) adjudication

- **B-Bug1, "imports cannot be resolved":** the problem is real but pre-existing and tracked as #6607, which the reporter linked. It is not a defect in this PR. N3 covers the disclosure.
- **B-Bug2, "repo-rule rationale absent":** I disagree. The coworker PR-description format is enforced by a hook, and the rationale is in the explanation comment. A human can decide.
- The fetch script found "2 Bugs" but extracted 0. I pulled the two titles by hand; the selector problem is noted for upstream.

### Side finds (not filed; relay to slang-triager per the hold)

- **S1:** under `-incomplete-library`, `fwd_diff` of a body-less `[Differentiable] extern` segfaults on hlsl, cuda and spirv; glsl gives E45001. Dedup: no matching issue. Repro: `runs/verify-14220/diffext2.slang`. Master `7f506f4c9` (equivalent). Likely cause: autodiff assumes the callee has a body (hypothesis; not traced).
- **S2:** slangc exits 0 and writes no output when its own `spirv-link` fails. Dedup: no issue (#12371 is a different validation problem). Repro: `mixed.slang` imports a precompiled `libA` and has an `extern`. Cause: `createArtifactFromIR` returns `SLANG_FAIL` on `linkresult != SLANG_OK` without diagnosing anything.
- **S3:** an extern `uint f(uint* p)` called with `&local` produces invalid SPIR-V: a `Function` pointer passed to a `PhysicalStorageBuffer` parameter. Pre-existing on base. Dedup: no issue found. Repro: `ptr.slang`. Cause: `specializeAddressSpace` cannot specialize a declaration (hypothesis).

## Result (machine-readable)

```json
{"verdict":"APPROVE_WITH_NITS","bugs":0,"gaps":2,"questions":0,"diff_hash":"55f877fc4f8f0eda6d82ab4a4f2322e76f3100859a6e0efa169198c6f460adf7","reviewers_complete":true}
```
