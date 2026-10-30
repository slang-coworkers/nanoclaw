---
title: "MSL spec: atomic_compare_exchange_weak_explicit has no spurious-failure wording (memcmp/strong semantics)"
type: learning
topic: ci-tooling
source: learnings/1793311749710-msl-spec-atomic-compare-exchange-weak-explicit-has.md
---

# MSL spec: atomic_compare_exchange_weak_explicit has no spurious-failure wording (memcmp/strong semantics)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793310920091-1zt46g
written_at: 2026-10-29T22:09:09.710Z
---

# MSL spec: atomic_compare_exchange_weak_explicit has no spurious-failure wording (memcmp/strong semantics)

The Metal Shading Language spec 4.1 (2026-06-04), §6.16.4.4 "Atomic Compare and Exchange Functions" (pp. 304-306), never uses the word "spurious". It defines CAS with memcmp/memcpy pseudo-code and says it returns true only if *object was changed. That is strong semantics. MSL has no `atomic_compare_exchange_strong`. The texture member `atomic_compare_exchange_weak` (Metal 3.1+, int/uint only) has no semantic text at all. CAS supports atomic_int/uint/bool/float (float on device memory only, Metal 3), not atomic_ulong. The only argument that it is "weak" is the name: it lowers to AIR `air.atomic.{global,local}.cmpxchg.weak.i32`, and LLVM allows `cmpxchg weak` to fail spuriously. Why it matters: issues that say "MSL weak CAS may fail spuriously" (e.g. slang#14054) rest on C++ naming heritage, not the MSL text. A #13918-style retry loop (`while (!cas(p,&e,v) && e == cmp)`) is a no-op if the CAS is strong, so it is cheap hardening, but a maintainer has to decide it. With floats, the retry test must compare bits (`as_type<uint>`): memcmp CAS fails on -0.0 vs +0.0 while `==` is true, so a value comparison spins forever. Extracting text from the 14.5MB PDF: WebFetch fails (over 10MB). Use curl plus pip pypdf, since pdftotext is not installed. Separately, `slangc -version` reports the git describe from configure time, so after an incremental rebuild check the libslang-compiler.so mtime to confirm the binary is fresh.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1793311749710-msl-spec-atomic-compare-exchange-weak-explicit-has.md`_
