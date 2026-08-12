# slang-fixer: tools/gfx/ is legacy code paralleling slang-rhi — fixes need to land in both, but in-tree tests only exercise slang-rhi

## Context

`tools/gfx/` and `external/slang-rhi/` are **two parallel implementations** of the same render-hardware abstraction. They both contain near-identical helpers like `_unwrapParameterGroups`, `ShaderObjectLayoutImpl`, etc. (Compare `tools/gfx/renderer-shared.h` against `external/slang-rhi/src/shader-object.h` — same function names, same signatures, often nearly identical bodies.)

**The current `render-test` and all `gfx-unit-test` files (most are `#if 0`'d) use `slang-rhi`, not `tools/gfx/`.** The legacy `tools/gfx/` is still built into `libgfx.so` and shipped for downstream consumers (Falcor, dxvk-remix, etc.) that haven't migrated yet, but it is no longer invoked by any test in the slang repo.

## Why this matters when fixing a bug

If a bug report points at `tools/gfx/...` (e.g. shader-slang/slang#8455 was an infinite loop in `tools/gfx/renderer-shared.h::_unwrapParameterGroups`):

1. **Always check the slang-rhi twin first.** Grep for the same symbol or pattern in `external/slang-rhi/src/`. If the twin is already correct, the bug is solely in the legacy gfx copy and the fix is to re-apply upstream's correction.

2. **Reviewer suggestions to add a `-cpu -shaderobj` regression test will not catch the gfx bug.** `-cpu -shaderobj` runs through `render-test` → slang-rhi. If slang-rhi is already fixed, the test passes whether or not the gfx fix lands. Empirical check: revert the gfx fix locally, rebuild gfx only, run the test — if it still passes, the test isn't exercising gfx.

3. **`gfx-unit-test/` is largely dead.** Most files have `#if 0` blocks at the top with notes like "Duplicated: this is identical to slang-rhi/tests/test-shader-cache.cpp". They reference `slang-rhi` headers anyway. Don't try to add a new gfx-unit-test as a regression — wire would have to be added.

4. **Honest framing for the PR.** A `.slang` regression test for a `tools/gfx/` bug can pin the language-side compile pattern (so a regression in Slang's parser/checker would be caught) but cannot guard the runtime helper. State this plainly in the test header and PR description rather than implying full coverage.

5. **Where real runtime coverage lives.** Either downstream consumers' CI (Falcor's gfx integration tests etc.) or, if a parallel bug exists in slang-rhi too, an `external/slang-rhi/tests/` test in the slang-rhi repo.

## How to confirm the parallel-twin pattern

```bash
# Symbol grep — does slang-rhi have its own copy?
grep -rn "_unwrapParameterGroups\|<your symbol>" external/slang-rhi/src/

# Compare the two implementations side-by-side
diff <(grep -A 30 "static slang::TypeLayoutReflection. _unwrapParameterGroups" tools/gfx/renderer-shared.h) \
     <(grep -A 30 "static slang::TypeLayoutReflection. _unwrapParameterGroups" external/slang-rhi/src/shader-object.h)
```

If the two implementations have diverged, the bug is almost certainly that someone fixed one and forgot the other. `tools/gfx/` lags slang-rhi.

## Concretely from #8455

- Bug: `case Resource: { ... break; ... } return typeLayout;` in `tools/gfx/renderer-shared.h` — `break` only escapes the switch, falls back into `for(;;)` → infinite loop on non-StructuredBuffer Resource shapes (like `Buffer<T>` with `SLANG_TEXTURE_BUFFER`).
- slang-rhi twin (`external/slang-rhi/src/shader-object.h:152`): already uses `return typeLayout;` for this case.
- Fix: re-apply the same correction in `tools/gfx/renderer-shared.h`.
- Test: SIMPLE compile-only filecheck — explicitly documents that gfx runtime coverage requires downstream tests, since slang-test goes through (already-fixed) slang-rhi.
