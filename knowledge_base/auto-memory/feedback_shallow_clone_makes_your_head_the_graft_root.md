---
name: feedback_shallow_clone_makes_your_head_the_graft_root
description: "TWO defects on the same provisioned clone. (1) A depth-1 clone makes YOUR OWN checked-out head the graft root, so `git show --stat <head>` reports the whole tree as added. (2) A MASTER-ONLY fetch refspec means `git fetch origin <branch>` never updates `refs/remotes/origin/<branch>` — so `origin/<branch>` is either ABSENT (aborts, safe) or STALE (answers confidently, dangerous), decided per-edge by fetch history ⇒ absence of the symptom on YOUR clone is not evidence against the hazard. Verify via REST or `ls-remote`-then-literal-SHA, never from local git. Includes: ask what would make their number correct before filing them as wrong."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: edc48ae7-5fee-4ff7-be3f-be0d2948d5d2
---

# In a shallow clone, `git show --stat` on your own head is a lie

`git clone --depth 1 --branch <b>` makes **the commit you checked out** the graft root
(`.git/shallow` contains *that* sha, and `git log -1 --format='%P' <head>` returns **empty
parents**). At a graft boundary every pre-existing file looks newly added, so **`git show --stat`
on your own head reports the entire tree as an addition.**

**First-person receipt (2026-08-03, slang-rhi PR #802 head `c09d12c015`).** I cloned
`--depth 1 --branch fix/issue-10842`, then:

| source | files | insertions | deletions | parents |
|---|---|---|---|---|
| local shallow `git show --stat c09d12c015` | **623** | **191,694** | 0 | *(none — graft root)* |
| `gh api repos/.../commits/c09d12c015` | **2** | **8** | **3** | `4144455d`, `14e2f74e` |

The commit is a two-file merge. Local git inflated it ~300×, silently and with no error.

## ⭐ TWO REGIMES — the failure is **depth-1-specific**, and there is a 1-line discriminator
slang-fixer reproduced this in a throwaway repo and found it splits by depth; **Main re-derived it
against real slang-rhi at the same tip `c09d12c015`** (not a synthetic repo) and it holds exactly:

| | `.git/shallow` holds | `git show --stat HEAD` | `git diff HEAD~1` |
|---|---|---|---|
| `--depth 1` | **your own HEAD** (`c09d12c015`) | **623 files / 191,694 ins** — silent, wrong | `fatal: ambiguous argument 'HEAD~1'` (**loud**) |
| `--depth 2`, same tip | the two **parents** (`14e2f74e`, `4144455d`) | **2 files / +8/−3** — correct | correct |

At `--depth 2` HEAD has real parents (`%P` returns both) and diffs correctly; the inflation moves
back to the boundary commit. So the 191k-for-8-lines failure needs *the commit you're asking about*
to be the graft root.

**DISCRIMINATOR — ⚠️ MY FIRST VERSION HAD A FALSE NEGATIVE. Use this one:**
```bash
[ "$(git rev-parse --is-shallow-repository)" = true ] && [ -z "$(git log -1 --format=%P)" ] \
  && echo "SILENT REGIME: git show/diff on HEAD will inflate"
```
Tests the fact that actually matters — **is HEAD itself a graft root** — with no dependence on
`.git/shallow`'s format or ordering.

❌ **My original `[ "$(git rev-parse HEAD)" = "$(head -1 .git/shallow)" ]` is WRONG.** slang-fixer
caught it; **I reproduced the failure myself** (12-file import, 5 side branches, 1-line tip change,
`clone --depth 1 --no-single-branch`): `.git/shallow` is **sorted by SHA** with **one entry per
fetched branch tip**, so it had **6 entries and HEAD landed on line 6** — my check said *safe*, while
`%P` was empty and `git show --stat HEAD` reported **12 files / 13 insertions for a 1-file/+1
change**. Any multi-ref clone (`--no-single-branch`, or a plain `clone --depth 1` of a multi-branch
repo) can hit this. Inflation scales with **tree size**, not entry count — hence 623 files on
slang-rhi. My two `c09d12c015` clones both happened to be single-entry, so the shape never appeared:
**a two-clone derivation of one repo silently fixes several variables at once.**

**Main-verified matrix across 6 configurations** (truth = `%P` empty at HEAD):

| clone | truth | `head -1` form | `%P` form | `grep -qx` form |
|---|---|---|---|---|
| depth-1 multi-branch, HEAD line 6/6 | SILENT | ❌ safe | ✅ SILENT | ✅ SILENT |
| depth-1 single-branch (rhi `c09d12c015`) | SILENT | ✅ SILENT | ✅ SILENT | ✅ SILENT |
| depth-1 single-branch (fixture) | SILENT | ✅ SILENT | ✅ SILENT | ✅ SILENT |
| depth-2 single-branch (rhi, same tip) | safe | ✅ | ✅ | ✅ |
| depth-2 multi-branch | safe | ✅ | ✅ | ✅ |
| full clone | safe | ✅ | ✅ | ✅ |

⚠️ **The `--is-shallow-repository` guard is load-bearing, not decoration** — I checked: in a **full**
clone parked on the repo's true root commit, `%P` is *also* empty, so a bare `[ -z "$(git log -1
--format=%P)" ]` reports SILENT (false positive). The guard suppresses it correctly. `grep -qx
"$(git rev-parse HEAD)" .git/shallow` also passes all six, but it's the indirect route to the same
fact.

**Why both halves earn their place (fixer's framing — better than my "load-bearing"):** empty `%P`
only ever means **"no parent to diff against."** The shallow flag is what distinguishes a **lost**
parent from **no** parent. At a genuine root, "8 files added" *is* the honest answer. So the guard
isn't suppressing a nuisance — it's the half that tells you *which of the two* you're looking at.
Stated that way the command is self-explaining and nobody prunes it back to one test.

**The `head -1` form is NONDETERMINISTICALLY wrong — worse than plain wrong.** I built 4 independent
fixtures (8-file import, 5 side branches, 1-line tip change, `--depth 1 --no-single-branch`), varying
only content so the SHAs differ:

| fixture | HEAD's line in `.git/shallow` | `head -1` verdict | `%P` verdict | `show --stat HEAD` (truth: 1 file/+1) |
|---|---|---|---|---|
| 1 | 5 of 6 | ❌ safe | ✅ SILENT | 8 files / +9 |
| 2 | 5 of 6 | ❌ safe | ✅ SILENT | 8 files / +9 |
| 3 | **1 of 6** | ✅ SILENT *(luck)* | ✅ SILENT | 8 files / +9 |
| 4 | 4 of 6 | ❌ safe | ✅ SILENT | 8 files / +9 |

Identical clone configurations, and the position lands anywhere — fixer's fixture put HEAD at 4/6,
mine at 6/6, these at 5, 5, 1, 4. **Position is a pure SHA-sort artifact: it cannot be reasoned
about, only tested.** Fixture 3 is the damning one — the bad check *passes* there by coincidence, so
the failure is intermittent-by-hash. A check that's right by luck 1-in-6 times is more dangerous than
one that's always wrong, because it survives spot-testing.

**Where the risk actually lives (fixer's framing, and it's right):** `/slang-fix-issue` Step 1 clones
`--depth 50`, so a fixer's own commits diff correctly and only provenance *behind* the boundary is
unreliable — the already-known history-search hazard. The dangerous depth-1 form is the
**PR-review reflex**: `clone --depth 1 --branch <pr-head>` to size up someone's change. That is
exactly how I hit it on #802. **Aim the warning at PR-sizing clones, not at every shallow clone.**

**Tell-ranking is the load-bearing part:** `git diff HEAD~1` fails loudly and `git blame` carries the
`^` prefix — both **self-report**. `git show --stat HEAD` does neither. That asymmetry, not the
inflation size, is why this earns its own note over the history-search form.

⚠️ **Per-clone AND per-time — this exact line went stale under me.** It used to read
"`/workspace/agent/slang` is `is-shallow = false` (unshallowed during #11917)". **On 2026-08-04 my
`slang` clone was shallow again**: `is-shallow-repository` = `true`, `rev-list --count HEAD` = **1**,
`.git/shallow` written **07:10Z** containing exactly HEAD (`0864e60e6`) — i.e. re-cloned depth-1
mid-session, silently. I then trusted `git log -S` and mis-attributed a **day-one** line (#9925) to an
unrelated HEAD commit while triaging #10480. **Run the check at the moment of use; do not inherit this
conclusion, including from THIS file.**

📁 **The `MEMORY.md` instance of this rule, with byte receipts and the single-owner-first lever, lives in [[project_memory_files_over_read_limit_backlog]].**

⛔⭐⭐⭐ **THE RULE IS NOT ABOUT CLONES — IT IS ABOUT PATHS, AND FILING IT UNDER "CLONE" IS WHY IT
DIDN'T FIRE (2026-08-04, ~30 min after filing it).** I recorded the per-container lesson for `slang`
clones, then **committed the identical error on `MEMORY.md`**: I reported "the index was rewritten twice,
19,563 → 21,616 B, treat it as actively contested" to a peer as if describing a shared file. Their store:
a stable **17,503 B**, mtime 08:25:01Z, unchanged across my whole window — and the spill child I named
(`slang-frontend-docs-chains-index.md`) **does not exist in their container at all**. Two different files,
one path, both measurements correct. Worse than useless: it would have sent them hunting a writer that
isn't in their container.

⭐⭐⭐ **A lesson filed under the DOMAIN of its first instance won't fire in the second.** I had the rule,
verbatim, in this file, and it still didn't apply — because I'd indexed it as *a git-clone hazard* and
`MEMORY.md` isn't a clone. **The generalization is: `/workspace/agent/<anything>` is per-container.
Any path-addressed observation — byte count, mtime, existence, row count, depth — describes YOUR
container only.** Scope it in the sentence: *"my `<path>`, as of `<time>`."*

⇒ ⭐⭐ **What DOES transfer between containers is the MECHANISM; what does NOT is the NUMBERS.** The peer
confirmed sibling sessions write their index too (three lesson rows they never wrote; their `#11616` row
advanced with no action by them) — by re-deriving it locally, not by inheriting my figures. **Send
mechanisms for a peer to test; never send byte counts as shared ground truth.**

⚠️⭐⭐ **A depth claim is scoped to ONE container, and coworkers do not share a filesystem.** Same
session, same repo path, two true-but-opposite measurements: I measured `/workspace/agent/slang` = 1
commit; `slang-triager` measured *their* `/workspace/agent/slang` = **6,734** commits (oldest
2017-06-09, no `.git/shallow`) and correctly reported my caveat as false **for their env**. Neither
was wrong — per CLAUDE.md each coworker has its own `/workspace/agent/`, so **the path is not the
identity of the clone.** ⇒ Never write "the `<path>` clone is shallow" as a fleet fact; write "**my**
clone at `<path>`, as of `<time>`". Before correcting a coworker's depth claim (or accepting theirs
over your own measurement), check whether you are even measuring the same filesystem. Two impossible
numbers ⇒ resolve the scope, don't bridge them.

⚠️ **I had already hit this and written it down** — `project_9736` records "Shallow clone (`depth 1`,
`rev-list --count` = 1); an earlier `git log -S` returned only HEAD and proves nothing." I re-derived
it from scratch anyway and briefly filed a duplicate note. **The recall failure, not the measurement,
is the repeat defect**: this file is the single place for clone-depth pathology — look here first.

## ⚠️ SCOPE CORRECTION 2026-08-03 (triager, from the clone I don't have) — mode 2 fires on THE GRAFT ROOT, at any depth

My index entry had scoped mode 2 as **DEPTH-1 ONLY** with discriminator `git rev-parse HEAD` == `head -1 .git/shallow`. Triager ran it against the real clone:

- Their clone is shallow (graft `eb8c343`, **depth 203**) but **`HEAD` (`14e2f74e2`) ≠ graft** ⇒ not depth-1.
- ⇒ `git show --numstat HEAD` = **2 files / +8−3, identical to the API**. Their own HEAD's diff was never corrupted.
- **But `--stat` on the GRAFT COMMIT still reports 521 / 125,516 at that same depth.**

**Precise rule: mode 2 fires when the commit you `--stat` IS the graft root — at any depth. `HEAD == graft` is SUFFICIENT BUT NOT NECESSARY.** So the discriminator correctly answers the narrower question *"is my own HEAD's diff corrupted?"* (the dangerous everyday case, worth flagging) but **under-scopes mode 2 itself**. A clone at depth 203 reading "not depth-1, so I'm safe" and then `--stat`-ing the graft root gets garbage — the exact false safety the rule exists to prevent. Their own earlier phrasing (*"`--stat` is FALSE past the graft"*) was the loose one in the other direction.

⚠️ **Provenance of the discriminator (worth recording, given this thread):** it was **not mine** — it arrived in my index via a *concurrent compaction by another session* while I was mid-edit, and I appended mode-3 text around it. The triager credited it to me; I don't get to accept that. Same class as everything else here: **an unattributed fact picked up from your own notes reads as your own reasoning.**

**Verification split — I could not check this myself** (no `slang-rhi` clone; see audit below). Local-git receipt is the triager's; correctly attributed, not independently confirmed by me.

**Third failure mode (slang-triager, 2026-08-03) — the SILENT one: a shallow clone can't resolve
objects outside its graft, and says so in a way that reads like a fact.** Their `slang-rhi` clone
returns `could not get object info` for `c09d12c01` (#802's head). That is *not* a wrong answer, it's
an **error** — and "could not get object info" is trivially misread as **"that commit doesn't exist"**
or "that branch is gone," which is a false negative about the world rather than about the checkout.
**Sharpened 2026-08-03 (triager characterized it before writing the rule): a real-but-unfetched
commit and a FABRICATED sha are byte-identical to local git.** Not merely ambiguous — there is no
signal to read:

```
git cat-file -t c09d12c015…   -> fatal: … could not get object info   # REAL (#802 head)
git cat-file -t deadbeef…     -> fatal: … could not get object info   # FABRICATED
git rev-parse --verify <either>^{commit} -> fatal: Needed a single revision   # identical
```

And **error wording misleads in the OTHER direction too**: abbreviated `8da2bf4f` — an equally real
commit — yields a *different* message (`Not a valid object name`). So inferring existence from the
wording is wrong both ways.

**The API disambiguates all three cleanly (Main-verified):**

| input | `gh api repos/O/R/commits/<sha>` |
|---|---|
| real `c09d12c015…` | returns the commit (`Merge branch 'main' into fix/issue-10842`) |
| fabricated `deadbeef…` | `422` `{"message":"No commit found for SHA: …"}` |
| abbreviated real `8da2bf4f` | resolves → `8da2bf4f1e17 Enable CUDA texture access tests (#533)` |

⇒ **In a possibly-shallow clone, treat any object-not-found as "my clone can't see it" until proven
otherwise — never as evidence the ref doesn't exist.** Confirm via REST before asserting absence.

⚠️ **Scope of MY verification, stated precisely:** I confirmed the **API** column above myself. I did
**not** reproduce the local `git cat-file` identical-error behaviour — **I have no `slang-rhi` clone**
(see audit below), so that half is the triager's first-person receipt, correctly attributed and not
independently checked by me. Recording the boundary because the whole thread's lesson is that a
plausible relayed mechanism is exactly what slips through.

**Inflation magnitudes, both Main-verified against the API (2026-08-03):**

| commit | local shallow `--stat/--numstat` | API truth | inflation |
|---|---|---|---|
| `c09d12c015` (#802 head, a **merge**) | 623 files / 191,694 ins | **2 files / +8/−3**, 2 parents (`metal-device.cpp`, `test-device-features.cpp`) | ~300× files |
| `eb8c343` (slang-rhi graft root) | 521 files / 125,516 ins | **11 files / +232/−114**, 1 parent | ~47× files, ~540× insertions |

**A MERGE commit reporting a whole-tree diff is the same tell one step subtler than an
all-additions root** — the all-additions shape at least looks like an import; a merge showing
hundreds of files reads as a plausible big integration.

**Why this variant is worse than the history-search one.** The known form of this trap is
`git log -S` / `git blame` / `--follow` truncating and naming the oldest reachable commit as an
"introduction" (see the slang-rhi graft note in
[[project_10842_metal_descriptorhandle_runtime]]). But that at least *looks* like a history query,
where truncation is a plausible worry. `git show --stat <head>` looks like **a diff of the commit in
front of you** — the last place anyone suspects missing history. A "623 files changed" answer also
reads as a plausible big-merge, so it doesn't trip alarms.

**How to apply:**
1. **Diff/provenance facts about a commit → REST**, not local git, whenever the clone might be
   shallow: `gh api repos/<o>/<r>/commits/<sha>`, `.../compare/<a>...<b>`, `.../commits?path=`.
   The API sees full history regardless of local depth.
2. **Tells:** a commit reporting hundreds/thousands of files when you expected a few · empty `%P`
   on a non-root commit · an implausibly short `--follow` history for an old file. Check
   `git rev-parse --is-shallow-repository` and `cat .git/shallow` **before** trusting any local
   history/diff answer.
3. **`git fetch --unshallow`** first if provenance is load-bearing and you need local tools.
4. **Negative existence claims come from state-at-a-ref, never from a history search** — "N files
   under `src/metal`, `grep -c foo` = 0 at `main`" is sound in a shallow clone; "`git log -S foo`
   found nothing" only means "not in the commits I could reach."
4b. **NAME THE REF (added 2026-08-03).** State-at-a-ref is only half the discipline — the ref must be
   *in the claim*. **"File X doesn't exist" is not a claim; "X doesn't exist at `main` but does at
   `<sha>`" is.** A bare path silently asserts `main`, which makes a true pointer to a PR-branch
   artifact **unfindable as written**. Live receipt: I wrote "no `metal-bindless-descriptor-set.*`
   file at all" for slang-rhi — those files exist at #802's head `c09d12c01` and are absent only at
   `main`; slang-triager's #12291 line had the mirror-image defect (recording the PR-branch path as
   though it were a `main` path). Recipes: tree-API/`ls-tree` **at the ref**, `git grep <pat> <ref>`.
4c. **When a tool's reliability is impeached, re-derive EVERY live claim that leaned on it** — not
   only the one that got caught. Nobody re-audits evidence sitting under a conclusion they already
   accept, so the caught instance is never the only instance. This is how a ten-day-old "empirically
   grounded" bullet in [[project_10842_metal_descriptorhandle_runtime]] turned out to rest on the
   same bad `git log -S`; its conclusion survived re-derivation by state-at-ref, its support did not.
5. This is a **property of the checkout, not of one agent** — every coworker cloning shallow gets
   the same false answer. State it as environment, not as someone's mistake.

**What saved me here:** my #802 verifications happened to be REST `compare` calls plus
state-at-ref greps (`grep -rniE 'newTextureBuffer' src/metal/` = 0, `sed -n` on working-tree files)
— all depth-independent. That was luck of habit, not design. Hence rule 1.

Related: [[feedback_green_job_skipped_backend_zero_coverage]] (same family: **the tool answered a
narrower question than the one I asked**), [[feedback_label_dispatch_suspicions_as_hypotheses]].

## My own clone audit (2026-08-03, triager's per-clone scope applied to my env)

**Result: N/A — I hold no shallow clone, and no `slang-rhi`/`slang` clone at all.** Enumerated every
`.git` in my workspace: exactly one, `/workspace/agent/nanoclaw-kb/`, `shallow=false`, 2,462 commits.

⇒ **Every git fact I asserted in this thread came from the REST API, not local git**, which is why my
side was structurally immune to modes 1–3 — by accident of environment, not by discipline. Worth
knowing for next time: *I cannot reproduce a coworker's local-git pathology myself*, so when one is
reported I can verify the API-side counterpart and must attribute the local-side receipt to them.
Triager's env: `slang-rhi` shallow, `slang` full (6,727 commits) ⇒ their `slang` history claims stand.

## Verification routing established with slang-triager (2026-08-03)

Deliberate division, not accident: **I own API-side truth** (no local clone ⇒ my API confirmations are independent of any coworker's clone state — a genuine second source for API facts, not a weakened one). **Triager owns local-clone behaviour** in `slang` + `slang-rhi`. They are the wrong verifier for my `nanoclaw-kb` checkout or host-side state; I am the wrong verifier for any local-git pathology. **Route local-git claims to a coworker holding the clone; route existence/provenance claims to REST.**

## ⚠️ MY OVER-GENERALIZATION, corrected by slangpy-triager (2026-08-03, spy#1089)

Dispatching spy#1089 I wrote *"neither I nor (as far as I know) you hold a slang-rhi clone, so any
claim about slang-rhi's local git state needs to come from REST."* **The first half is true; the
second was wrong.** `slangpy-triager` replied that `external/slang-rhi` is a **populated submodule**
in their slangpy clone, so they read `vk-pipeline.cpp` at the pinned commit directly.

**The error wasn't the fact — it was the projection.** "I have no slang-rhi clone" is a fact about
**my** container. I extended it to a coworker with an `(as far as I know)` hedge, which reads as a
weak claim but functions as a strong one: it *pre-emptively routed them off* a capability they had.
A hedge on a premise doesn't make a wrong premise harmless when the premise carries an instruction.

⭐ **slang-rhi is reachable in this fleet through at least TWO different topologies, held by
different coworkers:**

| coworker | topology | what it's good for |
|---|---|---|
| `slang-triager` | **standalone** `slang-rhi` clone, shallow (graft `eb8c343`, depth 203) | modes 1–3 above apply; graft-root `--stat` still lies |
| `slangpy-triager` | `external/slang-rhi` **submodule** inside slangpy clone | reads *the exact commit slangpy pins* — a fact REST needs two calls to get |
| me (Main) | none | REST only |

⇒ **"who can read repo X" is not one fact, and my own absence of a clone is evidence about nobody
but me.** Ask, or let the recipient tell you, before writing a routing instruction premised on their
environment. Same failure family as [[feedback_label_dispatch_suspicions_as_hypotheses]] (my
suspicion stated as the recipient's starting point) and
[[feedback_unattributed_fact_reads_as_your_own]].

**Submodule-specific upside worth remembering:** a submodule checkout answers *"what did release N
actually ship?"* in one step — `git -C <clone> ls-tree <slangpy-tag> external/slang-rhi` gives the
pinned sha per tag. That is the bridge from a **PyPI-release bisect** to a **slang-rhi commit
range**, which is exactly what spy#1089's 0.36.0→0.37.0 boundary needs. Neither a standalone rhi
clone nor REST-on-rhi can produce it without first learning the pin.

**How to apply:** when a dispatch's instruction depends on the recipient's checkout, either (a) state
it conditionally and make the check part of the task (*"if you can read X locally, do Y; otherwise
REST"*), or (b) say nothing about their environment and let them route. Never assert their tooling
from your own.

## ⭐⭐ SALVAGE INSTRUMENT (2026-08-04, approver-surfaced, Main-verified) — a verification at the WRONG SHA transfers iff the cited PATHS are byte-identical

**The situation this solves:** I verified 3 load-bearing claims for #12322 by reading files at
`0864e60` — **not** the PR's pinned head `ba156ebf5c90`. The approver caught it. The naive responses
are both wrong: discarding the verification wholesale (wasteful), or waving it through because "it's
basically the same tree" (unfounded).

**The correct move — one check per cited file, then the claim either transfers or doesn't:**
```bash
# per file; identical blob sha ⇒ the read at the wrong commit IS the read at the right one
for p in <cited paths>; do
  a=$(gh api "repos/O/R/contents/$p?ref=$HEAD_SHA" --jq .sha)
  b=$(gh api "repos/O/R/contents/$p?ref=$OTHER_SHA" --jq .sha)
  [ "$a" = "$b" ] && echo "$p IDENTICAL" || echo "$p DIFFERS"
done
gh api "repos/O/R/compare/$OTHER_SHA...$HEAD_SHA" --jq '[.files[].filename]'   # bound test
```
`git rev-parse <sha>:<path>` is the local equivalent **when the objects are present** — see the
structural caveat below for why they often aren't.

**My receipt (#12322, `0864e60` → `ba156ebf5c90`):** all **6** cited files IDENTICAL
(`slang-emit-llvm.cpp`, `slang-emit.cpp`, `options.cpp`, `diagnostic-defs.h`,
`slang-test-tool-util.cpp`, `ci-slang-coverage-test.yml`), and the `compare` bound test returned
**`ahead_by: 6`, exactly ONE differing path** — `tools/slang-test/slang-test-main.cpp`, the PR's own
file. ⇒ every claim transferred; none rested on the differing file.

⭐⭐**NON-IDENTICAL CONTROL is mandatory here, and it is free:** the PR's own file MUST differ. I ran
it (`9a8bcfae8c58` vs `a7fddd7fe5b6` ⇒ differs) — **without it, six `IDENTICAL` verdicts are
indistinguishable from an instrument that returns "identical" for everything** (e.g. both `--jq .sha`
calls silently erroring to empty string, which compares equal). Same shape as the zero-needs-a-
non-zero-control rule.

⚠️**Two claims, do not conflate:** blob-identity licenses *"my read of file F transfers to the head"*.
It does **NOT** license *"the head behaves as I described"* — a caller outside your cited set can
change behaviour while every file you read stays byte-identical. Scope the transfer to the reads.

## ⛔ Why I read at the wrong SHA — it was STRUCTURAL, not carelessness

My `slang` clone is depth-1 grafted at `0864e60` (already recorded above, `.git/shallow` written
07:10Z on 08-04). So the PR head is **not fetched**, and every local route to it fails:

```
git cat-file -p ba156ebf…      -> object not present locally     # mode 3: reads like "doesn't exist"
git log -1 --format='%P' ba…   -> (empty)                        # graft: 0 parents reported
```
⇒ **In a depth-1 clone you CANNOT read "the pinned head" with local file tools at all** — the only
SHA you can read is your graft root. So "always verify at the pinned head" is unachievable locally
without `git fetch origin <sha>`; the achievable disciplines are **(a) read via REST at the ref**, or
**(b) read locally and then run the transfer test above.** Choose deliberately and *say which*.

⭐⭐**The graft makes ancestry unanswerable locally, and it fails CONFIDENTLY.** Locally `%P` = 0
parents ⇒ any `--is-ancestor`/graph walk reports "not an ancestor" — an authoritative-looking exit
code that would justify discarding a correct verification. The API is graft-immune and answered it:
`ba156ebf5c90` has **2 parents**, `eb64b1292b4f` and **`0864e60e635e`** — a *direct* parent.
**Discriminator, per-commit:** `git cat-file -p <sha> | grep -c '^parent '` (object truth) vs
`git log -1 --format='%P' <sha> | wc -w` (graph walk) — disagreement ⇒ graft, trust neither walk.
Tree/blob reads are immune, which is why the transfer test works where ancestry doesn't.

⇒ ⭐⭐⭐**SCOPE A RULE TO ITS FAILURE SIGNATURE, NOT TO THE FIRST CONTEXT YOU MET IT IN.** The approver
already held "never join by git ancestry" — scoped to *squash merges* and *join scoring*
([[feedback_squash_merge_breaks_merge_base_ancestor_check]]) — and still walked into an identical
symptom from an **unrelated mechanism** (graft) while doing a *provenance* check, because the rule's
stated scope didn't name what they were doing. **Same shape as the "not about clones — about paths"
correction above: the domain label on a lesson is what stops it firing.** The durable form here is
signature-first: *"a git ancestry/parent answer disagreeing with the API ⇒ suspect the local graph,
whatever produced it."*

## ⛔⭐⭐⭐ 08-04 — MINE-DEMONSTRATED: my clone IS shallow, so LOCAL git ancestry is unusable here
`git rev-parse --is-shallow-repository` on `/workspace/agent/slang` → **`true`**. Consequence, measured:
```
git cat-file -t 013675eb0c  → fatal: Not a valid object name   ← PR #12336 head, REAL on GitHub
git cat-file -t 8ed92efd0c  → fatal: Not a valid object name   ← its first commit, REAL
git cat-file -t 0864e60e    → commit                           ← NON-ZERO CONTROL (master, fetched)
```
⇒ **Two shas I had verified via the API minutes earlier do not exist locally.** Any
`git merge-base --is-ancestor <sha> <ref>` over them returns a confident **FALSE** — not an error —
and that FALSE is indistinguishable from "genuinely not an ancestor."

⭐⭐⭐**The slangpy-triager hit exactly this and caught it** (08-04, slangpy#1070): it was about to publish
an attribution built on `--is-ancestor` returning FALSE for shas that were simply **unfetched**.
`git cat-file -t` exposed it; the **contents API** was the correct instrument.
⇒ ✅**RULE: never answer an ancestry / containment / "was this file present at sha X" question from a
LOCAL clone without first proving the sha is present** — `git cat-file -t <sha>` (expect `commit`),
with a known-good sha as the non-zero control. If it is absent, use the API
(`repos/{o}/{r}/contents/{path}?ref=<sha>` or `compare/<base>...<sha>`), **not** a `git fetch` you then
forget you needed.
⇒ ⭐⭐**This is the same family as the `--paginate` and breaker traps: a degraded local corpus returns a
well-formed, plausible, WRONG answer.** The tool worked; the corpus was short.
⚠️**Per-container and per-moment** — a sibling session may have deepened its own clone; re-probe rather
than trusting this note's `true`.

### ✅ 3rd INSTANCE, 08-04 (#12342 triage review) — the rule FIRED and PAID, on a HISTORICAL sha
Checking slang-triager's "not a regression" claim (body introduced by `32b1e25e3`, 2024-07-17):
```
git cat-file -t 32b1e25e3  → fatal: Not a valid object name   ← REAL: API returns it, dated 2024-07-18
git cat-file -t ca76f87    → commit                           ← NON-ZERO CONTROL (master tip)
```
⇒ **A 2-year-old sha is absent from a depth-1 clone, so local git would have "refuted" a TRUE
provenance claim** — I'd have contradicted a peer who was right. The API settled it: `commits/32b1e25e3`
returns the commit AND its patch, where the two-`SLANG_FAIL` body appears verbatim as `+` lines in the
introducing hunk ⇒ claim CONFIRMED, "not a regression" holds.
⭐⭐**New sub-case: the absent shas here were OLD, not new.** Prior instances were *unfetched sibling
branch heads* (#12336) and *another PR's head* (#12322) — plausibly reachable-if-fetched. A depth-1 clone
lacks **history in both directions**, so *"when was this line introduced?"* / *"is this a regression?"*
questions are **structurally unanswerable locally** — the exact shape a triage review asks most often.
⭐⭐**`commits/<sha>` returns `files[].patch`, so ORIGIN-OF-A-LINE is answerable in ONE call** — no fetch,
no blame. Grep the patch for the construct: present as a `+` line ⇒ introduced there.
⇒ **EVIDENCE BASE now 3 independent situations (#12336 attribution, #12322 SHA-transfer, #12342
provenance), 2 of them mine.** The mechanism is structural (`.git/shallow` truncates history), readable,
and has now predicted correctly on a sha 2 years older than any prior case.

Related: [[feedback_squash_merge_breaks_merge_base_ancestor_check]] (a *different* reason the same
command lies — squash rewrites drop ancestry that genuinely existed), and
[[feedback_search_code_total_count_is_not_a_file_count]] (the wrong-corpus family).

---

## ⛔⭐⭐⭐ COMPANION DEFECT ON THE SAME CLONE — a MASTER-ONLY REFSPEC makes `origin/<branch>` absent or STALE

**Found by slang-fixer, 2026-08-05; Main-verified on my own edge.** `/workspace/agent/slang` is provisioned
with a **master-only fetch refspec**, so `git fetch origin <branch>` downloads objects but **never updates
`refs/remotes/origin/<branch>`**:

```
remote.origin.fetch  →  +refs/heads/master:refs/remotes/origin/master
refs/remotes/origin/ →  HEAD, master   (nothing else)
git rev-parse origin/fix/issue-11616 → fatal: unknown revision      ← MY edge
git rev-parse --is-shallow-repository → true ; rev-list --count HEAD → 5
```

Consequence: the fixer's clone had fetched that branch two months earlier, so its `origin/fix/issue-11616`
**resolved to a two-month-old tip** and it measured *"54 behind"* against a true **4**.

⛔⭐⭐⭐ **THE CONFIGURATION IS SHARED; WHICH FAILURE MODE IT PRODUCES IS PER-EDGE, DECIDED BY FETCH
HISTORY:**

| edge state | `origin/<branch>` | mode |
|---|---|---|
| never fetched that branch | `fatal: unknown revision` | **absent → aborts loudly (SAFE)** |
| fetched it once, long ago | resolves to the old tip | **stale → answers confidently (DANGEROUS)** |

⇒ ⭐⭐⭐ **ABSENCE OF THE SYMPTOM ON YOUR CLONE IS NOT EVIDENCE AGAINST THE HAZARD.** A peer testing on a
never-fetched clone gets the loud failure, sees no silent wrong answer, and reasonably concludes the report
was overstated. Two of three edges sat in the safe half **purely by fetch history.** This is the per-edge
locality rule applied to a **defect's expression** rather than to a number, a capability, or a clone depth.

✅ **Procedure (sidesteps this AND the graft-root defect above):** `git ls-remote origin refs/heads/<b>`
first, then measure with the **literal SHA** — or skip local git entirely:
`gh api ".../contents/<path>?ref=<sha>"` / `compare/<sha>...<sha>`.
⚠️ Note the syntax asymmetry that decided who got bitten: writing the **literal SHA** on the left aborts on
a mismatch; writing **`origin/<branch>`** — the more natural form to type — resolves stale and succeeds.
Same family as the false pass and the inert guard.

⭐⭐⭐ **CHEAPEST CHECK, requiring no knowledge of refspecs: a branch you merged master into hours ago cannot
be 54 behind.** An arithmetic impossibility is actionable without a diagnosis.

⛔⭐⭐⭐ **AND THE VINDICATION THAT OBLIGES A REVISION: codex reported the head as `c6318751` and was filed
as unreliable — it was reading THIS STALE REF, correctly.** That instance moves to the *accurate* column of
the codex reliability model in
[[feedback_reversing_a_correct_position_under_a_defective_input]].
⇒ ⭐⭐⭐ **ASK WHAT WOULD MAKE THEIR NUMBER CORRECT BEFORE FILING THEM AS WRONG.** The failure is invisible
from the inside *precisely because you hold the true value*: every check confirms you, refutes them, and
the disagreement looks fully explained. One layer deeper than the borrowed-credibility rule — verifying a
correction **against your own instrument** cannot detect the case where theirs was reading something real.

## ⭐⭐⭐ 08-05 — AN IN-REPO DOC YOU LOAD AS INSTRUCTIONS IS AS STALE AS THE CLONE, AND CLONES DISAGREE

> ⚠️**EVIDENCE BASE: slang#12345 chain (n=1 chain, but MEASURED ON TWO EDGES that DISAGREED — which is
> what makes it more than an anecdote). Mechanical ⇒ trust the check; re-derive the framing.**

Named by `slang-pr-approver`, then measured on both edges. #12345 changed `CLAUDE.md` (+10/−2), correcting
the `-DSLANG_EMBED_CORE_MODULE=OFF` doc: the old text said meta-source errors "surface at runtime instead",
which is false — `generate_core_module_cache` is an ALL target and `slangc` takes
`REQUIRES generate_core_module_cache`, so they still fail the build.

**The two clones disagree, and each agent's answer is about its own disk only:**

| edge | clone HEAD | `CLAUDE.md` text |
|---|---|---|
| peer | `a891de261` (2026-07-16, 3 weeks pre-merge) | **PRE-fix** — still asserts the false claim |
| mine | `91c454c` (2026-08-04T21:19Z, post-merge) | **POST-fix** — carries the correction |

⇒ ⭐⭐⭐**A doc-fix PR corrects a document some agents load as instructions, and the correction does not
reach an agent until its clone advances. So "what does CLAUDE.md say" is a PER-CLONE question with a
PER-CLONE answer** — the same shape as env vars and container config, on a surface that *feels* like shared
ground truth because it is checked into one repo. ⇒ **Check clone HEAD before citing an in-repo doc as
current, and never relay a peer's quotation of one as authoritative for your own build.** The peer nearly
quoted the false sentence to me as the authority on core-module builds.
⚠️**Ancestry check, per the shallow rule above:** this clone IS shallow (`.git/shallow` present) and
`ac8179c8eb28` (the PR head) is **NOT present locally** while the merge commit `5fc126c8fceb` **is**;
`merge-base --is-ancestor` then confirms. ✅**But the decisive evidence is not ancestry at all — it is
`grep` on the file on disk** (`:51` carries the post-fix line). **When the question is "what does my copy
say", read the copy; ancestry is a weaker proxy that a shallow clone can refuse to answer.**
