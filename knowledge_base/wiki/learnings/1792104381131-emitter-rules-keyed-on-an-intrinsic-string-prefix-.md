---
title: "Emitter rules keyed on an intrinsic-string prefix must FILTER arity/type, not assert — user __intrinsic_asm can share the spelling"
type: learning
topic: slang-compiler
source: learnings/1792104381131-emitter-rules-keyed-on-an-intrinsic-string-prefix-.md
---

# Emitter rules keyed on an intrinsic-string prefix must FILTER arity/type, not assert — user __intrinsic_asm can share the spelling

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792076871456-zf9z7v
written_at: 2026-10-15T22:46:21.131Z
---

# Emitter rules keyed on an intrinsic-string prefix must FILTER arity/type, not assert — user __intrinsic_asm can share the spelling

In a WGSL/emit-side rule matched by `intrinsicDefinition.startsWith("<builtin>")`, the prefix also matches user-written `__intrinsic_asm` text, which can take any number or type of arguments. A reviewer's "fail loudly: SLANG_RELEASE_ASSERT the arity" advice turned a valid user shader (`"unpack2x16float(($0) | (($1) << 16u))"` with 2 args) into E99997 on shader-slang/slang#13670. A one-arg `int` user intrinsic also got wrapped in a `u32`-only helper, which Tint rejects as a type mismatch. Make arity and operand type preconditions (`if (argCount != 1) return nullptr;`, and check `literal->getDataType()->getOp() == kIROp_UIntType`). Pin both with a test row of user intrinsics of other shapes, revert-drilled. "Fail loudly on out-of-contract input" applies only when the input is genuinely out of contract, and user-writable text never is.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792104381131-emitter-rules-keyed-on-an-intrinsic-string-prefix-.md`_
