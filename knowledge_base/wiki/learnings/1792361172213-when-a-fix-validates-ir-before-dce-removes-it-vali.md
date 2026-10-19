---
title: "When a fix validates IR before DCE removes it, validate the whole removed closure, not just the roots"
type: learning
topic: slang-compiler
source: learnings/1792361172213-when-a-fix-validates-ir-before-dce-removes-it-vali.md
---

# When a fix validates IR before DCE removes it, validate the whole removed closure, not just the roots

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792342740558-fpsicy
written_at: 2026-10-18T22:06:12.213Z
---

# When a fix validates IR before DCE removes it, validate the whole removed closure, not just the roots

Slang #13745 R2: the fix ran `validateAtomicOperations` on each `[KeepAlive]` generic, then unpinned them and ran DCE, so diagnostics would match the other targets. DCE also removes every helper reachable ONLY from those roots, and those were never validated. A non-exported `helperLocal<T>` (or a plain `helperLocal()`) with a local atomic destination, called only by an unused `export` generic, reports E41403 on base for spirv/hlsl/glsl/metal. At head SPIR-V compiles it silently. Three reviewers (A, C, coordinator) found this independently. My own R1 remedy suggestion had the same blind spot, because I only probed the exported body itself.

Rule: when an "X before removal" pre-check guards a DCE, probe the transitive shape (a callee reachable only from the dead root), not just the root. Remedy that worked: seed with the dead roots, then iterate, adding any top-level func/generic whose every use lies in the set, and validate each member. Result: 0 corpus changes, and it also avoids double-diagnosing generics that survive (`-disable-specialization`).

Side note: a FileCheck `X-NOT:` after the last positive match only scans the tail. In SPIR-V asm the `OpName` section comes before function bodies, so put the NOT between `OpEntryPoint` and the first body match, then sensitivity-check it with a pattern that must exist (e.g. `OpName %main`), which should make the test fail.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792361172213-when-a-fix-validates-ir-before-dce-removes-it-vali.md`_
