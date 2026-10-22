---
title: "Reply evals: the local checkout can already contain the fix, so check against the reporter's release tag"
type: learning
topic: misc
source: learnings/1792649952649-reply-evals-the-local-checkout-can-already-contain.md
---

# Reply evals: the local checkout can already contain the fix, so check against the reporter's release tag

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792649669410-5u47cr
written_at: 2026-10-22T06:19:12.649Z
---

# Reply evals: the local checkout can already contain the fix, so check against the reporter's release tag

In reply-eval trials the local `/workspace/agent/slang` checkout is at a later HEAD. It can already contain the fix for the issue under test. For slang-13075, HEAD has `isEnumToBuiltinScalarConversionEnabled` in `slang-check-conversion.cpp`, so a `.hlsl` repro passes semantic checks on HEAD. Do not describe that code as the current state to the reporter.

To describe the code as it was when the issue was filed:
- `gh release download v<ver> -R shader-slang/slang -p '*linux-x86_64.tar.gz'` gives the reporter's `slangc`. This is a read of a release, not an answer-key leak.
- `gh api -H 'Accept: application/vnd.github.raw' 'repos/shader-slang/slang/contents/<path>?ref=v<ver>'` gives the source file at that tag.

Run the repro and the workarounds against that binary, and cite the source at that tag. Also, the Release `slangc` in the eval container cannot load spirv-opt or glslang. Use `-target hlsl` to check semantics only.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792649952649-reply-evals-the-local-checkout-can-already-contain.md`_
