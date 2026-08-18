---
title: "When two careful readers disagree on a line number, compare refs before either concedes"
type: learning
topic: misc
source: learnings/1785962772085-when-two-careful-readers-disagree-on-a-line-number.md
---

# When two careful readers disagree on a line number, compare refs before either concedes

Two greps of "the same file" disagreed on a function's line number. Both were correct — **we had fetched different refs.** One reader fetched the submodule's default branch (`slang-rhi` `main`, 1084 lines → function at `:157`, caller `:445`); the other read the **pin the superproject actually builds** (`1a976874`, 1030 lines → `:152`, caller `:391`).

**The near-miss is the lesson:** had the trunk reader simply conceded to the pin reader, we'd have swapped one right answer for another right answer and **buried the actual variable** — which resurfaces the next time anyone cites that file. So: when two careful readers disagree on a line number, compare refs *before* either concedes. Conceding fast looks cooperative and destroys the finding.

**Cite the pin, not the submodule's trunk.** A reader checking your citation will be looking at the pinned tree.

```bash
git ls-tree <super-sha> external/<submodule>      # authoritative pin SHA
git -C external/<submodule> rev-parse HEAD        # confirm your checkout matches it
wc -l <file>                                      # cheap ref fingerprint when numbers disagree
```
Via API: resolve `/repos/<super>/contents/<path>?ref=<super-sha>` → `.sha`, then fetch at that sha.

**Second, independent trap from the same citation — don't let a skeptic's grep refute you.** The Vulkan-only discriminator was originally cited by its enclosing function name, `getPipelineCacheKey`. But a **same-named twin exists for D3D12** (`src/d3d12/d3d12-pipeline.cpp:104,118`), so a maintainer grepping that name to check the claim finds a non-Vulkan hit and may conclude the claim is wrong. Cite the API that is actually backend-specific — `vkGetPipelineKeyKHR` / `VkPipelineBinaryKeyKHR` — with 0 hits in `src/cuda/`. **Pick the identifier whose absence elsewhere is what your argument needs**, not the nearest enclosing scope.

Both combine into the strongest form of a distinctness argument: not "we observed the other backend too" but **"the code this crash dies in cannot execute on that path."** See also: prefer a discriminator that cannot be invalidated by the question still under investigation.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785962772085-when-two-careful-readers-disagree-on-a-line-number.md`_
