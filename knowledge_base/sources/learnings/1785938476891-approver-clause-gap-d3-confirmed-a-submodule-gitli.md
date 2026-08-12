# [approver/clause-gap] D3 confirmed — a submodule gitlink defeats every path-based and size-based clause; 9 protected-path hits invisible on slangpy#1090, but they execute in the SUBMODULE's CI, not the consumer's

## Symptom

A one-line submodule bump makes an arbitrarily large diff invisible to every clause in
`eval-clauses.py` that reasons over changed paths or changed size. Independently verified
on shader-slang/slangpy#1090 @ `bb870c1750cc`.

The gitlink `external/slang-rhi` moves `1a976874` → `11eefdc6`. Confirmed a true gitlink:
`git ls-tree HEAD external/slang-rhi` → `160000 commit 11eefdc6…`.

`GET repos/shader-slang/slang-rhi/compare/1a976874...11eefdc6`:
**7 commits, 22 files, +448/−160 = 608 lines.**

Recorded `tier_eligible` evidence for the PR: **"220 lines / 7 files"** — an undercount
of ≈3.8× on lines and ≈4.1× on files. Every inner path is invisible to
`no_protected_paths`.

## The protected-path blindness (the serious half)

Running the skill's **own** `glob_to_re` (not `fnmatch`) over the 22 inner paths against
the **bundled** `protected_paths` → **9 hits**:

```
removed   .github/workflows/add-pr-to-project.yml     <- ['.github/**', '**/*.yml']
added     .github/workflows/pr-checks-complete.yml    <- ['.github/**', '**/*.yml']
added     .github/workflows/pr-commit-status.yml      <- ['.github/**', '**/*.yml']
added     .github/workflows/pr-maintenance.yml        <- ['.github/**', '**/*.yml']
added     .github/workflows/pr-review-fork-apply.yml  <- ['.github/**', '**/*.yml']
added     .github/workflows/pr-review-fork-bridge.yml <- ['.github/**', '**/*.yml']
added     .github/workflows/pr-sweep-nightly.yml      <- ['.github/**', '**/*.yml']
added     .github/zizmor.yml                          <- ['.github/**', '**/*.yml']
modified  CMakeLists.txt                              <- ['**/CMakeLists.txt']
```

Six workflow files added, one removed — passing through a gate whose policy `_comment`
explicitly names `.github/workflows/**` a supply-chain surface requiring protection at
enforcement.

**Re-tightening `protected_paths` does not fix this.** The bundle *already* lists
`.github/**` and `**/*.yml` and still never sees these paths, because clause evaluation
enumerates the outer commit's changed files, where the entire submodule appears as the
single entry `external/slang-rhi`. The gate is blind **by construction, not by
configuration.**

## Important scoping correction — whose CI runs these?

The workflows live in **slang-rhi's** `.github/workflows/`, and GitHub Actions only
executes workflows from the *consuming repository's* root `.github/workflows/`
(slangpy has its own: `ci.yml`, `claude.yml`, etc.). A submodule's workflows do **not**
run in the consumer's CI.

So the immediate supply-chain exposure to slangpy's pipeline is **not** "6 new workflows
now run in slangpy CI." The real exposures are narrower and still real:

- The **build inputs** do change materially — `CMakeLists.txt` plus 608 lines of C++
  compiled into slangpy, reviewed as "220 lines."
- Anyone reviewing *slang-rhi* through a slangpy PR sees none of it, so review attention
  is misallocated by ~4×.
- The blindness is **general**: the same mechanism hides a gitlink bump to any submodule
  whose own root *is* the CI surface, and hides arbitrary source changes in all cases.

Stating this precisely matters — the defect is real without the strongest available
phrasing, and overstating it would be the same over-attribution error this session
already made three times.

## How to catch it

For any PR touching a gitlink, expand before trusting size/path clauses:

```bash
git ls-tree <head> <path>            # mode 160000 ⇒ gitlink
gh api repos/<sub>/compare/<old>...<new> --jq \
  '{commits:(.commits|length), files:(.files|length)}'
# then re-run the skill's own glob_to_re over the inner filenames
```

## Fix — a design decision, not a patch

Either evaluate clauses over the **expanded** submodule diff (union of outer changed
paths and inner changed paths, sizes summed), or treat any gitlink modification as
protected/ineligible so it routes to a human. Both **widen** what the approver blocks and
change its behavior on a whole class of PRs, so this belongs to the re-tightening owner —
not to a unilateral edit. Filed with #1090 as the worked example.
