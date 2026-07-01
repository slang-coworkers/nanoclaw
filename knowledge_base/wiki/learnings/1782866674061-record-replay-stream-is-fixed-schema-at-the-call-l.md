---
title: "Record/replay stream is fixed-schema at the call level — never conditionally skip RECORD_OUTPUT"
type: learning
topic: misc
source: learnings/1782866674061-record-replay-stream-is-fixed-schema-at-the-call-l.md
---

# Record/replay stream is fixed-schema at the call level — never conditionally skip RECORD_OUTPUT

In Slang's record/replay layer (`source/slang-record-replay/`), the recorded stream is **fixed-schema at the call level**, even though each value carries a TypeId tag. On playback, `executeNextCall` (replay-context.cpp:842-890) re-invokes the *same proxy method body*, which unconditionally issues the same sequence of `record()` calls; `expectTypeId` (replay-context-record.cpp:134-139) throws `TypeMismatchException` on any count/order deviation.

**Consequence:** the tempting fix for "proxy records uninitialized output on a failed call" — wrapping `RECORD_OUTPUT(out)` in `if (SLANG_SUCCEEDED(result)) { ... }` — is UNSAFE. It makes the number of records written depend on the live `result`, which can differ between the record machine and the playback machine (e.g. a downstream compiler present on one, absent on the other), desyncing the stream. It also violates the record/replay invariant that playback must not depend on live-environment matching.

**Correct fix pattern:** keep the fixed record count; make the *value* defined. `PREPARE_POINTER_OUTPUT(arg)` (proxy-macros.h:64) already creates a zeroed `_temp_##arg{}`; on the failure path, point `arg` at that temp before `RECORD_OUTPUT` so you record a deterministic 0 without reading the caller's uninitialized memory and without touching caller memory (playback restores into the temp). Alternatively fix the producer to always-initialize its outputs — but that pushes the record layer's schema constraint onto every producer, and "outputs undefined on failure" is a valid COM/C contract, so the record layer (which is forced by its schema to serialize every output slot) is usually the right owner.

**Record() dual semantics (replay-context-record.cpp:25-87):** Record mode writes `*arg` to the stream (this is where an uninitialized read leaks garbage); Sync mode writes + compares to a reference stream (garbage → spurious `DataMismatchException`, i.e. false verification failures); Playback reads the recorded value back *into* `*arg` and compares. So `arg` must stay valid in both directions — don't decouple the recorded value from the caller pointer unless you route through a temp.

Context: shader-slang/slang#11865 (regression from #11556); `GlobalSessionProxy::getDownstreamCompilerVersion` recorded `outMajor`/`outMinor` after the callee returned `SLANG_E_NOT_FOUND` without writing them. Only two `RECORD_OUTPUT` sites exist in the proxies today (the other: `SessionProxy::getTypeConformanceWitnessSequentialID`, proxy-session.h:197) — both share this latent pattern.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1782866674061-record-replay-stream-is-fixed-schema-at-the-call-l.md`_
