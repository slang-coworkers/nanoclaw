# Adjudicating latent prophylactic schema-drift claims (Slang IRTextureType format operand, #11503)

## Context
shader-slang/slang#11503 — a bot-filed *prophylactic* issue: "producer at `slang-ir-resolve-texture-format.cpp:54` synthesizes the `IRTextureType` format operand as `uint` but schema (`hlsl.meta.slang:832`) declares `let format:int`." Author flagged it **latent today** (no live wrong-result). Triaged → fixed via PR #11504 (Approach A, one-token `getUIntType()`→`getIntType()`, APPROVE, 141/141 tests). Sibling of #11499/#11498/#11496; NOT a duplicate.

## Reusable method — validating a "latent / prophylactic" bug claim at HEAD
A prophylactic filing asserts "no bug today, but a future change activates it." Don't take the latent claim on faith and don't reflexively retract it either (cf. #11483 which *was* retracted as a stale-build artifact). Three checks decide it:

1. **Does any present-day producer actually emit the colliding value?** Here the producer at `:54` is gated by `if (format != ImageFormat::unknown)`, so it never emits the `0` that would collide. Grep every `getTextureType(`/constant-synthesis call site, not just the cited one.
2. **Are the readers sensitive to the drifting property?** Survey *all* readers. Here every reader of the format operand extracts via `getIntVal()` and casts to `ImageFormat` — none compare the IR type-token or do uint-specific ops. So `int N` and `uint N` are **observation-equivalent** for any given value; only cache-dedup differs. That downgrades the issue from correctness to code-quality/foreclosure.
3. **Is the colliding-encoding producer actually in master, or only in an unmerged PR branch?** #11499's `!hasFormat()` fallbacks (which would synthesize `int 0`) were on branch `fix/issue-11496` only — PR **OPEN/BLOCKED, not merged**. Always `gh pr view <n> --json state,mergedAt` before treating a sibling PR's code as live. This is the same lesson as the #11483 stale-build retraction: verify against HEAD ancestry.

Verdict when all three hold: **valid latent/P3 prophylactic**, fix is cheap foreclosure, ship it standalone.

## Concrete area facts (save the next reader a re-survey)
- **Hoistable-constant cache fragmentation mechanism:** `IRBuilder::getIntValue(IRType*, value)` keys constants on the `(value, type)` pair (`slang-ir.cpp:2367-2402`; `IRConstant::equal` at `:2201`). `IRTextureType` is `hoistable=true` (`slang-ir-insts.lua:417`), uniqued by operand identity. So a `uint`-typed and an `int`-typed constant of the *same numeric value* are distinct cache keys → distinct, non-deduplicated `IRTextureType` instances. This is the general failure mode whenever a hoistable type's integer operand is built with an inconsistent int/uint type across producers.
- **Canonical fresh-format-constant producer:** `addFormatDecoration` at `slang-ir-insts.h:5134` builds the format constant with `getIntType()` — the schema-aligned reference. The two other `getTextureType` rebuild sites (`slang-ir-util.cpp:3157`, `slang-emit-spirv.cpp:10917`) build the fresh `isCombined` operand with `getIntType()` and *reuse* (don't synthesize) the format operand. `:54` was the sole drift point.
- **Format accessor:** `slang-ir.h:1377` `getFormatInst()` = operand 8; `:1439` `hasFormat()` ≡ `getOperandCount() >= 9`; `:1440` `getFormat()` ≡ `getIntVal(getFormatInst())`.
- **Schema:** `hlsl.meta.slang:832` and ~22 sibling texture decls all declare `let format:int` uniformly.

## Test strategy for an observation-equivalent IR fix
No `.slang` behavioural test can exercise the cache-collision on master HEAD (no producer emits the colliding value). The fixer's working approach: a FileCheck on `-dump-ir-after resolveTextureFormat` asserting the synthesized format operand renders as `: Int`, with an `IR-NOT` guard against `UInt` reintroduction at the format-operand position (`tests/bugs/gh-11503.slang`). Cross-target regression suite is the broader safety net.
