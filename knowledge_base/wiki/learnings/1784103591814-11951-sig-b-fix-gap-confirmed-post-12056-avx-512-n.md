---
title: "#11951 Sig-B fix-gap confirmed post-#12056 (AVX-512 not sole cause)"
type: learning
topic: verification
source: learnings/1784103591814-11951-sig-b-fix-gap-confirmed-post-12056-avx-512-n.md
---

# #11951 Sig-B fix-gap confirmed post-#12056 (AVX-512 not sole cause)

**#11951 (static-const-matrix-array.slang.3 syn (llvm) test-server JSON-RPC IPC drop) was CLOSED 2026-07-15 as fixed by #12056 (AVX-512 JIT workaround), but a fix-gap is REAL.** Merge_group run 29390282163 (2026-07-15) evicted APPROVED PR #12064 (LDeakin Flat-decoration fragment fix — unrelated to LLVM-synth compute) with `SLANG_DISABLE_AVX512=1` ACTIVE in the job, yet `static-const-matrix-array.slang.3 syn (llvm)` still hit a genuine FAILED line + companion `gh-5900.slang.1 syn (llvm)` JSON-RPC drop, on `test-windows-RELEASE-cl-x86_64-gpu`.

**Why it matters for future sweeps:** the AVX-512 export being active does NOT rule out Sig-B anymore. When you see the `syn (llvm)` JSON-RPC waitForResult/hasMessage drop on a fresh run with the export present, it's a fix-gap data point, not "needs-rebase." Sig-B now spans BOTH tiers (title says debug-gpu; this receipt is release-gpu).

**Mechanism UNPROVEN** — no SIGILL/illegal-instruction string in the log. Claim is "fix-gap real," NOT "residual AVX-512." Either the disable doesn't cover the GPU-tier JIT path, or a second cause shares the exact JSON-RPC-drop fingerprint. Match that hedge; don't assert a mechanism you didn't see.

**The receipt that proves it (vs the one that didn't):** a fix-gap receipt needs the TRIFECTA — export-active + genuine FAILED line + UNRELATED PR. #12105 (mimalloc PR failing allocator tests, debug-gpu) was contaminated — its failures were its own change, so it did NOT prove the gap. Killing a contaminated receipt ≠ disproving the hypothesis; it leaves it unproven. #12064 supplied the clean trifecta. Comment posted to #11951 2026-07-15 (issue-4978396335); jkwak owns the reopen decision. See [[project-11951-sigb-resolved-avx512]].

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1784103591814-11951-sig-b-fix-gap-confirmed-post-12056-avx-512-n.md`_
