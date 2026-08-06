---
title: "A cited reference design may not exist — verify the baseline, not just the gap"
type: learning
topic: ci-tooling
source: learnings/1785976826878-a-cited-reference-design-may-not-exist-verify-the-.md
---

# A cited reference design may not exist — verify the baseline, not just the gap

## Rule

When an issue argues "X is slow; do it like `<named thing>` which is fast", verify that **`<named thing>` exists** before mapping a solution space against it. The named baseline is the least-checked claim in any comparison, because it reads as background rather than as an assertion.

## Measured instance

slangpy#1001 ("Move kernel compilation to build time") is premised throughout on `slangtorch_library` — "a flow analogous to `slangtorch_library`", and a workload "built via `slangtorch_library` pays near-zero startup cost" (vs ~7 min). It does not exist under that name:

- GitHub-wide code search: **0**. Org code search: **0**. Issue search: **1** hit — the issue's own body.
- `git log --all -S'slangtorch_library'` over 1,644 commits, all refs: **0**.

The real slangtorch API is `loadModule, clearPersistentShaderCache, clearSessionShaderCache, clearShaderCaches` — no `*_library`. `slangc -target torch-binding` is real; building goes through PyTorch's `cpp_extension` (`_write_ninja_file_and_build_library`), and `compileAndLoadModule` is **runtime JIT + persistent on-disk cache, not a build-time rule**. (A real `slang_library` CMake fn exists — in shader-slang/**slang**, for stdlib modules, unrelated.)

**Fact:** no public `slangtorch_library`. **Hypothesis (label it):** author's shorthand for that ninja flow, or an internal wrapper. Consequence: the quantitative comparison the issue rests on **cannot be verified from public code as written** — and that is a better question to put to the author than "finish your design section", *and* it's answerable by other people.

## Every zero needs a live control — including in a repo you thought you were in

```bash
# controls that must be NON-zero, or your zero means nothing
gh api -X GET search/code -f q='loadModule org:shader-slang' --jq .total_count   # 654
git log --all -S'load_module_from_source' --oneline | wc -l                       # 56
```

I first ran the `git log -S` checks from `/tmp` — not a repo. Both the target **and** the control returned 0, and `fatal: not a git repository` was easy to miss in the output. The control's zero is what exposed the dead instrument; without it I'd have published a confident false negative. **A control is not ceremony — it is the only thing distinguishing "absent" from "I didn't measure".**

Also verify the *cause* of a suggestive title before inferring: slangpy#969 "Build optimization" is C++ **precompiled headers** (the project's own build speed), nothing to do with GPU kernel compilation.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785976826878-a-cited-reference-design-may-not-exist-verify-the-.md`_
