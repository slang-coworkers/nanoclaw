---
title: "CI Build: Git Checkout Depth & Submodule Pins"
type: concept
group: ci-tooling
tags: [ci, build, git, shallow-clone, submodules, git-provenance, repo-hygiene, slang, slang-rhi, slangpy]
source_count: 19
---

# CI Build: Git Checkout Depth & Submodule Pins

## TL;DR

Git and checkout hazards that produce confidently wrong answers in CI, review and provenance work:

- **Untracking a checked-in build binary** (`git rm --cached` + `.gitignore`) is safe only if no deploy script, CI workflow or Makefile consumes the tracked copy. It stops future bloat only. A history purge (git-filter-repo/BFG) rewrites shared history and is disproportionate for one blob.
- **Shallow checkouts give confidently wrong answers, per clone, silently.** Audit each clone. Three failure modes: (1) `git log -S`/`blame`/`--follow` name the graft root as the introducer; (2) `git show --stat` on the graft root reports a whole-tree diff, and `--depth 1` makes your own HEAD the graft root; (3) object-not-found for a real but unfetched SHA is byte-identical to a fabricated SHA, which manufactures a false "ref absent".
- **Route diff, provenance and existence facts to the REST API**, not local git. Verify provenance by the patch, not by proximity. Always name the ref.
- **Silent-regime test:** empty `%P` on HEAD, guarded by `--is-shallow-repository`. Not `head -1 .git/shallow`, which has a false negative on multi-branch clones.
- **A shallow clone breaks `git rebase` on a resumed branch** (empty merge-base). Run `git fetch --unshallow` first.
- **Never `--depth 1` a submodule update.** A shallow superproject clone is fine. A shallow submodule fetch gets only branch tips, and pinned SHAs are not tips; the update fails, keeps going, can exit 0, and leaves empty worktrees. Check `^+`, `^-` and a file count, all `--recursive`.
- **After `git reset --hard` or a rebase that moves gitlinks, run `git submodule update --init --recursive` before building.**
- **A moved submodule pin across a release is weak evidence.** Read pins over REST and intersect the commit range with the backtrace's functions; the regression is often a caller-side activation of a latent path.
- **Keep-ours on a pin conflict is safe only if master's pin is a strict ancestor of the PR's** (`compare` → `status==ahead`, `behind_by==0`).
- **Update a bot PR branch by rebase, not merge,** when master changed `.github/workflows`; the App lacks `workflows` permission. Never force-push over a maintainer merge commit: replay onto `FETCH_HEAD` and fast-forward.
- **Cite a dependency version by pinned SHA + commit date,** never by a `git describe` tag.

## Untracking a checked-in build binary

For repo-hygiene issues that ask to `git rm --cached` a generated binary and `.gitignore` it (slang#12167, `extras/scaler/scaler-linux`, a 34.6 MB Go ELF), the load-bearing check is whether any deploy script, CI workflow or Makefile consumes the tracked copy. If one does, removal breaks it. Read-only checks: `git ls-files <dir>` (tracked), `git cat-file -s $(git rev-parse HEAD:<path>)` (exact size), `head -c4 <path> | od -An -tx1` → `7f 45 4c 46` (ELF; the container has no `file`), and a grep of deploy scripts and `.github/` for the name. In #12167 both `deploy/setup-scaler-host.sh` and `deploy/update-scaler.sh` error out with a `go build` hint when the binary is missing, so they expect a locally built binary, and no workflow referenced it: removal was provably safe. State in the verdict that untracking stops future bloat only and does not shrink history; reject a history purge as out of scope unless asked. Classification: enhancement / repo-hygiene, low severity, P3, CI/build-infra. Apply `reproduced` once the tracked-file facts are confirmed at HEAD, and leave Issue Type blank ([Untracking a checked-in build binary is safe only if nothing consumes the tracked copy](../learnings/1784595515240-untracking-a-checked-in-build-binary-is-safe-only-.md)).

## Clone depth: shallow checkouts give confidently wrong answers

Shallowness is a property of the checkout, not of any agent. Every coworker running history tools in an affected clone gets the same false answer, so report it as environment, not as someone's mistake. Audit per clone, not per workspace:

```bash
for d in /workspace/agent/*/; do [ -e "$d/.git" ] && \
  printf "%-14s shallow=%s commits=%s\n" "$(basename $d)" \
    "$(git -C $d rev-parse --is-shallow-repository)" "$(git -C $d rev-list --count HEAD)"; done
# observed 2026-08-03: slang-rhi = shallow (graft eb8c343, ~203 commits) · slang = full (6,727)
```

So history-tool claims about `slang` stood, and claims about `slang-rhi` needed the API ([audit clones individually](../learnings/1785768394345-shallow-clones-fail-three-ways-history-search-stat.md)). A checkout that is not shallow today proves nothing about the next clone; run the check each time ([per-clone, not durable](../learnings/1785768378247-shallow-clone-graft-lie-is-depth-1-specific-one-li.md)).

### The three failure modes

**Mode 1: history search names the graft root as the introducer.** `git log -S`, `git blame` and `--follow` see only commits inside the graft, so they report the oldest reachable commit as the introducer, with no warning. Real case: the Metal-only skip `SKIP("skipped due to regression in Slang v2025.18.2")` at `tests/test-sampler-array.cpp:29` was attributed to graft root `eb8c343` (slang-rhi #534) by `git log --follow -S'<string>' -- <path>`. REST showed it was added by `8da2bf4f` (#533 "Enable CUDA texture access tests"): patch `+2/−0` adding exactly those lines, absent in parent `e5242e04`. The file dates to `4ab6f46d` (2024-08-30 initial import), and #534's real 11-file list does not contain it. Same author, same day, adjacent PR number, and the conclusion drawn from it was correct. Only the identifier was wrong, which is the hard shape: nobody re-checks a commit id that supports a conclusion they already accept ([slang-rhi provenance misattribution via git log -S past the graft](../learnings/1785767576978-workspace-agent-slang-rhi-is-a-shallow-clone-git-l.md), [same trap, verified from both sides against the REST API](../learnings/1785767719938-slang-rhi-clones-are-shallow-git-history-tools-giv.md)). It also impeached an older stored claim that rested on `git log -S` in that repo ("Metal `getDescriptorHandle` never landed"). That claim survived re-verification, but by a different method.

**Mode 2: `--stat` inflation, including on your own HEAD.** At a graft boundary every pre-existing file looks like a new addition. Both measured against the API:

| commit | local (shallow) | API truth | inflation |
|---|---|---|---|
| `eb8c343` (slang-rhi graft root) | 521 files / 125,516 ins / 0 del | **11 files / +232 −114**, 1 parent | ~47× files, ~540× ins |
| `c09d12c015` (#802 head, `--depth 1` clone) | 623 files / 191,694 ins / 0 del | **2 files / +8 −3**, a *merge* with 2 parents | ~300× files |

A `--depth 1 --branch <ref>` clone writes the checked-out commit into `.git/shallow`, so your own HEAD is the graft root (`git log -1 --format='%P' <head>` is empty). This is worse than mode 1, because `git show --stat <head>` does not look like a history query; it looks like the diff of the commit in front of you. A reviewer sizing a PR this way reports a 191k-line diff for an 8-line change ([--depth 1 makes YOUR head the graft root](../learnings/1785767871401-shallow-clone-your-own-checked-out-head-becomes-th.md)). Tells: implausibly many files with all additions and zero deletions; empty `%P` on a commit that is not the true root; a merge commit with a whole-tree diff. The tells are asymmetric. `git diff HEAD~1` fails loudly in a depth-1 clone (`fatal: ambiguous argument 'HEAD~1'`), and `git blame` marks truncation with `^`, but `git show --stat HEAD` does neither ([the tells are asymmetric; aim the warning at PR-sizing clones](../learnings/1785768378247-shallow-clone-graft-lie-is-depth-1-specific-one-li.md)).

**Mode 3: object-not-found manufactures a false negative.** Modes 1 and 2 corrupt a claim about a commit and leave an implausible number to notice. Mode 3 fabricates a claim about the world ("that commit does not exist", "that branch was deleted"), and not-found looks like a clean result. A real but unfetched commit and a fabricated SHA are byte-identical to local git:

```
git cat-file -t c09d12c015…   -> fatal: git cat-file: could not get object info   # REAL (#802 head)
git cat-file -t deadbeefdead… -> fatal: git cat-file: could not get object info   # FABRICATED
git rev-parse --verify <either>^{commit} -> fatal: Needed a single revision       # identical
```

Error wording misleads in the other direction too: the abbreviated, equally real `8da2bf4f` gives a different message (`Not a valid object name`). So message text is no signal either way. The API disambiguates: a real full SHA returns the commit, a fabricated one returns `HTTP 422 {"message":"No commit found for SHA: …"}`, and an abbreviated real SHA resolves ([a real unfetched SHA and a fabricated one are byte-identical to local git](../learnings/1785768516776-shallow-clone-mode-3-a-real-unfetched-sha-and-a-fa.md), [three modes, and mode 3 is the silent one](../learnings/1785768291147-shallow-clone-object-not-found-is-about-your-check.md)). In a possibly shallow clone, object-not-found means "my clone cannot see it" until proven otherwise, never that a ref is absent.

### Scope: mode 2 fires on the graft root at any depth

"It is a depth-1 problem" under-scopes the rule, and "`--stat` is false past the graft" over-scopes it. On a depth-203 `slang-rhi` clone, `git show --numstat HEAD` (`14e2f74e2`, not the graft) gave 2 files / +8 −3, identical to the API, while `git show --stat eb8c343` (the graft) still reported 521 files against a truth of 11. Mode 2 fires when the commit you `--stat` is the graft root, at any depth; `HEAD == graft` is sufficient but not necessary. Check the commit you are about to `--stat`, not the clone's depth ([mode 2 lies on the graft root at any depth](../learnings/1785768744942-shallow-clone-mode-2-scope-stat-lies-on-the-graft-.md)). In practice, `/slang-fix-issue` Step 1 clones `--depth 50`, so a fixer's own commits diff correctly and in-flight worktree diffs need no re-check; only provenance behind the boundary is unreliable there. The dangerous depth-1 form is the PR-review reflex, `git clone --depth 1 --branch <pr-head>`, which produced the 191k-for-8-lines reading.

### The silent-regime discriminator

An earlier check is retracted:

```bash
# ❌ WRONG — false negative
[ "$(git rev-parse HEAD)" = "$(cat .git/shallow | head -1)" ] && echo "SILENT REGIME"
```

`.git/shallow` is sorted by SHA and has one entry per fetched branch tip. A clone that fetches more than one ref has several lines, and HEAD is usually not line 1, so the check reports "safe" while HEAD is a graft root. On a fixture (12-file import, 5 side branches, 1-line tip change, `clone --depth 1 --no-single-branch`) there were 6 entries with HEAD last: `head -1` said safe, `%P` was empty, and `git show --stat HEAD` reported 12 files / 13 insertions against a truth of 1 file / +1. Inflation scales with tree size, not with the number of entries. Use this instead:

```bash
[ "$(git rev-parse --is-shallow-repository)" = true ] && [ -z "$(git log -1 --format=%P)" ] \
  && echo "SILENT REGIME: git show/diff on HEAD will inflate"
```

It tests whether HEAD itself is a graft root and needs no knowledge of the file's format or order. The `--is-shallow-repository` guard is load-bearing: in a full clone parked on the true root commit, `%P` is also empty, and the guard suppresses that false positive. (`grep -qx "$(git rev-parse HEAD)" .git/shallow` also works, indirectly.) Across six configurations (depth-1 single-branch on a real repo and on a fixture, depth-1 multi-branch with HEAD on and off line 1, depth-2 single- and multi-branch, and a full clone), the `%P` form matched ground truth on all six and the `head -1` form failed the multi-branch case ([use the empty-%P form, not head -1 of .git/shallow](../learnings/1785768517981-shallow-clone-silent-regime-test-head-s-empty-pare.md), [CORRECTION: the head -1 discriminator has a false negative](../learnings/1785768628753-correction-the-shallow-clone-discriminator-using-h.md)).

The bad check rarely fails in testing, which makes it worse. `--depth` implies `--single-branch`, so the common `git clone --depth 1 --branch <ref>` writes exactly one entry and the bad check agrees. A multi-entry file needs `--no-single-branch`, or a later `git fetch --depth 1 origin <other-ref>`, which appends an entry without moving HEAD and flips the verdict by SHA order. Two smells generalize: a check that reads one element of an arbitrarily ordered set carries no information when it passes, and a check whose result an unrelated later operation can flip never measured its subject.

### Shallow clones also break `git rebase` on a resumed branch

`/slang-fix-issue` clones with `--depth 50`. When you resume a committed branch weeks later and run `git rebase origin/master`, `git merge-base <base> origin/master` returns empty past the graft. Rebase then replays dozens of unrelated upstream commits (for example "Update generated design docs") with hundreds of `AA` conflicts and submodule merge errors. Symptoms: `--is-shallow-repository` is `true`, merge-base is empty, `.git/shallow` exists. Fix: `git rebase --abort`, `git fetch --unshallow origin` (~16 s for shader-slang/slang), then rebase; merge-base now finds the true fork point and only your commits replay. Confirm with `git merge-base --is-ancestor <base> origin/master && echo YES`. Then re-run `git submodule update --init --recursive`; master may have bumped pins, which show as ` M` and must not be staged into your commit ([shallow clone silently breaks git rebase on resumed branches](../learnings/1789147590776-shallow-clone-depth-silently-breaks-git-rebase-on-.md)).

### Working rules

1. **Check depth before trusting any local history or diff answer:** `git rev-parse --is-shallow-repository`, `cat .git/shallow`, empty `%P` on a non-root commit.
2. **Route diff and provenance facts to REST** in any repo that might be shallow: `gh api repos/<o>/<r>/commits/<sha>`, `.../compare/<a>...<b>`, `.../commits?path=<p>`. Or run `git fetch --unshallow` first.
3. **Verify provenance by the patch, never by proximity:** the line is present after the candidate commit and absent in its parent. Sibling PRs land the same day.
4. **Make negative existence claims from state at a ref,** never from a history search: `git ls-tree -r <ref>`, `git grep <pat> <ref>`, `gh api "repos/O/R/git/trees/<ref>?recursive=1"`, `contents?ref=`.
5. **Always name the ref.** "X does not exist at `main` but does at `<sha>`" is a claim; a bare path silently asserts `main`. Real case: `src/metal/metal-bindless-descriptor-set.{cpp,h}` exists at slang-rhi #802's head and not at `main`, so "not at main" pins the target rather than refuting it.
6. **When a tool's reliability is impeached, re-derive every live claim that leaned on it,** not just the one that got caught. Two independent audits each found one at-risk claim; both were in the full clone and dual-sourced, which is a checked result, not an assumption.
7. **Cheapest detector:** an implausibly short history for an old file (three commits for a two-year-old file) means suspect the clone, not the file.

Verification routing: an agent with no local clone owns API-side truth and is an independent second source, but it cannot reproduce a local-git pathology and must attribute rather than co-sign such a receipt. The agent holding the clone owns local-git behavior and is the wrong verifier for someone else's checkout. Route local-git claims to the clone holder and existence or provenance claims to REST, and say which half you verified.

Method lessons: a rule stored as a runnable command beats one stored as a claim, because a command gets run against inputs its author never had; that is how the `head -1` false negative was caught. Deliberately construct the shape you did not observe (here, a multi-branch clone). When a finding impeaches a tool, grep stored rules for that tool and amend them in place. For example, a stored rule "review `git show HEAD`, not `git diff base`" names the exact command that lies in the depth-1 regime.

## Never `--depth 1` a submodule update

`git clone --depth N` on the superproject is fine, because submodule SHAs come from the gitlink. A shallow submodule fetch is not. `git submodule update --init --recursive --depth 1` fetches only each submodule's branch tip, and Slang pins several submodules behind their tips:

```
fatal: Fetched in submodule path 'external/WindowsToolchain', but it did not contain
9dc178a86fcbbf13c94b4cd4cb046f238d26c8da. Direct fetching of that commit failed.
```

`--depth 1` works only when the pin is the current tip. CI is unaffected, because `.github/actions/build-and-test-with-slang/action.yml` runs `git submodule update --init --recursive` with no depth flag.

The failure is partial, and the exit code can be 0. `git submodule update` continues after the fatal line and leaves a tree that looks populated, which reads as "the build is slow" rather than "the checkout is broken" (about 35 min lost once and 20 min another time; the build would have produced a meaningless result). A `+`-marked submodule can be an empty worktree: `find external/slang-rhi -type f | wc -l` = 1 (only `.git`), `du -sh external/` = 2.8M across 18 submodules against 30M in `.git/modules`, and `git status` inside shows every file staged as deleted. `grep -c '^-'` alone is not enough, because uninitialized is only one of two bad states. Use all three:

```bash
git submodule status --recursive | grep -c '^+'   # wrong commit  -> must be 0
git submodule status --recursive | grep -c '^-'   # uninitialized -> must be 0
find external/<a-big-submodule> -type f | wc -l   # must be >> 1
```

`--recursive` is load-bearing: nested submodules (e.g. `external/vulkan` → Vulkan-Headers) are invisible to a non-recursive status, so the outer path can look done while a nested clone still runs. `pgrep -f "git submodule"` matches the checking shell itself; match `^git submodule update` instead. Repair: `git submodule deinit -f --all` (plus `rm -rf .git/modules` if worktrees are empty), then `git submodule update --init --recursive` with no `--depth`. Before trusting any test result from a PR build, confirm the `^+` count is 0 ([never use --depth 1 for slang submodules](../learnings/1785748265939-never-use-depth-1-for-slang-submodules-fetch-fails.md), [--depth 1 silently checks out WRONG commits with empty worktrees](../learnings/1785747759562-git-submodule-update-depth-1-silently-checks-out-w.md)).

After any `git reset --hard` or checkout that moves submodule gitlinks (a rebased base almost always does), run `git submodule update --init --recursive` before building. Submodule working trees do not follow the reset; `git status` shows `external/spirv-tools` and `external/spirv-headers` as ` M`. Commit `c7954ebd1f` (SPIRV VulkanSDK Sep-2026 bump) moved those gitlinks and also regenerated the in-tree `external/spirv-tools-generated/core_tables_*.inc`. Building the new tables against the old submodule gives a mismatched disassembler that prints the `NonSemantic.DebugPrintf` instruction by number (`%set 1`), so `tests/spirv/debug-printf.slang` fails only its `DebugPrintf` CHECK. This was first misdiagnosed as breakage from the SPIRV-Tools bump; the cause was the stale tool ([CORRECTION: debug-printf.slang failure was a stale submodule checkout after reset --hard](../learnings/1789592891886-correction-debug-printf-slang-failure-was-stale-su.md)).

## Reading a submodule pin move across a release boundary

Converting a PyPI-release bisect into a slang-rhi commit range is the right first move on a slangpy issue with rhi frames in its backtrace. But "the pin moved" is weak evidence and can point the wrong way. Read pins over REST: coworker slangpy clones often have no tags (`git describe` → "No names found"), so `git ls-tree <tag>` returns nothing, which is easy to misreport as "the pin did not change":

```bash
gh api "repos/shader-slang/slangpy/contents/external/slang-rhi?ref=v0.36.0" --jq '.sha'
gh api "repos/shader-slang/slangpy/contents/external/slang-rhi?ref=v0.37.0" --jq '.sha'
gh api "repos/shader-slang/slang-rhi/compare/<sha1>...<sha2>" \
  --jq '.commits[] | "\(.sha[0:9]) \(.commit.message|split("\n")[0])"'
```

On slangpy#1089 the pin moved across 0.36.0→0.37.0 (`96fef6f9`→`af6a1168`, 15 commits / 78 files). All 15 commits were adapter, CUDA, WebGPU or test work, and the suspect functions (`getPipelineCacheKey`, `createPipelineWithCache`) were byte-identical at both pins; the rhi pipeline-cache code landed in slang-rhi#379 (2025-06-02), before the older pin. The regression was slangpy newly entering a latent rhi path: v0.37.0 added `src/sgl/device/persistent_cache.{h,cpp}` (REST 404 at v0.36.0) and began setting `.persistentPipelineCache` in the rhi `DeviceDesc`. Always intersect the range with the backtrace's functions, and grep them at both pins (`gh api .../contents/<path>?ref=<sha> --jq .content | base64 -d | grep -n …`). If they are identical, the regression is a caller-side activation; the fix may still land in rhi while the cause is in slangpy. A 404-vs-200 check at the older tag is a cheap, decisive boundary probe ([a moved slang-rhi pin across a release boundary is not evidence the regression is in rhi](../learnings/1785774865515-a-moved-slang-rhi-submodule-pin-across-a-release-b.md)).

**Keep-ours on a submodule-pin merge conflict needs an ancestor check.** When a PR bumps a pin and master also moved it, keep-ours (the PR's pin) is safe only if master's pin is a strict ancestor of the PR's; otherwise it silently reverts master's pin move, and no test may catch it. Verify without a clone: `gh api repos/<owner>/<subrepo>/compare/<MASTER_PIN>...<PR_PIN> --jq '{status,ahead_by,behind_by,merge_base:.merge_base_commit.sha}'`. Keep-ours is safe iff `status=="ahead"` and `behind_by==0` (equivalently `merge_base == MASTER_PIN`). If `behind_by>0`, rebase onto a descendant of master's pin instead. On shader-slang/slang#9030 / PR #13105 the PR bumped slang-rhi `d6d31411`→`079b75b54c` (for PR #852's coop-matrix-2 feature names) while master had moved to `29dc332e55` (via PR #12522, which predated #852). Compare returned `ahead`, `behind_by=0`, `merge_base=29dc332e55`, so keep-ours was correct. This applies to any pinned dependency: a gitlink, a CMake FetchContent `GIT_TAG`, a vendored SHA. On a maintainer-watched PR, do not take a coworker's "strict superset" claim on faith; one compare call confirms it ([verify ancestor before trusting a keep-ours submodule-pin merge conflict resolution](../learnings/1789529223205-verify-ancestor-before-trusting-a-keep-ours-submod.md)).

## Updating a PR branch's history safely

**Rebase, not merge, to update a bot PR branch past master `.github/workflows` changes.** The `nv-slang-bot` App lacks the `workflows` permission, so pushing a `git merge origin/master` that brings in any `.github/workflows/**` change is rejected. `git rebase origin/master` replays only the bot's own commits; master's workflow changes arrive via the new base, so the push introduces no workflow edits and passes. Push with `git push --force-with-lease=<branch>:<remote-sha>`. This rewrites history and replaces any human merge commit on the branch, so note the swap in the report (the PR comment is operator-gated). If the bot's own commit must change a workflow file, there is no workaround: put the proposed YAML in the PR body for a human with `workflows` permission ([rebase (not merge) to update a bot PR branch past master workflow changes](../learnings/1789475499114-workaround-rebase-not-merge-to-update-a-bot-pr-bra.md)).

**Do not force-push over a maintainer merge commit.** If the remote was updated with GitHub's "Update branch" (a `Merge branch 'master' into <branch>` commit) but your local was rebased, `git push` is rejected non-fast-forward and the fix exists as two SHAs. Recipe: `git fetch origin <branch>` and compare `HEAD` with `FETCH_HEAD` (the tracking ref may not materialize); prove nothing unique is lost (`git diff FETCH_HEAD <last-shared-commit> -- <fix files>` is empty); replay only your new commits with `git rebase --onto FETCH_HEAD <branch-point-before-new-commits>`; then `git push origin HEAD:<branch>` fast-forwards with no force and keeps the merge commit ([reconciling a diverged PR branch without force-push](../learnings/1789505131994-reconciling-a-diverged-pr-branch-without-force-pus.md)).

## Cite a dependency version by pinned SHA + commit date, never a `git describe` tag

In a triage, PR description or GitHub reply, lead with the pinned SHA and its commit date (`git -C <sub> show -s --format=%ci <sha>`). Mention a `git describe --tags` string only as a labeled secondary hint. `git describe` reports the nearest ancestor tag plus a commit count, so for a sparsely tagged project like SPIRV-Tools a recent commit reads as ancient, and the label depends on the clone. The same commit `ef96ed763b43b59b33b31b362f09a02b729fa1c9` (2026-09-10, "Prepare release v2026.4.rc2", rolled into Slang by PR #12996) describes as `v2022.4-1347-gef96ed76` in a full clone and as the lightweight `v2026.4.rc2` in a shallow or alt-tag checkout. In slang#13230 a subagent reported "tag v2026.4.rc2"; maintainer jhelferty-nv saw `v2022.4-1347-gef96ed76` and challenged it as stale. Leading with SHA + date (a two-week-old pin) would have avoided that round-trip. Portable identifiers: `git ls-tree HEAD external/spirv-tools` (gitlink SHA), `git show -s --format=%ci <sha>` (true date), and `git log -1 -- external/spirv-tools` in the superproject (the bump PR). Before advising "roll the submodule to the upstream fix", establish the pin's real date and whether the fix is an ancestor or descendant of it; a describe label tells you neither. This gateway's `gh api` carries only shader-slang credentials, so KhronosGroup/SPIRV-Tools endpoints return 401 and upstream status (e.g. #6711) is unverifiable here; say so rather than guess ([git describe is not a version id for sparsely-tagged submodules](../learnings/1790185183125-git-describe-is-not-a-version-id-for-sparsely-tagg.md), [cite dependency/submodule versions by SHA + commit date](../learnings/1790185229706-cite-dependency-submodule-versions-by-sha-commit-d.md)).

**Source learnings (19):**
- [After reset --hard/checkout that moves submodule gitlinks, run git submodule update before building](../learnings/1789592891886-correction-debug-printf-slang-failure-was-stale-su.md) — stale submodule vs regenerated in-tree tables breaks debug-printf disassembly.
- [Shallow clones fail three ways: history search, --stat inflation, object-not-found](../learnings/1785768394345-shallow-clones-fail-three-ways-history-search-stat.md) — audit per clone.
- [slang-rhi clones are shallow: history tools give confidently wrong provenance](../learnings/1785767719938-slang-rhi-clones-are-shallow-git-history-tools-giv.md) — verify by patch, not proximity.
- [--depth 1 makes your checked-out head the graft root](../learnings/1785767871401-shallow-clone-your-own-checked-out-head-becomes-th.md) — `git show --stat <head>` reports the whole tree as added.
- [Shallow clone: object-not-found is about your checkout, not the world](../learnings/1785768291147-shallow-clone-object-not-found-is-about-your-check.md) — confirm via REST before asserting a ref is absent.
- [The graft lie targets PR-sizing `--depth 1 --branch <pr-head>` clones](../learnings/1785768378247-shallow-clone-graft-lie-is-depth-1-specific-one-li.md) — the tells are asymmetric.
- [Mode 3: a real unfetched SHA and a fabricated SHA are byte-identical to local git](../learnings/1785768516776-shallow-clone-mode-3-a-real-unfetched-sha-and-a-fa.md) — error wording misleads both ways.
- [CORRECTION: the `head -1 .git/shallow` discriminator has a false negative](../learnings/1785768628753-correction-the-shallow-clone-discriminator-using-h.md) — use empty `%P` with the `--is-shallow-repository` guard.
- [Mode 2 scope: `--stat` lies on the graft root at any depth](../learnings/1785768744942-shallow-clone-mode-2-scope-stat-lies-on-the-graft-.md) — route local-git claims to the clone holder, provenance to REST.
- [Never use `--depth 1` for slang submodules](../learnings/1785748265939-never-use-depth-1-for-slang-submodules-fetch-fails.md) — the fetch gets branch tips, not pinned commits.
- [`git submodule update --depth 1` silently checks out wrong commits with empty worktrees](../learnings/1785747759562-git-submodule-update-depth-1-silently-checks-out-w.md) — `grep -c '^-'` does not catch it.
- [A moved slang-rhi pin across a release boundary is not evidence the regression is in rhi](../learnings/1785774865515-a-moved-slang-rhi-submodule-pin-across-a-release-b.md) — intersect the range with the backtrace's functions.
- [Untracking a checked-in build binary is safe only if nothing consumes the tracked copy](../learnings/1784595515240-untracking-a-checked-in-build-binary-is-safe-only-.md) — stops future bloat only.
- [Shallow clone silently breaks git rebase on resumed branches](../learnings/1789147590776-shallow-clone-depth-silently-breaks-git-rebase-on-.md) — empty merge-base; fetch --unshallow first.
- [Verify ancestor before trusting a keep-ours submodule-pin merge resolution](../learnings/1789529223205-verify-ancestor-before-trusting-a-keep-ours-submod.md) — `compare/<master>...<pr>` → ahead, behind_by=0.
- [Rebase (not merge) to update a bot PR branch past master workflow changes](../learnings/1789475499114-workaround-rebase-not-merge-to-update-a-bot-pr-bra.md) — the App lacks `workflows` permission.
- [git describe is not a version id for sparsely-tagged submodules](../learnings/1790185183125-git-describe-is-not-a-version-id-for-sparsely-tagg.md) — cite SHA + commit date; KhronosGroup endpoints 401 here.
- [Cite dependency/submodule versions by SHA + commit date, never a describe tag](../learnings/1790185229706-cite-dependency-submodule-versions-by-sha-commit-d.md) — a stale-looking label cost a maintainer round-trip on slang#13230.
- [Reconciling a diverged PR branch without force-push](../learnings/1789505131994-reconciling-a-diverged-pr-branch-without-force-pus.md) — `git rebase --onto FETCH_HEAD`, then fast-forward.
