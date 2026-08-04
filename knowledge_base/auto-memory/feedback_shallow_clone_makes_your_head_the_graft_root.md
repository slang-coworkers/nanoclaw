---
name: feedback_shallow_clone_makes_your_head_the_graft_root
description: "A depth-1 clone makes YOUR OWN checked-out head the graft root, so `git show --stat <head>` reports the whole tree as added — verify diffs/provenance via REST, and never from local git in a shallow clone"
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

⚠️ **Per-clone, not durable:** base `/workspace/agent/slang` is `is-shallow = false` (unshallowed
during #11917), but that is a property of one checkout at one time. **Run the check; don't inherit
the conclusion.**

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
