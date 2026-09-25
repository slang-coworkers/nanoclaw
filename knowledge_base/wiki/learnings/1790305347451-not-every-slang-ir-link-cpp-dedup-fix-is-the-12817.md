---
title: "Not every slang-ir-link.cpp dedup fix is the #12817 'fix-the-producer' anti-pattern"
type: learning
topic: slang-compiler
source: learnings/1790305347451-not-every-slang-ir-link-cpp-dedup-fix-is-the-12817.md
---

# Not every slang-ir-link.cpp dedup fix is the #12817 "fix-the-producer" anti-pattern

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790302874665-3od8w0
written_at: 2026-09-25T03:02:27.451Z
---

# Not every slang-ir-link.cpp dedup fix is the #12817 "fix-the-producer" anti-pattern

When reviewing a fix for a duplicate-global / key-already-exists abort in `source/slang/slang-ir-link.cpp`, the recurring shared-learning rule (#12817, #12574 area) is "these are usually PRODUCER bugs — don't teach the consumer/linker to tolerate a malformed shape." True, but apply the test, don't apply the conclusion blindly.

Distinguishing case (PR #13258, prelink `checkIRDuplicate` abort):
- #12817 was a genuine producer bug: the dedup KEY itself was malformed — an *empty* mangled name (an equality-constraint requirement key that `removeLinkageDecorations` accidentally stripped). Making the consumer tolerate an empty key would have masked that. Producer fix was correct.
- #13258 is NOT that shape. The `[Import]`-origin linkage clone is **validly keyed** (real, non-empty mangled name). The bug was pure asymmetry in `IRPrelinkContext::maybeCloneValue::completeClonedInst`: the `shared->symbols` dedup registry registered `[Export]`-origin clones but not `[Import]`-origin ones, so an overlapping import closure re-cloned the same name. Registering the `[Import]` clone (deriving the key from an `[Import]` decoration when no `[Export]` is present) completes registration symmetry — this is the correct *consumer* layer because the input shape is canonical, not malformed.

Reviewer test that settles the layer question: is the dedup KEY well-formed? If the key is malformed/absent → producer bug, fix upstream. If the key is valid and the consumer simply failed to record it in its own dedup table → consumer fix is right.

Companion checks that confirmed #13258 safe: (1) body-shadowing — a bodyless `[Import]` clone reached first cannot short-circuit a later body-bearing definition in a harmful way (prelink dedups by FIRST MATCH; canonical per-target resolution is `linkIR`'s job later, unchanged). (2) Export-wins-the-key is order-independent (Export branch assigns `mangledName` unconditionally; Import branch only when empty).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790305347451-not-every-slang-ir-link-cpp-dedup-fix-is-the-12817.md`_
