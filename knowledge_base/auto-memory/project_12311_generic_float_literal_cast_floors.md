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

## ⚠️ RE-OPENED 2026-08-01 by reporter (comment 5236595461)
Tabris05: *"me using `IArithmetic` for the interface here was purely an example (since the bot's fix seems fixated on this interface specifically). `ITexelElement` was the actual interface I ran into this issue with in the wild."*

⇒ **Scope challenge to PR #12312.** The fix adds `__init(float)` to `IArithmetic` only; root cause (cast `(T)x` = `T.__init(x)`) is not confined to one interface. Dispatched to slang-triager on the canonical thread.

### Triager measured findings (2026-08-10, interim — my "same fix repeated N times" framing was WRONG)
- **`ITexelElement` REPRODUCES and is WORSE.** slangi @HEAD `716ec597f`: `direct=0.250000 texelAssoc=0.000000 texelCtor=0.000000 arith=0.000000`. ⚠️**NO diagnostic at all** on the ITexelElement path (measured `no-diag` ×3 cells) vs `warning[E30081]` on the IArithmetic control ⇒ strictly worse severity than what the issue was filed on (silent wrong code, zero warning).
- **⚠️ DIFFERENT SHAPE, not a repeat.** `ITexelElement` (hlsl.meta.slang:592) does NOT declare `__init(int)`. It declares `__init(Element x)` where `Element` is an **associated type** constrained `: __BuiltinArithmeticType` (core.meta.slang:378, which extends IArithmetic). Flooring happens one level deeper — in the literal→`Element` conversion. **Adding `__init(float)` to ITexelElement is not the right shape for it.** Also `(T)0.25` verbatim hard-errors `E30019` (expected `T.Element`, got `float`) — reproducing spellings are the Element-typed ones.
- **Blast radius census** (all `*.meta.slang`, 41 interface decls scanned = non-zero control): **Class A** (declares int-ish `__init`, no `__init(float)` = bug class) = **4**: `IArithmetic`(core:140), `ILogical`(:178), `IInteger`(:251), `ICoopElement`(:902). **Class B** (immune, has `__init(float)`) = 1: `IFloat`(:304). **Class C** (`__init` takes neither) = 3: **`ITexelElement`**, `__EnumType`, `IDefaultInitializable`. Must-hit control confirms PR touches only IArithmetic (`IArithmetic`×4; other three ×0).
- **PR head MOVED** `5665da3e70` → **`1e00452b11`** (2 commits); still DRAFT, `pr: non-breaking`, mergeStateStatus **BEHIND**, reviewDecision REVIEW_REQUIRED. **Issue gained assignee `jkwak-work`.**
### SETTLED by measurement (2026-08-10) — ⭐BOTH ratios were wrong: triager's "1 of 4" AND Main's "2 of 4"
Differential matrix, slangi, PRE=master `716ec597f` vs POST=PR head `1e00452b11` (isolated worktree, both binaries freshness-proven behaviourally; run **per-cell** — a combined run aborts on `IInteger` E39999):

| cell | PRE | POST |
|---|---|---|
| CONTROL non-generic `(float)0.25` | 0.250000 | 0.250000 |
| `T:IArithmetic` | 0.0 (+W E30081) | **0.250000** ✅ |
| `T:ITexelElement` `(T.Element)0.25` | 0.0 no-diag | **0.250000** ✅ |
| `T:ITexelElement` `T(T.Element(0.25))` | 0.0 no-diag | **0.250000** ✅ |
| `T:IInteger` T=int | **error E39999** ambiguous int/int64_t | 0 ✅ (correct for int; clears a pre-existing ERROR) |
| `T:ILogical` | n/a — **no float type conforms at all** | n/a |
| `T:ICoopElement` T=float | 0.0 no-diag | **0.0 no-diag** ⛔ |

POST verified EXACT (`v == 0.25f` ⇒ 1), not a printf artifact.

**⇒ #12312 already fixes the reporter's wild case transitively.** `Element : __BuiltinArithmeticType` → derives IArithmetic; `IInteger : IArithmetic, ILogical`. One addition at one hierarchy point covers **3 shapes** while the diff mentions IArithmetic×4 and the other four ×0 (must-hit control passed) — the PR is broader than it reads.

**ONE genuine residual = the useful finding:** **`ICoopElement` does NOT derive from IArithmetic**, so the fix cannot reach it, yet `float` DOES conform (via `__BuiltinArithmeticType : ICoopElement`; also `IFloatingPointCoopElement : ICoopElement`). `T:ICoopElement`, T=float ⇒ still **0.0 silently, no diagnostic, post-fix**. Live proof that per-interface addition doesn't generalise — better evidence for hold point (i) than any repetition count. `ILogical` is **n/a, not a gap** (no FP conformer exists).

**Design verdict:** ⛔the reporter's comment does **NOT** revive Approach B — a cast IS a ctor invoke bound to the constraint's requirement set; nothing changed. Transitivity is why per-interface is *less* bad than both of us thought. **RECOMMEND: land #12312 as-is** (fixes filed + wild case); track `ICoopElement` separately rather than widening. Posted as fresh delta comment **5236743498** (stacked, not an edit — last commenter was the human OP; verified live: nv-slang-bot[bot], 3529 chars, 0 HTML-escaping, 7 table rows, disclaimer). No fixer dispatch (nothing to build; widen-vs-separate is a maintainer scope call). PR left DRAFT untouched. Worktree `wt-12311-texel` + `refs/pr/12312` retained — the two-state differential IS the instrument.

⚠️**Main's cited line numbers were MASTER-based, −4 vs PR head** (ILogical :182 not :178, IInteger :255 not :251, IFloat :308 not :304, `__BuiltinArithmeticType` :382 not :378, ICoopElement :906 not :902 — the PR adds 4 lines above them). Every *clause* Main quoted was correct. ✅**The hedge worked:** Main wrote "state as of my edge — re-derive on your worktree, don't take my line numbers on faith", triager re-derived, caught the offset. Cheap correction instead of a propagated wrong citation.

**HELD on maintainer** — two design points: (i) adding a requirement to a public core-module interface (source-compat as tested; triager assessed serialized-module/ABI benign — witness keyed by mangled name, build-tag digest gates stale core modules); (ii) truncate-toward-zero for non-float conformers. Maintainer signoff → mark ready + merge. **Webhook-driven from here** (fixer owns PR review/CI follow-up via /slang-github-webhook). RE-OPEN only on fresh substantive human comment.
