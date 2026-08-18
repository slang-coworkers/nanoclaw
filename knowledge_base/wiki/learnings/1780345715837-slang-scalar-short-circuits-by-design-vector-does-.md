---
title: "Slang `?:` short-circuit semantics + #11403 disposition (scalar short-circuits by design; vector does not)"
type: learning
topic: slang-compiler
source: learnings/1780345715837-slang-scalar-short-circuits-by-design-vector-does-.md
---

# Slang `?:` short-circuit semantics + #11403 disposition (scalar short-circuits by design; vector does not)

*Consolidation (2026-06-07) of three #11403 notes: triage finding, maintainer confirmation, and the verified fact.*

## The fact (verified in source, shader-slang/slang)
- A **scalar**-condition `?:` short-circuits — only the selected operand is evaluated.
- A **vector**-condition `?:` does NOT short-circuit (both operands evaluated, component-wise select) and is **deprecated → use `select`**.
- This is intentional and **target-independent** (HLSL, SPIR-V, slangi all behave the same — it's a **shared frontend lowering**, NOT a slangi-VM quirk).
- `&&`/`||` are separate: they do NOT short-circuit by default (there's a `-disable-short-circuit` flag) — don't conflate with `?:` when reading short-circuit docs.

## Source locations
- `ValLoweringVisitor::visitSelectExpr` (`source/slang/slang-lower-to-ir.cpp`, ~:6673) lowers a scalar `?:` to **if-else control flow** — comment (~:6687): "A scalar typed `select` expr will turn into an if-else to implement short circuiting semantics." Vector-cond and global/const scope (~:6676, :6682) fall through to a real non-short-circuiting `IRSelect` (both operands materialized).
- `SemanticsExprVisitor::visitSelectExpr` (`source/slang/slang-check-expr.cpp`): when the condition is a scalar (`BasicExpressionType`), it **early-returns with NO diagnostic**. Only the vector path reaches **E30055** (`UseOfNonShortCircuitingOperatorInDiffFunc` — inside a `[Differentiable]` func) and **E30056** (`UseOfNonShortCircuitingOperator` — deprecation elsewhere). So **E30055/E30056 are vector-`?:`-only**; a scalar `?:` never triggers them.

## #11403 disposition — maintainer-confirmed Approach A (docs-only)
The issue claimed only slangi short-circuits scalar `?:` while HLSL evaluates both (labeled bug + "Test Agent Finding"). **Premise wrong.** A maintainer independently re-verified both central claims and **approved Approach A: docs-only**. The real defect is two in-repo docs disagree:
- **STALE:** `docs/language-reference/expressions-operators.md` (~:98-101) — "`?:` does not short-circuit (HLSL precedent)". Doubly wrong now: the compiler short-circuits AND modern HLSL 2021/DXC short-circuits too.
- **CORRECT (matches compiler):** `docs/user-guide/02-conventional-features.md` (~:396-398) — scalar `?:` short-circuits; vector does not and is deprecated.

Fix scope authorized: rewrite the language-reference Note to match compiler + user-guide; drop the over-specified generated test asserting non-short-circuit (regenerate the catalog, don't hand-edit); **no compiler change; `pr: non-breaking`**.

**Why Approach B (make scalar `?:` non-short-circuit) was rejected — reusable point:** pointer/opaque operands (`Texture`, `Sampler`, resources) are not first-class on most targets, so a `kIROp_Select` between two such values often can't be formed. The if-else lowering is therefore *required* for those operands (likely the motivation for PR #10679). Forcing scalar `?:` through `select` would regress opaque/pointer cases or force B to keep if-else for them anyway. **General rule:** when deciding whether an operator can lower to `select` vs control flow, check whether operands can be opaque/pointer/non-first-class — if yes, control-flow lowering is mandatory on some targets.

## Transferable lessons
1. **For "Test Agent Finding" issues, distrust the cited spec until cross-checked** against (a) other in-repo docs, (b) the actual compiler code, (c) an empirical run. Agentic test-gen read the STALE language-reference, emitted an over-specified assertion (counter=2), it failed under slangi, and got mis-flagged as a "VM bug."
2. **"Backend X differs from backend Y" claims** for expression semantics usually trace to the SHARED frontend lowering (`slang-lower-to-ir.cpp`), not the backend — check `visitSelectExpr` / `visit*Expr` first.
3. **HLSL emit gotcha:** an if/else with the same call in both (mutually-exclusive) branches IS short-circuiting, even though the call text appears twice. Don't count textual occurrences as "evaluated".
4. **Repro representativeness:** when the reporter's commit isn't in your checkout, `git fetch origin <sha>` then `git diff <localHEAD> <sha> -- <lowering+emit files>`; if 0 lines, your local repro is authoritative even on an older HEAD.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780345715837-slang-scalar-short-circuits-by-design-vector-does-.md`_
