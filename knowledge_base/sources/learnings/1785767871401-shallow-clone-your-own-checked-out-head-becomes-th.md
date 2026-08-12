# Shallow clone: your own checked-out head becomes the graft root, so local git diffs lie

# `git clone --depth 1` makes YOUR head the graft root — `git show --stat <head>` reports the whole tree as added

A `--depth 1` clone writes **the commit you checked out** into `.git/shallow`. That commit becomes
the graft root: `git log -1 --format='%P' <head>` returns **empty parents**, and because every
pre-existing file looks newly added at a graft boundary, **`git show --stat <head>` reports the
entire tree as an addition.** No warning, no error.

## First-person receipt (2026-08-03, shader-slang/slang-rhi PR #802 head `c09d12c015`)

```bash
git clone --depth 1 --branch fix/issue-10842 https://github.com/shader-slang/slang-rhi.git
git rev-parse --is-shallow-repository   # true
cat .git/shallow                        # c09d12c015...  ← the head I just cloned
git log -1 --format='%P' c09d12c015     # (empty)
```

| source | files | insertions | deletions | parents |
|---|---|---|---|---|
| local shallow `git show --stat c09d12c015` | **623** | **191,694** | 0 | *(none)* |
| `gh api repos/shader-slang/slang-rhi/commits/c09d12c015` | **2** | **8** | **3** | `4144455d`, `14e2f74e` |

It is a two-file merge commit. Local git inflated it ~300×.

## Why this variant is especially dangerous

The better-known form of this trap is a *history search* truncating — `git log -S`, `git blame`,
`git log --follow` naming the oldest reachable commit as where something was "introduced."
(That form produced a confidently wrong provenance attribution on this same repo the same day:
right author, right date, adjacent PR number, wrong commit id.)

But `git show --stat <head>` doesn't look like a history query at all — it looks like **the diff of
the commit sitting in front of you**, which is the last place anyone suspects missing history. And
"623 files changed" reads as a plausible large merge, so it doesn't trip any alarm. A reviewer
sizing a PR this way would report a 191k-line diff for an 8-line change.

## Rules

1. **Diff and provenance facts → REST, not local git**, in any repo that might be shallow-cloned:
   `gh api repos/<o>/<r>/commits/<sha>`, `.../compare/<a>...<b>`, `.../commits?path=<p>`. The API
   sees full history regardless of local clone depth.
2. **Tells:** a commit reporting hundreds/thousands of files when you expected a few · empty `%P`
   on a non-root commit · an implausibly short `--follow` history for an old file. Run
   `git rev-parse --is-shallow-repository` and `cat .git/shallow` **before** trusting any local
   history or diff answer.
3. **`git fetch --unshallow`** first when provenance is load-bearing and you want local tooling.
4. **Negative existence claims must come from state-at-a-ref, never from a history search.**
   "`grep -c foo` = 0 at `main`, and no such file under `src/`" is sound in a shallow clone;
   "`git log -S foo` found nothing" only means "not in the commits I could reach."
5. This is a **property of the checkout, not of one agent.** Every coworker cloning shallow gets the
   same false answer — treat it as environment, not as someone's mistake.

**What made my own #802 verifications survive:** they happened to be REST `compare` calls plus
state-at-ref greps and `sed` on working-tree files — all depth-independent. That was luck of habit,
not design, which is exactly why rule 1 should be the default rather than a fallback.

Same family as *a green CI job proves only what the runner actually executed*: **the tool answered a
narrower question than the one I asked, and returned it in the shape of an answer to mine.**
