---
title: "A thread-local set by an assert handler is unreadable across a dlopen'd module boundary — the exception object is the only carrier"
type: learning
topic: misc
source: learnings/1786198724315-a-thread-local-set-by-an-assert-handler-is-unreada.md
---

# A thread-local set by an assert handler is unreadable across a dlopen'd module boundary — the exception object is the only carrier

Measured on shader-slang/slang @ `716ec597f` while triaging #12431/#12432, both of which proposed
reading `Slang::getLastSignalMessage()` from a `catch (...)` in the test harness.

**`core` is a static archive (`libcore.a`) and the build uses hidden visibility, so every binary that
pulls in `slang-signal.cpp.o` gets its OWN `thread_local g_lastSignalMessage`.** Measured with `nm -C`
on one Debug tree: `libslang.so`, `libslang-unit-test-tool.so`, `test-server`, `slang-test` and
`slangc` each define a private copy (`b`/`t` locals in the .so's, `B`/`T` in the executables).
`nm -D --defined-only libslang.so | grep -c getLastSignalMessage` → **0** against 677 exported
symbols, so the accessor is not reachable across a library boundary at all.

Consequence, executed with a stand-in module built to mimic the real one (`MODULE`, dlopen'd,
`-fvisibility=hidden`, own `libcore.a`):

| assert fires in | `catch (const Slang::Exception& e)` → `e.Message` | host's `getLastSignalMessage()` |
|---|---|---|
| host's own copy of core | correct text | correct text |
| the dlopen'd module | correct text | **empty string** |

**GUILTY CONTROL that makes the empty read meaningful:** export a reader from the module itself and it
returns the correct text at the same instant the host reads empty ⇒ the emptiness is "wrong copy", not
"no assert happened". Without that cell, an empty read is indistinguishable from a probe that never
fired the assert.

Three transferable rules:

1. **A typed catch reading a member off the exception object crosses the boundary; a global/thread-local
   does not.** The object is passed by reference to the handler, so its `String` member is readable
   wherever it is caught. This codebase already relies on it: `tools/slang-unit-test/unit-test-replay-stream-decoder.cpp:52-54`
   does `catch (const InternalError& e)` reading `e.Message` across exactly this module→`libslang.so`
   boundary, and it works because `cd1e9bc99` (PR #11910, for issue #11912) annotated the exception
   types `SLANG_EXCEPTION_TYPE_VISIBLE` so their typeinfo is exported and the catch matches.
2. **Check whether the exception hierarchy you're catching derives from `std::exception` before writing
   `catch (const std::exception& e)` and calling `e.what()`.** `Slang::Exception` does not — it's a
   standalone class with a `String Message` member, no `what()` anywhere (grep 0, control
   `String Message`=1). A `std::exception` clause placed ahead of the Slang clause silently never
   matches; control flow falls through, which looks like the clause working until you probe it.
3. **Which binaries carry a copy is CONFIGURATION-DEPENDENT.** In the Release build of `slangc`, none of
   `getLastSignalMessage`/`handleAssert`/`handleSignal`/`g_lastSignalMessage` appear at all (against 690
   surviving `Slang::` symbols and 236 `Slang::String` ones), because static-archive linking is
   per-object selective. So adding an accessor call to a link that currently lacks the object would
   *create* the always-empty copy it tries to read. Corollary: "links `libcore.a`" does not imply "has a
   copy" — check with `nm`, per configuration.

Bonus defect found in the same probe: a thread-local written only by the signal handler and **never
cleared** reports a *previous, unrelated* assert as the cause of any later throw that bypasses that
handler. Measured: after an earlier assert, catching a `TextFormatException` gives the correct
`e.Message` while the accessor still returns the earlier assert's text. That is worse than an empty
buffer — it is confidently wrong.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786198724315-a-thread-local-set-by-an-assert-handler-is-unreada.md`_
