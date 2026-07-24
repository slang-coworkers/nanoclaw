---
title: "C++ versioned-struct inheritance: non-standard-layout ≠ non-aggregate; use base-slicing not offsetof"
type: learning
topic: agent-ops
source: learnings/1784851897134-c-versioned-struct-inheritance-non-standard-layout.md
---

# C++ versioned-struct inheritance: non-standard-layout ≠ non-aggregate; use base-slicing not offsetof

When refactoring a versioned C-ABI struct chain to use inheritance (e.g. `struct Req_1_3 : public Req_1_2 { newFields; }` instead of re-listing the base's fields), these C++ facts matter and are easy to get wrong (all caught by codex review on slang PR #12206):

1. **A class with a public base AND its own data members is NOT standard-layout.** Consequence: `offsetof(Req_1_3, anyField)` is only *conditionally-supported* — GCC/Clang warn `-Winvalid-offsetof`, which FAILS under a `-Werror` build. So you cannot `static_assert` the layout via `offsetof` on the derived type. Base-being-at-offset-0 is a stable ABI property on every real toolchain, but it is NOT a general C++ guarantee — don't write code (or asserts) that depend on reading the base's bytes out of the front of the derived object. Instead, convert via base-slicing: `static_cast<Base&>(derivedRef)` / `Base b = static_cast<const Base&>(derived);` — language-guaranteed correct regardless of ABI offset.

2. **But such a class IS still an aggregate in C++17.** Aggregates are allowed public base classes since C++17, so `Req_1_3 r{{/*base init*/}, field1, field2};` compiles and `std::is_aggregate_v<Req_1_3>` is true. Do NOT claim "aggregate initialization is gone" — that's a common wrong intuition (it's only gone if you add user-declared constructors, virtuals, private/protected members, etc.).

3. **It stays trivially copyable** if the base and the new members are all trivially copyable and you add no user special members — so `memset`/`memcpy`/`sizeof` on the whole object still work. Assert `std::is_trivially_copyable_v<Derived>` for that.

4. **`is_trivially_copyable` + `sizeof(D) > sizeof(B)` do NOT prove B is a byte-prefix of D at offset 0** — they permit field reordering, intervening fields, and padding. To assert the *relationship*, use `std::is_base_of<B, D>`; for the trivial-copy invariant use `is_trivially_copyable`. Don't dress up size arithmetic as a layout proof.

Net recipe for "append a field to a versioned struct via inheritance": derive publicly, add only data members, `set()` does base-slice assignment then zeroes the new fields + fixes any `sizeInBytes`, do cross-version downgrades by slicing to the typed base (not raw memcpy of the derived), and assert `is_trivially_copyable` + `is_base_of` (never offsetof).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1784851897134-c-versioned-struct-inheritance-non-standard-layout.md`_
