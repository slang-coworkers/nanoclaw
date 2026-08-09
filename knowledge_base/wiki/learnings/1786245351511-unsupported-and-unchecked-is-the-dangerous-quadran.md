---
title: "Unsupported-and-unchecked is the dangerous quadrant — grep for the identity check, not the diagnostic"
type: learning
topic: misc
source: learnings/1786245351511-unsupported-and-unchecked-is-the-dangerous-quadran.md
---

# Unsupported-and-unchecked is the dangerous quadrant — grep for the identity check, not the diagnostic

## The finding

A Slang user asked whether he could load a module on one `ISession` and call `createCompositeComponentType` on another (to fan specialisation across threads). Answer: **no** — and the reason it bites is *not* that it is unsupported, but that it is unsupported **and silently accepted**.

`source/slang/slang-session.cpp:390-443` — the entire validation is null checks (`Diagnostics::NullComponentType` at `:415`, `:430`). Grepped `getLinkage() ==`/`!=`, `m_linkage ==`/`!=`, `!= this`, `getSession() !=` across the file ⇒ **zero hits**; no `SLANG_ASSERT` on linkage identity in the creation path. So the call returns `SLANG_OK` and the program crashes later in `getEntryPointCode()`.

Maintainer `csyonghe` on **#8437** (open), verbatim: *"component types created from different sessions cannot be mixed together in a single CompositeComponentType, so the above use will not be supported. If you want to use a module created from a different session, you must first serialize that module, and deserialize it from the current session."*

## The transferable rule

Four quadrants, and they need different answers to a user:

| | checked | unchecked |
|---|---|---|
| **supported** | fine | fine |
| **unsupported** | clean error — user finds out immediately | ⚠️ **UB / crash far from the cause** |

**The bottom-right is the one worth warning about explicitly.** "This is unsupported" under-serves the user if the API won't tell them — they will conclude their own code is at fault. Say *"and nothing will diagnose it."*

To establish which quadrant you're in, grep for the **identity/validation check** (`==`/`!=` on the owning object), not for a diagnostic name. Absence of a diagnostic does **not** prove silent acceptance — an assert or an early `SLANG_E_INVALID_ARG` also counts as checked. Enumerate both.

## Related: prove a lock's absence by enumerating every lock in the file

Same session, adjacent claim: does `loadModule` race on a shared session? Rather than grepping `loadModule` for a lock (which proves nothing — a caller could hold one), I enumerated **every** lock in the 2328-line file: exactly **3** (`:122` type-checking cache, `:398` composite/specialize, `:792` sequential-ID map). `Linkage::loadModule` (`:185-224`) is covered by none, while the module dictionaries are written at 9 sites. That is a complete-enumeration argument, not a name-grep.

## Docs can be stricter than you assume — read them, don't infer the "obvious" rule

I expected "one session per thread." The docs require **one global session per thread**: `docs/user-guide/08-compiling.md:720-721` — *"each concurrent thread compiles with a distinct global session"* — and `:1011` extends non-reentrancy to *"a session, **or objects created from them**."* A per-thread `ISession` under one shared `IGlobalSession` is **not** sanctioned. `include/slang.h:4071-4074` says the same.

But read far enough to find the **carve-out that saves the user's design**: `:1015-1028` documents a serial-frontend / parallel-backend split — after `link()`, `getEntryPointCode`/`getTargetCode`/`getTargetMetadata`/`getEntryPointMetadata`/`getResultAsFileSystem` *are* safe concurrently. That was exactly the user's "reflection + SPIR-V" step, so his architecture mostly survives by moving the thread boundary later. Stopping at "no, unsupported" would have been correct and much less useful. (It is documented **experimental** — pass that along too.)

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786245351511-unsupported-and-unchecked-is-the-dangerous-quadran.md`_
