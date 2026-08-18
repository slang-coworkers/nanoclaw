---
title: "Git in a Shared Clone: Worktrees, Reaping, FETCH_HEAD, and Reachability"
type: concept
group: general
tags: [git, worktree, shared-clone, fetch-head, reaping, gc, reachability, destructive-ops]
source_count: 10
---

## TL;DR

Git failure modes specific to a fleet of agents sharing one clone, plus the safe recipes for
GC/reap decisions. The through-line: **a git command that returns exit 0 and a clean
`git status` can be operating on the wrong tree, restoring nothing, or destroying a peer's
uncommitted work — and none of that shows up in the exit code.**

- **Never run a working-tree-mutating command (`checkout -- .`, `reset --hard`, `clean`,
  `stash`) in a shared clone.** `git show <ref>:<path>` reads any ref and writes nothing.
- **`git checkout -- <file>` restores from the INDEX**, so a staged change survives it — use
  `git restore --staged --worktree` or `git checkout HEAD --`.
- **A guard beside a destructive verb is a log line** unless control flow branches on it;
  prefer `merge --ff-only` (cannot silently discard) over `reset --hard`.
- **FETCH_HEAD is per-worktree**; the race is the *shared checkout*, not the ref — worktrees
  fix it. Resolve to a literal SHA immediately and assert the binding.
- **Bind a worktree to its PR by head SHA, not by branch name or dir number** — a
  constructed `fix/issue-<n>` that resolves is not verified; a closed PR is evidence about
  *that PR*, never about the branch.
- **`rev-list --count` counts commits, not work** — use `patch-id` and reachability.
- Only the **owning container** can resolve another tier's worktree branch; anyone else gets
  DETACHED. Ask; don't infer from the directory name.

## Restore and destructive verbs

`git checkout -- <file>` copies from the **index**, not `HEAD`, so a change that was
`git add`-ed *survives* it — exit 0, no warning, and a tree believed pristine was patched
when a ~25-min rebuild launched against it. Use `git restore --staged --worktree <paths>` or
`git checkout HEAD -- <paths>`, then **verify with a marker whose expected count is
non-zero** (a silent no-op restore and a real restore share the same exit code). The
covering generalization: *ask what this output would look like if the operation had failed;
if the answer is "the same", it is not a verification* — and the fix is mechanical (validate
every new marker against a known-present case), not attentional. [git checkout -- file restores from the index so a staged change survives it](../learnings/1786082712619-git-checkout-file-restores-from-the-index-so-a-sta.md)

**A guard whose output nothing branches on is a log line, not a guard.** A `reset --hard`
that *contained its own check* (`git status --porcelain | grep -v '^??' | wc -l` printed `1`)
ran anyway, because no control flow consumed the `1`, destroying a sibling's uncommitted edit.
The fix is the wiring, not the caution: `test "$(…)" -eq 0 || { echo ABORT; exit 1; }`, and
prefer `merge --ff-only` because it *cannot* silently discard — safety becomes structural.
The discriminator that matters: a written caution *was* present and had fired correctly in 11
prior files — but every one was a *deliberate cleanup decision* (stopping to think is the
task), while both losses came from a **refresh recipe run as session boilerplate**. *A
destructive verb inside routine boilerplate never reaches the deliberation the same verb gets
when it IS the decision* — only a changed default holds. Also: a recovery copy is a *claim*
about lost work, never an *authority* over it (a `.patched` scratch copy was strictly behind
an already-pushed PR head; restoring would have re-introduced the exact hazard); *an artifact
that RESCUES you gets the same audit as one that CORRECTS you*, and urgency is not evidence.
[A guard beside a destructive verb is a log line; boilerplate bypasses deliberation](../learnings/1786094514274-a-guard-beside-a-destructive-verb-is-a-log-line-bo.md)

## FETCH_HEAD and the shared-checkout race

The two prior shared learnings that said "`FETCH_HEAD` is a single mutable file in the clone"
were **wrong as a git fact, right about their incidents.** Measured (git 2.39.5):
`FETCH_HEAD` is *per-worktree* (`git rev-parse --git-path FETCH_HEAD` →
`.git/worktrees/<wt>/FETCH_HEAD`); a worktree fetch pinning c2 survives a co-tenant fetch of
c3 *from main*. **The race exists only because every session currently shares the ONE main
checkout** — N writers to one `.git/FETCH_HEAD` — so worktrees *fix* this class rather than
being immune to it. This failure deserves separate billing because it produces a *valid
worktree at the wrong commit*: every downstream measurement is true about the wrong tree,
exit codes are 0, `git status` clean. Remedy is an assert, not a guard: resolve to a literal
SHA *immediately* after fetch and `test "$(git -C <wt> rev-parse HEAD)" = "$SHA"`. And: *a
peer's true report about its own environment arrives as a general fact about the tool* — name
the edge and the version, or run the discriminating probe. [FETCH_HEAD is per-worktree; the race is the shared checkout, not the ref](../learnings/1786182802936-fetch-head-is-per-worktree-the-race-is-the-shared-.md)

## Reaping a worktree: bind by head SHA, never by name

A worktree-GC dispatch said "issue #11877's PR #11879 is CLOSED, the worktree is reclaimable"
— both facts true — and reaping would have destroyed the tree behind **OPEN draft PR #12162**
on the same branch. **One branch hosts many PRs; a direction pivot closes one and opens
another, so CLOSED is precisely the state a successor lives behind** — "the PR is closed" is
evidence about *that PR*, never about the branch. Second trap in the same reap: a *stale
tracking ref* manufactured a fake "unpushed commit" (`git rev-parse origin/<branch>` frozen
at the old head because the shallow clone's refspec covers only master); **only `git
ls-remote` is authoritative for a remote tip.** Before any reap: enumerate *all* PRs on the
branch (`--state all`, any OPEN ⇒ stop), `ls-remote` vs local HEAD, `git status --porcelain`,
re-read the issue. [A closed PR does not license reaping its branch's worktree — one branch hosts many PRs, and a direction pivot leaves the SUCCESSOR open](../learnings/1786193893035-a-closed-pr-does-not-license-reaping-its-branch-s-.md)

**A constructed address that hits something looks like a successful lookup.** A GC resolver
built `fix/issue-<num>` from an issue number and hit the *first* PR ever attached (long
closed), reporting "reclaimable" for an APPROVED unmerged PR — it failed *plausibly, twice*.
A name that resolves to nothing announces itself; a constructed name that happens to hit a
real object looks exactly like a successful lookup. Resolve *from the artifact you hold
outward* (`git branch --show-current` → `gh pr list --head` → newest OPEN row), never from a
reconstructed key. Companion: scope an absence claim to the instrument (`git cat-file -e` on
two refs supports only "not at that path on those two refs"), and *run the candidate on the
baseline before attributing a failure to your change* (a test that fails identically on base
master is a pre-existing defect, not your regression). [A constructed address that hits something looks like a successful lookup](../learnings/1786194800019-a-constructed-address-that-hits-something-looks-li.md)

The full binding rule, from a 22-worktree inventory: **`git branch --show-current` PLUS
`git rev-parse HEAD`, then match that SHA against `headRefOid` of every open PR** — not just
PRs whose `--head` equals the branch. Three successive premises each failed and exposed the
next: dir-number → PR-number (wrong twice, `1052→1054` breaks the `+1` symptom); `gh issue
view` succeeds on a PR number (unfalsifiable); and **branch-match alone still misses live
worktrees** — `wt-1052` on `…-v2` returned `[]` from `--head` but its head was byte-identical
to OPEN draft PR #1054's. Verdicts: EXACT (never reap), DIVERGED (still live, safe to rebase
not delete), NO-PR (candidate only, verify commits on origin first), DETACHED (needs a human).
Two hard conditions that hide live worktrees: an OPEN PR can be `isDraft:true` (a draft filter
re-hides every one), and a CLOSED issue does not imply no open PR on its branch. [Bind a worktree to its PR by head SHA, not by branch name or dir number](../learnings/1786196579212-bind-a-worktree-to-its-pr-by-head-sha-not-by-branc.md)

The head-SHA mismatch check fires for **three different reasons, only one of which is a wrong
binding** — disambiguate with `merge-base --is-ancestor` in both directions, reading exit
codes explicitly: local-AHEAD (unpushed work, never reap), object-ABSENT (`cat-file -e` exit
128, cannot compare, unknown), and genuinely-DIVERGENT (same commit *subject*, different SHA
from a rebase/recommit). `cat-file -e` exit 128 vs 1 matters — a never-fetched head returns
"not an ancestor" both ways, identical to genuine divergence. `git branch --show-current`
returns *empty* (not an error) for a non-worktree path, so gate on `.git` existing and treat
empty as unknown. And a worktree's `.git` gitdir resolves into the *owning container's* clone
— a supervisor cannot read another tier's worktree branch at all, so this can only be
computed by the owning tier. [Worktree→PR binding: the head-SHA check fires for three different reasons, only one of which is a wrong binding](../learnings/1786196635377-worktree-pr-binding-the-head-sha-check-fires-for-t.md)

## Git topology is not risk

The three-way SHA-mismatch classification (local-AHEAD / object-ABSENT / true-DIVERGENCE)
treated *topology* as the risk signal — and content measurement showed **two of three legs
were wrong about what was at stake**: a "true divergence" was a *rebase* (`git patch-id
--stable` identical both sides, nothing at risk); a "local AHEAD by 2" was a *merge* of
`origin/master` (zero authored work); only the third leg (a commit the forge API 422s) was
genuinely unpushed. **`rev-list --count A..HEAD` counts commits, not work** — merge and
pulled-in upstream commits inflate it. **Reachability is the risk test** (`git branch -r
--contains <sha>` empty, or the API 422) and **`patch-id --stable` is rebase-invariant**
(identifies same-change/different-SHA). *Differing trees are NOT evidence of lost content*
(identical patches on different bases have different trees). The generalizable shape:
distinct from the plausible-negative family — here the probe was correct and the *reading*
was wrong, because one output value ("ahead by 2") covered several states; enumerate the
states an output can represent before trusting the reading, and note **a correction is
itself a claim** (this correction collapsed topology-vs-content while catching a peer doing
the same with three states). [Git topology is not risk: rev-list --count counts commits, not work — use patch-id and reachability](../learnings/1786197168003-git-topology-is-not-risk-rev-list-count-counts-com.md)

## Loud vs silent failure on the reachability instruments

Adopting `git ls-remote` + `merge-base --is-ancestor` as a worktree-containment check, both
instruments have failure modes worth scripting around: **`ls-remote`'s empty stdout is
two-valued** (`rc=0` ref-absent vs `rc=128` remote-unreachable, both empty) — on a reap path
that difference is a destroyed worktree, so capture `rc` separately and `rc != 0` means
*unknown*, never *absent*. **`merge-base --is-ancestor` is three-valued** (0=ancestor,
1=not, **128=object missing**) — collapsing 128 into "not an ancestor" converts *I couldn't
tell* into a verdict. And a memory note about the clone being `--depth 50` had **gone stale
in the safe direction** — re-measured, it was no longer shallow (6765 commits) so an
ancestry recipe was sound today; *a stale note that makes you more cautious is the kind you
never catch*, because acting on it always looks like rigour. Keep the *check*
(`--is-shallow-repository`, one line) in the recipe, never the *conclusion*. [ls-remote can't tell "branch deleted" from "remote unreachable" on stdout — and a memory note can go stale by becoming too pessimistic](../learnings/1786194591747-ls-remote-can-t-tell-branch-deleted-from-remote-un.md)

## Diagnosability into a buffer nobody reads

Restoring a value into a buffer nobody reads is not a diagnosability fix. A probe consuming
the loader's one-shot reporting opportunity (`sink=nullptr`) left later compiles silent; the
reorder that "restored the diagnostic for the log" delivered it into the *library
precompile's* diagnostics blob, on which the test called `setNull()` — the log was
byte-identical either way. **For any diagnosability fix, the acceptance test is "does the
string appear in the output a human reads?", not "is the value now produced somewhere?"** —
trace the *consumer*, verify with a two-cell count (message present in exactly the failing
cells, absent in the healthy ones), and beware wording ("records for the log", "surfaces to
the user") that quietly asserts a delivery path you never checked. [Restoring a value into a buffer nobody reads is not a diagnosability fix](../learnings/1786193883857-restoring-a-value-into-a-buffer-nobody-reads-is-no.md)
