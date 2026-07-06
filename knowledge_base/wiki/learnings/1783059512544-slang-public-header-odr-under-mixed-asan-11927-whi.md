---
title: "Slang public-header ODR under mixed ASan (#11927): which header constructs are/aren't detect_odr_violation offenders"
type: learning
topic: slang-compiler
source: learnings/1783059512544-slang-public-header-odr-under-mixed-asan-11927-whi.md
---

# Slang public-header ODR under mixed ASan (#11927): which header constructs are/aren't detect_odr_violation offenders

When triaging Slang public-header (`include/`) ODR-under-mixed-ASan work (shader-slang/slang#11927, the burn-down of #11926's `detect_odr_violation=2` list), the offender test is precise and worth reusing:

`detect_odr_violation` fires only on **global variables** whose *registered size* differs across TUs. In a mixed build (downstream consumer compiles the header WITH ASan → the global gets a redzone + ODR indicator; libslang compiled WITHOUT) any header construct that emits a **vague/external-linkage** definition into every including TU is a candidate: C++17 `inline` variables, template static data members, ODR-used `constexpr` static members, `extern`+header-definition.

- **Offenders** (found at HEAD f4975a7f8): `include/slang.h:770` `inline constexpr SlangTargetFlags kDefaultTargetFlags`; `include/slang.h:4754` `inline constexpr uint32_t kInvalidCoverageCounterIndex`. Caveat: an `inline constexpr` only emits storage (→ registers an ASan global) when ODR-used (address taken / bound to a reference), so the CI run is what *confirms* them.
- **NOT offenders** (verified against source): namespace-scope plain `const` (e.g. `slang-gfx.h:140 kMaxRenderTargetCount`) has *internal* linkage → distinct per-TU symbol → not cross-TU compared. The `SLANG_COM_INTERFACE` `getTypeGuid()` (slang.h:1419) is a `constexpr static` member fn returning `SlangUUID` **by value** (prvalue in `return`) — no `static` local, no global emitted. (DeepWiki *claimed* it returns "a static const SlangUUID by reference" — a hallucination; reading the macro disproved it.)
- ASan redzones wrap globals/stack, they do NOT change `sizeof` of ordinary structs, so the issue's "types whose layout ASan alters" phrasing really means STL-container annotations crossing the ABI — and Slang's public ABI deliberately avoids STL, so that class is likely empty at the boundary.

Fix menu for simple constant offenders: internal linkage (`inline constexpr` → `static constexpr`) or enumerator/macro — both remove the emitted global, non-ABI-breaking, keep it compile-time. An out-of-line `extern` definition removes `constexpr` + adds a runtime symbol (fits only larger offenders). An ASan ignorelist / `no_sanitize_address` (like the existing `cmake/sanitizer-ignorelist.txt` COM-vptr precedent) is **Slang-build-side only** and does NOT fix the downstream mixed build — the consumer compiles the header with their own ASan regardless.

Process note: #11927 is TRIAGE-AND-PARK until #11926 lands — #11926 (adds `detect_odr_violation=2` to ci-slang-sanitizer.yml) is a `.github/workflows` edit (bot-unpushable) and had no PR at triage time, so the authoritative offender list doesn't exist yet. The overall header-restructuring strategy is a maintainer design call.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783059512544-slang-public-header-odr-under-mixed-asan-11927-whi.md`_
