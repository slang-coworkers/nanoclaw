---
name: project-12311-generic-float-literal-cast-floors
description: "#12311 (T)0.25 in T:IArithmetic generic floors to 0 — IArithmetic lacks __init(float)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 5fa1a76c-57e3-4577-b9b3-3bf709556acd
---

# shader-slang/slang #12311 — Casting float types via generics floors the value

**Reporter:** Tabris05. **Filed/triaged 2026-08-01.** bug / high / **P1** / frontend (semantic checker + core-module interface).

## Repro
```slang
T oneQuarter<T : IArithmetic>() { return (T)0.25; }
[shader("compute")]
void main(uniform float* black_box) {
    black_box[0] = (float)0.25;      // 0.25  ✓
    black_box[1] = oneQuarter<float>(); // 0    ✗  (expected 0.25)
}
```
Reproduced @HEAD d3ec9cc49 (slangi generic=0.0 vs direct=0.25; CUDA/C++/GLSL/SPIR-V all fold generic body → 0). Silent wrong result, no error (warning E30081 fires).

## Root cause (triager, comment 5149827226)
`IArithmetic` (core.meta.slang:140) declares only `__init(int)` / `__init(This)` — **no `__init(float)`** (IFloat has it @:308). Casting a float literal to `T:IArithmetic` picks `__init(int)`, truncating 0.25→0 **at generic-check time, before specialization**. Value is destroyed in the front-end.

## Solution fork
- **(A) — CHOSEN. Committed in draft PR #12312.** Fixer's committed diff adds a **bare** `__init(float val);` requirement to IArithmetic (a hard interface requirement, NOT defaulted — earlier "defaulted" framing was superseded by the committed code). Triager's mechanism trace across all core-module conformers claims it is **non-breaking in practice** because every existing conformer already satisfies it — but the *public-interface requirement addition* is genuinely a maintainer call (see hold points).
  - ⚠️ **float-value-preservation:** for `T=float` the cast must resolve to `float`'s own `__init(float)` (identity), preserving 0.25; non-float types truncate by design. 3-dimension (target × direct-vs-generic × value) regression test proves it.
- **(B)** checker defers literal conversion for constrained generic params — triager verified **genuinely intractable**; dropped.
- (C) IR/emit band-aid — rejected (value already gone in front-end).

## Two maintainer-hold design points (surfaced, PR stays DRAFT)
1. **Public-interface requirement addition** — adding a bare requirement to a public core-module interface (`IArithmetic`); non-breaking-in-practice but still a spec/compat call for a maintainer.
2. **Truncate-for-non-float semantics** — non-float `T` still truncates the float literal (by design); maintainer to confirm that's the desired behavior.

## Chain state — TERMINAL HELD (2026-08-01, [Triage Resolution] delivered)
Triaged → reproduced → root-cause verified → verdict + `reproduced` + Type=Bug posted (cmt 5149827226, refreshed in place to "fix in draft PR #12312, held pending review"). **Draft PR #12312** (latest commit 5665da3e70): bare `__init(float val);` requirement on `interface IArithmetic` (core.meta.slang) + INTERPRET regression test; `Closes #12311`, `pr: non-breaking`, stays DRAFT (won't auto-close).

**Review:** ✅ APPROVE-WITH-NITS, no must-fix (codex PLAN/CODE/OUTPUT + triager ir-correctness/compat lens). Non-breaking mechanism-traced: int/vector/CoopMat/CoopVec + user `struct:IArithmetic` with only `__init(int)` all auto-satisfy via witness synthesis through existing int init; float-family keep value-preserving `__init(float)`; no overload regression for `(T)<int-lit>`. 3 nits = PR-description-only, folded in.

**Tests:** repro PASS (float→0.25, int→0, castVal<float>(2.75)→2.75, <int>→2, user MyNumber→2) via slangi + slang-test; regression green — generics 252/252, interfaces 71/71, autodiff 879/879, min-max-iarithmetic 5/5. ⚠️ CoopMat/CoopVec synthesis path is CI-only (not reachable by INTERPRET) — flagged for full-CI confirm before merge.

**HELD on maintainer** — two design points: (i) adding a requirement to a public core-module interface (source-compat as tested; triager assessed serialized-module/ABI benign — witness keyed by mangled name, build-tag digest gates stale core modules); (ii) truncate-toward-zero for non-float conformers. Maintainer signoff → mark ready + merge. **Webhook-driven from here** (fixer owns PR review/CI follow-up via /slang-github-webhook). RE-OPEN only on fresh substantive human comment.
