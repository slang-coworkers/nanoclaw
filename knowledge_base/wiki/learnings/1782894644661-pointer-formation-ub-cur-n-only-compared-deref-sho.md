---
title: "Pointer-formation UB (cur+N only compared, deref short-circuit-guarded) is UBSan-flaggable but NOT a realized crash — don't over-call P1"
type: learning
topic: ci-tooling
source: learnings/1782894644661-pointer-formation-ub-cur-n-only-compared-deref-sho.md
---

# Pointer-formation UB (cur+N only compared, deref short-circuit-guarded) is UBSan-flaggable but NOT a realized crash — don't over-call P1

**Rule:** When triaging a "memory-safety / UB pointer arithmetic" bug, distinguish **pointer formation** from **pointer dereference**. Forming a pointer more than one-past-the-end (e.g. `cur + 6 <= end` when fewer than 6 bytes remain) is UB per C++ `[expr.add]` and UBSan (`-fsanitize=pointer-overflow`) will flag it — but if that pointer is only *compared*, never *dereferenced*, there is **no actual OOB read/write and no crash** on mainstream flat-memory ISAs (the comparison yields the correct result). Check whether the subsequent dereferences are short-circuit-guarded behind the bounds check (`&&` ordering). If they are, the realized severity is "latent UB / UBSan finding," not "crash/OOB" — that's typically P2, not P1.

**Why:** On slang #11864, `JSONStringEscapeHandler::appendUnescaped` formed `cur+6`/`cur+4` past-end pointers, but the `cur[0]`/`cur[1]`/`_parseHex4(cur+2)` reads were all guarded behind `cur+6 <= end` via `&&` short-circuit — so nothing past the buffer is ever read. Empirically no crash; worst case an unpaired surrogate is mis-encoded (minor wrong output). The issue was recommended P1 (memory-safety); the honest call was P2 — real UB worth fixing, but not a realized crash/OOB. Contrast a true P1: the pointer is dereferenced out of bounds, or the formed pointer drives an unguarded memcpy/index.

**How to apply:** For UB-pointer triage, (1) locate every use of the out-of-range pointer, (2) confirm compare-only vs dereference, (3) check short-circuit guards, (4) note if only UBSan/segmented-arch would surface it. Fix is still worth doing (idiom: compute `end - cur >= N`, always well-defined). Also always pickaxe (`git log -S`) the exact site to attribute the introducing PR — sibling sites in the same function can have different provenance (one a fresh regression, one latent for years).

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1782894644661-pointer-formation-ub-cur-n-only-compared-deref-sho.md`_
