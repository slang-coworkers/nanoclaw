---
title: "/workspace/agent/slang-rhi is a SHALLOW clone — git log/blame/-S provenance is silently WRONG past the graft root"
type: learning
topic: slang-compiler
source: learnings/1785767576978-workspace-agent-slang-rhi-is-a-shallow-clone-git-l.md
---

# /workspace/agent/slang-rhi is a SHALLOW clone — git log/blame/-S provenance is silently WRONG past the graft root

## The trap

The `slang-rhi` checkout in the coworker workspaces is a **shallow clone**. Any `git log`, `git blame`, or `git log -S'<string>'` answer about *when/why a line was introduced* is bounded by the graft boundary — and git reports the truncated answer with full confidence, no warning.

```bash
cd /workspace/agent/slang-rhi
git rev-parse --is-shallow-repository   # -> true
cat .git/shallow                       # -> eb8c34362e141efa31eda32bc37776e9d03ed79c
git log -1 --format='%P' eb8c343       # -> EMPTY (no parents = graft root)
git rev-list --count HEAD              # -> 202 (not the real history depth)
```

At a graft boundary **every pre-existing file looks like a brand-new addition**:

```bash
git show --stat eb8c343 | tail -1
# 521 files changed, 125516 insertions(+)     <- all additions, zero deletions
```

## How it burned me

I attributed the Metal skip at `tests/test-sampler-array.cpp:29` (`SKIP("skipped due to regression in Slang v2025.18.2")`) to `eb8c343` / slang-rhi #534 "Enable bindless support in CUDA", using the *right* tool:

```bash
git log --follow -S'regression in Slang v2025.18.2' -- tests/test-sampler-array.cpp
# -> eb8c343 2025-10-09 Simon Kallweit :: Enable bindless support in CUDA (#534)   [WRONG]
```

`-S` found its "introduction" at the oldest commit it could reach — the graft root. Ground truth from full history:

```bash
gh api "repos/shader-slang/slang-rhi/commits?path=tests/test-sampler-array.cpp" --jq 'reverse|.[0]'
# file dates to 4ab6f46d 2024-08-30 "initial import" -- long before the graft
gh api repos/shader-slang/slang-rhi/commits/8da2bf4f
# 8da2bf4f "Enable CUDA texture access tests (#533)", 3 files, parent e5242e04
#   tests/test-sampler-array.cpp +2/-0  <- adds exactly the 2 skip lines
```
Real introducer = **`8da2bf4f` (#533)**. Confirmed both directions: skip absent at parent `e5242e04`, present at `8da2bf4f`; and #534's *real* file list is 11 files and does not include the file at all (the 521-file list was the graft artifact).

## How to apply

- **Check depth before trusting provenance:** `git rev-parse --is-shallow-repository`. If `true`, treat `log`/`blame`/`-S` line-origin answers as unreliable past the graft.
- Confirm against full history without re-cloning: `gh api "repos/OWNER/REPO/commits?path=<path>"` (add `--paginate` if needed), then fetch the candidate commit and check its **patch** actually adds the line, plus that the parent lacks it. Or `git fetch --unshallow` if you need local history.
- **Tell that you're looking at a graft root:** `--stat` shows implausibly many files, all insertions and no deletions, and `git log -1 --format='%P' <sha>` is empty.
- Verify by patch, never by proximity. Right author + right date + adjacent PR number is not evidence — sibling PRs land the same day and produce a claim that is wrong *only in the identifier* while the surrounding conclusion is correct. That shape survives review; a wrong conclusion does not.
- `git log --follow --oneline -- <path>` returning only 2-3 commits for a file you'd expect to have a long history is itself a shallow-clone smell.

**Method lesson:** a wrong premise supporting a *right* conclusion is the most durable kind of error. Everything else in my claim held (Metal-only, unconditional, the sole such skip in the suite, predating slang#12291) — which is exactly why nobody would have re-checked the commit id if the reviewer hadn't.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785767576978-workspace-agent-slang-rhi-is-a-shallow-clone-git-l.md`_
