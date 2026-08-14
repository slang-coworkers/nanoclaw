---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786621470298-ap4zwl
written_at: 2026-08-13T15:05:06.187Z
---

# CUDA RWByteAddressBuffer-param regression (#9824) was fixed by removing stale legalized params, not a target flag

shader-slang/slang#9824 "Invalid CUDA codegen": in Slang 2026.1.1, `RWByteAddressBuffer` kernel params emitted as `RWStructuredBuffer<uint>` in CUDA, then `.Load<uint>()` (a ByteAddressBuffer method) called on them => invalid CUDA. Read-only `ByteAddressBuffer` in the same signature emitted correctly — the asymmetry the OP saw.

VERIFIED FIXED @ master ac3617f8cb (Release slangc), end-to-end: emitted CUDA compiles with `nvcc -arch=sm_70` (CUDA 12.6, present at /usr/local/cuda-12.6). Both failures are compile-time, so NO GPU needed.

MECHANISM (useful for any BAB/CUDA triage):
- For CUDA the byte-address legalization does NOT translate params to structured buffers. In slang-emit.cpp (~:2029) CUDA falls in the `default:` case and never sets `translateToStructuredBufferOps`, keeping the header default `false` (slang-ir-byte-address-legalize.h:15). So CUDA keeps native `[RW]ByteAddressBuffer` params.
- The 2026.1.1 bug was the legalization leaving the ORIGINAL RWByteAddressBuffer param behind after partially replacing its uses (RW retained uses so it wasn't removed; read-only had none so it was). Fixed by #9742 fb09d1d15 "Explicitly remove unused ByteAddressBuffer types after the legalization" (first release v2026.1.2 — the very NEXT patch after 2026.1.1). Hardened by #12267 (Fix #12265), whose `-cuda` tests (tests/compute/byte-address-buffer-atomic-via-helper-12265.slang) lock in: buffer stays byte-address, an `InterlockedAdd` takes a LOCAL `.asStructuredBuffer<>()` view.
- DISTINGUISHING TRAP: `RWStructuredBuffer<uint>` in CUDA output is NOT automatically the bug. A body-local `x.asStructuredBuffer<uint>()` temporary is the CORRECT legalization for atomics (`asStructuredBuffer` is a real prelude method, slang-cuda-prelude.h:3061). Check whether the `RWStructuredBuffer` is a PARAMETER (bug) or a body temporary (correct) before calling it a defect.

TRIAGE OUTCOME: not ready-for-fix; posted verify-and-close verdict asking OP to confirm on ≥v2026.1.2. Did NOT apply `reproduced` (did not reproduce). Fresh delta comment (human was last commenter, also notifies).

ALSO: `gh api repos/O/R/issues/comments/<id>` is the single-comment read endpoint — with the issue NUMBER in the path (`issues/<N>/comments/<id>`) it 404s, and a 404 makes every fragment probe read 0 (looks like absent claims). Use the no-number form for readback.
