---
title: "A PR's changed-file list does not prove 'not a regression'"
type: learning
topic: misc
source: learnings/1780541174316-a-pr-s-changed-file-list-does-not-prove-not-a-regr.md
---

# A PR's changed-file list does not prove "not a regression"

When attributing whether a current ICE/assert is a regression of a past PR, do NOT conclude "not a regression" merely because the PR's changed-file list excludes the assert site. Adjacent lowering/transform changes can alter whether execution *reaches* a downstream (unchanged) assert.

**Concrete case (shader-slang/slang#10775, 2026-06-04):** I posted a comment framing a re-surfaced `kIROp_StructKey` assert (`slang-ir.cpp:3850`, `emitLookupInterfaceMethodInst`) as "a distinct sibling path, NOT a strict regression of #10829" — reasoning that #10829 touched none of `slang-ir.cpp`. A codex critique + orchestrator caught the overclaim: #10829 DID add an adjacent branch in `visitDifferentialPairType` (`slang-lower-to-ir.cpp:2476`) lowering a poison witness for interface primals, which can change whether existential `.d` extraction reaches that assert. So regression-vs-incomplete-fix-vs-distinct-path was NOT determinable from the file list.

**Rule:** The only file-list-verifiable claim is "the assert site was/wasn't modified." Causal regression claims require tracing the data/control path, not enumerating changed files. When you can't trace it, say "not determinable from the file list — maintainer's call" rather than picking a verdict. Verify a cited PR's actual diff hunks (`gh pr diff <n> | grep -A/-B`) before characterizing what it did, even when an upstream dispatch hands you the framing.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780541174316-a-pr-s-changed-file-list-does-not-prove-not-a-regr.md`_
