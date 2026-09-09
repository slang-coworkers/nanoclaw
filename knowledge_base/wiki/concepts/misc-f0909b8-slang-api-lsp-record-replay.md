---
title: "Slang public API boundary, LSP null-result serialization, and the record-replay proxy layer"
type: concept
group: misc
tags: [slang, public-api, slang-h, lsp, language-server, json-rpc, nullresponse, record-replay, wrapObject, refcount, singleton, com]
source_count: 8
---

## TL;DR

Eight atoms on three adjacent Slang subsystems where the *contract* and the
*implementation* diverge in ways that bite users and reviewers.

- **The public/internal API boundary is not what DeepWiki says.** DeepWiki freely
  describes internal C++ symbols as if they were public — always grep
  `include/slang.h` before telling a user an API is callable from outside the
  compiler. And the *nominal* doc contract can be contradicted by the
  implementation: `loadModuleFromSource` supports a null source blob (loads from
  path), despite slang.h/DeepWiki claiming "source cannot be null" — read the code.
- **A `SLANG_RELEASE_ASSERT` on a value derived from a public-API argument is a
  latent user-facing crash** that ships in the Vulkan SDK. Validate + diagnose API
  inputs; assert only genuinely-internal invariants.
- **LSP "no result" serializes to `{}`, not `null`.** `NullResponse` is a zero-field
  struct, and the RTTI Struct→JSON path always emits an object → `{}`. Strict
  clients (JetBrains/LSP4J) reject it for methods with a required result field
  (`textDocument/hover`). The fix is a central `sendNullResult` — but NOT for
  `completionItem/resolve`, whose LSP result is non-nullable (return the item or a
  JSON-RPC error). Check the spec's nullability per method.
- **The LANG_SERVER FileCheck harness cannot distinguish `{}` from `null`** — it
  reads through the zero-field struct, which parses `{}` as "null". Assert the raw
  `result` `JSONValue` kind (`getRPC` → `Kind::Null`), never `getMessage` through a
  struct.
- **In record-replay, `wrapObject` dedups by object identity** and consumes exactly
  one caller-owned reference on first-wrap. Stand-in objects must be **per-call,
  genuinely ref-counted instances** (a singleton registers once where recording
  registered N times → handle drift → `TypeMismatchException`). A singleton-designed
  class with no-op refcount **leaks if heap-allocated** — give it a real singleton
  accessor. And a custom FS's `castAs` IS reached (MutableFileSystemProxy queries the
  extended guids in its ctor).

## The public/internal API boundary and release-assert hazards

DeepWiki confidently answered a "get a ComponentType's module dependencies" question
with `getModuleDependencies()`/`enumerateModules()` — both real, but on the
*internal* `Slang::ComponentType`/`Module` classes; neither appears in the public
`include/slang.h`. Grep the actual public header before advising a Discord user;
the closest public workarounds are session-scoped, not program-scoped
[getModuleDependencies/enumerateModules are internal-only](../learnings/1788093186621-getmoduledependencies-enumeratemodules-are-interna.md).
The nominal contract can also be wrong in the user's favor:
`ISession::loadModuleFromSource` supports a null `source` blob when a readable path
is given (loads from file), which #10996 regressed by adding an unconditional
`computeSourceBlobDigest(source)` whose `SLANG_RELEASE_ASSERT(blob)` fires before
the path-fallback. The principled fix derives the digest from the *materialized*
source; the general lesson is that a release-assert on a public-API-derived value is
a shipping crash — validate and diagnose instead
[loadModuleFromSource supports null source; #10996 regressed it](../learnings/1788198536182-loadmodulefromsource-supports-null-source-path-loa.md).

## LSP null-result serialization and its test traps

Slang's language server sends the `NullResponse` sentinel for "no result", but that
is a zero-field struct serialized through the RTTI `NativeToJSONConverter`, whose
Struct case always builds an object → `makeEmptyObject()` → `{}`. A struct can never
serialize to `null` through that path, so ~13 LSP methods emit `{}` for "nothing" —
which strict clients reject for `textDocument/hover` because `Hover.contents` is
required. The principled fix is a central `sendNullResult` helper that sets
`JSONValue::makeNull()`
[LSP null responses serialize to {} not null](../learnings/1788275460247-slang-lsp-null-responses-serialize-to-not-null-nul.md).
The bug hid for years because the `//TEST:LANG_SERVER` FileCheck harness reads the
result through `getMessage(&NullResponse)`, and a zero-field struct parses `{}`
successfully → prints "null"; worse, once you emit real `null`, JSON→native struct
conversion *fails* on a null source → silently breaks every existing null test. Test
the raw wire JSON via `getRPC(&JSONResultResponse)` and inspect
`result.getKind() == Kind::Null`, extracted into a named predicate so a later
"simplify" can't reinstate the bug
[LANG_SERVER harness can't distinguish {} from null](../learnings/1788282358936-lang-server-filecheck-harness-can-t-distinguish-js.md).
The corollary trap: do NOT route *every* no-result site through `sendNullResult` —
`completionItem/resolve` has a **non-nullable** LSP result (return the
`TextEditCompletionItem`, preserving the textEdit, or a JSON-RPC error). Check each
method's spec nullability before mapping its empty case to `null`
[completionItem/resolve has a non-nullable LSP result](../learnings/1788350185889-completionitem-resolve-has-a-non-nullable-lsp-resu.md).

## Record-replay: identity dedup, per-call stand-ins, and no-op-refcount leaks

`wrapObject()` deduplicates by object identity (an already-wrapped object takes the
`getProxy` early-out without a new handle registration), and playback must reproduce
the *exact* sequence of proxy registrations recording made or the handle counter
drifts → `TypeMismatchException`. So stand-in/placeholder objects on the reading arm
must be a **fresh, distinct, genuinely ref-counted instance per call** — a shared
singleton registers once where recording registered N times. The reference is handed
straight to `wrapObject` (tryWrap adopts one via `obj->release()`; do not pre-addRef)
[record-replay stand-ins must be per-call, not singletons](../learnings/1788260579889-record-replay-stand-in-objects-must-be-per-call-no.md).
This intersects a leak pattern: a class whose `addRef`/`release` are hardcoded
no-ops is *singleton-designed* and leaks if heap-allocated (the owning wrapper's
`release()` is a no-op, so the object is never `delete`d). `NULLFileSystem`
documented itself as a singleton but exposed a public default ctor, so callers
`new`'d it; the principled fix is a real singleton accessor + private ctor, mirroring
`OSFileSystem::getMutableSingleton()` — a static object means zero heap alloc, so the
leak is gone by construction (LSan-only observable, dead on master)
[singleton-designed class with no-op refcount leaks if heap-allocated](../learnings/1788257348928-singleton-designed-class-with-no-op-refcount-leaks.md).
Finally, a reachability check for reviewers: a custom `ISlangFileSystem`'s `castAs`
IS invoked — `MutableFileSystemProxy`'s ctor calls `castAs(ISlangFileSystemExt)` (and
if it succeeds, `ISlangMutableFileSystem`) during wrapping; a `castAs` returning null
for those *extended* guids is correct for a plain FS, and clarity findings that hinge
on "X is never called" must be grounded by tracing call sites, not inferred
[MutableFileSystemProxy ctor calls castAs during wrapping](../learnings/1788255005317-record-replay-mutablefilesystemproxy-ctor-calls-ca.md).

**Source learnings (8):**

- [getModuleDependencies/enumerateModules are internal-only, not in public slang.h](../learnings/1788093186621-getmoduledependencies-enumeratemodules-are-interna.md) — DeepWiki described internal symbols as public; grep include/slang.h before advising a user; closest public workarounds are session-scoped, not program-scoped.
- [loadModuleFromSource supports null source + path; #10996 regressed it with an unconditional digest assert](../learnings/1788198536182-loadmodulefromsource-supports-null-source-path-loa.md) — #12852; the nominal "source cannot be null" doc is contradicted by loadSourceModuleImpl; a SLANG_RELEASE_ASSERT on a public-API-derived value is a shipping crash.
- [Record-replay: MutableFileSystemProxy ctor calls castAs during wrapping](../learnings/1788255005317-record-replay-mutablefilesystemproxy-ctor-calls-ca.md) — #12863 FG001; a custom FS's castAs IS reached with extended guids; null for those is correct; ground "X is never called" clarity flags in traced call sites.
- [Singleton-designed class with no-op refcount LEAKS if heap-allocated (NULLFileSystem)](../learnings/1788257348928-singleton-designed-class-with-no-op-refcount-leaks.md) — #12865; give it a real singleton accessor + private ctor (mirror OSFileSystem); static ⇒ no alloc ⇒ leak gone by construction; LSan-only observable, dead on master.
- [Record-replay stand-in objects must be per-call, not singletons (wrapObject dedups by identity)](../learnings/1788260579889-record-replay-stand-in-objects-must-be-per-call-no.md) — #12863; playback must reproduce the exact registration sequence; a per-call heap stand-in must be genuinely ref-counted (ReplayNullFileSystem overriding addRef/release); don't pre-addRef.
- [Slang LSP null responses serialize to {} not null (NullResponse zero-field struct)](../learnings/1788275460247-slang-lsp-null-responses-serialize-to-not-null-nul.md) — #12869 hover; ~13 methods emit {}; a struct can never serialize to null via the RTTI path; fix = central sendNullResult with makeNull().
- [LANG_SERVER FileCheck harness can't distinguish JSON {} from null](../learnings/1788282358936-lang-server-filecheck-harness-can-t-distinguish-js.md) — #12869; getMessage through a zero-field struct parses {} as "null"; test via getRPC(&JSONResultResponse) + Kind::Null in a named predicate; harness spawns real slangd over stdio.
- [completionItem/resolve has a NON-nullable LSP result — don't send null](../learnings/1788350185889-completionitem-resolve-has-a-non-nullable-lsp-resu.md) — #12870; not every no-result site routes through sendNullResult; echo the TextEditCompletionItem (preserving textEdit) or a JSON-RPC error; a //RESOLVE test directive was added.
