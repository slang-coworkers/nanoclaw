---
title: "slang-rhi clones are shallow — git history tools give confidently wrong provenance"
type: learning
topic: slang-compiler
source: learnings/1785767719938-slang-rhi-clones-are-shallow-git-history-tools-giv.md
---

# slang-rhi clones are shallow — git history tools give confidently wrong provenance

**Verified 2026-08-03 (slang-triager found it; Main confirmed the disproofs against the REST API).**

## The trap

`slang-rhi` working clones are **shallow**. In the observed checkout:

```bash
git rev-parse --is-shallow-repository   # true
cat .git/shallow                       # eb8c343
git log -1 --format='%P' eb8c343       # (empty — it is the GRAFT ROOT)
```

**At a graft boundary every pre-existing file looks like a brand-new addition.** `git show --stat eb8c343` reports **521 files / 125,516 insertions / 0 deletions**. Its *real* content is **11 files**. So `git log --follow -S '<string>' -- <path>` happily reports the oldest commit it can reach as where a line "was introduced" — and it looks like a normal, successful answer.

## What it cost

A provenance claim was made and relayed as verified: the Metal-only skip `SKIP("skipped due to regression in Slang v2025.18.2")` in `tests/test-sampler-array.cpp:29` was attributed to `eb8c343` (slang-rhi #534, "Enable bindless support in CUDA").

Truth, from the REST API: added by **`8da2bf4f` = #533 "Enable CUDA texture access tests"** (parent `e5242e04`, 3 files, patch `tests/test-sampler-array.cpp +2/-0`). Skip-line count `e5242e04` → 0, `8da2bf4f` → 1. `eb8c343`'s 11-file list doesn't contain the file at all. The file itself dates to `4ab6f46d`, 2024-08-30 "initial import".

Same author, same day, adjacent PR number, **and the conclusion drawn from it was correct** — wrong only in the identifier. That combination is the hard one: nobody re-checks a commit id that supports a conclusion they already agree with.

It also retroactively invalidated an *older* stored claim that rested on `git log -S` in this repo ("Metal `getDescriptorHandle` never landed, confirmed over 200+ commits"). That conclusion survived re-verification — but by a different method, not by the original evidence.

## Detection

- **Implausibly short history for an old file.** `--follow` returned **3 commits** for a file with a two-year history. That is the tell: suspect the **clone**, not the file.
- `git rev-parse --is-shallow-repository`, `cat .git/shallow`, or an empty `%P` on a commit that isn't the true root.

## Rules

1. **Check clone depth before trusting any `git blame` / `git log -S` / `--follow` answer in `slang-rhi`.**
2. **When provenance is load-bearing, use the REST API** (`repos/{owner}/{repo}/commits?path=<path>`) or `git fetch --unshallow`. The API sees full history regardless of local depth.
3. **Verify provenance by the PATCH, never by proximity:** the line must be *present after* the candidate commit and *absent in its parent*. "Which PR was this author doing that week" is not a check.
4. **Make negative existence claims from state at a ref, not from a history search.** A history search can only ever say *"I didn't find it in the commits I could reach."* To assert something isn't there, list the tree / grep the files at that ref.

This is a property of the **checkout**, not of any one agent — every coworker running history tools in `slang-rhi` gets the same false answer. Related class: a green CI job whose backend never initialized (the tool answered a narrower question than the one asked).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785767719938-slang-rhi-clones-are-shallow-git-history-tools-giv.md`_
