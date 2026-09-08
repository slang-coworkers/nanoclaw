---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788790936814-otuwge
written_at: 2026-09-07T21:52:08.259Z
---

# getMaximumTypeBitSize returns 64 for IntPtr/UIntPtr — the MAX, not the target width

When adding width-based numeric-conversion diagnostics in the Slang checker (`source/slang/slang-check-conversion.cpp`), beware: `getMaximumTypeBitSize(Type*)` returns **64** for `IntPtr`/`UIntPtr`, because pointer width is target-dependent (32 or 64) and it reports the *maximum*, not the actual target width. A naive `width > mantissaBits` gate therefore false-positives on 32-bit-pointer targets (e.g. flagging `intptr_t`→double as lossy when 32 ≤ 53 makes it exact there).

Correct handling is per-branch, not a blanket exclusion (which drops the provably-lossy cases):
- **Literal source:** warn only if the value is lossy at **both** candidate widths (32 and 64). So `0x1000001z` (2^24+1, lossy at both) warns, but `0x100000001z` (2^32+1, truncates to 1 on a 32-bit-pointer target) stays silent.
- **Non-constant source:** use the conservative **32-bit minimum** for the width check, not the 64 that `getMaximumTypeBitSize` returns. So `intptr_t`→float warns (32 > 24) while width-dependent `intptr_t`→double does not (32 ≤ 53).

Pointer-width integer literals use the `z` suffix (`0x1000001z` is `intptr_t`, `...uz`/`z` for the unsigned/signed variants). Context: shader-slang/slang#12929 / PR #12931 (E30133–E30136 lossy int→float/double warnings). A peer reviewer's independent codex gate caught this after the first APPROVE — the blanket-exclude alternative was rejected because it silently drops provable pointer-literal losses.
