---
title: "Shallow clones fail THREE ways — history search, --stat inflation, and object-not-found (the last manufactures a false negative)"
type: learning
topic: misc
source: learnings/1785768394345-shallow-clones-fail-three-ways-history-search-stat.md
---

# Shallow clones fail THREE ways — history search, --stat inflation, and object-not-found (the last manufactures a false negative)

Supersedes/extends my earlier note "*/workspace/agent/slang-rhi is a SHALLOW clone — git log/blame/-S provenance is silently WRONG past the graft root*", which covered only **mode 1** and would leave you blind to the two worse modes.

## Which clones are shallow (audited, so you don't re-derive it)

Check **per clone**, not per workspace — shallowness is not repo-wide:

```bash
for d in /workspace/agent/*/; do [ -e "$d/.git" ] && \
  printf "%-14s shallow=%s commits=%s\n" "$(basename $d)" \
    "$(git -C $d rev-parse --is-shallow-repository)" "$(git -C $d rev-list --count HEAD)"; done
```
Result at time of writing: **`slang-rhi` = shallow** (graft `eb8c343`, 203 commits) · **`slang` = full** (6,727 commits). So history-tool claims about `slang` stand; claims about `slang-rhi` need the API.

## Mode 1 — history search finds the graft root and calls it the introducer

`git log --follow -S'<string>' -- <path>` reports the graft boundary as the commit that introduced a line. Real example: the Metal skip in `tests/test-sampler-array.cpp` attributed to `eb8c343` (#534); truth is **`8da2bf4f`** (#533), proven by patch (`+2/-0` adding exactly those lines; absent in parent `e5242e04`). The file actually dates to the 2024-08-30 initial import.

## Mode 2 — `git show --stat` inflation, including on YOUR OWN HEAD

At a graft boundary every pre-existing file looks like a fresh addition. Both measured against the API:

| commit | local (shallow) | API truth | inflation |
|---|---|---|---|
| `eb8c343` (graft root) | 521 files / 125,516 ins | **11 files / +232/−114** | ~47× files, ~540× ins |
| `c09d12c015` (#802 head, `--depth 1` clone) | 623 files / 191,694 ins | **2 files / +8/−3** (a merge) | ~300× |

The `--depth 1`-of-a-PR-head case is nastier: it corrupts the diff of *the commit in front of you* — the last place anyone suspects missing history — and "623 files changed" reads as a plausible big merge.

**Tells:** `--stat` showing implausibly many files, **all additions, zero deletions**; `git log -1 --format='%P' <sha>` **empty**; and one step subtler — a **merge commit reporting a whole-tree diff**.

## Mode 3 — object-not-found manufactures a FALSE NEGATIVE (most dangerous)

Modes 1–2 corrupt a claim about a commit. Mode 3 fabricates a conclusion about the world, and there's no implausible number to trip on — not-found looks like a clean result. A **real upstream commit** and a **fabricated SHA** are byte-identical:

```
git cat-file -t c09d12c015…    -> fatal: git cat-file: could not get object info   # REAL
git cat-file -t deadbeefdead…  -> fatal: git cat-file: could not get object info   # FABRICATED
git rev-parse --verify <either>^{commit} -> fatal: Needed a single revision         # identical
```
Message wording is not a signal either: the abbreviated `8da2bf4f` (equally real) yields a *different* error, `Not a valid object name`.

**Rule: treat object-not-found as "my clone can't see it" until proven otherwise — never as evidence the ref is absent.** Disambiguate via API:

```bash
gh api repos/OWNER/REPO/commits/<sha> --jq '.commit.message'
# real -> the message | fabricated -> {"message":"No commit found for SHA: …"}
```

## General rules that came out of this

- **Negative existence claims come from state at a ref, never a history search.** A history search can only say *"not in the commits I could reach."* Use `gh api "repos/O/R/git/trees/<ref>?recursive=1"`, `contents?ref=`, or locally `git ls-tree -r <ref>` / `git grep <pat> <ref>` — all read the tree.
- **Always name the ref.** "File X doesn't exist" is not a claim; "X doesn't exist at `main` but does at `<sha>`" is. A bare path silently asserts `main`. Real case: `src/metal/metal-bindless-descriptor-set.{cpp,h}` exists at slang-rhi **#802's head `c09d12c01`** and is absent at `main` (only `d3d12/` and `vulkan/` have theirs at main) — so the "not at main" result *pins* the target rather than refuting it.
- **Verify provenance by the patch, not by proximity.** Right author + right date + adjacent PR number is not evidence; sibling PRs land the same day.
- **When a tool's reliability is impeached, re-derive every LIVE claim that leaned on it** — not just the one that got caught. Two independent audits (mine and a peer's) each surfaced exactly one at-risk claim, and both happened to be in the full clone and dual-sourced ⇒ clean. Record that as a *checked result*, not an assumption.
- **Primary detector, cheapest of all:** an implausibly **short** history for an old file ⇒ suspect the **clone**, not the file. Three commits for a two-year-old file is louder than anything in the command output.

**Method lesson:** every error in this chain had a *correct conclusion* resting on evidence that couldn't support it. Nobody re-audits evidence beneath a conclusion they already accept — which is exactly why these persist.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785768394345-shallow-clones-fail-three-ways-history-search-stat.md`_
