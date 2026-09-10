---
title: "Slang Serialization, Module Cache, and Enum/Sentinel Discipline"
type: concept
group: slang-grab-bag
tags: [record-replay, serialization, RECORD_OUTPUT, wrapObject, UBSan, miniz, binary-module, module-cache, getRelativePath, digest, sentinel, CountOf, enum-collision, macos-visibility, RTTI, inline-template, switch-default, C++]
source_count: 15
---

# Slang Serialization, Module Cache, and Enum/Sentinel Discipline

This page covers the record/replay layer (fixed-schema stream, ownership/UBSan hazards), the miniz heap-archive allocator gotcha, the binary-module up-to-date check and the #11918 cross-drive cache-miss correction chain, terminal count/sentinel enum discipline, plus a set of C++/build reading-error lessons (macOS cross-dylib exception catch, an inline template's `__FILE__`, and a switch's `default:` arm) surfaced during serialization and RHI triage.

## TL;DR
- The record/replay stream is **fixed-schema at the call level**: `executeNextCall` re-invokes the same call shape on playback, so **never conditionally skip `RECORD_OUTPUT`** — a skipped output desynchronizes every subsequent call.
- Always pass an **interface-typed** pointer to record-replay `wrapObject`/`unwrapObject`; a concrete-impl `T` compiles and runs but is a bad-downcast UB that a green Debug build + passing tests hide and only UBSan catches.
- The record-replay **replay** path leaks because `ReplayContext` registries are raw/non-owning (DeepWiki wrongly says owning — verify against source).
- A buffer from miniz's `mz_zip_writer_finalize_heap_archive` must be freed with the **archive's own** deallocator (`archive.m_pFree`), not global `mz_free`.
- Slang's binary-module up-to-date check is **digest-based, not mtime-based**.
- #11918 (Windows cross-drive cache MISS) root cause: `getRelativePath` returns empty across volumes → an EMPTY serialized module dep (save produces it, load consumes it); RESOLVED by PR #11921. The path went through two prior wrong/partial hypotheses — a model correction-supersession chain.
- Terminal `CountOf`/`Count`/`NUM_*` sentinels should stay **IMPLICIT** (restore textual order == value order); a `static_assert(CountOf == Named + 1)` is NOT a uniqueness guard.
- Reading errors to avoid: an inline template's `__FILE__` names the header (attributes the instantiating TU, not the data owner); a switch's `default: break;` admits **every** case.
- `SLANG_ASSERT` becomes `SLANG_ASSUME` under NDEBUG, so a false assert in release is UB. Before citing an internals behaviour, read it at a named ref — several entries here record a premise that was false.

## Record/Replay Stream Is Fixed-Schema at the Call Level

In Slang's record/replay layer (`source/slang-record-replay/`), the recorded stream is **fixed-schema at the call level** even though each value carries a TypeId tag. On playback `executeNextCall` re-invokes the same call shape, so you must **never conditionally skip `RECORD_OUTPUT`** — a skipped output desynchronizes the stream for every subsequent call ([Record/replay stream is fixed-schema at the call level — never conditionally skip RECORD_OUTPUT](../learnings/1782866674061-record-replay-stream-is-fixed-schema-at-the-call-l.md)).

## Record/Replay `wrapObject<T>` Must Be Instantiated with a COM INTERFACE Type (UBSan Bad-Downcast)

`slang-record-replay` has TWO `wrapObject`s: a free function `ISlangUnknown* wrapObject(ISlangUnknown*)` (`proxy-base.h`, does the real `tryWrap`) and a type-safe template `template<typename T> T* wrapObject(T*)` (`replay-context.h`) that QIs the wrapped proxy back to `T` via `T::getTypeGuid()`. Overload resolution prefers the template (exact match) over the free function (which needs a base-pointer conversion), so `wrapObject(new ReplayNullFileSystem())` deduces `T = ReplayNullFileSystem` — a concrete impl class, not a COM interface. Its inherited `getTypeGuid()` still compiles and even runs (vtable dispatch happens to land on the right `release()`), but `toSlangInterface<ReplayNullFileSystem>` then calls a member through a pointer to the wrong dynamic type = UB, which UndefinedBehaviorSanitizer reports as a bad-downcast (`replay-shared.h:105`) even though the plain Debug build + all 85 unit tests were green (PR #12863). Rule: always pass an **interface-typed** pointer — `ISlangMutableFileSystem* standIn = new ReplayNullFileSystem(); desc.fileSystem = wrapObject(standIn);` — so `T` is a COM interface with a genuine `getTypeGuid()` and the QI-back is well-defined (the working arms already do this: `wrapObject(desc.fileSystem)` → `ISlangFileSystem*`). Two broader lessons: a UBSan/ASAN CI failure can hide behind a fully-green Debug build + passing tests (vtable dispatch masks an invalid downcast), so when the sanitizer job fails and local Debug is green, suspect exactly this static-vs-dynamic-type UB; and dead code a new test first executes can surface *multiple* latent bugs at once (here a leak AND this bad-downcast both lived in the never-run `new NULLFileSystem()` arm) ([Slang record-replay: wrapObject<T> must be instantiated with a COM *interface* type, never a concrete impl class (else UBSan bad-downcast)](../learnings/1788352568307-slang-record-replay-wrapobject-t-must-be-instantia.md)).

## Record/Replay REPLAY Path Leaks: ReplayContext Registries Are Raw/Non-Owning

The record-replay *replay* path leaks (LSan direct leaks, #11936) because `ReplayContext` registries are raw/non-owning — DeepWiki wrongly describes them as owning, so verify against the source ([1783073842766-slang-record-replay-the-replay-path-le](../learnings/1783073842766-slang-record-replay-the-replay-path-leaks-because-.md)).

## miniz Heap-Archive Buffers Are Owned by Per-Archive Callbacks, Not Global `mz_free`

A buffer from miniz's `mz_zip_writer_finalize_heap_archive(&archive, &buf, &size)` must be freed with the **archive's own** deallocator (`archive.m_pFree`), not global `mz_free` — they can differ ([1783064260282-miniz-heap-archive-buffers-are-owned-b](../learnings/1783064260282-miniz-heap-archive-buffers-are-owned-by-per-archiv.md)).

## Terminal Count/Sentinel Enums: Keep Them IMPLICIT; static_asserts Aren't Uniqueness Guards

When a trailing `CountOf`/`Count`/`NUM_*` sentinel enumerator collides with a real option (#11852: `CompilerOptionName::CountOf == SPIRVUnifiedDescriptorHeapStride == 154`), the durable fix is to restore **textual order == value order** and keep the sentinel *implicit* rather than pinning it explicitly ([Terminal count/sentinel enums: prefer keeping them IMPLICIT, not explicit+static_assert](../learnings/1782859187073-terminal-count-sentinel-enums-prefer-keeping-them-.md)). An implicit `CountOf` can silently alias an option when a concurrent-PR renumber breaks textual value-order — a subtle follow-on to the enum-collision hazard that survives the usual fix ([Implicit CountOf sentinel aliases an option when a concurrent-PR renumber breaks textual value-order](../learnings/1782853815255-implicit-countof-sentinel-aliases-an-option-when-a.md)). And a `static_assert(CountOf == SomeNamedOption + 1)` guard is **not** a uniqueness guard: it only checks adjacency to one named enumerator, not the general "CountOf is unique" invariant ([Sentinel static_assert pinned to a named option is not a uniqueness guard](../learnings/1782858072079-sentinel-static-assert-pinned-to-a-named-option-is.md)).

## Binary-Module Up-to-Date Check Is Digest-Based; the #11918 Cross-Drive Cache Miss

Slang's binary-module up-to-date check is **digest-based, not mtime-based** ([1783028515295-slang-binary-module-up-to-date-check-i](../learnings/1783028515295-slang-binary-module-up-to-date-check-is-digest-bas.md)). The Windows-only #11918 cross-drive cache MISS was investigated through several corrections: the reproducer first refuted the naive path-layer hypothesis ([1783029316997-slang-11918-cross-drive-module-cache-m](../learnings/1783029316997-slang-11918-cross-drive-module-cache-miss-reproduc.md)); a correction said the load side is drive-agnostic and `getRelativePath` is save-side only ([1783029497134-correction-to-11918-learning-load-side](../learnings/1783029497134-correction-to-11918-learning-load-side-path-layer-.md)); that was then **superseded** — the `getRelativePath` cross-volume EMPTY-dep IS the root cause (save produces an empty dep, load consumes it) ([1783031868902-supersedes-prior-11918-correction-the-](../learnings/1783031868902-supersedes-prior-11918-correction-the-getrelativep.md)), confirmed RESOLVED by PR #11921 ([1783038802019-slang-11918-resolved-getrelativepath-r](../learnings/1783038802019-slang-11918-resolved-getrelativepath-returns-empty.md)). A model chain worth reading end-to-end for how corrections supersede.

## macOS Hidden Visibility Breaks Cross-Dylib Typed C++ Exception Catch

On macOS, hidden visibility breaks catching a `Slang::Exception`/`InternalError` BY TYPE across dylibs — libc++abi relies on RTTI *identity*, which hidden visibility duplicates, so a typed `catch` in another dylib silently misses ([1783011716114-macos-hidden-visibility-breaks-cross-d](../learnings/1783011716114-macos-hidden-visibility-breaks-cross-dylib-typed-c.md)).

## Reading a C++ Crash Path: `__FILE__` of an Inline Template, and a Switch's Default Arm

Two mechanical C++ reading errors from the slang-rhi#818 triage, each visible in the reader's own earlier output. **An inline template member's `__FILE__` names the header, not the owner of the data.** The assert path read `src/metal/../core/short_vector.h:187`, read as "a metal TU indexed metal-owned data" — but `short_vector::operator[]` is an inline template, so `__FILE__` expands to the header and the `src/metal/../core/` prefix is just the relative include path of whichever TU *instantiated* it. Three cheap measurements disproved the metal-subsystem attribution at the pinned commit: `src/metal/` declared exactly two `short_vector`s and neither was referenced again (structurally incapable of being the crash site — a disproof, one grep), and zero files under `src/metal/` include `../core/` at all (must-hit control: that TU has 7 includes) ([An inline template's __FILE__ names the header, so a crash path's directory prefix attributes the TU, not the owner of the data](../learnings/1786303967402-an-inline-template-s-file-names-the-header-so-a-cr.md)). **A switch's `default: break;` admits every case** — a claim that a vulnerable call "fires exactly on `ConstantBuffer`/`ParameterBlock` cursors" (the two `case` labels immediately above it) inverted a guard into a no-op, because the block's `default: break;` arm means the call runs for every kind that isn't one of the listed cases; read the default arm before asserting a switch restricts to its listed labels ([A switch's `default: break;` admits every case — reading the case labels without the default arm inverts a guard into a no-op](../learnings/1786304686679-a-switch-s-default-break-admits-every-case-reading.md)).

---

**Source learnings (15):**
- [Record/replay stream is fixed-schema at the call level — never conditionally skip RECORD_OUTPUT](../learnings/1782866674061-record-replay-stream-is-fixed-schema-at-the-call-l.md)
- [record-replay wrapObject<T> must be instantiated with a COM interface type, never a concrete impl class (else UBSan bad-downcast); a green Debug build can hide it (PR #12863)](../learnings/1788352568307-slang-record-replay-wrapobject-t-must-be-instantia.md)
- [record-replay REPLAY path leaks: ReplayContext registries are raw/non-owning (DeepWiki wrong)](../learnings/1783073842766-slang-record-replay-the-replay-path-leaks-because-.md)
- [miniz heap-archive buffers are owned by per-archive callbacks, not global mz_free](../learnings/1783064260282-miniz-heap-archive-buffers-are-owned-by-per-archiv.md)
- [Terminal count/sentinel enums: prefer keeping them IMPLICIT, not explicit+static_assert](../learnings/1782859187073-terminal-count-sentinel-enums-prefer-keeping-them-.md)
- [Implicit CountOf sentinel aliases an option when a concurrent-PR renumber breaks textual value-order](../learnings/1782853815255-implicit-countof-sentinel-aliases-an-option-when-a.md)
- [Sentinel static_assert pinned to a named option is not a uniqueness guard](../learnings/1782858072079-sentinel-static-assert-pinned-to-a-named-option-is.md)
- [Binary-module up-to-date check is DIGEST-based (not mtime); path layer has no cross-drive handling](../learnings/1783028515295-slang-binary-module-up-to-date-check-is-digest-bas.md)
- [#11918 cross-drive module-cache MISS: reproducer refutes the naive path-layer hypothesis](../learnings/1783029316997-slang-11918-cross-drive-module-cache-miss-reproduc.md)
- [CORRECTION to #11918: load-side path layer is drive-agnostic; getRelativePath is save-side only](../learnings/1783029497134-correction-to-11918-learning-load-side-path-layer-.md)
- [SUPERSEDES #11918 correction: getRelativePath cross-volume EMPTY-dep IS the root cause](../learnings/1783031868902-supersedes-prior-11918-correction-the-getrelativep.md)
- [#11918 RESOLVED: getRelativePath returns empty across Windows volumes → empty serialized module dep (PR #11921)](../learnings/1783038802019-slang-11918-resolved-getrelativepath-returns-empty.md)
- [macOS: hidden visibility breaks cross-dylib typed catch of C++ exceptions (libc++abi RTTI-identity)](../learnings/1783011716114-macos-hidden-visibility-breaks-cross-dylib-typed-c.md)
- [an inline template's __FILE__ names the header — a crash path's dir prefix attributes the instantiating TU, not the data owner](../learnings/1786303967402-an-inline-template-s-file-names-the-header-so-a-cr.md)
- [a switch's `default: break;` admits every case — reading case labels without the default arm inverts a guard into a no-op](../learnings/1786304686679-a-switch-s-default-break-admits-every-case-reading.md)
