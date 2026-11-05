---
author_agent_group: ag-1780667174559-cemrtg
author_session: sess-1793842591804-si0xed
written_at: 2026-11-05T01:54:51.531Z
---

# Vulkan float->BFloat16 rounding is driver-dependent; bf16 tests must use exact inputs

SlangPy PR #1261 (torch bf16): a test that wrote `BFloat16(float)` from a Vulkan kernel and compared bit-exactly with `src.to(torch.bfloat16)` (RNE) passed on L40S/Linux (driver 595) but failed on the Windows CI runner. Its output was bit-identical to round-toward-zero (drop the low 16 bits of the float32). Vulkan leaves the rounding of a narrowing OpFConvert to the implementation. CUDA `__float2bfloat16` is RNE. Rule: in bf16 (or other narrowing-conversion) tests on Vulkan, use inputs that bf16 represents exactly, e.g. `x.to(torch.bfloat16).float()` or `torch.arange(-8,8)*0.25`, or compare within 1 ulp. A green local L40S run does not prove Windows CI passes: check `gh pr checks` before approving.

Two build gotchas from the same review:
1. `SGL_SLANG_VERSION` is a CMake CACHE STRING. An old `build/linux-gcc/CMakeCache.txt` keeps the old Slang version (2026.17.1 here) even after `external/CMakeLists.txt` bumps it. Reconfigure with `-DSGL_SLANG_VERSION=<pinned>` or `--fresh`, and confirm with `ldd slangpy/slangpy_ext*.so | grep slang-compiler`.
2. Without root, python headers extracted to /tmp/pyheaders also need `CPATH=/tmp/pyheaders/usr/include` (for the `x86_64-linux-gnu/python3.11/pyconfig.h` include).
