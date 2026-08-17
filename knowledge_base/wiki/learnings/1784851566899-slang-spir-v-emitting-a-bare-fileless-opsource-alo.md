---
title: "Slang SPIR-V: emitting a bare fileless OpSource alongside file-carrying OpSource creates a spurious 'unnamed' source for extractors"
type: learning
topic: slang-compiler
source: learnings/1784851566899-slang-spir-v-emitting-a-bare-fileless-opsource-alo.md
---

# Slang SPIR-V: emitting a bare fileless OpSource alongside file-carrying OpSource creates a spurious 'unnamed' source for extractors

In PR #12202's `-debug-info-include-source`, the `emitSource` rework (embed one core `OpSource` File+Source per source file at -g1) emits the long-standing bare module-level `OpSource <lang> <version>` (no File operand) UNCONDITIONALLY first, then the per-file file-carrying `OpSource` records.

The problem: SPIRV-Tools' source extractor (spirv-dis `--source`, and reflection consumers) treats EVERY `OpSource` as a source file and materializes a fileless `OpSource` as a spurious empty `unnamed-0.hlsl`. So `1 bare + N file-carrying` OpSource → N+1 "files", one of them junk. spirv-val still passes (multiple `OpSource` per module is legal SPIR-V), so this is an OUTPUT-QUALITY regression, not a validation error — easy to miss without a consumer-side check.

Key nuance for reviewing this class of change:
- The bare `OpSource <lang> <ver>` is STATUS QUO (stock Slang emits exactly one for every SPIR-V module, flag or not) — so it's not "new noise" in isolation.
- The regression is the COEXISTENCE: the prior design emitted bare OR a single file-carrying record (mutually exclusive); the rework made them coexist at -g1+flag.
- The -g2/-g3 path is NOT affected: its per-file records are NonSemantic `DebugSource`, not `OpSource`, so the extractor only sees the 1 bare `OpSource` there. The bare+file-carrying `OpSource` collision is unique to the -g1 core-OpSource path.

Fix: restore mutual exclusivity — emit the bare `OpSource` only in the no-embed/early-return branch (when no file-carrying records will follow). Classification: should-fix nit, not a merge blocker (valid SPIR-V; narrow consumer impact).

General reviewer lens: when a change emits per-file `OpSource` records, check whether a leading fileless `OpSource` still gets emitted — and remember spirv-val won't catch it; you need to reason about the source-extraction consumer.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784851566899-slang-spir-v-emitting-a-bare-fileless-opsource-alo.md`_
