---
title: "Additive review-nit rounds still need CHECK-NOT backing + accurate comments (codex catches self-authored false claims)"
type: learning
topic: agent-ops
source: learnings/1784884204062-additive-review-nit-rounds-still-need-check-not-ba.md
---

# Additive review-nit rounds still need CHECK-NOT backing + accurate comments (codex catches self-authored false claims)

From the #12197 / PR #12200 NRVO tightening round (reviewer APPROVE_WITH_NITS → additive tests + comment fixes). Three durable lessons for handling "do-while-in-file" nit rounds on an already-approved fix:

1. **A test's prose claim needs a CHECK backing it, or narrow the prose.** I wrote two -O0 SPIR-V tests whose header comments claimed "no callee-local ray-query variable and no whole-handle copy," but the CHECK lines only proved `OpRayQueryInitializeKHR` targets the return-dest parameter. codex OUTPUT_REVIEW flagged the unbacked claim as must-fix. Fix: add scoped `CHECK-NOT: OpVariable [[RQPTR]] Function` + `CHECK-NOT: OpCopyMemory` between the dest `OpFunctionParameter` and the Initialize op (FileCheck CHECK-NOT asserts absence in the range between two CHECKs). Don't assert-by-prose; assert-by-check.

2. **codex catching a FALSE claim in a comment I authored myself is the highest-value critique.** I wrote "the parameter loop already debug-decorated the return-destination" — FALSE: the return-dest IRParam has `decl==nullptr` (synthesized by maybeAddReturnDestinationParam), so `addVarDecorations`/`maybeAddDebugLocationDecoration` never run for it; it gets only a name hint. The correct mechanism: the debug-value pass (slang-ir-insert-debug-value-store.cpp) surfaces return-dest PARAMETERS via its parameter loop, so an NRVO local aliased to that param needs no IRDebugLocationDecoration of its own. Self-authored inaccuracies in comments are the hardest to catch solo — always run a fresh OUTPUT_REVIEW after comment edits, don't assume "comments only = safe."

3. **HitObject is the untested silent-miscompile SIBLING of RayQuery.** `isNonCopyableOpaqueType` (slang-ir-util.cpp:3424) covers BOTH `IRRayQueryType` and `IRHitObjectType`, so the same NRVO path fires for `HitObject` returns (common SER pattern: `HitObject::MakeNop/MakeHit/MakeMiss/FromRayQuery` → local → return). When a fix's mechanism handles N sibling types, add a positive test per sibling — an untested path the *same code* miscompiles-then-fixes is where a future refactor silently regresses. Gotcha: HitObject-returning callees get inlined even with `[noinline]` (SER intrinsics), so you can't observe a separate callee `OpFunction`; assert caller-level shape instead (exactly one hit-object OpVariable + record op targets it + no OpCopyMemory).

Also: `git add -A` will sweep scratch PR-body/working-log files into the commit — stage explicitly (source + test paths), and refresh the live PR body ONCE at the end, not per-turn (each edit is a full-context turn). Draft workflow_dispatch → ci_failed webhook is a benign priority-yield (only wait-for-human-priority + check-ci "fail", all build/test SKIPPED).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1784884204062-additive-review-nit-rounds-still-need-check-not-ba.md`_
