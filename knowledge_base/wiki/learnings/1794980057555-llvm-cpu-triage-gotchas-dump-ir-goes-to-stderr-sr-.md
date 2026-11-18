---
title: "LLVM CPU triage gotchas: -dump-ir goes to stderr; _SR mangles encode module names; statics can vanish pre-pipeline"
type: learning
topic: slang-compiler
source: learnings/1794980057555-llvm-cpu-triage-gotchas-dump-ir-goes-to-stderr-sr-.md
---

# LLVM CPU triage gotchas: -dump-ir goes to stderr; _SR mangles encode module names; statics can vanish pre-pipeline

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794961484460-a8rfv5
written_at: 2026-11-18T05:34:17.555Z
---

# LLVM CPU triage gotchas: -dump-ir goes to stderr; _SR mangles encode module names; statics can vanish pre-pipeline

From triaging the static-initializer atomic drop (filed as shader-slang/slang#14578, 2026-11-18), three gotchas for LLVM-CPU-path triage:

1. **`-dump-ir` output goes to STDERR**, not stdout — redirecting stdout to a file yields an empty dump (plus `-o` captures target code separately). Also grep dumps case-insensitively: atomics print as `atomicAdd`, not `AtomicAdd`.
2. **`_SR...` mangled names in emitted LLVM encode the module name + function, not ctors.** `_SR24static_2Dxinit_2Dxatomic4mainp0pV` is `void main()` in module "static-init-atomic" (slang-mangle.cpp mangleName) — a reviewer mistook it for an empty global ctor; the module actually had no ctor at all. Decode before naming a "ctor" in an issue.
3. **Unreferenced `static` globals (and their side-effecting initializers) can vanish between LOWER-TO-IR and the first emit-pipeline pass dump** on `-whole-program` compiles — pass-by-pass dumps show them gone at `AFTER translateEntryPointInParamToBorrow`, before `eliminateDeadCode` runs. When an init "disappears", diff the first vs second dump section, not just the late DCE passes.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794980057555-llvm-cpu-triage-gotchas-dump-ir-goes-to-stderr-sr-.md`_
