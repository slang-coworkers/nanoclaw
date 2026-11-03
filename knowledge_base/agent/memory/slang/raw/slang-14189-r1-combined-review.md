---
type: source
description: "slang-reviewer R1 combined review of PR #14189 (fixes #14183, head 3bf949220): APPROVE_WITH_NITS, 0 bugs, 1 gap (G1: Append/Consume E55204 has no location), 6 nits; verbatim memo, distilled state lives in ../14183-cpu-atomic-float-add-ice.md"
okf_synth: exempt
---
# Combined PR Review — shader-slang/slang#14189 (pr, head 3bf949220, R1)

## Lead verdict (slang-reviewer): APPROVE_WITH_NITS (0 bugs, 1 gap, 0 questions; 6 nits, one tested patch)

The fix is correct and sits at a defensible layer. Every `IRAtomicOperation` that reaches `CPPSourceEmitter` without a C++ lowering now gets a located E55204, not E99999. Integer `add`/`reduceAdd`/`+=` still compile and run. The HLSL and Metal emitters already report unsupported float atomics with the same E55204 at emit time (`slang-emit-hlsl.cpp:744`, `slang-emit-metal.cpp:456`), so this follows existing practice. Support also depends on `T` inside one generic method (int `add` works, float `add` does not), and only specialized IR can see that. CUDA and Torch do not change: their `tryEmitInstStmtImpl` handles all 13 atomic ops, or returns `false`, without calling the C++ base (`slang-emit-cuda.cpp:732-1030`, `slang-emit-torch.cpp:64`). Every atomic op goes through `emitInstStmt` (`slang-emit-c-like.cpp:3374-3386`), so the stmt-level catch-all cannot be bypassed through an expression.

**Maintainer direction: none.** Checked live at 15:10Z. #14183 has only the reporter and bot comments. #13705 has the reporter, the bot, and an assignee (jkwak-work) who has not commented. #14189 has only bot comments, and jkwak-work, the requested reviewer, has not commented.

**Issue requirements (#14183 body, reporter):**
- **IR1, "not an internal error" on the CPU target:** **met** for `cpp`/`shader-sharedlib`/`host-callable`. **Partial** overall, because `-emit-cpu-via-llvm`/`llvm-ir`/`host-object-code` still give E99997. That is disclosed, and the PR says "Addresses", so the issue stays open.
- **IR2, "either a float add in the prelude or a capability diagnostic like E36107":** **met** by a clean, located E55204. Real float support waits on the #13705 part-2 maintainer decision.
- **Fixer self-check:** I agree with R1–R6 except one point. R1 / the PR Summary say "at the user's call", which does not hold for `Append`/`Consume`: there the E55204 has no location, and the default output does not show the op name (G1).

### My verification (head 3bf949220, base 6815ed82d, L40S)

| Check | Result |
|---|---|
| Issue repro, `cpp` + `host-callable` | base E99999; head E55204 at `5:12`, "atomicAdd on float" |
| New tests | head **5/5**. Base: diagnostic test **0/3**; int-add **2/2** (a lock, as designed) |
| Exhaustive-mode drill: an extra unannotated `pu->sub(1u)` | fails 3/3, so exhaustive mode is real and the "integer add gives no diagnostic" claim is enforced |
| Full `slang-test`, head, `-server-count 8` | **11147/11150**. The only failures are the 3 `fp8-cuda*` tests, which also fail on master (known) |
| Opt/debug variants of the diagnostic test (`-O0`, `-g`, `-g -O0`, `-minimum-slang-optimization`, `-g3 -O0`) | each gives 24 errors at the same locations, with 0 E99999 |
| Extra probes on head: `groupshared Atomic<float>`, a generic `bump<T>(Atomic<T>*)` specialized for float and int, int `add` with a dynamic `MemoryOrder`, `reduceAnd`/`reduceInc`, plain `ib[0] = 5` on `RWStructuredBuffer<Atomic<int>>` | all diagnosed with a location. Int add with a dynamic order compiles. Base gives E99999 for all |
| **Alternative drill:** a per-method `[require(cuda_glsl_hlsl_metal_spirv_wgsl)]` on the type-independent ops (`sub/min/max/and/or/xor/increment/decrement`) | the core module does not build. E36108 on `reduceSub/Max/Min/And/...`: their `[require(atomic_reduce)]` includes `cpp`/`llvm` (`slang-capabilities.capdef:2282`). A front-end alternative would need an `atomic_reduce` split too, and would still need this emitter backstop for float `add`, accessors, plain assignment, and Append/Consume. That supports the PR's layer choice (see N6) |
| **Placeholder drill:** delete `_emitInstAsDefaultInitializedVar` from the helper | identical diagnostics on 5 probes (md5), tests 5/5. Once emit reports an error, the emitted C++ is discarded (`slang-emit.cpp:3120-3123`), and E55204 cannot be downgraded. So the placeholder has no effect (N2) |
| CI | run 41466582949: `wait-for-human-priority` failed and every build/test job was skipped. **No CI evidence yet** |

### Adjudication of A / B / C

- **A 🟡 Append/Consume catch-all: CONFIRMED, not a regression, already tracked as #14192** (filed 15:23Z). Head gives two E55204 with no location. Default output shows only `error[E55204]: unsupported intrinsic operation`; the op name ("atomicInc on int"/"atomicDec on int") appears only with `-enable-machine-readable-diagnostics`. → **G1**: fix the PR description and add a link. No code change needed in this PR.
- **A/C contract inconsistency (A 1376, C C001/FG006): CONFIRMED, and it is wider.** `docs/cpu-target.md:18` still says *"Atomics are not supported in user code"*, but the new `-cpu` test pins user-code `Atomic<int>.add` as supported. → **N1** (docs + comment in the patch).
- **A/C helper routes (A 1435, C FG002): CONFIRMED.** The comment names 1 of 4 producers: extension methods, plain assignment to an `Atomic<T>` lvalue (verified: E55204 at `=`), property accessors, and the Append/Consume lowering. → **N3**.
- **A/C placeholder (A 1450, C FG001/FG004): CONFIRMED by drill.** → **N2** (drop it, which also makes the helper's name accurate).
- **C FG003 value-type invariant: valid.** → stated in the N3 comment.
- **A/C uint64 never crosses 2^32: CONFIRMED.** → **N4**. The patch's high-word row is live: changing the expected value to 0 fails cpu and cuda.
- **A IR mnemonics (C FG007 dropped):** the fixer's judgment call (2). I accept it, and the patch comment now says "IR operation" explicitly.
- **A test header, getter vs setter locations:** valid as an observation. Optional (Q-opt below).
- **B (Devin): no bugs, flags, or informational items.** Commit status "unknown".

### Findings

- **G1 (gap) — the PR description says "Each now reports E55204 at the user's call."** Append/Consume (#14192) get E55204 with no location, and default output shows no op name. Accessor getters report inside the accessor body. **Remedy:** narrow the Summary ("…at the call; compiler-synthesized Append/Consume atomics still have no location, #14192"), and add `Related: #14192` in the PR body. The cpp symptom in #14192 changes with this PR, so its body goes stale on merge.
- **N1** `docs/cpu-target.md:18` contradicts the new contract. The patch rewrites the bullet: integer `Atomic<T>.add`/`reduceAdd`/`+=` work; everything else errors (E36107 or E55204); the LLVM backend has no atomics.
- **N2** `slang-emit-cpp.cpp:1450-1453`: the placeholder declaration has no effect (drill). The patch drops it, and the comment records why.
- **N3** `slang-emit-cpp.cpp:1432-1435`: the helper comment now lists all four routes and the `atomicStore` value-type rule.
- **N4** `atomic-cpu-integer-add.slang`: adds a uint64 high-word row (`+= 0x100000000ULL`, `>> 32` → 1). The header now says "each 32- and 64-bit integer type".
- **N5** `atomic-t-cpp-unsupported.slang`: adds `intBuffer[1] = 5;`, the plain-assignment `atomicStore` producer, which does not depend on the accessor gap.
- **N6 (explanation comment only):** "Why the emitter" rebuts only an extension-level `[require]`. Add one sentence on the per-method alternative (drill above: E36108 through `atomic_reduce`; the backstop is still needed). C001 asks for this justification.
- **Q-opt:** the getter errors land inside the accessor body, and the setter errors land at the assignment. Either explain this in the test header or leave it. Not blocking.

**Tested remedy:** `remedy-14189-r1.patch` (4 files, +18/−11; applies to head 3bf949220). On the drill build it gives new tests 5/5. `tests/diagnostics` + `atomic-t` + `cpu-program` + `compute/atomics` give 1027/1028; the one failure, `gfx-smoke`, needs the `gfx` DLL, which the partial drill build lacks, and it passes on the head build. Formatter tools are not installed here. The changed C++ lines are ≤100 columns, but run `./extras/formatting.sh` before committing.

### Side finds (not this PR; per the side-find hold, for slang-triager via slang-fixer, no GitHub action)

- **S1 Capability checking skips property accessors, on any target.** dedup: no match (searched "accessor capability", "property require capability", "getter capability check"). Repro: `[require(hlsl)] uint onlyHlsl() { return 0; }` called from `struct S { property uint v { get { return onlyHlsl(); } } }` and read in a compute entry point compiles with `-target spirv` and no error; a direct `onlyHlsl()` call gives E36107. master 6815ed82d. Cause (hypothesis, unverified): `SemanticsDeclCapabilityVisitor::visitPropertyDecl` (`slang-check-decl.cpp:23053`) does not join the accessors' inferred requirements into the `PropertyDecl` that callers reference. The fixer already lists this as a sibling; relay it if that has not been done.
- **S2 The default diagnostic formatter drops the span message of a diagnostic with no location.** dedup: no match (#12192/#11395 are about missing locations, not the dropped text). Repro: `AppendStructuredBuffer<uint> ab; … ab.Append(1)` with `-target cpp` on #14189 prints only `error[E55204]: unsupported intrinsic operation`, and `-enable-machine-readable-diagnostics` shows the span text `intrinsic operation 'atomicInc on int' …`. master 6815ed82d plus this PR. Cause: a rich diagnostic with no valid location prints only the header line, so any diagnostic that carries its detail in the span label loses that detail.
- **Append/Consume on CPU:** duplicate of **#14192**.

## Reviewer A — Correctness (nv-slang-bot)

**Verdict**: 🔴 Has issues — 0 bug(s), 1 gap(s), plus 6 clarity comments

The PR changes `CPPSourceEmitter::tryEmitInstStmtImpl` so that every `IRAtomicOperation` with no C++ lowering reports E55204 (`UnsupportedTargetIntrinsic`, e.g. "atomicAdd on float") and declares a placeholder result. Before, these hit `diagnoseUnhandledInst` (E99999). CUDA and Torch are unaffected: their `tryEmitInstStmtImpl` overrides handle all 13 atomic opcodes themselves and never delegate to the C++ version.

The new catch-all also catches `atomicInc`/`atomicDec` that the compiler itself builds for `AppendStructuredBuffer`/`ConsumeStructuredBuffer` on CPU. There, the message names an IR operation the user never wrote, probably has no source location, and no test covers it. The clarity comments are about the contract the comments and tests describe: whether CPU integer `Atomic<T>.add` is supported or an accident, which producers the catch-all guards, and the diagnostic's wording.

<details>
<summary>Changes Overview</summary>

**C++ emitter atomic diagnostics** (`source/slang/slang-emit-cpp.cpp`, `source/slang/slang-emit-cpp.h`)
- What changed: `kIROp_AtomicAdd` on non-integer types, and every other `IRAtomicOperation`, now goes to the new `_diagnoseUnsupportedAtomicOperation` and returns `true`. Before, it returned `false` and ended in E99999.
  - The helper builds its message from `getIROpInfo(op).name` plus `getTypeNameHint` of the value type. For `atomicStore` it uses the stored value's type.
  - For non-void results it emits a `T name = {};` placeholder, following the CUDA cooperative-vector precedent.
  - The `AtomicAdd` comment is updated to say that user code reaches the lowering through `Atomic<T>.add`/`reduceAdd`/`+=`.

**Regression tests** (`tests/diagnostics/atomic-t-cpp-unsupported.slang`, `tests/language-feature/atomic-t/atomic-cpu-integer-add.slang`)
- What changed: a new exhaustive-mode diagnostic test on `cpp`, `shader-sharedlib` and `host-callable` covers all 13 atomic opcodes. It reaches `load`/`store`/`exchange`/`compareExchange` through property accessors.
- What changed: a new `-cpu` compute test pins integer `add`/`reduceAdd`/`+=` for `int`, `uint`, `int64_t` and `uint64_t`.

</details>

<details>
<summary>Findings (7 total)</summary>

| Severity | Location | Finding |
|----------|----------|---------|
| 🟡 Gap | `source/slang/slang-emit-cpp.cpp:1424` | Catch-all also fires for compiler-built Append/Consume atomics on CPU; the message names an op the user never wrote, has no location, and is untested |
| 📝 Clarity | `source/slang/slang-emit-cpp.cpp:1376` | Comment calls CPU integer `Atomic<T>.add` a capability-hole accident; the new test pins it as supported |
| 📝 Clarity | `source/slang/slang-emit-cpp.cpp:1435` | Helper comment names only one of several producers the catch-all handles; the overall case analysis is no longer stated |
| 📝 Clarity | `source/slang/slang-emit-cpp.cpp:1444` | Diagnostic uses IR opcode mnemonics, not the API the user called |
| 📝 Clarity | `source/slang/slang-emit-cpp.cpp:1450` | "diagnose" helper also emits C++ output; the stated reason for the placeholder is unclear, and the value-type invariant is unstated |
| 📝 Clarity | `tests/diagnostics/atomic-t-cpp-unsupported.slang:8` | Accessor cases depend on a capability-check gap; getter and setter errors land at different locations without explanation |
| 📝 Clarity | `tests/language-feature/atomic-t/atomic-cpu-integer-add.slang:6` | "every integer width" claim, but the `uint64` section never crosses 2^32 |

</details>

<sub>reviewed: 3bf94922043a8c34bc9e7f22ba8c3682c4a7d65a · diff sha256 55ae97d3c6dd</sub>

---

### `source/slang/slang-emit-cpp.cpp:1424`

🟡 **Gap**: The catch-all also fires for atomics the compiler builds for `AppendStructuredBuffer`/`ConsumeStructuredBuffer` on CPU, and no test covers that

The new `default:` branch catches every `IRAtomicOperation`, not only those that come from user `Atomic<T>` calls.
- `AppendStructuredBuffer` is declared `[require(cpp_cuda_glsl_hlsl_metal_spirv_wgsl_llvm, appendstructuredbuffer)]` (`hlsl.meta.slang:126`).
- `appendstructuredbuffer = sm_5_0_version`, and that alias includes `| cpp | llvm` (`slang-capabilities.capdef:1754-1762`).
- `lowerAppendConsumeStructuredBuffers` runs for every target except HLSL (`slang-emit.cpp:1931`: `if (target != CodeGenTarget::HLSL && requiredLoweringPassSet.appendConsumeStructuredBuffer)`).
- That pass builds `builder.emitIntrinsicInst(builder.getIntType(), kIROp_AtomicInc, 2, atomicIncArgs)` and the matching `kIROp_AtomicDec` (`slang-ir-lower-append-consume-structured-buffer.cpp:129`, `:167`). They sit inside the new `AppendStructuredBuffer_Append`/`_Consume` functions.

So `appendBuf.Append(x)` on `-target cpp` now reaches this branch. The user gets "intrinsic operation 'atomicInc on int' is not supported for the current target", which names an operation they never wrote. That lowering file never sets a source location and does not mark the helpers for inlining, so the error most likely has no file or line either. Before this PR the same input gave E99999, so this is not a regression. But the PR summary says each case "now reports E55204 at the user's call", and that does not hold for this producer. No test pins the behavior.

**Example**:
```slang
//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK): -target cpp
AppendStructuredBuffer<uint> appendBuf;
ConsumeStructuredBuffer<uint> consumeBuf;
RWStructuredBuffer<uint> outBuf;
[shader("compute")][numthreads(1,1,1)]
void computeMain() { appendBuf.Append(1u); outBuf[0] = consumeBuf.Consume(); }
// expected after this PR: E55204 'atomicInc on int' / 'atomicDec on int', likely without a location
```

**Suggestion**: Choose the intended behavior for Append/Consume on CPU and pin it with a test like the one above. Either accept the IR-level message, or diagnose `Append`/`Consume` by name at the call site, for example where the capability or lowering is decided, so the user sees the API they called. If CPU is not meant to support these types, the `cpp` in their `[require]` is the real source of the mismatch.

---

### `source/slang/slang-emit-cpp.cpp:1376`

📝 **Clarity**: Is CPU integer `Atomic<T>.add` a supported feature or a capability-hole accident?

This comment and the new `-cpu` test disagree.
- The comment says shader coverage is the client this lowering exists for. It also says user code reaches it because the extension that declares `add` does not repeat `Atomic<T>`'s `[require(cuda_glsl_hlsl_metal_spirv_wgsl)]`. That describes a hole in capability checking, not a design decision.
- `tests/language-feature/atomic-t/atomic-cpu-integer-add.slang` calls the same path "the supported integer add" and pins it for all four integer widths.
- `reduceSub`/`reduceMin`/`reduceMax` carry `[require(atomic_reduce)]`, and `atomic_reduce` explicitly lists `cpp`, yet this PR makes them errors at emit time on CPU.

If someone later adds the missing `[require]` to the `extension<T : IArithmeticAtomicable> Atomic<T>` block in `core.meta.slang`, neither place tells them whether breaking the new test is a regression or the intended fix. Please state the contract in one place:
- user-facing integer `Atomic<T>.add` is supported on CPU, and the capability declarations should say so; or
- it is an accident the test should not pin.

The phrase "wrappers that inline to it" also hides the mechanism. `reduceAdd` is a `[ForceInline]` `__target_switch` whose non-CUDA `default:` arm calls `add`, which is why the claim holds on CPU but not on CUDA.

---

### `source/slang/slang-emit-cpp.cpp:1435`

📝 **Clarity**: The helper comment names only one of the producers the catch-all handles

The comment gives one reason atomics reach C++ emission: extension methods that skip the struct's `[require]`. The `default:` branch that calls this helper catches every `IRAtomicOperation`, and other producers feed it too:
- **Property accessors.** The new test's own header uses these to reach `load`/`store`/`exchange`/`compareExchange`.
- **Plain assignment to an `Atomic<T>` lvalue.** `slang-lower-to-ir.cpp` lowers it straight to `emitAtomicStore` (`if (as<IRAtomicType>(...)) builder->emitAtomicStore(...)`), with no method call.
- **The Append/Consume lowering**, covered in the Gap above.

Please say which producers this branch is meant to backstop, so a reader can tell whether it is a user-facing diagnostic or a general guard.

The PR also removed the sentence that explained the case analysis ("Other widths / float types fall through to the default unhandled-opcode diagnostic"). Unsupported atomics are now diagnosed from two places: the inner `default:` at line 1402 for non-integer `add`, and the outer `default:` here for every other opcode. One sentence saying the two together cover "every atomic except 32/64-bit integer add" would make that coverage explicit.

---

### `source/slang/slang-emit-cpp.cpp:1444`

📝 **Clarity**: Which "operation" does the diagnostic name: the IR opcode or the API the user called?

```cpp
operation << getIROpInfo(inst->getOp()).name << " on ";
```

The helper comment says the diagnostic names "the operation", but the text is the internal IR mnemonic from `slang-ir-insts.lua`, not the API the user called. The test pins these mismatches:

| User code | Message names |
|---|---|
| `pl->decrement()` | `atomicDec on int64_t` |
| `intBuffer[0]++` | `atomicInc on int` |
| `count.compareExchange(...)` | `atomicCompareExchange` |

For `add`/`max`/`load` the two happen to read alike. For the others the user sees a name they never wrote. Renaming a Lua key would also silently change this user-facing text and break the test. Please either state in the comment that IR mnemonics are the intended vocabulary, or map the opcodes to the user-facing method or operator names.

---

### `source/slang/slang-emit-cpp.cpp:1450`

📝 **Clarity**: The diagnose helper also emits C++ output, and its contract does not say so

The name `_diagnoseUnsupportedAtomicOperation` and its declaration comment both describe reporting a diagnostic. The body also writes a placeholder declaration of the instruction's result into the C++ output. That side effect is what makes `return true` ("this instruction has been emitted") correct at both call sites. A reader of `_diagnoseUnsupportedAtomicOperation(atomic); return true;` cannot tell that without opening the body.

The in-body reason is that later uses should "name a declared value". But `emitEntryPointsSourceFromIR` returns `SLANG_FAIL` as soon as the error count rises during emission (`slang-emit.cpp`: `if (sink->getErrorCount() > errorCountBeforeEmit) return SLANG_FAIL;`), so this C++ is never compiled or shown to the user. Please put the emission in the caller-visible contract, and say what the placeholder actually protects: consistency inside the emitter, or some consumer of partial output.

A related unstated invariant is at lines 1439-1441. The result type is treated as "the value type" for every opcode except `atomicStore`. That holds only because the other twelve `IRAtomicOperation` opcodes all return the old stored value, and `atomicStore` is the only void-typed one. Stating that, or asserting it, would make the special case obviously complete.

---

### `tests/diagnostics/atomic-t-cpp-unsupported.slang:8`

📝 **Clarity**: The accessor cases depend on a capability-check gap, and getter and setter errors land at different locations without explanation

The header explains that `load`/`store`/`exchange`/`compareExchange` are reachable only because capability checking skips property accessor bodies. Two things about that section are hard to read.

1. The test runs in exhaustive mode (the default per `docs/diagnostics.md`). Fixing that front-end gap would add capability errors and leave four E55204 annotations unmatched, so the file would fail on all three targets. Is the file meant as a tripwire for that fix, or is the accessor route just a convenient way to reach these opcodes today?
2. The header says each operation "is reported at the user's call", but the two accessor kinds report in different places:
   - The getter errors (`atomicLoad`, `atomicExchange`) are annotated inside the accessor bodies, at `count.load()`/`count.exchange(0)`. The call site `outputBuffer[0] = counterBuffer[0].value;` has no annotation.
   - The setter errors (`atomicStore`, `atomicCompareExchange`) are annotated at the assignment `counterBuffer[0].value = 3;`, with nothing inside the setter body.

   A reader cannot tell why reads and writes differ, or whether the test is meant to pin that difference.

Explaining both in the header, or moving the accessor cases into their own file, would make a future failure here easy to read. For `atomicStore` the gap is not needed at all: plain assignment `intBuffer[0] = 5;` lowers through `emitAtomicStore` in `slang-lower-to-ir.cpp`, so that case can be separated from the gap.

---

### `tests/language-feature/atomic-t/atomic-cpu-integer-add.slang:6`

📝 **Clarity**: The header claims "every integer width", but the `uint64` section never crosses 2^32

The `int64` section crosses 2^32 (`int64Buffer[0] += 0x100000000;`, then `>> 32` gives 1), so it shows the 64-bit helper really updates the high word. The `uint64` section only goes 0 → 7 → 8 (`uint64Buffer[0].add(7)`, then `reduceAdd(1)`, then `add(0)`). It would still pass if `_slang_atomic_add_u64` were mistakenly bound to a 32-bit add.

Either give `uint64` the same high-word check, or narrow the header's "every integer width" claim to what the test actually distinguishes. For example, add `uint64Buffer[0].reduceAdd(0x100000000ULL);`, then `outputBuffer[8] = int(uint64Buffer[0].add(0) >> 32);`, grow the output buffer to 9 elements, and add `// CHECK-NEXT: 1`.

## Reviewer B — Devin Review

# Devin Review

## AI Analysis

CPU targets now report unsupported atomic operations at the user's call instead of internal error E99999. Integer add keeps working on every integer width.

Summary: On CPU targets (cpp, shader-sharedlib, host-callable), Atomic<T> operations reaching C++ emission other than integer add, e.g. float add or integer sub, failed with internal error E99999. Each now reports E55204 at the user's call, naming the op and value type ("atomicAdd on float"). Root cause: CPPSourceEmitter::tryEmitInstStmtImpl (slang-emit-cpp.cpp:1367) lowers only integer AtomicAdd, yet other ops reach emit: the Atomic<T> extensions (core.meta.slang:4223, :4304) skip the struct's [require], and property accessors are not capability-checked. Tests: New diagnostic test (24 sites, 3 CPU targets) fails before and passes after; new -cpu test pins integer add. Full slang-test: only 3 fp8 CUDA failures, also failing on master. Risk: Only CPU C++ emission of these atomics changes; float add stays unsupported on CPU. CUDA/HLSL/SPIR-V results are byte-identical across 132 selected test files. Addresses #14183

🤖 Generated by an automated Slang coworker — may be inaccurate. A human maintainer should verify.

Show less
225 lines left
1
Diagnose unsupported atomic ops in CPPSourceEmitter
0/2
slang-emit-cpp.cpp
source/slang
+37
−12
Viewed
All 1335 lines
5 lines
1336
bool CPPSourceEmitter::tryEmitInstStmtImpl(IRInst* inst)
1337
{
1338
    switch (inst->getOp())
5 lines
All 28 lines
5 lines
1367
    case kIROp_AtomicAdd:
1368
        {
All 4 lines
1373
            // Shader coverage is the client this lowering exists for,
1374
            // and it only emits the unsigned variants (its
1375
            // synthesized buffer element type is uint/uint64). User
1376
            // code does not reach it through the atomic APIs meant
1377
            // for it: `InterlockedAdd` and `Atomic<T>` declare
1378
            // capabilities that exclude the CPU target, so they are
1379
            // rejected before emission. `Atomic<T>.add` is the
1380
            // exception, because the extension that declares it does
1381
            // not repeat `Atomic<T>`'s `[require]`; that is also the
1382
            // only way the signed variants are reached.
1376
            // code reaches it through `Atomic<T>.add` and the
1377
            // `reduceAdd` and `+=` wrappers that inline to it, because
1378
            // the extension that declares `add` does not repeat
1379
            // `Atomic<T>`'s `[require]`. `InterlockedAdd` declares
1380
            // capabilities that exclude the CPU target, so it is
1381
            // rejected before emission.
1382
            //
1383
            // 32-bit and 64-bit integer widths are supported via the
1384
            // matching prelude helper pair
1386
            // (`_slang_atomic_add_{u,i}{32,64}`). Other widths /
1387
            // float types fall through to the default unhandled-
1388
            // opcode diagnostic so the build fails loudly instead
1389
            // of producing bogus code.
1385
            // (`_slang_atomic_add_{u,i}{32,64}`).
1386
            auto dataType = inst->getDataType();
1387
            char const* helper;
1388
            switch (dataType->getOp())
1389
            {
5 lines
All 12 lines
5 lines
1402
            default:
1407
                return false;
1403
                _diagnoseUnsupportedAtomicOperation(cast<IRAtomicOperation>(inst));
1404
                return true;
1405
            }
5 lines
All 15 lines
5 lines
1421
            return true;
1422
        }
1423
    default:
1424
        if (auto atomic = as<IRAtomicOperation>(inst))
1425
        {
1426
            _diagnoseUnsupportedAtomicOperation(atomic);
1427
            return true;
1428
        }
1429
        return false;
1430
    }
1431
}
1432
 
1433
// Report an atomic operation that the C++ target has no lowering for as an unsupported intrinsic,
1434
// naming the operation and its value type (for example "atomicAdd on float"). User code can reach
1435
// C++ emission with these operations because the `Atomic<T>` methods declared in extensions do not
1436
// repeat the struct's `[require]`.
1437
void CPPSourceEmitter::_diagnoseUnsupportedAtomicOperation(IRAtomicOperation* inst)
1438
{
1439
    IRType* valueType = inst->getDataType();
1440
    if (auto store = as<IRAtomicStore>(inst))
1441
        valueType = store->getVal()->getDataType();
1442
 
1443
    StringBuilder operation;
1444
    operation << getIROpInfo(inst->getOp()).name << " on ";
1445
    getTypeNameHint(operation, valueType);
1
1446
    getSink()->diagnose(Diagnostics::UnsupportedTargetIntrinsic{
1447
        .operation = operation.produceString(),
1448
        .location = inst->sourceLoc});
1449
 
1450
    // We still declare the result, as the CUDA emitter does for unsupported cooperative-vector
1451
    // operations, so that later uses of the instruction in the emitted C++ name a declared value.
1452
    if (!as<IRVoidType>(inst->getDataT

## Vulnerabilities

(none reported)

## Bugs



## Flags

(none reported)

## Informational

(none reported)

## Reviewer C — Clarity

The clarity pipeline for PR 14189 is done, and nothing was posted to GitHub. I checked the canonical file's format against the posting script's parsing rules by reading the code, but did not run the script. The canonical file is `tmp/review-candidates/pr-14189-clarity-workflow.md`, and its full contents follow.

# PR 14189 Clarity Workflow Candidates

## PR Summary

**Title:** Diagnose unsupported atomic operations on CPU targets instead of E99999 (head `3bf94922043a8c34bc9e7f22ba8c3682c4a7d65a`, +213/−12).

**What the description says:** On the `cpp`, `shader-sharedlib`, and `host-callable` targets, `Atomic<T>` operations other than integer add (for example float `add` or integer `sub`) failed with the internal error E99999. They now report E55204 ("atomicAdd on float"). The description puts the root cause in the front end: the `Atomic<T>` extensions skip the struct's `[require]`, and property accessors are not capability-checked. The fix is in `CPPSourceEmitter::tryEmitInstStmtImpl`.

**What the diff does:**

- `slang-emit-cpp.cpp`:
  - The `kIROp_AtomicAdd` case now diagnoses non-32/64-bit-integer element types instead of returning `false`.
  - A new `default:` branch catches every other `IRAtomicOperation` and diagnoses it.
  - A new private helper, `_diagnoseUnsupportedAtomicOperation`, builds the message from the IR opcode mnemonic plus `getTypeNameHint` of the value type, reports `UnsupportedTargetIntrinsic`, and emits a default-initialized declaration of the result.
  - The `AtomicAdd` comment is rewritten to describe how user code reaches it.
- `slang-emit-cpp.h`: declares the helper.
- `tests/diagnostics/atomic-t-cpp-unsupported.slang`: an exhaustive diagnostic test over all 13 atomic opcodes on the three CPU targets, including the property-accessor route for `load`, `store`, `exchange`, and `compareExchange`.
- `tests/language-feature/atomic-t/atomic-cpu-integer-add.slang`: a CPU runtime test that pins integer `add`, `reduceAdd`, and `+=` for `int`, `uint`, `int64_t`, and `uint64_t`.

**Match with description:** The diff matches the description. One nuance: the description says the diagnostic lands "at the user's call", but for accessor-routed operations it lands inside the accessor body. The description also openly traces the root cause to the front end while fixing at emit, and the PR does not say whether that layer choice is permanent. Separately, `reduce*` reaches emission because `atomic_reduce` explicitly lists `cpp`, a route that neither the description nor the code comments mention.

**Value:** High for its size. It turns an ICE into an actionable, well-located diagnostic and adds solid coverage.

## Review Body

> Claude Opus 5.5-authored clarity review:
>
> This is a small, worthwhile PR. It turns an internal error (E99999) into a real diagnostic (E55204) that names the operation and value type, and the diagnostic test covers every atomic opcode on all three CPU targets. The mechanics look close to merge-ready. Most of my comments are about whether the code explains *why* it is shaped this way. They aren't requests for different behavior.
>
> ## Main Concerns
>
> - **The CPU contract for `Atomic<T>`.** The new comments and test headers explain reachability in terms of front-end capability gaps, and those capability declarations are inconsistent:
>   - `Atomic<T>` itself excludes CPU.
>   - The extension methods have no `[require]`.
>   - `atomic_reduce`, which gates `reduce*`, explicitly lists `cpp`.
>
>   Meanwhile the PR pins integer add on CPU as supported. Please state the intended contract once, and say whether the emit-time diagnostic is the permanent layer or a backstop for the upstream gap. Then make the emitter comment, the helper comment, and both test headers consistent with it.
> - **The helper's contract.**
>   - `_diagnoseUnsupportedAtomicOperation` also emits a declaration, which its name hides.
>   - Its reachability comment covers only one of the three routes it handles.
>   - Its "value type" rule special-cases `atomicStore` implicitly.
>   - The stated reason for declaring the result after an error doesn't hold, because the emitted C++ is discarded once emit reports an error.
> - **Test intent.** In the integer-add test, each width exercises a different subset of operations, and only `int64_t` checks the high word. A sentence on what each block proves would make it clear what the test protects.
>
> None of these should be hard to address. They are mostly about comments and naming, plus one possibly unnecessary line.

## Kept

### C001: The CPU contract for `Atomic<T>` is described only through capability gaps

- Status: Keep
- Confidence: High
- Scope: Direct
- Category: invariant
- Location: `source/slang/slang-emit-cpp.cpp:1376-1381`
- GitHub link: https://github.com/shader-slang/slang/pull/14189/files
- Overlap decision: Keep
- Overlap rationale: This is the umbrella contract and layer-choice concern; C002, C003, and FG006 were merged into it, and the more local FG002 is kept separately because it names a specific factual gap in a different comment.
- Scope decision: Direct
- Scope rationale: The PR rewrites this comment, adds both tests whose headers make the same reachability claims, and chooses the emit-time layer for the fix.

Context:

```cpp
            // Shader coverage is the client this lowering exists for,
            // and it only emits the unsigned variants (its
            // synthesized buffer element type is uint/uint64). User
            // code reaches it through `Atomic<T>.add` and the
            // `reduceAdd` and `+=` wrappers that inline to it, because
            // the extension that declares `add` does not repeat
            // `Atomic<T>`'s `[require]`. `InterlockedAdd` declares
            // capabilities that exclude the CPU target, so it is
            // rejected before emission.
```

```slang
// core.meta.slang
[require(cuda_glsl_hlsl_metal_spirv_wgsl)]
struct Atomic<T : IAtomicable> { ... }
extension<T : IArithmeticAtomicable> Atomic<T>
{
    __intrinsic_op($(kIROp_AtomicAdd)) [__ref] T add(...);   // no [require]
    [require(atomic_reduce)] ... void reduceAdd(...)         // atomic_reduce lists `cpp`
}
```

Proposed comment:

> After reading this comment and the two new tests, I can't tell what the CPU contract for `Atomic<T>` is supposed to be. The comment explains how user code *reaches* this lowering (the extension doesn't repeat `Atomic<T>`'s `[require]`) but not whether that is intended. The capability declarations also disagree with each other:
>
> - `Atomic<T>` itself is `[require(cuda_glsl_hlsl_metal_spirv_wgsl)]`, which excludes CPU.
> - The `add`/`sub`/... extension methods have no `[require]` at all.
> - `reduceAdd`/`reduceSub`/`reduceMin`/`reduceMax` carry `[require(atomic_reduce)]`, and `atomic_reduce` explicitly lists `cpp`.
>
> So the capability system advertises `reduceSub` on CPU, and this PR then rejects it at emit time.
>
> The PR also adds `atomic-cpu-integer-add.slang`, which pins signed and unsigned user-level `add`/`reduceAdd`/`+=` on CPU as supported, while this comment still opens with "shader coverage is the client this lowering exists for". Could you state the intended contract in one place?
>
> - If integer `Atomic<T>.add` on CPU is a supported user feature, which capability declaration is meant to describe it?
> - If it works only because of a capability gap, are the new E55204 diagnostics a backstop until the front end rejects these calls? What should happen to `atomic-t-cpp-unsupported.slang` when that gap closes? Its header documents the same gaps, including property accessors not being capability-checked.
>
> Either way, this comment, the helper's doc comment, and both test headers should tell the same story. The PR description traces the root cause to the front end. If diagnosing in the emitter is the permanent design, please say why the emitter owns this decision rather than the capability declarations or an IR check like `checkUnsupportedInst`. The HLSL and Metal emitters' emit-time diagnostics for unsupported float atomics would be a reasonable precedent to cite.

Notes:
`atomic_reduce` is defined at `slang-capabilities.capdef:2282` as `_cuda_sm_7_0 | glsl | hlsl | metal | spirv | wgsl | cpp | llvm`. `checkUnsupportedInst` is skipped under minimum-optimization mode (`slang-emit.cpp:2955-2956`), which may be a legitimate reason to keep an emit-time diagnostic. The comment asks for the justification and does not prescribe a layer. The posted text absorbs C002 (layer choice), C003 (test header contract), and FG006 (stale "exists for").

### FG001: `_diagnoseUnsupportedAtomicOperation` also emits code, which its name hides

- Status: Keep
- Confidence: High
- Scope: Direct
- Category: naming
- Location: `source/slang/slang-emit-cpp.cpp:1437`
- GitHub link: https://github.com/shader-slang/slang/pull/14189/files
- Overlap decision: Keep
- Overlap rationale: This is a naming and contract mismatch, distinct from FG004, which questions whether the emitted declaration is needed at all.
- Scope decision: Direct
- Scope rationale: The function is new in this PR.

Context:

```cpp
void CPPSourceEmitter::_diagnoseUnsupportedAtomicOperation(IRAtomicOperation* inst)
{
    ...
    getSink()->diagnose(Diagnostics::UnsupportedTargetIntrinsic{...});
    ...
    if (!as<IRVoidType>(inst->getDataType()))
        _emitInstAsDefaultInitializedVar(inst, inst->getDataType());
}
```

Proposed comment:

> The name and the first sentence of the doc comment say this function *reports* a diagnostic, but it also writes a default-initialized declaration of the instruction's result into the C++ output. Both call sites rely on that: they `return true` from `tryEmitInstStmtImpl`, which tells the base emitter the statement has been emitted. At `_diagnoseUnsupportedAtomicOperation(atomic); return true;` a reader can't see that anything was emitted. Could the name and the doc comment's contract cover both effects? CUDA's analogous `emitUnsupportedTargetIntrinsicExpr` uses an `emit…` name for the same diagnose-then-emit-a-placeholder pattern. If FG004's question shows the declaration is unnecessary, this goes away instead.

Notes:
The header declaration at `slang-emit-cpp.h:105` has the same name. Whether the emitted declaration is needed at all is FG004; if it is dropped, this mismatch disappears, and the comment says so.

### FG002: The helper's reachability explanation covers only one of the paths it handles

- Status: Keep
- Confidence: High
- Scope: Direct
- Category: comments
- Location: `source/slang/slang-emit-cpp.cpp:1433-1436`
- GitHub link: https://github.com/shader-slang/slang/pull/14189/files
- Overlap decision: Keep
- Overlap rationale: C001 asks for one consistent contract overall; this candidate names a concrete local inaccuracy in a different comment, which the author can fix even if C001 is resolved by citing precedent.
- Scope decision: Direct
- Scope rationale: The doc comment is new in this PR.

Context:

```cpp
// Report an atomic operation that the C++ target has no lowering for as an unsupported intrinsic,
// naming the operation and its value type (for example "atomicAdd on float"). User code can reach
// C++ emission with these operations because the `Atomic<T>` methods declared in extensions do not
// repeat the struct's `[require]`.
```

Proposed comment:

> This explains why the operations reach C++ emission only in terms of the extension methods. But this helper also handles `atomicLoad`, `atomicStore`, `atomicExchange`, and `atomicCompareExchange`. Those are declared on `Atomic<T>` itself, under its `[require]`. The new diagnostic test says they reach emission only because capability checking doesn't visit property accessors. The `reduce*` wrappers are a third route, since their `[require(atomic_reduce)]` lists `cpp`. As written, the comment implies the struct's own methods can't get here. Could the comment either list every route this helper actually handles, or point to the single place that documents them?

Notes:
This is a concrete inconsistency between this comment and the test header at `tests/diagnostics/atomic-t-cpp-unsupported.slang:5-9`.

### FG003: "Value type" is defined implicitly, and `atomicStore` is special-cased twice

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: function contract
- Location: `source/slang/slang-emit-cpp.cpp:1439-1441`
- GitHub link: https://github.com/shader-slang/slang/pull/14189/files
- Overlap decision: Keep
- Overlap rationale: No other candidate covers how the message's type is derived.
- Scope decision: Direct
- Scope rationale: These lines are new in this PR.

Context:

```cpp
    IRType* valueType = inst->getDataType();
    if (auto store = as<IRAtomicStore>(inst))
        valueType = store->getVal()->getDataType();
    ...
    if (!as<IRVoidType>(inst->getDataType()))
        _emitInstAsDefaultInitializedVar(inst, inst->getDataType());
```

Proposed comment:

> The doc comment says the message names the operation's "value type", but that term is defined only by these three lines: the result type, except for `atomicStore`, where it is the stored operand's type. To trust this, a reader has to check that every other `IRAtomicOperation` returns exactly the type of the atomically accessed memory (`compareExchange`, `inc`/`dec`, `exchange`, ...). Further down, the same "store has no result" distinction comes back as a separate `IRVoidType` check on `inst->getDataType()`, so the function juggles two different types under one unqualified name. Could you state the invariant this relies on, or derive the value type from something that holds uniformly for every atomic op? Keeping the result type clearly separate from the value type named in the message would also help.

Notes:
The comment doesn't prescribe the pointer operand's pointee type, because it is unclear whether that is `T` or `Atomic<T>` at this point in lowering.

### FG004: Declaring the result after an error has no observable consumer, so the stated reason doesn't establish necessity

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: control flow
- Location: `source/slang/slang-emit-cpp.cpp:1450-1453`
- GitHub link: https://github.com/shader-slang/slang/pull/14189/files
- Overlap decision: Keep
- Overlap rationale: This questions whether the line is necessary; FG001 is about the name given that the line exists.
- Scope decision: Direct
- Scope rationale: Both the line and its comment are new in this PR.

Context:

```cpp
    // We still declare the result, as the CUDA emitter does for unsupported cooperative-vector
    // operations, so that later uses of the instruction in the emitted C++ name a declared value.
    if (!as<IRVoidType>(inst->getDataType()))
        _emitInstAsDefaultInitializedVar(inst, inst->getDataType());
```

```cpp
// slang-emit.cpp:3120-3123
        const Index errorCountBeforeEmit = sink->getErrorCount();
        sourceEmitter->emitModule(irModule, sink);
        if (sink->getErrorCount() > errorCountBeforeEmit)
            return SLANG_FAIL;
```

Proposed comment:

> The justification is that later uses in the emitted C++ should name a declared value. But once this function has reported an error, `emitModule`'s caller (`slang-emit.cpp:3120-3123`) returns `SLANG_FAIL` and discards the emitted source, so no C++ compiler ever sees those uses. What breaks if the declaration is omitted? If some emitter invariant needs it (for example, that every statement-emitted instruction has its result declared), please name that invariant in the comment. Otherwise the line, and the appeal to the CUDA emitter as precedent, doesn't show that it is necessary.

Notes:
Verified that new emit-time errors cause the emitted C++ to be discarded. The precedent may be about keeping emitter state consistent; the author should say so if that is the reason.

### FG009: The integer-add test exercises an uneven subset per width, and the purpose of the high-word check is unstated

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: comments
- Location: `tests/language-feature/atomic-t/atomic-cpu-integer-add.slang:35-37`
- GitHub link: https://github.com/shader-slang/slang/pull/14189/files
- Overlap decision: Keep
- Overlap rationale: This is the only candidate about the positive runtime test's design.
- Scope decision: Direct
- Scope rationale: The test file is new in this PR.

Context:

```slang
    outputBuffer[4] = int(int64Buffer[0].add(5));
    int64Buffer[0] += 0x100000000;
    outputBuffer[5] = int(int64Buffer[0].add(0) >> 32);

    outputBuffer[6] = int(uint64Buffer[0].add(7));
    uint64Buffer[0].reduceAdd(1);
    outputBuffer[7] = int(uint64Buffer[0].add(0));
```

Proposed comment:

> The header says this test checks that integer add "still runs for every integer width". Each width, though, exercises a different subset of `add`/`reduceAdd`/`+=`, and only the `int64_t` block checks that the add reaches the high 32 bits (`+= 0x100000000`, then `>> 32`). The `uint64_t` values stay below 2^32, so a 64-bit helper that only updated the low word would still pass that block. If the high-word check is what proves the 64-bit path works, please say so and explain why `uint64_t` doesn't need it. "Every integer width" also means the four 32/64-bit types `Atomic<T>` accepts, not 8/16-bit, which is worth stating.

Notes:
Mis-selecting a helper would fail C++ compilation because the helpers take typed pointers, so the high-word check guards the prelude's 64-bit implementation rather than helper selection.

## Dropped

### C002: The choice to diagnose at emit time, not in an IR/front-end check, is unexplained

- Status: Drop
- Confidence: Medium
- Scope: Direct
- Category: organization
- Location: `source/slang/slang-emit-cpp.cpp:1423-1428`
- Overlap decision: Merged into C001
- Overlap rationale: The layer-choice question is part of the same "state the intended contract" concern, and C001's final paragraph now asks it directly.
- Scope decision: Direct
- Scope rationale: The PR chose this layer.

Proposed comment:

> The PR description says the root cause is upstream: capability checking misses the `Atomic<T>` extensions and property accessors. The fix, though, is a diagnostic in the C++ emitter. `checkUnsupportedInst` (`slang-ir-check-unsupported-inst.cpp`) already exists to diagnose instructions that kernel C++ cannot represent, such as `String`. On the other hand, the HLSL and Metal emitters diagnose unsupported atomics at emit time. Which layer is intended to own "this atomic has no C++ lowering", and why?

### C003: The diagnostic-test header mixes the protected contract with incidental capability gaps

- Status: Drop
- Confidence: Medium
- Scope: Direct
- Category: comments
- Location: `tests/diagnostics/atomic-t-cpp-unsupported.slang:3-9`
- Overlap decision: Merged into C001
- Overlap rationale: C001 now asks what should happen to this test when the gaps close, and FG002 covers the incomplete reachability claim for `reduce*`.
- Scope decision: Direct
- Scope rationale: The test is new in this PR.

Proposed comment:

> The header explains how each operation gets past capability checking, but not which expectations are the contract under test. Is the contract "no E99999, and E55204 naming op and type", or is it these exact diagnostics at these exact sites? The `reduce*` wrappers also carry `[require(atomic_reduce)]`, which lists `cpp`, so they don't reach emission only because the extensions skip `[require]`. Please make clear what a maintainer should do with this test if capability checking starts covering accessors or the extensions.

### FG006: "The client this lowering exists for" is stale now that user-level integer add is pinned

- Status: Drop
- Confidence: Medium
- Scope: Direct
- Category: comments
- Location: `source/slang/slang-emit-cpp.cpp:1373-1375`
- Overlap decision: Merged into C001
- Overlap rationale: C001 quotes this sentence as part of the contract inconsistency.
- Scope decision: Direct
- Scope rationale: The PR rewrote the surrounding comment and added the test that makes it stale.

Proposed comment:

> With the new `atomic-cpu-integer-add.slang` pinning signed and unsigned user-level `Atomic<T>.add` on CPU, shader coverage is no longer the only client this lowering is maintained for. The opening sentence now undersells what the lowering supports.

### FG005: The outer `default:` relies on every atomic op being routed to `emitInstStmt`

- Status: Drop
- Confidence: Low
- Scope: Direct
- Category: control flow
- Location: `source/slang/slang-emit-cpp.cpp:1423-1428`
- Overlap decision: Keep
- Overlap rationale: There is no direct overlap.
- Scope decision: Direct
- Scope rationale: The branch is new in this PR.
- Judgment decision: Drop
- Judgment rationale: Routing every `IRAtomicOperation` to `emitInstStmt` is an established base-emitter invariant (`slang-emit-c-like.cpp:3374-3386`), and the new exhaustive diagnostic test exercises all 13 atomic opcodes, so the case analysis is both obvious and tested.

Proposed comment:

> This branch covers "every atomic other than integer `AtomicAdd`" only because `CLikeSourceEmitter::emitInst` sends every `IRAtomicOperation` to `emitInstStmt` (`slang-emit-c-like.cpp:3374-3386`). An atomic op emitted as an expression would bypass it. Could the case analysis say that?

### FG007: The diagnostic text uses IR opcode mnemonics rather than the user's API names

- Status: Drop
- Confidence: Low
- Scope: Direct
- Category: terminology
- Location: `source/slang/slang-emit-cpp.cpp:1444`
- Overlap decision: Keep
- Overlap rationale: There is no direct overlap.
- Scope decision: Direct
- Scope rationale: The message format is new in this PR.
- Judgment decision: Drop
- Judgment rationale: The mnemonics (`atomicAdd`, `atomicInc`) are readable and familiar from GLSL/HLSL, there is precedent for IR op names in diagnostics (`slang-emit-hlsl-prelude.cpp:340`), and the doc comment states the format explicitly; this is a design preference, not a clarity gap.

Proposed comment:

> The user writes `intBuffer[0]++` or `count.compareExchange(...)` and sees `atomicInc on int` or `atomicCompareExchange on uint`. Those IR mnemonics are now part of user-facing diagnostic text and are pinned by the tests. Is that the intended vocabulary?

### FG008: The `getTypeNameHint` output is used as a user-facing type spelling

- Status: Drop
- Confidence: Low
- Scope: Direct
- Category: function contract
- Location: `source/slang/slang-emit-cpp.cpp:1445`
- Overlap decision: Keep
- Overlap rationale: There is no direct overlap.
- Scope decision: Direct
- Scope rationale: The line is new in this PR.
- Judgment decision: Drop
- Judgment rationale: `IAtomicable` is `[sealed]` and implemented only by builtin scalars, so the name hint always equals the user-facing spelling (`float`, `int64_t`, `half`), as the test confirms.

Proposed comment:

> `getTypeNameHint` builds identifier-style name hints. Is its output guaranteed to match the user-facing type spelling for every value type that can reach here?

### FG010: The test-only property names don't describe their accessor behavior

- Status: Drop
- Confidence: Low
- Scope: Direct
- Category: naming
- Location: `tests/diagnostics/atomic-t-cpp-unsupported.slang:27-33`
- Overlap decision: Keep
- Overlap rationale: There is no direct overlap.
- Scope decision: Direct
- Scope rationale: The test is new in this PR.
- Judgment decision: Drop
- Judgment rationale: The test header already explains that these accessors exist only to route `load`/`store`/`exchange`/`compareExchange` through property accessors, so a rename would add little.

Proposed comment:

> `previous` has a mutating getter that resets the counter and a setter that does a compare-exchange. The name doesn't describe either behavior.

## Result (machine-readable)

```json
{"verdict":"APPROVE_WITH_NITS","bugs":0,"gaps":1,"questions":0,"diff_hash":"55ae97d3c6dd5a820e230b58629f9e250cf4fec061f2908303b976e1b1e8b7aa","reviewers_complete":true}
```
