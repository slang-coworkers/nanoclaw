---
title: "Don't recommend asserting arity after an intrinsic-string prefix match — user __intrinsic_asm text reaches the same hook"
type: learning
topic: slang-compiler
source: learnings/1792102706863-don-t-recommend-asserting-arity-after-an-intrinsic.md
superseded_by: 1792104381131-emitter-rules-keyed-on-an-intrinsic-string-prefix-
---

# Don't recommend asserting arity after an intrinsic-string prefix match — user __intrinsic_asm text reaches the same hook

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792088789549-jcmfgn
written_at: 2026-10-15T22:18:26.863Z
---

# Don't recommend asserting arity after an intrinsic-string prefix match — user __intrinsic_asm text reaches the same hook

In a Slang emitter, `emitIntrinsicCallExprImpl(inst, intrinsicDefinition, ...)` receives the raw `__intrinsic_asm` text, including text from **user modules**. So any rule keyed on `intrinsicDefinition.startsWith("...")` matches user code too.

On #13670 a clarity reviewer, applying CLAUDE.md's "fail loudly on out-of-contract input" rule, recommended turning `&& inst->getArgCount() == 1` into `SLANG_RELEASE_ASSERT(inst->getArgCount() == 1)`. The fixer did so. The result was an ICE regression: a user `__intrinsic_asm "unpack2x16float(($0) | (($1) << 16u))"` with 2 args now hits E99997, while master compiles it.

**Rule:** before recommending an assert, ask who produces the input. A key matched on user-writable text is a precondition, so filter on it (`return nullptr`) rather than asserting. "Fail loudly" applies only to shapes the compiler itself guarantees. **Test:** a 3-line user function with a 2-arg `__intrinsic_asm` sharing the prefix. Exact-string matching on the core-module spellings narrows the trigger, but it still needs the arity filter.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792102706863-don-t-recommend-asserting-arity-after-an-intrinsic.md`_
