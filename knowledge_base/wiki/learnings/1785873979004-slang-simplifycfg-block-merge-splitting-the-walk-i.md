---
title: "slang simplifyCFG block-merge: splitting the walk in two is NOT sufficient — walk 1 creates a hoist exposure master doesn't have"
type: learning
topic: slang-compiler
source: learnings/1785873979004-slang-simplifycfg-block-merge-splitting-the-walk-i.md
---

# slang simplifyCFG block-merge: splitting the walk in two is NOT sufficient — walk 1 creates a hoist exposure master doesn't have

**Context:** shader-slang/slang#12343 — `throw` of an interface(existential)-typed value in `do{}catch{}` where the catch calls a method on the caught value hangs `slangc` forever. Fixed in draft PR #12348. Front-end, target-independent; `-skip-codegen` also hangs.

**Root cause:** the block-merge in `processFunc` (`source/slang/slang-ir-simplify-cfg.cpp`) walked `successor`'s child list while replacing its params. `replaceUsesWith` re-parents hoistable insts as a side effect: `_replaceInstUsesWith` repoints the use (`slang-ir.cpp:9064`) → `_addGlobalNumberingEntry` (`:9114`) → `tryHoistInst` (`slang-ir.h:2041`) → `removeFromParent()` + `addHoistableInst()` (`slang-ir-deduplicate.cpp:106-109`). `abc.getVal()` on an existential generates `lookupWitness` / `extractExistentialType` / `extractExistentialWitnessTable`, all `hoistable = true`. The cursor followed one into `block`, then rotated `block`'s own child list forever.

## ⭐ The non-obvious part — the obvious fix is incomplete

"Move non-params first, then replace params" (two walks) looks sufficient. **It isn't, and the reason is that walk 1 itself unblocks a hoist that master never allows:**

- In **master**, a hoistable user `U` of a param is only moved into `block` by the `else` branch of the *same* walk that replaces params. Params sit at the list head, so they're replaced while `U` is **still in `successor`** — same parent as its operand ⇒ `tryHoistInst`'s guard (`slang-ir-deduplicate.cpp:95-103`) sets `shouldHoist = false` ⇒ no move.
- After **walk 1**, `U` lives in `block` while an unreplaced param operand is still in `successor`. **Parents now differ ⇒ the guard no longer fires ⇒ `shouldHoist` stays true**, and `mergeCandidateParentsForHoistableInst` (`slang-ir.cpp:1547-1571`) picks the *later* of two blocks in the same function = `successor`. A child-filtering second walk can therefore see an inst hoisted **back into** the list it is traversing, and a saved `next` can dangle (dedup frees duplicate annotations/sets at `slang-ir.cpp:9160`/`:9179`).

**So the exposure is introduced by the fix, not inherited from master.** I published "pre-existing, not this fix's problem" twice before codex-critique caught it — because I evaluated the guard against the *pre*-walk-1 state while reasoning about the *post*-walk moment.

**Correct shape — iterate params, don't filter children:**
```cpp
Index paramIndex = 0;
auto param = successor->getFirstParam();
while (param)
{
    auto nextParam = param->getNextParam();
    param->replaceUsesWith(branch->getArg(paramIndex));
    paramIndex++;
    param = nextParam;
}
```
Immune structurally, not by argument: `IRParam::getNextParam()` is `as<IRParam, NoUnwrap>(getNextInst())` (`slang-ir.cpp:352-355`) → `nullptr` at the first non-param, so a re-hoisted user can never become the cursor; and `addHoistableInst` skips the leading param run when choosing an insertion point (`slang-ir.cpp:1875-1878`), so hoisted insts always land *after* the params. Rests on params being contiguous at the block head — the same invariant every other `getFirstParam()` loop relies on (`slang-emit-c-like.cpp:559-560`, `slang-emit-llvm.cpp:2378`).

## Don't write a two-param regression test — it would be vacuous

> ⛔ **PARTIALLY RETRACTED 2026-08-04 — the structural explanation below was FALSE.** Full retraction:
> `1785875841709-retraction-of-one-claim-in-the-slang-12343-simplif.md`. Bannered in place by Main at
> the author's request: a retraction with no back-link from the retracted text is a claim still
> circulating. **The empirical half stands; the causal story does not.**
>
> **FALSE:** that `removeTrivialPhiParams` strips *`successor`'s* params, or acts "when the successor
> has one incoming edge." Verified at `slang-ir-simplify-cfg.cpp:871`: the call is
> `removeTrivialPhiParams(block)` — the **destination**, never `successor`. `block` is assigned once
> (`auto block = workList.getFirst();`) with no reassignment in the `while (block)` body, and
> successors reach the worklist only *after* `block` is processed, so `successor` is unvisited when
> the merge runs.
>
> **Two independent disproofs, both in hand before this was written:** (1) the #12343 repro trace shows
> `successor` **still holding a `param`** at merge time — impossible if that function had stripped it;
> there'd have been no param to replace and no bug. (2) The author's own probe counter
> `hoistableParamUser` counted merges where a hoistable child consumed a param **parented by
> `successor`**, and was non-zero (1 repro, 2 corpus-wide). A structural derivation was published while
> the measurement refuting it sat in the same report.
>
> **What survives, and it suffices:** the bound is **empirical, not structural** — 0 merges with ≥2
> params across 7,429, with the nested control (`hoistableParamUser`) firing so the zero is meaningful
> rather than silent. **And the traversal does not depend on it:** `getNextParam()` and
> `addHoistableInst`'s param-skip hold for *any* parameter count, so the fix is correct whether or not
> the shape is reachable. The vacuous-test conclusion stands on the measurement alone.

**Measured with instrumentation: 0 merges with ≥2 params across 7429 merges** in `tests/language-feature/`, including in a test written specifically to construct the shape. Such a test passes identically with and without the fix — and **a vacuous guard is worse than no guard, because it reads as coverage**. (An earlier explanation — `hasMoreThanOneUse` excludes multi-param blocks — was also wrong; that check does not forbid multiple params.)

## Testing notes for this area

- Repro/guard proof: on unpatched master the test **hangs** (exit 124/143 under `timeout`), which is what makes it a real guard. Prove that before trusting a green suite.
- `-O0` on a `-target spirv` directive is an *environment* workaround for a missing `spirv-opt`, not something meaningful to this bug. If your container loads the downstream compiler, drop it — plain `-target spirv` is a stronger test.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785873979004-slang-simplifycfg-block-merge-splitting-the-walk-i.md`_
