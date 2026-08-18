---
title: "CI Build Tooling & Workflow Structure (part 2)"
type: concept
group: ci-tooling
tags: [ci, build, wasm, falcor, workflows, test-silencing, perf, cmake, slang, capability-atoms, doc-regen, cmdline-ref, shallow-clone, submodules, git-provenance]
source_count: 14
---

# CI Build Tooling & Workflow Structure (part 2)

> **This page is part 2 of 3** of the CI Build Tooling & Workflow Structure synthesis (split 2026-08-11 to stay under the 40 KB read cap). Siblings: [part 1](ci-build-tooling.md), [part 3](ci-build-tooling-3.md). The TL;DR below is shared across all parts.

## TL;DR


## Untracking a Checked-In Build Binary Is Safe Only If Nothing Consumes the Tracked Copy (2026-07-21 fold)

For repo-hygiene issues asking to `git rm --cached` a checked-in generated binary + `.gitignore` it (e.g. slang#12167, `extras/scaler/scaler-linux`, a 34.6 MB Go ELF), the load-bearing verification beyond "is it tracked / how big" is: **does any deploy script, CI workflow, or Makefile CONSUME the tracked copy?** If a consumer reads the tracked binary directly, removal breaks that path and the fix is NOT safe as stated. Quick read-only checks from the checkout: `git ls-files <dir>` to confirm tracked; `git cat-file -s $(git rev-parse HEAD:<path>)` for exact byte size; `head -c4 <path> | od -An -tx1` → `7f 45 4c 46` confirms ELF (no `file` binary in the container); grep deploy scripts + `.github/` for the binary name. In #12167 both `deploy/setup-scaler-host.sh` and `deploy/update-scaler.sh` already did `[ ! -f "$BINARY" ]` → error out and print a `go build` command — i.e. they expect a *locally built* binary, not the tracked one — making removal provably safe, and no workflow referenced it. State in the verdict (so a maintainer isn't surprised) that untracking stops **future** bloat only; it does NOT shrink existing history/packs, and a full history purge (git-filter-repo/BFG) rewrites shared history and is disproportionate for a single blob — reject it as out-of-scope unless explicitly requested. Classification: enhancement / repo-hygiene, low severity, P3, component CI/build-infra; apply `reproduced` once tracked-file facts are confirmed at HEAD, leave Issue Type blank (a build-chore is neither a clean Bug nor Feature) ([Untracking a checked-in build binary is safe only if nothing consumes the tracked copy](../learnings/1784595515240-untracking-a-checked-in-build-binary-is-safe-only-.md)).


## Clone Depth: Shallow Checkouts Give Confidently Wrong Answers (2026-08-04 fold)

Shallowness is a property of the **checkout, not of any agent** — every coworker running history tools in an affected clone gets the same false answer, so state it as environment rather than as someone's mistake. Audit **per clone**, not per workspace:

```bash
for d in /workspace/agent/*/; do [ -e "$d/.git" ] && \
  printf "%-14s shallow=%s commits=%s\n" "$(basename $d)" \
    "$(git -C $d rev-parse --is-shallow-repository)" "$(git -C $d rev-list --count HEAD)"; done
# observed 2026-08-03: slang-rhi = shallow (graft eb8c343, ~203 commits) · slang = full (6,727)
```

So history-tool claims about `slang` stood; claims about `slang-rhi` needed the API ([audit clones individually — slang-rhi shallow, slang full](../learnings/1785768394345-shallow-clones-fail-three-ways-history-search-stat.md)). A base checkout that is `is-shallow=false` today (e.g. unshallowed during earlier work) proves nothing about the next clone — **run the check, don't inherit the conclusion** ([per-clone, not durable](../learnings/1785768378247-shallow-clone-graft-lie-is-depth-1-specific-one-li.md)).

### The three failure modes

**Mode 1 — history search names the graft root as the introducer.** `git log -S` / `git blame` / `--follow` can only see commits inside the graft, so they report the oldest *reachable* commit as where a line was introduced, with full confidence and no warning. Real cost: the Metal-only skip `SKIP("skipped due to regression in Slang v2025.18.2")` at `tests/test-sampler-array.cpp:29` was attributed to graft root `eb8c343` (slang-rhi #534, "Enable bindless support in CUDA") by exactly the right-looking tool, `git log --follow -S'<string>' -- <path>`. Ground truth from REST: added by **`8da2bf4f` = #533 "Enable CUDA texture access tests"** — 3 files, patch `+2/−0` adding exactly those lines, absent in parent `e5242e04`; the file itself dates to `4ab6f46d`, 2024-08-30 "initial import", and #534's real 11-file list does not contain the file at all. Same author, same day, adjacent PR number, **and the conclusion drawn from it was correct** — wrong only in the identifier, which is the hard shape: nobody re-checks a commit id that supports a conclusion they already agree with ([slang-rhi provenance misattribution via git log -S past the graft](../learnings/1785767576978-workspace-agent-slang-rhi-is-a-shallow-clone-git-l.md), [same trap, verified from both sides against the REST API](../learnings/1785767719938-slang-rhi-clones-are-shallow-git-history-tools-giv.md)). It also retroactively impeached an *older* stored claim resting on `git log -S` in that repo ("Metal `getDescriptorHandle` never landed, confirmed over 200+ commits") — which survived re-verification, but by a different method, not by the original evidence.

**Mode 2 — `--stat` inflation, including on your own HEAD.** At a graft boundary every pre-existing file looks like a fresh addition, so `--stat` reports a whole-tree diff. Both measured against the API:

| commit | local (shallow) | API truth | inflation |
|---|---|---|---|
| `eb8c343` (slang-rhi graft root) | 521 files / 125,516 ins / 0 del | **11 files / +232 −114**, 1 parent | ~47× files, ~540× ins |
| `c09d12c015` (#802 head, `--depth 1` clone) | 623 files / 191,694 ins / 0 del | **2 files / +8 −3**, a *merge* with 2 parents | ~300× files |

A `--depth 1 --branch <ref>` clone writes **the commit you checked out** into `.git/shallow`, making your own HEAD the graft root (`git log -1 --format='%P' <head>` → empty). This variant is nastier than mode 1 because `git show --stat <head>` doesn't look like a history query at all — it looks like the diff of the commit in front of you, the last place anyone suspects missing history — and "623 files changed" reads as a plausible large merge. A reviewer sizing a PR this way reports a 191k-line diff for an 8-line change ([--depth 1 makes YOUR head the graft root, so local diffs lie](../learnings/1785767871401-shallow-clone-your-own-checked-out-head-becomes-th.md)). **Tells:** implausibly many files with **all additions and zero deletions**; empty `%P` on a commit that isn't the true root; and one step subtler, **a merge commit reporting a whole-tree diff**.

The tells are also **asymmetric**, which is what makes `show --stat` the command to distrust: `git diff HEAD~1` fails **loudly** in a depth-1 clone (`fatal: ambiguous argument 'HEAD~1'`) and `git blame` carries its `^` prefix — both *self-report* truncation. `git show --stat HEAD` does neither ([the tells are asymmetric; aim the warning at PR-sizing clones](../learnings/1785768378247-shallow-clone-graft-lie-is-depth-1-specific-one-li.md)).

**Mode 3 — object-not-found manufactures a false negative (the dangerous one).** Modes 1–2 corrupt a claim *about a commit* and each leaves an implausible number to trip on. Mode 3 fabricates a conclusion *about the world* — "that commit doesn't exist," "that branch was deleted" — and not-found looks like a clean result. A real-but-unfetched commit and a completely fabricated SHA are **byte-identical** to local git; there is no weak signal, there is none:

```
git cat-file -t c09d12c015…   -> fatal: git cat-file: could not get object info   # REAL (#802 head)
git cat-file -t deadbeefdead… -> fatal: git cat-file: could not get object info   # FABRICATED
git rev-parse --verify <either>^{commit} -> fatal: Needed a single revision       # identical
```

Error *wording* misleads in the other direction too: the abbreviated but equally real `8da2bf4f` yields a **different** message (`Not a valid object name`). So inferring existence from message text is wrong both ways — identical errors for real-vs-fake, different errors for real-vs-real. The API disambiguates all three: real full SHA → the commit; fabricated → `HTTP 422 {"message":"No commit found for SHA: …"}`; abbreviated real → resolves ([a real unfetched SHA and a fabricated one are byte-identical to local git](../learnings/1785768516776-shallow-clone-mode-3-a-real-unfetched-sha-and-a-fa.md), [three modes, and mode 3 is the silent one](../learnings/1785768291147-shallow-clone-object-not-found-is-about-your-check.md)). **Rule: in a possibly-shallow clone, object-not-found means "my clone can't see it" until proven otherwise — never that a ref is absent.**

### Scope: mode 2 fires on the GRAFT ROOT at any depth

Two opposite loose phrasings are both wrong. "It's a depth-1 problem" **under-scopes** it; "`--stat` is false past the graft" **over-scopes** it (commits inside the graft diff correctly). Measured on a real shallow `slang-rhi` clone at **depth 203**: `HEAD` = `14e2f74e2` ≠ graft, and `git show --numstat HEAD` = 2 files / +8 −3, **identical to the API, not corrupted** — while `git show --stat eb8c343` (the graft) still reported 521 files against an API truth of 11. **Precise rule: mode 2 fires when the commit you `--stat` IS the graft root, at any depth; `HEAD == graft` is sufficient but not necessary.** A depth-203 clone that reasons "not depth-1, so I'm safe" and then `--stat`s the graft root gets garbage — precisely the false safety the rule was written to prevent. So check *the commit you are about to `--stat`*, not your clone's depth ([mode 2 lies on the graft root at any depth, not just depth-1](../learnings/1785768744942-shallow-clone-mode-2-scope-stat-lies-on-the-graft-.md)).

Where the everyday risk actually lives: `/slang-fix-issue` Step 1 clones `--depth 50`, so a fixer's own commits diff correctly and **nobody needs to re-verify in-flight worktree diffs** — only provenance *behind* the boundary is unreliable there (mode 1). The catastrophic depth-1 form is the **PR-review reflex**, `git clone --depth 1 --branch <pr-head>` to size up someone else's change, which is exactly how the 191k-for-8-lines reading happened.

### ⚠️ The ONE correct discriminator — the `head -1 .git/shallow` form has a false negative

An earlier revision of this cluster circulated this check, and it is **retracted**:

```bash
# ❌ WRONG — false negative
[ "$(git rev-parse HEAD)" = "$(cat .git/shallow | head -1)" ] && echo "SILENT REGIME"
```

`.git/shallow` is **sorted by SHA** and holds **one entry per fetched branch tip**, so a clone that fetches more than one ref writes several lines and HEAD is usually *not* line 1 — the check then reports "safe" while you are squarely in the inflating regime. Reproduced on a constructed fixture (12-file initial import, 5 side branches, 1-line tip change, `clone --depth 1 --no-single-branch`): 6 shallow entries with HEAD on the last line, `head -1` compare → "SAFE" (**wrong**), `%P` → empty (**right**), and `git show --stat HEAD` → 12 files / 13 insertions against a truth of 1 file / +1. Inflation scales with **tree size**, not with the number of shallow entries — the same mechanism that produced 623 files for a 2-file merge on a real repo. Use this instead:

```bash
[ "$(git rev-parse --is-shallow-repository)" = true ] && [ -z "$(git log -1 --format=%P)" ] \
  && echo "SILENT REGIME: git show/diff on HEAD will inflate"
```

It asks the question that actually matters — *is HEAD itself a graft root* — and needs no knowledge of `.git/shallow`'s format or ordering. **The `--is-shallow-repository` guard is load-bearing, not decoration:** in a **full** clone parked on the repository's true root commit `%P` is *also* empty, so the bare `-z` test reports SILENT (a false positive) and the guard suppresses it. (`grep -qx "$(git rev-parse HEAD)" .git/shallow` also closes the gap, but it is the indirect route to the same fact.) Validated across six configurations — depth-1 single-branch (real repo and fixture), depth-1 multi-branch with HEAD on line 1, depth-1 multi-branch with HEAD *not* on line 1, depth-2 single- and multi-branch, and a full clone: the `%P` form agrees with ground truth on all six, the `head -1` form disagrees on the multi-branch case ([use the empty-%P form, not head -1 of .git/shallow](../learnings/1785768517981-shallow-clone-silent-regime-test-head-s-empty-pare.md), [CORRECTION: the head -1 discriminator has a false negative](../learnings/1785768628753-correction-the-shallow-clone-discriminator-using-h.md)).

**Sharpening on how badly the bad check fails.** `--depth` implies `--single-branch`: a plain `git clone --depth 1 --branch <ref>` sets `remote.origin.fetch` to that one ref and writes **exactly one** shallow entry, so HEAD is trivially line 1 and the bad check **agrees ~always** — reaching a multi-entry shallow file requires `--no-single-branch` explicitly, or a later `git fetch --depth 1 origin <other-ref>` (which appends an entry without moving HEAD, flipping the verdict on a coin toss). Since the modal real-world shape is precisely `clone --depth 1 --branch <pr-head>`, anyone reading a measured "false-agreement rate" would conclude they'd have caught this by testing; in the configuration that actually hits them they would **not** have. Two structural smells, both readable without running anything: **a check that reads ONE element of an unordered or arbitrarily-ordered set carries no information when it passes** (`| head -1` on unsorted output, SHA-sorted files, hash-map order, `[0]` on an unordered collection), and **a check whose result an unrelated later operation can flip was never measuring its subject.**

### Working rules

1. **Check depth before trusting any local history or diff answer:** `git rev-parse --is-shallow-repository`, `cat .git/shallow`, empty `%P` on a non-root commit.
2. **Diff and provenance facts → REST, not local git,** in any repo that might be shallow: `gh api repos/<o>/<r>/commits/<sha>`, `.../compare/<a>...<b>`, `.../commits?path=<p>`. The API sees full history regardless of local depth. `git fetch --unshallow` first if you want local tooling.
3. **Verify provenance by the PATCH, never by proximity** — the line must be present after the candidate commit and absent in its parent. "Which PR was this author doing that week" is not a check; sibling PRs land the same day.
4. **Negative existence claims come from state at a ref, never a history search** (`git ls-tree -r <ref>`, `git grep <pat> <ref>`, `gh api "repos/O/R/git/trees/<ref>?recursive=1"`, `contents?ref=`). A history search can only ever say *"not in the commits I could reach."*
5. **Always name the ref.** "File X doesn't exist" is not a claim; "X doesn't exist at `main` but does at `<sha>`" is — a bare path silently asserts `main`, which makes a true pointer to a PR-branch artifact unfindable as written. Real case: `src/metal/metal-bindless-descriptor-set.{cpp,h}` exists at slang-rhi #802's head and is absent at `main`, so the "not at main" result *pins* the target rather than refuting it.
6. **When a tool's reliability is impeached, re-derive every LIVE claim that leaned on it** — not just the one that got caught, because nobody re-audits evidence sitting under a conclusion they already accept. Two independent audits each surfaced exactly one at-risk claim; both were in the full clone and dual-sourced, and that is worth recording as a *checked result*, not an assumption.
7. **Primary detector, cheapest of all:** an implausibly **short** history for an old file ⇒ suspect the **clone**, not the file. Three commits for a two-year-old file is louder than anything in the command output.

**Verification routing that generalizes past git:** an agent with **no local clone** owns API-side truth — its confirmations are *independent* of any coworker's clone state, making it a genuine second source — but it cannot reproduce a local-git pathology and must attribute rather than co-sign such a receipt. An agent **holding the clone** owns local-git behavior and is the wrong verifier for someone else's checkout. Route local-git claims to whoever holds the clone; route existence/provenance claims to REST; and when you can only verify half a mechanism, say which half.

**Two method lessons the cluster earned.** A rule stored as a **runnable command** beats one stored as a claim — a claim gets nodded at, a command gets run against inputs its author never had, which is the only reason the `head -1` false negative was catchable. The follow-through is to deliberately construct the shape you *didn't* observe (here: a clone fetching more than one branch), because a two-clone derivation of one repo silently fixes several variables at once and returns a narrow result shaped like a general one. And when a new finding impeaches a tool, **grep your own stored rules for that tool and amend them in place** rather than appending a second, contradicting note — a stored rule of the form *"review `git show HEAD`, not `git diff base`"* names the exact command that lies in the depth-1 regime, and that collision only surfaced because the finding was checked against existing notes.


## Never `--depth 1` a Submodule Update: Pinned SHAs Aren't Branch Tips (2026-08-04 fold)

The superproject/submodule asymmetry is the whole rule: **`git clone --depth N` on the superproject is fine** (submodule SHAs come from the gitlink and resolve independently), but a shallow *submodule fetch* breaks pinning. `git submodule update --init --recursive --depth 1` fetches only each submodule's **branch tip**, and Slang pins several submodules to commits behind their tips, so the pinned SHA simply isn't in the fetch:

```
fatal: Fetched in submodule path 'external/WindowsToolchain', but it did not contain
9dc178a86fcbbf13c94b4cd4cb046f238d26c8da. Direct fetching of that commit failed.
```

`--depth 1` only *happens* to work when the pinned SHA is the current tip — true for a freshly-tagged repo, false for basically any older pin. This is why CI is unaffected: `.github/actions/build-and-test-with-slang/action.yml` runs plain `git submodule update --init --recursive` with **no depth flag**.

**The failure is partial, not total, and the exit code can still be 0.** `git submodule update` keeps going after the fatal line, leaving a tree that looks populated but isn't — which reads as "the build is just slow" rather than "the checkout is broken" (~35 min lost assuming a long compile; another ~20 min on the same trap, which would have produced a completely meaningless build/test result if not caught). A `+`-marked submodule can be an **empty worktree**: `find external/slang-rhi -type f | wc -l` = **1** (only `external/slang-rhi/.git`), `du -sh external/` = 2.8M across 18 submodules while `.git/modules` was 30M, and `git status` inside it shows every file staged as deleted.

`grep -c '^-'` — the check most scripts use — is **insufficient**, because uninitialized is only one of the two bad states. Use all three:

```bash
git submodule status --recursive | grep -c '^+'   # wrong commit  -> must be 0
git submodule status --recursive | grep -c '^-'   # uninitialized -> must be 0
find external/<a-big-submodule> -type f | wc -l   # must be >> 1
```

`--recursive` is load-bearing: nested submodules (e.g. `external/vulkan` → Vulkan-Headers) are invisible to a non-recursive `git submodule status`, so the outer path can read as done while a nested clone is still running. And `pgrep -f "git submodule"` self-matches the shell running the check — match `^git submodule update` instead. Idempotent repair: `git submodule deinit -f --all` (plus `rm -rf .git/modules` if worktrees were left empty), then `git submodule update --init --recursive` with no `--depth`. If a build against a specific PR/commit matters, verify the `^+` count is 0 **before** trusting any test result from it ([never use --depth 1 for slang submodules — fetch fails on pinned commits](../learnings/1785748265939-never-use-depth-1-for-slang-submodules-fetch-fails.md), [--depth 1 silently checks out WRONG commits with empty worktrees](../learnings/1785747759562-git-submodule-update-depth-1-silently-checks-out-w.md)).


## Reading a Submodule Pin Move Across a Release Boundary (2026-08-04 fold)

Extending the "verify submodule pins at the gitlink, not the working tree" rule above: converting a PyPI-release bisect into a slang-rhi commit range is the right first move on any slangpy issue whose backtrace has rhi frames, but **"the pin moved" is weaker evidence than it looks and can point the wrong way.** Read the pins over REST — coworker slangpy clones often have **no tags at all** (`git describe` → "No names found"), so `git ls-tree <tag>` yields nothing and an empty result is easy to misreport as "the pin didn't change":

```bash
gh api "repos/shader-slang/slangpy/contents/external/slang-rhi?ref=v0.36.0" --jq '.sha'
gh api "repos/shader-slang/slangpy/contents/external/slang-rhi?ref=v0.37.0" --jq '.sha'
gh api "repos/shader-slang/slang-rhi/compare/<sha1>...<sha2>" \
  --jq '.commits[] | "\(.sha[0:9]) \(.commit.message|split("\n")[0])"'
```

On slangpy#1089 the pin **did** move across 0.36.0→0.37.0 (`96fef6f9`→`af6a1168`, 15 commits / 78 files) — yet all 15 commits were adapter/CUDA/WebGPU/test work, and the suspect functions (`getPipelineCacheKey`, `createPipelineWithCache`) were **byte-identical at both pins**; the rhi pipeline-cache code had landed months earlier (slang-rhi#379, 2025-06-02), well before the *older* pin. The real regression was slangpy newly **entering** a latent rhi path: v0.37.0 added `src/sgl/device/persistent_cache.{h,cpp}` (REST 404 at v0.36.0) and began setting `.persistentPipelineCache` in the rhi `DeviceDesc` for the first time. So **always intersect the commit range with the specific functions in the backtrace** before concluding ownership — a non-empty range only bounds the window. Grep the suspect symbols at *both* pins (`gh api .../contents/<path>?ref=<sha> --jq .content | base64 -d | grep -n …`); if they are identical, the regression is a caller-side activation and the fix may still land in rhi while the *cause* is in slangpy. Checking whether a file existed at the older tag (404 vs 200) is a cheap, decisive boundary probe ([a moved slang-rhi pin across a release boundary is not evidence the regression is in rhi](../learnings/1785774865515-a-moved-slang-rhi-submodule-pin-across-a-release-b.md)).

**Source learnings (14):**

- [shallow clones fail THREE ways — history search, --stat inflation, and object-not-found (which manufactures a false negative); audit per clone](../learnings/1785768394345-shallow-clones-fail-three-ways-history-search-stat.md)
- [/workspace/agent/slang-rhi is a SHALLOW clone — git log/blame/-S provenance is silently wrong past the graft root](../learnings/1785767576978-workspace-agent-slang-rhi-is-a-shallow-clone-git-l.md)
- [slang-rhi clones are shallow — history tools give confidently wrong provenance (verify by PATCH, not proximity)](../learnings/1785767719938-slang-rhi-clones-are-shallow-git-history-tools-giv.md)
- [--depth 1 makes YOUR checked-out head the graft root, so `git show --stat <head>` reports the whole tree as added](../learnings/1785767871401-shallow-clone-your-own-checked-out-head-becomes-th.md)
- [shallow clone: object-not-found is about your checkout, not the world — confirm via REST before asserting a ref is absent](../learnings/1785768291147-shallow-clone-object-not-found-is-about-your-check.md)
- [the graft lie targets PR-sizing `--depth 1 --branch <pr-head>` clones; the tells are asymmetric (`diff HEAD~1` is loud, `show --stat` is silent)](../learnings/1785768378247-shallow-clone-graft-lie-is-depth-1-specific-one-li.md)
- [mode 3: a real-but-unfetched SHA and a fabricated SHA are byte-identical to local git; error wording misleads both ways](../learnings/1785768516776-shallow-clone-mode-3-a-real-unfetched-sha-and-a-fa.md)
- [shallow-clone silent regime: test HEAD's empty `%P`, not `head -1 .git/shallow`](../learnings/1785768517981-shallow-clone-silent-regime-test-head-s-empty-pare.md)
- [CORRECTION: the `head -1 .git/shallow` discriminator has a false negative — use the empty-`%P` form with the `--is-shallow-repository` guard](../learnings/1785768628753-correction-the-shallow-clone-discriminator-using-h.md)
- [mode 2 scope: `--stat` lies on the GRAFT ROOT at any depth, not just depth-1; route local-git claims to the clone holder, provenance to REST](../learnings/1785768744942-shallow-clone-mode-2-scope-stat-lies-on-the-graft-.md)
- [never use `--depth 1` for slang submodules — the fetch gets branch tips, not the pinned commits](../learnings/1785748265939-never-use-depth-1-for-slang-submodules-fetch-fails.md)
- [`git submodule update --depth 1` silently checks out WRONG commits with empty worktrees; `grep -c '^-'` doesn't catch it](../learnings/1785747759562-git-submodule-update-depth-1-silently-checks-out-w.md)
- [a moved slang-rhi submodule pin across a release boundary is not evidence the regression is in rhi — intersect the range with the backtrace's functions](../learnings/1785774865515-a-moved-slang-rhi-submodule-pin-across-a-release-b.md)
- [untracking a checked-in build binary is safe only if no deploy script/CI/Makefile consumes the tracked copy; untracking stops future bloat only, not history](../learnings/1784595515240-untracking-a-checked-in-build-binary-is-safe-only-.md)
