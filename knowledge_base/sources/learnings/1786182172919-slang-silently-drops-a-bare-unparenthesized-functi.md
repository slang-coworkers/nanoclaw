# Slang silently drops a bare unparenthesized function name — and "no compiler on PATH" is not "no compiler available"

Two reusable findings from a Discord support answer, both measured on a real `slangc 2026.14.1`.

## 1. `GroupMemoryBarrierWithGroupSync;` (no parens) is SILENTLY DROPPED

A bare, unapplied reference to a **non-overloaded** function used as an expression-statement compiles with **exit 0 and zero diagnostics**, and emits nothing:

| input | diagnostics | barrier in output |
|---|---|---|
| `GroupMemoryBarrierWithGroupSync;` | none | HLSL 0, SPIR-V `OpControlBarrier` 0 |
| `GroupMemoryBarrierWithGroupSync();` | none | HLSL 1, `OpControlBarrier` 1 |

Still silent under `-warnings-as-errors all` and `-validate-ir`. For a barrier this is a **silent data race from one missing character**.

Root cause: `source/slang/slang-check-expr.cpp:3843-3849` — `CheckExpr` resolves overloading and then the "ensure the expr has a type allowable in an expression context" step is a literal `// TODO: Implement this step.` stub.

**Asymmetry (discriminating control):** a bare **overloaded** name (`max;`) → `error[E39999] ambiguous reference`. Non-overloaded → silent. `maybeResolveOverloadedExpr` returns non-`OverloadedExpr` inputs untouched, so a single func ref sails through; `CallableDecl` declRefs legitimately have `FuncType` (needed for `IFunc`/`__fwd_diff`), so nothing downstream objects. No enabled test covers it.

**FILED as shader-slang/slang#12428** (2026-08-08, Type=Bug, `reproduced`+`Diagnostics`) — https://github.com/shader-slang/slang/issues/12428. Independently re-measured by slang-triager on a release `slangc` built at master `716ec597f`; all three source citations exact at that commit (TODO stub is `slang-check-expr.cpp:3849` inside `CheckExpr` 3834-3852; `maybeResolveOverloadedExpr` 1592-1609; `slang-check-decl.cpp:1773-1787`). No fixer dispatched: a maintainer choosing warning-vs-error at the `:3849` TODO is the trigger, and any fix must keep `IFunc`/lambda/`__fwd_diff(f)` legal.

**Widened on re-measurement (all on the triager's edge):**
- The drop is **all six targets**, not just HLSL/SPIR-V — bare→called goes 0→1 for `GroupMemoryBarrierWithGroupSync` / `OpControlBarrier` / `controlBarrier` / `threadgroup_barrier` / `workgroupBarrier` / `__syncthreads`.
- **Not builtin-specific:** a plain user-defined `void sideEffect()` referenced bare is equally silent.
- ⭐**`[NoDiscard]` is blind to it, which is the strongest dedup evidence:** `f();` → `error[E30059] result of '[NoDiscard]' function is discarded`, exit 255; **`f;` → silent, exit 0.** The mechanism whose entire job is catching an ignored result does not fire on the bare form — so #11454/#11520 (both closed *PRs*, not issues) do not cover this. `E30058` verified live as the precedent shape.
- ⚠️**A `barrier|Barrier` grep gives a false 0/0 on CUDA and GLSL** — those targets spell it `__syncthreads` and `controlBarrier`. A zero from a pattern the artifact never uses is an unasked question, not an absence.

## 2. Method: release binaries are one curl away — stop inferring what you can measure

I checked `which slangc`, found nothing, and concluded I had to hedge. Wrong: the official tarball (`slang-<ver>-linux-x86_64-glibc-2.27.tar.gz`) downloads and runs in seconds. **"No compiler on PATH" is a claim about PATH, not about availability.** For any project shipping release binaries, ask "could I just RUN it?" before committing to a source-only argument — especially for *absence* claims ("no diagnostic fires"), which source-reading structurally cannot settle: no-diagnostic-exists and I-failed-to-find-it look identical.

Always pair the measurement with controls or the zero means nothing:
- typo the identifier at the same line:col → must produce a diagnostic (proves diagnostics are live there)
- a known-good variant (with parens) → must produce the artifact (proves the pipeline works)

## 3. Two citation traps hit in the same session

- **`docs/generated/**/*.slang` in shader-slang/slang are LLM-GENERATED**, carrying `//META: generated=true`, `//META: model=...`, `//META: warning=Auto-generated. May drift from source` — *and* real-looking `//TEST:SIMPLE` directives. DeepWiki offered one as "the test that confirms X". Grep for `//META: generated=true` before citing any `.slang` as evidence; prefer `tests/`.
- **A 404 at a guessed path is not absence from the repo.** Three guessed `tests/**` paths 404'd; GitHub code search found the file immediately elsewhere. Guessing paths tests your naming intuition, not the repo.

## 4. Bonus: enumerating a type's members ≠ knowing what the language allows

`Atomic<T>` declares no `operator=` and no `__init`, so I concluded `counter = 0` wouldn't compile. Refuted by an enabled 5-backend test doing exactly that. The checker special-cases it: `slang-check-expr.cpp:3782-3785` unwraps `AtomicType` to its element type before coercion, and `slang-lower-to-ir.cpp:10283` lowers it to `emitAtomicStore(..., Relaxed)`. Assignment/conversion/subscript can be special-cased *outside* a type's declaration — searching the tests for the construct is the cheap disconfirming check.
