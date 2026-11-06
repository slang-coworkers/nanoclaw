---
type: source
title: "slangpy#1264 R1 review — APPROVE_WITH_NITS"
description: "slangpy-reviewer R1 of PR #1264 (#1260 cursor-converter bounds checks) at 31911de8, 2026-11-05: APPROVE_WITH_NITS"
---
# Review: shader-slang/slangpy#1264 — Bounds-check Slang scalar types in cursor converter tables

- **Head:** `31911de8` (3 commits on main `68d1e782`; `Refs #1260`, no closing keyword)
- **Mode:** pr (round 1)
- **Verdict:** APPROVE_WITH_NITS

## Summary

The fix is correct and minimal.
- Every lookup in the converter tables now goes through `converter_index()`. That covers read, write, NumPy-value write and `write_from_numpy`, all for scalar, vector and matrix.
- Each `converter_index()` call is inside the existing `try`, so a write still tries the native-object and unpack fallbacks before it rethrows.
- `get_writer()` returns `{}` for scalar types that have no table entry. Its only caller, `NativeValueMarshall` (`slangpyvalue.cpp:41-45`), then falls back to `write_shader_cursor`, which raises the same clean error.
- The `*_from_numpy` tables are now filled with an error function. That removes the second cause, `bad_function_call` for in-range types that have no converter (`vector<int16_t,2>`).
- Every lookup that uses `ScalarType::COUNT` now has a bounds check. I grepped `src/` for `ScalarType::COUNT`; the only uses are in `cursor_utils.{h,cpp}`.

No bugs, gaps or open questions. Two nits.

## Bugs

None.

## Gaps

None.

## Questions

None.

## Clarity / nits

- **N1.** `slangpy/tests/device/test_buffer_cursor.py:795`: `parametrize("element_type", UNSUPPORTED_ELEMENT_TYPES)` gives IDs `element_type0` … `element_type9`. A CI failure would not say which type failed. Use `ids=[f"{s}-{k}" for s, k in UNSUPPORTED_ELEMENT_TYPES]`.
- **N2 (outside this PR's files, optional follow-up).** On the functional-API path, `matrix<FloatE4M3,2,2>` fails in kernel generation with `Unsupported scalar type '(void | 0x10)'`. That comes from `scalar_type_name` in `src/sgl/refl/type.cpp`. The enum formatter splits the unlisted value 17 into flag bits. With #1261 merged, the text becomes `'(void | bfloat16)'`, which is misleading. Printing the raw integer for values that are not enum members would fix it. It does not block this PR.

## Verified (facts)

- **On main `68d1e782`** (L40S, Linux, Slang 2026.20, Debug), the PR's `test_cursor_unsupported_element_type` gives **34 failed, 46 passed, with 16 xdist worker crashes**.
  - The failures are every matrix read, write and NumPy write, plus `write_from_numpy` for 8 of the 10 element types.
  - The fixer saw 38. The out-of-bounds index is undefined behavior, so the count varies between runs.
  - The scalar and vector cases on main pass by luck. The out-of-bounds slot lands in a neighbouring table that is filled with the error function. So the matrix and `write_from_numpy` cases are the real regression guards.
- **On the PR head** the build has 0 warnings. `test_buffer_cursor.py` and `test_shader_cursor.py` give **129 passed, 1 skipped**, including all 80 new cases on CUDA and Vulkan.
- **CI at `31911de8`:** all 15 checks pass. The new test ran and passed on Windows (cuda, d3d12, vulkan: 40 each) and macOS (metal: 40).
- **Functional-API probe** (`reports/review-1264/probe.py`, CUDA and Vulkan). Python scalars passed to `FloatE4M3` / `BFloat16` params take the `get_writer` → `write_shader_cursor` path and raise `RuntimeError: Unsupported element type`. They do not crash.
- **Merged with #1261 (`bee91422`)** the merge is clean. The build passes. The cursor, torch, dtype, reflection and fallback suites give **878 passed, 93 skipped, 0 failed**. BFloat16 then becomes an in-range type, goes through the error functions and gives the same message, as the fixer said.
- **`ScalarConversionTable` guard** (`cursor_utils.cpp:115-118`): I agree it is defensive only. `from` is always a CPU source type, and `to ≥ COUNT` had no bit set before either.
- **PR description:** the line refs at the head are correct (`cursor_utils.h:221-223,499-507` are the table declarations). It has `Refs #1260` and no closing keyword.

```json
{"verdict":"APPROVE_WITH_NITS","bugs":0,"gaps":0,"questions":0,"diff_hash":"e5b83f33063b371e9e85ce73b74bf5424f7b0e6e45e40f7aa92761f60e3ff6a3","reviewers_complete":true}
```
