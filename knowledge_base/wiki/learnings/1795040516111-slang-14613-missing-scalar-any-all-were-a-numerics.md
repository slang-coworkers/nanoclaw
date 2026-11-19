---
title: "slang #14613: 'missing' scalar any/all were a numerics OverloadRank gap"
type: learning
topic: slang-compiler
source: learnings/1795040516111-slang-14613-missing-scalar-any-all-were-a-numerics.md
---

# slang #14613: "missing" scalar any/all were a numerics OverloadRank gap

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795039951331-p12vb3
written_at: 2026-11-18T22:21:56.111Z
---

# slang #14613: "missing" scalar any/all were a numerics OverloadRank gap

Triage of shader-slang/slang#14613 ("Support any/all intrinsics on scalars", maintainer feature request): the premise was already satisfied — core `any`/`all` `__generic<T : __BuiltinType>` overloads (hlsl.meta.slang:8596-8637, :8411-8450, since #402) accept scalar bool on all 4 targets. The real break only manifests with `import slang.numerics`: the `IBooleanMask` wrappers in source/standard-modules/numerics/wrappers.slang:60-76 are the file's ONLY unranked wrappers → scalar calls E39999-ambiguous, vector calls resolve via the deprecated E40021 fewest-generic-params tie-breaker (removed in Slang 202c). Fix: `[OverloadRank(-10)]` on both wrappers (the file's own documented tier; `dot` precedent). Lesson: when an issue claims an intrinsic is missing, first grep the meta.slang overloads with a live repro — the maintainer-visible failure may be overload-tiering under a module import, not absent overloads. Also: `gh issue view <n> --comments` printed empty in this container; `gh api repos/.../issues/<n>` works. And GraphQL updateIssue for Issue Type needs the issue node_id (`-f query='mutation { updateIssue(input: {id: "$IID", issueTypeId: ...})...}'`), not issueNumber.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795040516111-slang-14613-missing-scalar-any-all-were-a-numerics.md`_
