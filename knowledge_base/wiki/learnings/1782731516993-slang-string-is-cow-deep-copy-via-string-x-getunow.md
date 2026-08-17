---
title: "Slang::String is COW — deep-copy via String(x.getUnownedSlice()) to share across threads"
type: learning
topic: slang-compiler
source: learnings/1782731516993-slang-string-is-cow-deep-copy-via-string-x-getunow.md
---

# Slang::String is COW — deep-copy via String(x.getUnownedSlice()) to share across threads

**Context:** triage of shader-slang/slang#11814 (flaky test `coreDebugBridgeHandlesConcurrentMessages` destabilizing the merge queue; data race on a shared string buffer), verified at HEAD 6b473bdfb.

**The trap.** `Slang::String` is copy-on-write. Its copy ctor (`source/core/slang-string.h:553`) does `m_buffer = str.m_buffer;` — a shallow `RefPtr<StringRepresentation>` share, NOT a deep copy. `StringBuilder::toString()` (`slang-string.h:931`) is literally `return *this;`, so a `String` obtained from a `StringBuilder` aliases the builder's live buffer. Wrapping the *copy* in a mutex does NOT make this safe: once the returned `String` temporary dies, refcount drops to 1 and the next append takes the in-place path (`String::appendInPlace`, `slang-string.cpp:431-455`, writes `m_buffer->length` at :450 and char data at :453 with no synchronization — guarded only by `isUniquelyReferenced()` at `ensureUniqueStorageWithCapacity` :402). A reader still touching that buffer after the lock dropped = genuine data race. The `RefObject` refcount is `std::atomic` (`slang-smart-pointer.h:21`), so refcounting is safe — the race is on the char buffer + `length` field, not the count. aarch64's weaker memory model surfaces it more, but it is not arch-specific.

**The fix idiom.** To hand a `String` across threads independent of the source buffer, force a fresh uniquely-owned `StringRepresentation`: `String(x.getUnownedSlice())` (the `String(UnownedStringSlice)` ctor → `append` → `ensureUniqueStorageWithCapacity` allocates a new buffer). Do the copy *under the producer's lock* so it can't race the writer. In-tree precedent: `TestReporter::init` uses `m_expectedFailureList.add(String(s.getUnownedSlice()))` for exactly this cross-thread-sharing reason. Don't try to make `Slang::String` itself thread-safe — that defeats COW; fix the producer to hand out an owned copy.

**Triage signal:** a single common-suite/unit-test flake (RPC-timeout/server-hang symptom) can stall the whole merge queue → critical/P0 even though it's "just a test." RPC-timeout is the symptom; the data race is the cause — separate them.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782731516993-slang-string-is-cow-deep-copy-via-string-x-getunow.md`_
