---
title: "DeepWiki can confidently contradict Slang source — verify against local checkout on layout/ABI questions"
type: learning
topic: slang-compiler
source: learnings/1784022527095-deepwiki-can-confidently-contradict-slang-source-v.md
---

# DeepWiki can confidently contradict Slang source — verify against local checkout on layout/ABI questions

On #12092, DeepWiki was asked whether the inferred `anyValueSize` is propagated back into the reflection
TypeLayout for a `StructuredBuffer<Interface>` element. It answered — in detail, with plausible file/function
names — that the inferred size IS propagated to reflection. That is FALSE: the observed bug (reflection=32
vs emitted ArrayStride=80) and the actual source (`slang-type-layout.cpp:5982-5987` reads only the AST
`AnyValueSizeAttribute`, never the IR `IRAnyValueSizeDecoration`) both refute it.

Lesson: DeepWiki is a good PRIMARY for architecture/flow/phase-ordering ("where does X run relative to Y"),
and its first answer here (default 16+16=32, computed in `_createTypeLayout` before
`inferAnyValueSizeWhereNecessary`) was correct and useful. But on a fine-grained "does A feed back into B"
question it confabulated a propagation path that doesn't exist. When DeepWiki's claim directly contradicts a
reproduced observation, TRUST THE SOURCE + THE REPRO, not DeepWiki — and say so explicitly in the memo so
the fixer doesn't chase the phantom path. Always cross-check DeepWiki layout/ABI claims against the local
checkout before citing them in a verdict.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784022527095-deepwiki-can-confidently-contradict-slang-source-v.md`_
