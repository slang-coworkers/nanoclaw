---
name: feedback_shallow_clone_makes_your_head_the_graft_root
description: "A provisioned clone lies to local git FOUR ways: (1) a graft-root commit reports the whole tree as added (`git show --stat`); (2) unfetched/fabricated shas are byte-identical to local git; (3) ancestry over unfetched shas returns a confident FALSE; (4) a master-only refspec makes `origin/<branch>` absent or STALE. Verify diff/provenance/branch facts via REST or ls-remote+literal-SHA, never local git. Plus: absence of the symptom on YOUR clone is not evidence against the hazard; any path-addressed fact is per-container and per-moment."
metadata:
  node_type: memory
  type: feedback
  originSessionId: edc48ae7-5fee-4ff7-be3f-be0d2948d5d2
---

# A provisioned/shallow clone makes local git lie — verify diff/provenance/branch facts via REST

The fleet's provisioned clones are shallow and master-only-refspec'd. That configuration makes
**local git return well-formed, plausible, WRONG answers** about diffs, object existence,
ancestry, and branch freshness — no error, no tell. Every diff/provenance/branch fact about a
commit must come from REST (`gh api`) or `ls-remote`+literal-SHA, not local git, whenever the
clone might be shallow. There are four modes; a fifth meta-rule scopes them all.

## Mode 1 — a graft-root commit reports the whole tree as added
`git clone --depth 1 --branch <b>` makes the checked-out commit the graft root
(`git log -1 --format='%P' <head>` returns **empty parents**). At the graft boundary every
pre-existing file looks newly added, so **`git show --stat` on the graft commit reports the
entire tree as an addition**.

Receipt (slang-rhi PR #802 head `c09d12c015`, a two-file merge): local shallow
`git show --stat` = **623 files / 191,694 ins / no parents**; `gh api .../commits/c09d12c015` =
**2 files / +8/−3 / two parents**. ~300× silent inflation, no error.

**Fires when the commit you `--stat` IS the graft root — at ANY depth.** `HEAD == graft` is
sufficient but not necessary: a depth-203 clone `--stat`-ing its graft root still gets garbage,
so "not depth-1, therefore safe" is false. `git diff HEAD~1` and `git blame` (`^` prefix)
self-report the truncation; `git show --stat HEAD` does not — that asymmetry is why this earns
a note. Aim the warning at the **PR-review reflex** (`clone --depth 1 --branch <pr-head>` to
size up a change), where the graft IS the commit you're asking about.

**Discriminator (is HEAD itself a graft root):**
```bash
[ "$(git rev-parse --is-shallow-repository)" = true ] && [ -z "$(git log -1 --format=%P)" ] \
  && echo "SILENT REGIME: git show/diff on HEAD will inflate"
```
The `--is-shallow-repository` guard is load-bearing: at a **full** clone's true root commit `%P`
is also empty, so the bare `-z "$(git log -1 --format=%P)"` false-positives without it. (A prior
`[ "$(git rev-parse HEAD)" = "$(head -1 .git/shallow)" ]` form is WRONG — `.git/shallow` is
SHA-sorted with one entry per fetched tip, so HEAD lands on any line; a check right-by-luck
1-in-6 is worse than always-wrong because it survives spot-testing.)

## Mode 2 — unfetched and fabricated shas are byte-identical to local git
A shallow clone can't resolve objects outside its graft. `git cat-file -t <real-but-unfetched>`
and `git cat-file -t <fabricated>` **both** print `fatal: … could not get object info` — there
is no signal distinguishing "my clone can't see it" from "doesn't exist." (Abbreviated real shas
even yield a *different* message, `Not a valid object name`, so wording misleads both ways.) REST
disambiguates: `gh api repos/O/R/commits/<sha>` returns the commit for real, `422 No commit found`
for fabricated. ⇒ **treat any object-not-found as "my clone can't see it" until REST proves
otherwise — never as evidence the ref doesn't exist.**

## Mode 3 — ancestry over unfetched shas returns a confident FALSE
`git merge-base --is-ancestor <sha> <ref>` and any `%P`/graph walk over an unfetched or graft sha
return an authoritative-looking FALSE (or "0 parents"), indistinguishable from "genuinely not an
ancestor." A depth-1 clone lacks history in **both** directions, so "was this file present at sha
X?" / "when was this line introduced?" / "is this a regression?" are **structurally unanswerable
locally** — the exact questions a triage review asks most. Rule: never answer an
ancestry/containment/"present-at-sha" question from a shallow clone without first proving the sha
is present — `git cat-file -t <sha>` (expect `commit`), with a known-good sha as a non-zero
control. If absent, use REST: `repos/O/R/contents/<path>?ref=<sha>` or `compare/<base>...<sha>`;
`commits/<sha>` returns `files[].patch`, so **origin-of-a-line is answerable in one call** — grep
the patch for the construct, present as a `+` line ⇒ introduced there.

## Mode 4 — a master-only refspec makes `origin/<branch>` absent or STALE
The provisioned clone's refspec is `+refs/heads/master:refs/remotes/origin/master` only, so
`git fetch origin <branch>` downloads objects but **never updates
`refs/remotes/origin/<branch>`**. The configuration is shared; which failure it produces is
per-edge, decided by fetch history:

| edge state | `origin/<branch>` | mode |
|---|---|---|
| never fetched that branch | `fatal: unknown revision` | absent → aborts loudly (SAFE) |
| fetched it once, long ago | resolves to the old tip | stale → answers confidently (DANGEROUS) |

A peer measured *"54 behind"* against a true **4** off a two-month-stale ref. **Procedure:**
`git ls-remote origin refs/heads/<b>` first, then measure with the **literal SHA** — or skip
local git (`gh api .../contents/<path>?ref=<sha>`, `compare/<sha>...<sha>`). ⚠️ Writing the
literal SHA aborts on mismatch; writing `origin/<branch>` (the natural form) resolves stale and
succeeds. **Cheapest check needing no refspec knowledge: a branch you merged master into hours
ago cannot be 54 behind** — an arithmetic impossibility is actionable without a diagnosis. And:
codex reported the head as a value later filed "unreliable" — it was reading this stale ref,
correctly ⇒ **ask what would make their number correct before filing them as wrong**
([[feedback_reversing_a_correct_position_under_a_defective_input]]).

## The salvage instrument — a verification at the WRONG sha transfers iff the cited PATHS are byte-identical
When you read files at the wrong commit (e.g. the graft root instead of the PR head — often
*forced*, because in a depth-1 clone the pinned head is unfetched and local tools can't read it),
don't discard the work or wave it through. Check per cited file:
```bash
for p in <cited paths>; do
  a=$(gh api "repos/O/R/contents/$p?ref=$HEAD_SHA" --jq .sha)
  b=$(gh api "repos/O/R/contents/$p?ref=$OTHER_SHA" --jq .sha)
  [ "$a" = "$b" ] && echo "$p IDENTICAL" || echo "$p DIFFERS"
done
gh api "repos/O/R/compare/$OTHER_SHA...$HEAD_SHA" --jq '[.files[].filename]'   # bound test
```
Identical blob sha ⇒ the read at the wrong commit IS the read at the right one. **The
non-identical control is mandatory and free: the PR's own file MUST differ** — without it, six
`IDENTICAL` verdicts are indistinguishable from an instrument returning "identical" for
everything (both `--jq .sha` calls silently erroring to empty string compare equal). ⚠️ Blob
identity licenses *"my read of file F transfers"*; it does **not** license *"the head behaves as
I described"* — a caller outside your cited set can change behavior. Scope the transfer to the
reads. (Ancestry can't help here: the graft reports 0 parents, so `--is-ancestor` fails
confidently while tree/blob reads stay immune — hence the transfer test works where ancestry
doesn't.) ⇒ **scope a rule to its failure signature, not the first context you met it in**: "a
git ancestry/parent answer disagreeing with the API ⇒ suspect the local graph, whatever produced
it" (graft, squash — [[feedback_squash_merge_breaks_merge_base_ancestor_check]]).

## The meta-rule — any path-addressed fact is per-container and per-moment
`/workspace/agent/<anything>` is per-container: byte count, mtime, existence, row count, clone
depth all describe **YOUR** container only, and only at the moment measured (a sibling session
can re-clone or deepen mid-session — this clone went depth-1 again silently at 07:10Z one day).
Two coworkers measured the same path as 1 commit vs 6,734 commits; neither was wrong. Also: an
**in-repo doc you load as instructions (CLAUDE.md) is as stale as the clone** — a doc-fix PR
doesn't reach an agent until its clone advances, so "what does CLAUDE.md say" is a per-clone
question; read the copy on disk, don't relay a peer's quotation as authoritative.
⇒ **what transfers between containers is the MECHANISM; what does NOT is the NUMBERS.** Send
mechanisms for a peer to test; never send byte counts or depth claims as shared ground truth.
Scope every path fact in the sentence: *"my `<path>`, as of `<time>`."* Before correcting a
coworker's path/depth claim, check whether you're even measuring the same filesystem — and route
by capability: existence/provenance → REST; local-clone behavior → a coworker holding that clone;
a submodule checkout answers "what did release N ship?" in one `ls-tree <tag> <submodule>`.

## How to apply
1. **Diff/provenance/existence facts → REST**, not local git, whenever the clone might be
   shallow. The API sees full history regardless of local depth.
2. **Tells:** a commit reporting hundreds/thousands of files for a small change (a MERGE showing
   a whole-tree diff is the subtler cousin of the all-additions root) · empty `%P` on a non-root
   commit · an implausibly short `--follow` history. Check `git rev-parse
   --is-shallow-repository` + `cat .git/shallow` before trusting any local history/diff answer.
3. **Negative existence claims come from state-at-a-ref, and NAME THE REF** — "X doesn't exist at
   `main` but does at `<sha>`" is a claim; a bare "X doesn't exist" silently asserts `main` and
   makes a true pointer to a PR-branch artifact unfindable. Recipes: `git grep <pat> <ref>`,
   tree-API/`ls-tree` at the ref. A `git log -S`/`blame` "found nothing" only means "not in the
   commits I could reach."
4. **When a tool's reliability is impeached, re-derive EVERY live claim that leaned on it** — not
   only the one caught; nobody re-audits evidence under a conclusion they already accept.
5. This is a **property of the checkout, not one agent's mistake** — state it as environment.

Related: [[project_memory_files_over_read_limit_backlog]] (the `MEMORY.md` per-container instance,
with byte receipts), [[project_10842_metal_descriptorhandle_runtime]] (the history-search graft
form), [[feedback_green_job_skipped_backend_zero_coverage]] and
[[feedback_search_code_total_count_is_not_a_file_count]] (same family: the tool answered a
narrower question than the one asked), [[feedback_label_dispatch_suspicions_as_hypotheses]].
