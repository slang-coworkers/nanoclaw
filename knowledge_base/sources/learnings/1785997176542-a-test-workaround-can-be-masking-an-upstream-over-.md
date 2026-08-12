# A test workaround can be masking an upstream over-fire — ask which artifact the code believed it was validating

When a test needs a workaround (forced env var, dropped flag, relaxed assertion) to pass, treat the workaround as a **finding about the system** until proven otherwise. Before adjusting the test, state *which artifact the code under test believed it was operating on*.

**Evidence (shader-slang/slang#12382, 2026-08-06 — "validate the emitted SPIR-V, not the pre-link module").** The new unit test forced `SLANG_RUN_SPIRV_VALIDATION="0"` around a library precompile, with the stated reason "CI exports it globally and validating a precompiled library rejects it for carrying `Linkage`/`Export`". True but shallow. Actual cause:

- `Module::precompileForTarget` (`source/slang/slang-compiler-tu.cpp:91`) sets exactly three options — `GenerateWholeProgram`, `Profile` (DXIL only), `EmbedDownstreamIR` — and **neither `SkipSPIRVValidation` nor `IncompleteLibrary`**.
- `shouldRunSPIRVValidation` (`source/slang/slang-emit.cpp:3264-3287`) gates on only those two options plus the env var, and **never consults `EmbedDownstreamIR`**.
- But `createArtifactFromIR` (`slang-emit.cpp:3335`) reads `EmbedDownstreamIR` into `isPrecompilation` **from the same option set** to suppress downstream linking.

So the code knows it is a precompilation exactly where validation is decided, and doesn't use it ⇒ with ambient `SLANG_RUN_SPIRV_VALIDATION=1`, **any** precompile-for-target is falsely rejected. Confirmed by 3 CLI cells with controls: (1) `-embed-downstream-ir` + env=1, no `-incomplete-library` ⇒ exit 255, no module, 1 `Capability Linkage` error; (2) + `-incomplete-library` ⇒ exit 0, 83924 B; (3) cell-1 shape, env unset ⇒ exit 0, 83924 B. Rejection tracks the gate arms exactly.

**Scope-settling method that beat all the hand-reasoning:** `git show $(git merge-base <pr> origin/master):source/slang/slang-emit.cpp | sed -n '/shouldRunSPIRVValidation/,/^}/p'` — the function was **byte-identical** at merge-base and PR head, proving the over-fire is pre-existing and untouched ⇒ separate issue, don't bundle. This is stronger than "it's a different call site", and it pre-empts the reader who suspects the PR author caused the bug they filed.

**The tell (hit twice in one session):** a test failure whose *shape* was informative — the rejected module showed `0 Import / 2 Export` and 0 entry-point symbols, i.e. the library, not the entry point — read as "my harness is misconfigured" rather than "the compiler validated the wrong module". Same defect family as the PR's own fix, one call site over.

**Reusable rules:**
1. An **API-path repro outranks a CLI-path repro**: CLI-only is dismissible as a flag-combination footgun; reaching it via `precompileForTarget` proves public-API reachability. The discarded "my test failed weirdly" *was* the API repro.
2. Make a load-bearing workaround **self-expiring** — its comment must name the defect and the issue number so the cleanup is discoverable from the code, not only the tracker.
3. `SLANG_ASSERT` on a silent-truncation hazard is debug-only; if you've *established* the invariant holds on all current paths, that's the argument for `SLANG_RELEASE_ASSERT` (never fires ⇒ costs nothing; the only firing scenario is an unaudited future path).
4. A peer confirming your hypothesis is a reason to **audit** it, not accept it. Re-derived here: the gate diff, and the blob-size claim — `RawBlob::create(request.linkResult, request.linkResultSize * sizeof(uint32_t))` is at **`source/compiler-core/`**`/slang-glslang-compiler.cpp:435`, not `source/slang/` as reported.
5. `ScopedEnvVar` (`tools/slang-unit-test/scoped-env-var.h`) mutates **process-global** env; `slang-test` runs unit tests in-process and concurrently (`slang-test-main.cpp:5793-5799` sets `useMultiThread` for `UseTestServer`/`UseFullyIsolatedTestServer` with `serverCount > 1`, `runTestsInParallel` fans out `std::thread` at `:5452-5455`), and CI defaults `server-count: 8`. 9 construction sites / 4 files; 4 of them set `SLANG_RUN_SPIRV_VALIDATION`. The exposure is real but bounded to the lexical windows (destructor restores).
