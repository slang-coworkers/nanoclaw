---
name: project_slangpy_925_manylinux_2_28_version_override
description: "slangpy#925 manylinux_2_28 wheels — approver ABSTAIN_POLICY (100% protected-path); real 🟠 regression (Linux wheels lose SLANGPY_VERSION_OVERRIDE) CONFIRMED by executing cibuildwheel 3.4.1's own resolver; PR armed to auto-merge; approval provenance claim corrected."
metadata:
  node_type: memory
  type: project
  originSessionId: webhook-slangpy-925-2026-08-05
---

# slangpy#925 — "Support manylinux_2_28 wheels" (jkiviluoto-nv)

Head `4743d90ff367` · branch `manylinux-2-28` → `main` · opened 04-09, still open
08-05 · `Fixes #924` · diff **2 files, +13/-5**
(`.github/workflows/wheels.yml` +4/-3, `external/CMakeLists.txt` +9/-2).

## Approver verdict (slangpy-pr-approver, 2 dispatches on the canonical thread)

**ABSTAIN_POLICY · `CLAUSE_FAIL:no_protected_paths`** @ `4743d90ff367`, mode
`live_late`, policy `v0-shadow`. Ledger row written; **nothing posted to
GitHub**; no reviewer/fixer dispatched. Artifacts (its filesystem, not mine):
`work/925-4743d90ff367/`.

Diff is **100% protected-path** — a double hit (`.github/**` + `**/*.yml`;
`external/**` + `**/CMakeLists.txt`). Other 5 clauses pass, none `unevaluable`
in the final evaluation (two were on its first pass and resolved).

**slang#10777 dependency DISCHARGED** — merged 04-13, and the pinned
`SGL_SLANG_VERSION "2026.12"` (`external/CMakeLists.txt:85`) ships **both**
`slang-2026.12-linux-{x86_64,aarch64}-glibc-2.28.tar.gz`. A stale CodeRabbit 🔴
claiming the aarch64 asset was missing reasoned about v2026.5.2 — moot.

## The real finding: Linux wheels lose `SLANGPY_VERSION_OVERRIDE` — CONFIRMED

Surfaced by head-current CodeRabbit (🟠 Major), missed by the approver's
first-pass challenger, caught by its critique gate. **I confirmed it by
executing the pinned tool's own resolver, not by reasoning about precedence:**

```
wheels.yml:126  cibuildwheel==3.4.1     # the pinned version
wheels.yml:24   CIBW_ENVIRONMENT:       "BUILD_RELEASE_WHEEL=1"                              # workflow-level
wheels.yml:25   CIBW_ENVIRONMENT_LINUX: "BUILD_RELEASE_WHEEL=1 CMAKE_ARGS=-DSGL_...=ON"      # NEW in this PR
wheels.yml:133  CIBW_ENVIRONMENT:       "BUILD_RELEASE_WHEEL=1 SLANGPY_VERSION_OVERRIDE=…"   # step-level `Build wheels`
```

Step-level `env:` overrides workflow-level **for the same key** — but `:133`
never sets `CIBW_ENVIRONMENT_LINUX`, so the new workflow-level value survives
into the step and wins on Linux.

**MINE-MEASURED, `pip install cibuildwheel==3.4.1` in a venv then calling
`OptionsReader.get('environment', option_format=EnvironmentFormat())`:**

| env passed | platform | resolved | `SLANGPY_VERSION_OVERRIDE` |
|---|---|---|---|
| `CIBW_ENVIRONMENT` only (pre-PR) | linux | `BUILD_RELEASE_WHEEL=1 SLANGPY_VERSION_OVERRIDE=…` | **present** |
| both keys (post-PR) | **linux** | `BUILD_RELEASE_WHEEL=1 CMAKE_ARGS=-DSGL_SLANG_GLIBC_COMPAT=ON` | **ABSENT** |
| both keys | windows | `…SLANGPY_VERSION_OVERRIDE=…` | present |
| both keys | macos | `…SLANGPY_VERSION_OVERRIDE=…` | present |

**Controls:** merged-both-markers → `False` (⇒ REPLACE semantics, not merge);
glibc flag present on linux → `True` (⇒ resolver live, not a dead probe).
Source agrees: `options.py:741` reads `environment` with **no `env_rule`** ⇒
`InheritRule.NONE`, and `_apply_inherit_rule` returns `after` unconditionally on
`NONE`. **No rescue path** — no `CIBW_ENVIRONMENT_PASS` in the workflow, no
`[tool.cibuildwheel]` in `pyproject.toml`.

**Blast radius:** `nightly` only, where `:109` computes
`SLANGPY_VERSION_OVERRIDE=${MAJOR}.${NEXT_MINOR}.0.dev${dev_n}` into
`$GITHUB_ENV`, consumed by `setup.py:152-156`. Linux dev wheels would carry the
`sgl.h` version while Windows/macOS wheels in the same run carry the dev
version — and get published that way. **One-line fix:** add
`SLANGPY_VERSION_OVERRIDE=…` to `:25`, or set `CIBW_ENVIRONMENT_LINUX` at `:133`.

## Provenance CORRECTED — the approval POSTDATES the defect

Approver wrote *"`ccummingsNV`'s 07-29 approval predates it."* **Measured
false.** Full derivation and the general rule:
[[feedback_a_reviews_commit_id_can_postdate_the_review]].

- `CIBW_ENVIRONMENT_LINUX` is present at **`6286baba0908` (04-09) — day one**.
- Step-level `SLANGPY_VERSION_OVERRIDE` is **absent** at `6286baba0908` and
  `6cfb1df2149f`, **present** from `e5f2299b2b63` (06-23) — it arrived from
  **main**, not from this PR.
- ⇒ the collision was **born 06-23**; the 07-29 approval **postdates it by ~5
  weeks**. Stronger escalation reason, not weaker.
- Also: that review's `commit_id` = `4743d90ff367`, whose **committer_date is
  08-05T12:55:32Z** and whose main-side parent `08ae47a4ed66` is 08-04 — the
  commit did not exist on 07-29. `commit_match` still read `pass`.

## What actually clears `BEHIND` — MEASURED, and it is a deliberate human act

⛔**`BEHIND` does NOT self-clear on the evidence, and the "next push to main"
theory is wrong — another push makes #925 *further* behind.** Verified
independently (16:0xZ):

```
compare main...4743d90ff367 → status=diverged  ahead_by=4  behind_by=1
main head = 507b4cf1649b @ 13:32:42Z  ←  #1078's OWN MERGE is the blocking commit
#925 last commit 4743d90ff367 @ 12:55:32Z, armed 12:55:44Z  (12s later ⇒ CURRENT when armed)
#1078 last commit 06e7ddad232a @ 12:53:03Z, armed 12:53:13Z  (10s later ⇒ CURRENT when armed)
```

⇒ **#1078 was never `BEHIND` when armed** — it had been manually main-merged ten
seconds earlier — so **it was never a precedent for `BEHIND` self-clearing.** My
caveat ("cannot tell whether #1078 was BEHIND") was the right one to hold, and the
approver settled it by reading #1078's own commit rather than reasoning about
strict mode. ⭐⭐**Two PRs armed 2.5 min apart, and the FIRST ONE'S MERGE is what
stalled the second.**

⇒ **The clearing trigger is `Update branch` / an author main-merge — a deliberate
human action on this specific PR.** Consequence cuts both ways and both halves
belong in a report: ✅**no ambient race** (it will not fire unattended on a random
push), ⛔**but whoever clears it is doing so INTENTIONALLY TO MERGE, so auto-merge
fires immediately with zero window for a comment to be read first** ⇒ **a comment
must precede the Update click, not some passive event.**

⚠️**Limit, stated:** branch protection is **403 for both of us**
(`Resource not accessible by integration`) and `rulesets` returns empty ⇒ **cannot
rule out a repo-level auto-update setting.** The evidence shows the *observed*
clearings were manual; it does not prove nothing automatic exists.

⭐⭐⭐**Method note — this is the chain's closing instance of its own rule: I declined
to guess the trigger (having been wrong on 3 mechanism claims today), and the
answer turned out to be MEASURABLE from an artifact neither of us had opened —
#1078's last commit timestamp.** "I can't tell which" was correct *and* premature:
**the honest refusal to guess is not the end of the enquiry, it's the prompt to
find the artifact that settles it.**

## Operational state (measured 08-05 ~14:00Z) — NOT awaiting a human

```
reviewDecision: APPROVED   mergeable: MERGEABLE   mergeStateStatus: BEHIND
autoMergeRequest: {enabledAt: 2026-08-05T12:55:44Z, enabledBy: ccummingsNV, SQUASH}
```

⛔**Auto-merge (squash) is ARMED.** The only thing holding it is `BEHIND` — main
moved to `507b4cf1649b` at 13:32Z. Next main-merge/update lands this PR **with
the regression**. The approver's `next-action: human review by szihs` was
therefore wrong about the operational state.

## CI is green and says nothing about this change

- Combined status `success` covers only `license/cla` + `CodeRabbit`.
- 17 check-runs: 15 success, 2 `skipped` (`bridge`, `Claude Code Assistant`).
- ⛔**`wheels.yml:3` is `workflow_dispatch:`-only** — no `push`/`pull_request`
  trigger, and no other workflow dispatches it (`ci.yml` merely
  **`paths-ignore`s** it at `:12`/`:21`; `ci-gcp.yml`'s references are
  commented out). ⇒ the authoritative wheel build **never runs on a PR branch**.
- `ci.yml` at head: `SGL_SLANG_GLIBC_COMPAT` → 0 hits, `CMAKE_ARGS` → 0 hits
  (control: `cmake` → 3) ⇒ every `ci.yml` leg takes the CMake default **OFF**.
- ⇒ **green CI does not exercise the changed `=ON` path at all.** Unobserved:
  glibc-2.28 tarball resolve/link, `yum install -y epel-release … clang` on
  AlmaLinux 8, `manylinux_2_28` auditwheel tag — i.e. **the PR's own three-item
  test plan**. Related class: [[project_slangpy_1066_ci_pathsignore_stuck_checks]].
- CodeRabbit's config excludes `!external/**` ⇒ `external/CMakeLists.txt`, the
  file building the download URL, is **unreviewed by any bot**.

## `APPROVER_CI_GATE` was OFF — established behaviourally, not from an env read

The approver asked me to check whether the gate was on (it was woken 90s after a
push, which the gate exists to prevent). ⛔**My first instinct — `grep
APPROVER_CI_GATE .env` — was a FALSE ZERO: there is no `.env` in
`/workspace/agent/nanoclaw-kb` at all** (only `.env.example`). The positive
control caught it (`.env` = 0 lines). And per
[[feedback_every_copy_on_my_disk_never_settles_what_a_run_did]], no copy on my
disk settles what the **host process** loaded anyway — this tree is a synced
snapshot (`4c41224f`), not the running install.

**The sound instrument is the code path, which I did open:**

- `config.ts:318-320` — `APPROVER_CI_GATE` defaults **OFF** (empty string fails
  the `/^(1|true|yes|on)$/i` test).
- `webhook-github.ts:657` — park guard is `APPROVER_CI_GATE && event.headSha`,
  returning `'parked'`.
- `github-webhook-server.ts:347` — a reviewable event passes
  `headSha: reviewablePr.head.sha`, **always populated** on a `pull_request`
  payload. ⇒ for this event class the guard **reduces to `APPROVER_CI_GATE`
  alone**.
- I was delivered immediately ⇒ `'parked'` was not returned ⇒ **gate OFF.**

⚠️**The task string is NOT a discriminator** — I checked and nearly used it.
`releaseParkedReviewable` (`:721`) deliberately omits `headSha` and **re-enters
the same function**, so parked-then-released and never-parked emit
**byte-identical** content. The discriminator is **timing**: a released delivery
waits on a `check_suite` success.

⇒ The settling guarantee isn't failing; **it was never armed.** Turning it on
wants `CI_GATE_REQUIRED_SUITE` set too — `config.ts:322-329` documents that when
unset, *any* successful suite releases, and this PR is the exact false-safe:
`coderabbitai` + trivial suites go green while the build is still running.

## MINE-MEASURED: `ci_green_on_sha` was BUILD-BLIND at decision time

Extends the approver's own `:184`/`:190` finding with a second, independent
mechanism on the same clause:

```
head pushed                     12:55:32Z
approver decision (clause pass) ~13:10Z
build suite actually completed   13:44:09Z   ← 34 min AFTER the "pass"
```

`gh api commits/$SHA/status` returns contexts **`["license/cla","CodeRabbit"]`
only** — the legacy commit-status surface **structurally cannot see Actions
check-runs**, where every `build (...)` leg lives. So `ci_green_on_sha` read
`success` while `build (windows, x86_64, msvc, Release, 3.10)` was still
`in_progress`. Same-moment re-measurement of both surfaces confirms the split
(combined `success` / GraphQL rollup `SUCCESS` only *now*, post-settle).

**FLEET MEASUREMENT (default-branch heads, 08-05) — the ratio, and one
correction to the worst case:**

| repo | combined-status | check-runs |
|---|---|---|
| `shader-slang/slang` | **2** (`license/cla`, `SlangPy Tests`) → `success` | **278** |
| `shader-slang/slangpy` | **0** → **`pending`** | 48 |
| `shader-slang/slang-rhi` | **0** → **`pending`** | 81 |

⚠️**The approver's stated worst case — "a repo with no third-party status
posters returns `total_count: 0`" — is FAIL-SAFE, not fail-dangerous:** a
zero-count combined status returns **`state: "pending"`**, which no sane clause
reads as green. **The dangerous configuration is the one we actually hit: ONE
trivial integration green ⇒ a confident `success`.** So the exposure is not
"repos without posters", it is **repos with exactly the wrong posters** — and
`slang` is the worst case in the fleet, where 2 contexts (one of which is a CLA
bot) speak for **278** check-runs.

⇒ ⭐⭐**A `ci_green_on_sha` built on the combined-status API is not a weak check,
it is the wrong instrument** — it would report green on a repo whose entire
build lives in Actions. The gate's own comment
(`github-webhook-server.ts:315-316`) says the gate exists to replace this
"in-session `ci_green_on_sha` self-check that was blind to Actions check-runs" —
**the defect is documented in-tree and the replacement is switched off.**

## Public-visibility audit — I was WRONG that the defect was "already public"

⛔**I told the operator twice that the regression was "public via CodeRabbit, so
no post is owed." The approver falsified it and I re-measured: TRUE that the text
exists, FALSE that a reader sees it.**

- The **only** carrier is review body `4864639746`. **0 inline comments** mention
  `SLANGPY_VERSION_OVERRIDE` (positive control: 3 inline comments do exist), and
  **0 issue comments** (the sole one is CodeRabbit's 04-09 walkthrough).
- In that body the finding sits **two `<details>` deep** — outer
  `⚠️ Outside diff range comments (1)` (line 8-9), inner
  `.github/workflows/wheels.yml (1)` (11-12), finding at line 16. It is
  **outside the diff range**, which is *why* CodeRabbit could not inline it.

⇒ ⭐⭐⭐**"The API returns it" is not "a human sees it."** I grepped a body for a
string, got 4 hits, and reported *public* — a claim about **rendering** answered
with a claim about **content**. The collapsed-`<details>` case is the exact shape
where those two diverge, and it is the normal shape for any finding whose target
line is outside the diff.

⚠️**Conversely the approver over-corrected on the other half, and it holds:**
`AutoSquashEnabledEvent` **is** a first-class public timeline node
(GraphQL-verified: `12:55:44Z`, actor `ccummingsNV`) ⇒ **nobody needs to post the
auto-merge fact.** So the two halves swapped: the fact I thought needed posting
is public, and the fact I thought was public is buried.

⚠️**One thing in its sequencing to NOT inherit.** It wrote that auto-merge was
armed *"11 minutes before CodeRabbit's finding existed, so 'armed while a known
defect stands' isn't the sequence."* True about the **finding** (12:55:44Z vs
13:06:26Z ⇒ 10m42s) and it does clear the maintainer of arming *against a posted
report*. But the **defect** has been in the tree since **06-23**, and the
arming is **still active now, after the finding**. ⇒ ⭐⭐**this is the two-birthdays
error again in a new costume: dating a risk from when a BOT REPORTED it rather
than when the CONDITION arose.** The live state is "armed, with a standing
finding," regardless of which arrived first.

## Onset: the merge — and the "textually clean merge" story is FALSIFIED

The approver refined the birthday to the **merge** `e5f2299b2b63` rather than
either conjunct, and that is **correct**. I verified its parent table with a
positive control per fetch (`name: wheels` = 2 on every ref):

| ref | date | `_LINUX` | step-level override |
|---|---|---|---|
| `6cfb1df2149f` (branch parent) | 04-30 | **1** | 0 |
| `2c253730768a` (main parent) | 06-23T07:43Z | 0 | **1** |
| **merge `e5f2299b2b63`** | 06-23T16:47Z | **1** | **1** ⇒ defect |

Neither parent carries the defect; the merge co-locates them, and because
`_LINUX` **replaces** rather than extends the global, that is the first commit
where the override is shadowed on Linux. Three candidate birthdays — 04-09 (one
conjunct), 06-23-merge (the condition), 08-05 (the observation) — **only the
merge is right.**

⛔**But its accompanying story — "the merge was almost certainly textually clean;
git merges text, not meaning; no conflict marker would have fired" — is FALSE,
and I replayed the merge to check rather than accept it.** Two instruments:

```
git merge-file  (my approximation) → exit 1, 3 conflict markers
git merge-tree  (git's OWN machinery, authoritative):
  CONFLICT (content): Merge conflict in .github/workflows/wheels.yml   ← THE defect file
  CONFLICT (modify/delete): .github/workflows/wheels-dev.yml
  Auto-merging external/CMakeLists.txt                                 (clean)
```

**The conflict marker DID fire, in the exact file that carries the defect.** The
author resolved `wheels.yml` **by hand** and, in resolving it, produced the
shadowing pair — keeping A's `_LINUX` line, taking B's quoted global and its
step-level override:

```
base : CIBW_ENVIRONMENT: BUILD_RELEASE_WHEEL=1
A    : + CIBW_ENVIRONMENT_LINUX: "…GLIBC_COMPAT=ON"      + epel-release in BEFORE_ALL
B    : CIBW_ENVIRONMENT: "BUILD_RELEASE_WHEEL=1"         + :132 step-level override
actual: BOTH — A's _LINUX (:25) AND B's step-level (:133), A's epel-release
```

⇒ ⭐⭐⭐**The generalization must change, and this is why relaying its version
would have been costly: the failure was NOT git's silence, it was the HUMAN
RESOLUTION of a conflict git correctly raised.** Filing it as
"invisible to every conflict marker" points future probes at the wrong place —
you would build a detector for silent merges and miss this entirely. The
right probe is **"was this file hand-resolved during a merge, and did the
resolution co-locate two edits that are each individually correct?"** — a
conflicted-file review, not a marker-absence detector.

⭐⭐**What survives of its insight, and it is the valuable half:** review-vs-base
still cannot see it. Against base, `:25` reads as the intended one-line addition;
nothing in the diff shows that `:133` now loses. **A check that only ever sees one
side of a join cannot see a join defect** — that part is right, and it is the same
shape as the coverage finding (17 green legs covering none of the diff).

### Refinement (approver, verified by me): loud on one conjunct, silent on the other

Replayed hunk boundaries confirm it — **the conflict region is lines 23-31 and
contains the global + `_LINUX` and nothing else:**

```
23 <<<<<<< A      CIBW_BEFORE_ALL_LINUX: … epel-release …
                  CIBW_ENVIRONMENT: BUILD_RELEASE_WHEEL=1
                  CIBW_ENVIRONMENT_LINUX: "…GLIBC_COMPAT=ON"
28 =======  B     CIBW_BEFORE_ALL_LINUX: … (no epel)
                  CIBW_ENVIRONMENT: "BUILD_RELEASE_WHEEL=1"
31 >>>>>>>
…
139  (auto-merged, purely B's)  CIBW_ENVIRONMENT: "…SLANGPY_VERSION_OVERRIDE=…"
```

The step-level override **auto-merged cleanly 108 lines below the hunk** (A had 0
occurrences of it). ⇒ **The resolver was shown a quote-style-plus-added-key
reconciliation and was NEVER shown the distant line the kept `_LINUX` now
shadows. Both halves of the hazard were never on screen together.**

⇒ ⭐⭐⭐**The probe needs TWO clauses: (1) was this file hand-resolved during a
merge, AND (2) did the conflict region contain ALL conjuncts of the hazard?** If
one conjunct auto-merged outside the hunk, then **reviewing the resolution hunk
also misses it** — you must read the whole post-resolution file.
⭐⭐**Conflict-region review is itself a one-sided view of the join** — the same
generalization one level down, which is why the join framing is the durable
artifact here and the merge specifics are not.

### Tooling trap — `git merge-tree`'s old form has an uninformative exit code

The approver flagged that on git 2.39 the 3-arg `git merge-tree base A B` "dumps
a trivial-merge diff and exits 0 — it reads as success." **I tested it and the
claim is CONFIRMED, but not by the run I first did.** My first attempt in the
slangpy clone gave `exit=128` — which *looks* like the claim failing — and the
cause was a **confound, not the tool**: `fatal: remote error: upload-pack: not
our ref … could not fetch … from promisor remote`, i.e. **my blobless
(`--filter=blob:none`) clone could not materialize a needed blob.**
⚠️**An exit code from a partial clone is a claim about the clone, not the
command.**

Clean-room test (synthetic full repo, git 2.39.5), with the **negative control
that makes it meaningful**:

| invocation | conflicting merge | clean merge | informative? |
|---|---|---|---|
| `git merge-tree $BASE A B` (3-arg) | **exit 0** | exit 0 | ⛔ **no** |
| `git merge-tree --write-tree --name-only A B` | **exit 1**, `CONFLICT` listed | exit 0, no CONFLICT | ✅ yes |

⇒ ⛔**Use `--write-tree --name-only`. The 3-arg form's exit code cannot
distinguish conflict from clean**, and its `changed in both` string appears in
*both* cases (1 hit each), so grepping for that is equally useless.
⭐⭐**Positive control on the INVOCATION, not just the result** — and the
discriminator is only established by running the **clean** case too.

⭐⭐⭐**CONTROL-DESIGN RULE (approver-found, then independently reproduced here on
a fresh harness): a negative control must differ from the positive in EXACTLY
ONE variable, and must never be a strictly EASIER instance than the real case.**
Its first clean control used two **different files** (A adds `c.txt`, B adds
`d.txt`) and `changed in both` read **1 vs 0** — a signal that looks usable and
is an artifact of varying *two* things (which files, and whether they overlap).
Re-run with the control matching the real shape — **same file, both sides edit,
non-overlapping ⇒ auto-merges clean** — and it reads **1 vs 1**:

```
CONFLICT  (A:l2 vs B:l2)   3-arg exit=0  changed_in_both=1  | --write-tree exit=1 CONFLICT=1
CLEAN     (A:l2 vs B:l10)  3-arg exit=0  changed_in_both=1  | --write-tree exit=0 CONFLICT=0
```

⚠️**A probe built on the weak control would grep `changed in both`, hit, and call
CONFLICT on every merge where both sides touched the file — clean auto-merges
included. Right answer on this PR by luck, wrong detector** — the marker-absence
failure one layer further in. ⚠️**And `e5f2299b2b63` IS same-file-both-changed,
so the weak control failed on exactly the shape that mattered.**

✅**My own table survived only because my clean case happened to append to the
SAME file** — I did not choose that shape deliberately, so my "1 hit each" was
**accidentally** measured on the right control. Per this chain's own theme,
that is a correct result that certifies nothing about the method.

⭐**The join generalization held at FOUR altitudes in this chain:** 17 green CI
legs covering none of the diff · a merge of two individually-clean parents · a
conflict hunk showing one conjunct while the other auto-merged 108 lines away ·
and a test harness varying one side while the real case varied another.

⭐**Its `cibuildwheel 3.0.0rc1 → 3.4.1` trap-avoidance is sound:** the bump is at
the head commit and CodeRabbit's explanation leans on 3.4.1 semantics, which
tempts dating the defect to 08-05. **The bump changes severity, not the
birthday** — don't let a report's chosen mechanism reset the clock.

## Third CI-trust failure mode — green *about other files* (approver-found)

Passes **both** falsifiers we filed (17 check-runs, 0 incomplete, 0 failed) and
is still a false-safe:

- all 17 legs come from `ci.yml`, and `ci.yml:12,21` lists
  `.github/workflows/wheels.yml` under `paths-ignore` for **both** `push` and
  `pull_request`;
- `wheels.yml` is `on: workflow_dispatch:` only;
- ⇒ **wheel legs among the 17 green check-runs = 0.**

And the PR's new conditional is **dead under all PR CI**:
`external/CMakeLists.txt:87` defaults `SGL_SLANG_GLIBC_COMPAT OFF`, `:100-104`
consumes it, and its **only repo-wide setter is `wheels.yml:25`** — the file no
PR CI runs. Condition-false 17×, condition-**true 0×**.

⇒ ⭐⭐⭐**A "both-directions" probe generalizes one indirection further than
written: not *a flag with no setter*, but *a flag whose only setter is outside
CI's reach*.** Coverage is a **third axis**, independent of timing (gate) and
instrument (surface): a required-suite gate would still have released onto a
green that proves nothing about this diff.

✅**I closed the 404 risk it named** — MINE-MEASURED, both assets resolve at the
pinned version: `slang-2026.12-linux-{x86_64,aarch64}-glibc-2.28.tar.gz` →
**HTTP 206** on a ranged GET; **negative control** `-glibc-9.99` → **404**. So
the URL construction is correct today; the point stands that **CI would not have
caught it if it weren't**.

## Live gate state — UNRESOLVED from either seat

⚠️**Neither of us can read it.** The approver grepped `/app/src` (container-side
runner, no webhook/github files — false zero, control fired) and correctly said
the read is mine. **But mine is also indirect:** my `nanoclaw-kb` tree is a
synced snapshot (`4c41224f`), there is no `.env` in it, and per
[[feedback_every_copy_on_my_disk_never_settles_what_a_run_did]] no copy on my
disk settles what the host **process** loaded. What I *do* have is a **behavioural**
determination (delivered-not-parked ⇒ flag off at delivery time), which is sound
for this event but is **not** a reading of live config. Logs mention the name only
in prose. ⇒ **Report it as behaviourally-inferred, never as "I read the flag."**

## "A retraction is not self-verifying" — SECOND instance, same chain family

⛔**I retracted a correct claim under a welcome correction, for the second time in
two days, in the same #1090 orbit that produced the rule.**
[[project_approver_pipeline_defects_devin_fetch_ci_green]] already carries
*"an unnecessary retraction is a real error, not humility"* — filed 08-05 when I
withdrew a correct "inert clause" claim. **The rule was in my store and did not
fire.** ⇒ ⭐⭐⭐**Proximity to a rule does not help; a maxim earns its bytes only by
naming a command to run.** Here the command is: **before sending a retraction,
measure the retracted claim the same way you'd measure an advance.**

The approver's mechanical form is sharper than the store's: ⭐⭐⭐**retreat FEELS
epistemically safe, so it gets audited LESS than advance — but the cost is
symmetric.** And its reduction is exact: *"would X have prevented Y"* is **the
one-variable rule applied to a counterfactual** — unanswerable without pinning
X's config. My unconditional "the host gate would not have prevented it" was
false-either-way because it named no configuration.

## `CI_GATE_REQUIRED_SUITE` cannot discriminate on slangpy — MINE-MEASURED

⚠️**The approver's counterfactual is right in conclusion, wrong in flag, and I
only caught it by reading the matcher** (`github-webhook-server.ts:524`):

```js
const suiteMatches = !req_ || appSlug === req_ || appName.includes(req_);
```

It matches on the **App**, and **all 7 suites at `bb870c1750cc` share
`app.slug: github-actions`** — including the 3 trivial successes
(`board-sync`, `bridge`). So `CI_GATE_REQUIRED_SUITE=github-actions` releases
**exactly as unset does**. ⇒ ⭐⭐**suite identity is not the app; a
per-app gate cannot separate two suites from the same app.**

**The working mechanism is the next branch (`:544`), `CI_GATE_REQUIRED_CHECK_RUN`**
(`owner/repo=check-name`; unlisted repos fall back, so adding one can't wedge
others). Three-way answer, measured:

| config | would it have parked #1090's premature wake? |
|---|---|
| gate alone (`REQUIRED_SUITE` unset) | **No** |
| gate + `REQUIRED_SUITE` | **No** on slangpy — one app slug for all suites |
| gate + `REQUIRED_CHECK_RUN` | **Yes on slang** (`check-ci` = `failure` @ `0740a648254f`); **not yet on slangpy** |

⛔**MECHANISM GAP, not a setting: slangpy has NO roll-up check.** Its runs are 12
individual `build (os, arch, compiler, config, py)` legs plus `pre-commit`,
`bridge`, `board-sync` — **no single name means "the build passed"**, so a
name-based gate there would pin one arbitrary leg and gate on a **sample**.
slang has `check-ci`. ⇒ **Recommended: `APPROVER_CI_GATE=on` +
`CI_GATE_REQUIRED_CHECK_RUN=shader-slang/slang=check-ci`**; slangpy needs a
roll-up job before it can be gated precisely.

## `require_ci_green: false` is AUTHORIZED — do not re-tighten

⭐⭐⭐**A signed tradeoff and a bug look identical in the JSON.** Single global flag
in `v0-shadow-wide`; its `_comment` records a deliberate human-signed widening
(haaggarwal, 2026-08-04) on 232 measured decisions — **53% ABSTAIN_POLICY, 91% of
decisive abstains later approved** — explicitly marked re-tighten-before-
enforcement. ⇒ **Reporting "the clause was waived" bare invites someone to revert
a setting made on purpose and buy back the 53% abstain rate.** The *only* defect
is the clause recording a waiver as `pass` instead of `not_applicable`
(three-outcome split: `pass` / `unevaluable` / `not_applicable`).

## 🔴🔴 RESOLVED — #925's ABSTAIN_POLICY IS SPURIOUS. Per-PR staged policy shadows the signed mount.

**Mechanism (approver-read, `eval-clauses.py:267-283`) — resolution order:**

```
1. --policy PATH
2. per-PR staged:  <workspace>/policy/APPROVAL_POLICY.json   ← WINS
3. group mount:    /workspace/extra/approver-policy/...       ← the SIGNED file
4. bundled default
```

**Precedence 2 beats 3.** #925's workspace had a `policy/` snapshot staged at
12:58 pinned to **`v0-shadow`** (8 patterns incl. `.github/**`, `**/*.yml`,
`external/**`; caps 400/30), which **shadowed** the mounted, human-signed
**`v0-shadow-wide`** (1 pattern `**/slang-tag-version.h`; caps 8000/150).
`work/925-4743d90ff367/clauses.json` records `policy_version: v0-shadow`.

⇒ **`no_protected_paths` fired on exactly the case class the widening was signed
to stop abstaining on. Under the policy a human actually signed, #925 was
`WOULD_APPROVE`-eligible.**

⛔**BLAST RADIUS — CORRECTED 21 → 4** (approver over-called it, then re-measured
era-relative; I had sent 21/57 upstream and issued a correction):

```
918-57259b457b4c   v0-shadow  staged 2026-07-22  *** STALE (in force: v0-shadow-relaxed)
1078-b76c8065612d  v0-shadow  staged 2026-08-04  *** STALE (in force: v0-shadow-wide)
1078-06e7ddad232a  v0-shadow  staged 2026-08-05  *** STALE (in force: v0-shadow-wide)
925-4743d90ff367   v0-shadow  staged 2026-08-05  *** STALE (in force: v0-shadow-wide)
--- other 17: v0-shadow-relaxed staged 07-10..08-03 = CORRECT FOR THEIR ERA ---
```

⭐⭐⭐**17 of 21 were the policy actually in force when they ran — snapshotting the
current policy at decision time is CORRECT auditability behaviour.** The
over-call came from comparing every snapshot against **today's** version instead
of the version in force **at its own timestamp**. ⇒ ⭐⭐⭐**THE TWO-BIRTHDAYS ERROR
AGAIN, now on an inventory: correctness dated from NOW rather than from WHEN THE
CONDITION OBTAINED.** Era boundaries (from the `_comment` I read):
`v0-shadow` → `v0-shadow-relaxed` **07-10** → `v0-shadow-wide` **08-04**.

⇒ ⛔**A version-drift sweep MUST be ERA-RELATIVE. The absolute form produced 21
alarms where 4 were real** — a 5× false-positive rate on a finding already sent
upstream.

⚠️**I later tried to EXONERATE this as "mislabelled, not wrong" (21 being the
correct re-derivation pre-flight) and the approver DECLINED with evidence — it was
a genuine over-call.** The sentence 21 carried was *"every one of those decisions
was made under a policy that is not the one in force"*, which is **false for the 17
era-correct pins**, and the question 21 legitimately answers arose **three rounds
later**. ⇒ ⭐⭐⭐**a later question cannot retroactively validate an earlier answer;
a number is only "mislabelled" if the claim it CARRIED was true of its referents
under a reading available AT THE TIME.** The two entries stay separate — merging
them would delete the lesson. See
[[feedback_the_more_sayable_version_wins_before_verification_runs]] for the
sign-flipped rule this produced.

**ROOT CAUSE NARROWED — not "pinning is wrong" but "staging FELL BACK":** all 4
stale snapshots are **byte-identical (`cmp`) to the skill-bundled
`scripts/APPROVAL_POLICY.json`**, while all 17 era-correct ones **differ** from it
(negative control). ⇒ **the staging step fell through to precedence 4 (bundled
default) and wrote that into `policy/`, where precedence 2 then loaded it over the
mount.** The bundled default is `v0-shadow`, which is why all 4 pin exactly that.
⇒ **FIX: staging must never fall back to bundled when a mount exists** (pinning
itself stays), plus **record the loaded policy's absolute path in `clauses.json`**
— the field that turns this class from eight-round archaeology into a one-line
read.

✅**#925's REASON CODE is spurious. Its ABSTAIN STANDS ON THE SUBSTANCE.**

⛔⛔**"#925 was WOULD_APPROVE-eligible" is WRONG and I relayed it twice.
CLAUSE-ELIGIBLE ≠ APPROVABLE — passing Step 1 only means Step 2 RUNS.** The
approver read its own Step 2 input (`work/925-4743d90ff367/review/review-doc.md`):

```json
{"_approver_result": true, "verdict": "REQUEST_CHANGES",
 "bugs": 0, "gaps": 2, "reviewers_complete": true,
 "source_tier": "fallback-coderabbit-head-current-plus-devin"}
```

⇒ With the signed policy loaded, #925 proceeds **past** the clauses and lands on
**ABSTAIN_POLICY:OPEN_GAP or BLOCK** — on the substance. ✅**Both gaps are
MINE-VERIFIED independently, which is what makes this corroborated rather than
inherited:** gap 1 = the `SLANGPY_VERSION_OVERRIDE` shadowing (`:25` vs `:133`) I
confirmed by executing cibuildwheel 3.4.1's own `OptionsReader`; gap 2 = the
missing trigger-present control on a `workflow_dispatch:`-only wheel path, which I
measured (0 hits for `SGL_SLANG_GLIBC_COMPAT`/`CMAKE_ARGS` in `ci.yml`).

⇒ **CORRECT STATEMENT: the abstain was recorded for the WRONG REASON, not for no
reason. Same verdict, sound derivation instead of an artifact.**

⛔⭐⭐⭐**WHY THIS PHRASING WAS DANGEROUS, and it is the sharpest instance of the
sayability failure in the chain:** "would have been WOULD_APPROVE" invites *"so the
approver would have approved a PR with a known one-line regression"* — **the
opposite of true**, and the kind of claim that gets a shadow-mode program shut
down. ⇒ ⭐⭐⭐**An eligibility fix changes the REASON, never the VERDICT — never
report a gate correction as an outcome change without reading the downstream
stage.**

⛔**ALSO RETRACTED: "same for `1078`×2 and `918`."** That generalized from clause
state to outcome — the identical bad inference, applied to 3 more decisions
without opening any of their Step 2 inputs. **Nobody should quote a re-derived
outcome for any of the 4 until each one's Step 2 is read individually.**
See [[feedback_the_more_sayable_version_wins_before_verification_runs]].

⭐⭐⭐**DIRECTION IS WHAT HID IT: the stale copies are MORE conservative, so the
failure mode is a SPURIOUS ABSTAIN — and an abstain reads as caution, not as a
bug.** Same family as the whole chain, inverted: not a check passing for the wrong
reason but **failing for the wrong reason**, which is even quieter because nothing
downstream complains about excess caution.

✅**CONSISTENCY CHECK I RAN (its story vs my independent record):** my 08-05 note
has `work/1090-bb870c1750cc/policy/APPROVAL_POLICY.json` = **`v0-shadow-wide`**
(fresh), while it now lists `1090-5c384a20b11b` (the *other* head) as stale.
**Different workspaces, different snapshots — no contradiction**, and the staging
mechanism *explains* the earlier 3-round bundled-vs-mounted confusion rather than
conflicting with it. ⇒ corroboration, not a new assertion.

⚠️**Single-sourced vs corroborated, stated:** the *mechanism* and the 21/57 count
rest on **its** reading (`work/925-*` is not on my filesystem; the `/workspace/inbox/a2a-*`
copies it attached earlier are **gone**). **Independently corroborated from my own
disk:** my readable `v0-shadow-wide` has ONE protected path, and the verdict cited
patterns that exist only in `v0-shadow`. Two seats agree on the discrepancy.

## ⛔ THE TELL WAS IN ITS FIRST MESSAGE AND I READ PAST IT

⛔**Its round-1 report said `policy v0-shadow`, verbatim, and every later report
repeated it — while #1090's reports said `v0-shadow-wide`.** Two PRs decided
minutes apart, reporting **two different policy versions**, and I never compared
the strings until I stumbled on the policy file eight rounds later.

⇒ ⭐⭐⭐**A version string is a claim; I treated it as a label.** It was in my
context from the first message, cost one comparison, and would have found this
immediately. ⭐⭐**Fleet rule: whenever a report carries a `policy_version` /
`schema_version` / config-version field, DIFF IT against the version in force and
against sibling reports from the same period** — a mismatch between two runs
minutes apart is a staging/caching bug, near-100% of the time.

⚠️This is the same shape as the retrieval failure earlier in the chain: **the
answer was already in my possession and novelty elsewhere consumed the attention.**

## ALL 4 RE-DERIVED (era-relative) — 1 genuine FALSE-NEGATIVE, and the framing widens

| run | recorded | failing clause | Step-2 verdict | re-derived |
|---|---|---|---|---|
| `925-4743d90ff367` | ABSTAIN_POLICY | `no_protected_paths` (`.github/**`) | `REQUEST_CHANGES`, 2 gaps | ABSTAIN_POLICY:OPEN_GAP or BLOCK — **same outcome, sound reason** |
| `1078-b76c8065612d` | ABSTAIN_POLICY | `author_trust` (CONTRIBUTOR) | `verdict: null`, `reviewers_complete: **false**` | ABSTAIN_INFRA:NO_REVIEW_SIGNAL — abstain either way |
| `1078-06e7ddad232a` | ABSTAIN_POLICY | `author_trust` (CONTRIBUTOR) | `APPROVE_WITH_NITS`, 2 gaps | **ABSTAIN_POLICY:OPEN_GAP** (Step 3 done) |
| `918-57259b457b4c` | ABSTAIN_POLICY | `head_provenance` (fork) | **`APPROVE`, 0 bugs, 0 gaps** | **WOULD_APPROVE ← FALSE-NEGATIVE** |

✅**#918 CORROBORATED FROM GROUND TRUTH I MEASURED MYSELF** (not inherited):
`head.repo.full_name = jhelferty-nv/slangpy` ⇒ **genuinely a fork**, so
`allow_fork_head: false` in the bundled default really would fire; and the human
outcome is **`ccummingsNV` APPROVED + MERGED 2026-07-22T20:25:12Z**. ⇒ **the
re-derived WOULD_APPROVE agrees with the human verdict, and the recorded
ABSTAIN_POLICY was a false-negative against the actual outcome** — precisely the
agreement-scoring signal the shadow programme exists to produce. ⚠️It ran **07-22**
under `v0-shadow-relaxed`, which **already** had `allow_fork_head: true` ⇒ **this
is NOT about the 08-04 widening; the fallback pin reverted a relaxation live for
12 days.**

⛔⭐⭐⭐**FRAMING CORRECTION — 3 of the 4 failed on clauses UNRELATED to
`protected_paths`** (`author_trust` ×2, `head_provenance` ×1). I had framed the
whole finding as a `.github/**` problem **because #925 was the case in front of
me.** The bundled default is **uniformly stricter on every axis** — corroborated
against my own readable mount on all 6:

| axis | bundled (its read) | mounted `v0-shadow-wide` (MINE-READ) |
|---|---|---|
| `trusted_associations` | 3 | **7** |
| `allow_fork_head` | false | **true** |
| `require_ci_green` | true | **false** |
| `protected_paths` | 8 patterns | **1** |
| caps | 400 / 30 | **8000 / 150** |

⇒ **a fallback pin reverts EVERY relaxation simultaneously, and which clause fires
is incidental to what that PR happened to touch.** Correct sentence for upstream:
***"a staging fallback silently reverts the container's entire policy to the
shipped conservative default"*** — **not** "the `.github/**` widening isn't taking
effect." ⭐⭐⭐**GENERALIZING A MECHANISM FROM THE ONE INSTANCE IN FRONT OF YOU
NARROWS IT WRONGLY — enumerate which clause each affected run failed on before
naming the mechanism after a clause.**

✅**RESOLVED — the `1078-06e7ddad232a` three-policy discrepancy was a REPORTING
error, and checking it surfaced a live hazard.** The Step-3 judgment loaded the
**mount** (`/workspace/extra/approver-policy/APPROVAL_POLICY.json` =
`v0-shadow-wide`), correct for an 08-05 run; `v0-shadow-relaxed` had been read from
`work/1082-c4ae89058c6e/policy/` as a **control** (to show `CONTRIBUTOR` was
already trusted 12 days pre-widening) and its name drifted into the "loaded" slot.
Outcome unchanged: `ABSTAIN_POLICY:OPEN_GAP`.

⛔⭐⭐⭐**THE HAZARD IS REAL THOUGH — THE RE-DERIVATION PATH IS BOOBY-TRAPPED.** All
four workspaces **still** carry their stale `policy/APPROVAL_POLICY.json`
(`1078-06e7ddad232a`'s is `v0-shadow`, mtime 12:56:47). Step 3 was hand-derived, so
nothing reloaded it — but **a naive `eval-clauses.py` re-run in place takes
precedence 2 and reproduces the original defect exactly.** ⇒ **the one place the
bug is GUARANTEED to recur is the workspace where it happened.** Remedy: clear the
pin or pass `--policy` explicitly; **never re-derive in place.**
⭐⭐**Cheap pre-flight, reusing the negative control already established: the stale
pins are byte-identical to the bundled default, so `cmp <ws>/policy/APPROVAL_POLICY.json
<bundle>` flags every affected workspace before re-deriving** — same test that
narrowed the root cause, run as a guard instead of a diagnosis.

⭐⭐⭐**WHY A CONTROL READ DRIFTED INTO THE AUTHORITATIVE SLOT — 4th two-artifacts
instance, and the subtlest: at the COMMAND level a control read and an
authoritative read are IDENTICAL** (both are `json.load` of a policy file).
Nothing in the act distinguishes *"this governs the decision"* from *"this is a
comparison point"* ⇒ **only labels keep them apart, and labels drift.** Both
artifacts were legitimately the reader's own; they differed **only in role.**
⇒ **Bind the role at the point of read** — carry the path with the value, never a
bare version string.

✅**AND THIS VINDICATES THE PROVENANCE FIELD AS A DETECTOR, not bureaucracy:
naming the policy is what exposed the mismatch.** *"Re-derived correctly"* carries
no tripwire. Same reason `clauses.json` must record the loaded policy's absolute
path — the field exists to make this class **self-announcing**, and its first catch
was the author of the fix. ⭐⭐**Asking for the version by name is what surfaced
it — the same move that found the original bug (4th time in this chain).**

**Step 3 on `1078-06e7ddad232a` → `ABSTAIN_POLICY:OPEN_GAP`.** Substantive gap is
a **masked GPU device-removal**: `test_array.py:499-502` skips d3d12 with *"Array
dispatch with read-only (shader_resource) Tensor input removes the D3D12 device"*;
tensors are created `usage=shader_resource` only (`:521-526`) and then cleared —
`tensor_zeros` → `tensor->clear()` (`slangpy_ext/func/tensor.cpp:442`) → `clear_buffer`
on storage (`sgl/func/tensor.cpp:412-421`). **Clearing a buffer without
`unordered_access` plausibly causes the hard fault, and the skip hides it
permanently with no tracking issue** ⇒ a masked GPU crash is a nameable gap, not a
nit. (Gap 1, PR-description-vs-actual-Metal-skips at `:496-498`, is nit-adjacent.)

⚠️**Near-miss worth more than the verdict — MINE-VERIFIED:** the review's third
(informational) finding cited `tensor.cpp:458-468`. **`src/slangpy_ext/utils/tensor.cpp`
returns 404 — the cited path does not exist**, while `slangpy_ext/func/tensor.cpp:458-468`
(`tensor_zeros_like` passing `other.usage()`) **supports** the claim and
`sgl/func/tensor.cpp:455-472` (`Tensor::with_grads` setting
`shader_resource|unordered_access|shared`) **refutes** it. **Same line range, two
real files, opposite verdicts** — the approver read the refuting one first and
nearly published "the reviewer is wrong." ⇒ ⛔⭐⭐⭐**A CITATION NEEDS ITS PATH
VERIFIED, NOT JUST ITS LINES** — `file:line` is not unique across parallel
`sgl/` + `slangpy_ext/` trees; a right number in the wrong file **reads as
precision**. Filed in
[[feedback_every_copy_on_my_disk_never_settles_what_a_run_did]].

## 🔴 SECOND false-negative — #1002, and it is a DIFFERENT CLASS the whole investigation could not have found

The approver built the ABSTAIN-vs-merged join it owed and it fired on the first
run: **28 recorded abstains → 10 HIGH → 2 strict** (same decided head, Step-2
`APPROVE`, 0 gaps):

```
slangpy#918  @57259b457b4c  clause=head_provenance     (known — staging fallback)
slangpy#1002 @34e5df38dddf  clause=no_protected_paths  (NEW)
```

✅**#1002 MINE-VERIFIED on all four load-bearing facts:** merged **2026-07-15T23:37:17Z**;
`jkwak-work` **APPROVED at `34e5df38dddf` — the exact decided head** (no revision
drift); diff **does** touch `.github/workflows/wheels.yml` (+12/−4) so the clause
fired **legitimately**; and 07-15 falls between the `v0-shadow-relaxed` (07-10) and
`v0-shadow-wide` (08-04) boundaries ⇒ **era-correct policy, NO staging bug.**

⇒ ⛔⭐⭐⭐**TWO DISTINCT CAUSES PRODUCE THE SAME RECORDED ABSTAIN, AND EACH NEEDS A
DIFFERENT INSTRUMENT:**

| cause | example | findable by |
|---|---|---|
| wrong policy loaded | #918 | version/era audit |
| **correct policy, over-strict clause** | **#1002** | **only an outcome join** |

⭐⭐⭐**A version audit answers "did we use the intended rules?" — it CANNOT answer
"were the intended rules wrong?"** Every instrument in this 14-round chain was of
the first kind, so #1002 was **structurally invisible** to all of it. ⇒ **the
instances you find are the ones some other signal happened to surface** — which is
the argument for building the detector even when you believe the set is closed.

✅**And #1002 is evidence FOR `v0-shadow-wide`, not against it:** the policy
`_comment` cites *"`no_protected_paths` fired exclusively on `.github/**` (32
cases)"* as the reason for widening — #1002 is a **measured instance of exactly
that cost**, a PR the humans approved and merged that the pre-widening clause would
have blocked. ⇒ **cite it if anyone proposes re-tightening that flag**, alongside
the 232-are-unverified-not-tainted caution.

## FINAL: FALSE-NEGATIVE SET = 8 of 28 joined abstains (29% PER-DECISION)

All 8 soft rows worked. **8/28 abstains were false-negatives; the sole genuine gap
is `#1078`@06e7ddad232a** (masked D3D12 device-removal).

⚠️**QUOTE THE DENOMINATOR OR NOT AT ALL: 28 abstains span ~10 distinct PRs
(`#1075`×9, `samples#53`×7), so 29% is PER-DECISION, not per-PR.** A multi-head PR
contributes many rows, so the per-PR rate is a different and unmeasured number.

✅**MINE-VERIFIED: all 8 are ONE change class** — onboarding a repo to `slang`'s
reusable `pr-board-sync.yml`. Titles confirm it: slangpy#1084 *"Onboard slangpy to
slang PR board-sync workflow"*, slangpy-samples#57 *"Onboard slangpy-samples to slang
PR board-sync workflow"*; #1084 merged 08-04T15:11Z, #57 merged 07-31T22:22Z, #1082
merged 07-31T13:23Z. ⇒ **pre-widening `no_protected_paths` fired repeatedly on ONE
project type and was wrong nearly every time** ⇒ **quantified, outcome-derived
support for `v0-shadow-wide`, measured from what humans did rather than from the
abstain rate.** Pair with the 232-are-unverified-not-tainted caution if re-tightening
is ever proposed.

## SEVERITY CAN REQUIRE A SIBLING FILE IN THE SAME PR, NOT JUST THE CALLEE

✅**MINE-VERIFIED at `samples#57`'s merged head `df17e0f266ef`:** the flag
*"assignment-related PR events are not among the declared triggers"* is **factually
correct** — `pr-maintenance.yml` declares 3 `types:` lists and **`assigned` count =
0** (control: `types:` = 3), while the callee does act on assignment. **But the same
PR adds `pr-sweep-nightly.yml`** — `cron: "0 7 * * *"`, calling the same
`pr-board-sync.yml@master` — bounding drift to **≤24h**. A deliberate latency
tradeoff; #1084 made the identical choice.

⇒ ⭐⭐⭐**Extends the caller/callee rule: a per-FILE view sees the trigger list without
the sweep; a caller-only view sees empty permissions without the contract. BOTH
one-sided views MANUFACTURE concerns — same structure, two different missing
sides.** ⇒ **for a delegating or multi-file PR, ask which side of the join the diff
does NOT show you**, then read that side before assigning severity.

## FALSE-NEGATIVE SET 2 → 5 (`#1084`×3), and a flag that INVERTED the intent

Approver worked 3 of the 8 soft rows: **all three `slangpy#1084` heads resolve to
`WOULD_APPROVE`** with Step-3 confirmation. All four Devin "Investigate" flags are
nits — and **one, acted on, would have made the repo LESS safe.**

✅**MINE-VERIFIED against the callee** (`shader-slang/slang/.github/workflows/pr-board-sync.yml`,
ref **`master`** — see instrument note below):

> "Cross-repo reuse: any shader-slang repo adds a thin caller workflow … (no
> `secrets: inherit`; **callers should set `permissions: {}`** because this workflow
> uses the PAT for everything, not the GITHUB_TOKEN)" — followed by a code block
> matching what #1084 wrote, and *"every input below already defaults to the shared
> board's values; callers pass only the one secret."*

The callee also sets `permissions: {}` on itself (`:177`) with the comment *"Callers
therefore need no permissions block."* And #1084's caller
(`slangpy/.github/workflows/pr-maintenance.yml:46`) matches the documented form.
⇒ **the flag "empty permissions depends on the reusable workflow" was rational from
the caller alone and points the wrong way — acting on it grants permissions the
design deliberately withholds.**

⇒ ⭐⭐⭐**FOR A PR THAT DELEGATES (reusable workflow, shared action, library call),
SEVERITY CANNOT BE JUDGED FROM THE CALLER ALONE.** The caller-only view sees "empty
permissions + a secret handed to someone else's workflow" and flags an unverified
dependency; **the resolution lives entirely in the callee, one repo over, and
nothing in the diff points there.** Two `gh api contents` calls settled all four.

⭐⭐⭐**Mirror image of this PR's CI-coverage finding** — *a check that only sees one
side of a join cannot see a join defect* — except a one-sided view here
**MANUFACTURES** a concern instead of missing one. **Same structural cause, opposite
polarity.**

⚠️**INSTRUMENT NOTE (mine): my first verification 404'd and I nearly read it as "the
callee doesn't say that."** Cause: I used `?ref=main` and **`shader-slang/slang`'s
default branch is `master`** (⚠️`slangpy` **is** `main` — **two siblings in one org
with different defaults**, which is exactly what makes `?ref=main` a habit that fails
silently on one of them). The positive control caught it: listing
`.github/workflows` *also* 404'd, impossible for a real repo ⇒ probe fault.

🔴**AND MY FILED LESSON WAS ITSELF WRONG — the approver improved it, using output I
already had on screen:**

```
wrong REF, good path : {"message":"No commit found for the ref main", "status":404}
good ref, wrong PATH : {"message":"Not Found",                        "status":404}
```

**GitHub names the bad ref explicitly.** So *"a wrong-ref failure is
indistinguishable from absence"* is true of the **status code** and **false of the
message body** — the discriminator was **free**, in the response I'd already
printed. My positive control was a valid save but more expensive than needed; it
remains the right backstop for a **typo'd path**, which does return the generic
`"Not Found"`.

⇒ **Checklist item 3 sharpens to: does the path resolve — and if not, does the error
name the REF or the PATH? Read the message body first (free), run a control second
(an API call).**

⇒ ⭐⭐⭐**META, and the second instance today of the same shape: A LESSON FILED ABOUT
AN INSTRUMENT CAN ITSELF UNDER-READ THE INSTRUMENT.** I reached for the signal I had
*asked* for (status code) and ignored the one the tool *volunteered* (message body).
**When filing an instrument lesson, check whether the instrument was telling you more
than you read.**

⚠️**Held back deliberately (approver's own discipline): 8 rows at
`APPROVE_WITH_NITS` with 2-4 gaps** (`#1078`, `#1084`×3, `samples#57`×3, `#1002`×1)
— may be legitimate `OPEN_GAP`s, each needs an individual Step-3 read. **Not
counted as false-negatives**, since generalizing from clause state is the error
already made once today.

⚠️**Retrospective constraint worth knowing: only 1 of 57 workspaces still has
`tmp/record-payload.json`;** all 57 retain `clauses.json` + `tmp/context.json`, so
the join is built from the durable artifacts, not the ledger payloads. **Anyone
planning an audit over recorded payloads should know they are mostly gone.**

✅**Direction of the whole defect: CONSERVATIVE.** 1 false-negative, 2 reason-code
corrections, 1 pending. **No decision became wrongly permissive** — which is why
nothing alerted, and why the cost is destroyed calibration signal rather than a
bad merge.

## Superseded: the earlier open-discrepancy note (kept for the reasoning)

⛔**Found 08-05 on MY OWN disk at
`/workspace/extra/ephemeral/approver-policy/APPROVAL_POLICY.json`
(mtime Aug 4 15:48, `policy_version: v0-shadow-wide`) — the file whose own
`_comment` says it is "mounted into the *-pr-approver containers at
/workspace/extra/approver-policy/":**

```json
"require_ci_green": false,
"protected_paths": ["**/slang-tag-version.h"],
"max_total_lines": 8000, "max_files": 150
```

**The verdict cited `.github/**`, `**/*.yml`, `external/**`, `**/CMakeLists.txt`.
NONE of those four appear in the mounted `protected_paths`, which holds exactly
one entry — a version header.** No glob semantics reconcile
`**/slang-tag-version.h` with `wheels.yml`, so this does **not** hinge on
matcher choice (I only had `fnmatch`, a lookalike — `eval-clauses.py` is not on my
filesystem, so I could not run the real `glob_to_re`; see
[[feedback_run_the_programs_own_predicate_not_a_stdlib_lookalike]]).

⚠️**The `_comment` makes it sharper: the widening was performed BECAUSE
`no_protected_paths` "fired exclusively on `.github/**` (32 cases, all CI workflow
/ .github docs)" — #925 IS that case class**, and it is the case the widening was
signed to stop abstaining on. Full signature: *"Human sign-off: haaggarwal,
2026-08-04"*, 232 decisions, 53% ABSTAIN_POLICY, 91% of 82 decisive abstains
approved; `max_total_lines` widened to 8000 for 3200-6718-line PRs.

⇒ **If the run loaded THIS file, `no_protected_paths` should have PASSED and the
ABSTAIN_POLICY is spurious — #925 may have been WOULD_APPROVE-eligible.**

⛔**NOT ASSERTED AS A DEFECT — this is exactly the two-artifacts trap that burned
3 rounds on #1090.** Per
[[feedback_every_copy_on_my_disk_never_settles_what_a_run_did]]: **every copy on
my disk never settles what a RUN did; only the run's loaded artifact does.** My
path is `/workspace/extra/ephemeral/approver-policy/`; the `_comment` names
`/workspace/extra/approver-policy/` (no `ephemeral/`) — **two different paths,
which is itself a candidate explanation.** ⚠️Also unreadable by me:
`APPROVAL_POLICY.json.bak-20260804` is root-owned, `PermissionError` — so I
**cannot** confirm the pre-widening pattern set, only infer it from the
`_comment`.

⇒ **RESOLUTION REQUIRED FROM THE APPROVER, not from me: print the loaded
policy's `protected_paths` array and its absolute path.** Three outcomes:
(a) loaded policy has the 4 patterns ⇒ two files, mine is stale/unused, verdict
stands; (b) loaded policy matches mine ⇒ **the verdict is spurious** and the
clause is reading patterns from somewhere other than the policy (hardcoded
defaults?); (c) path mismatch ⇒ the mount is not what the `_comment` documents.

## Gate-arming: my "asymmetry" was FALSE; the no-TTL park is the real blocker

⛔**I told the operator not to arm `APPROVER_CI_GATE` because "failure deliveries
are proven, success deliveries are assumed." That asymmetry does not exist**, and
the code settles it without consulting docs — **both branches sit INSIDE one
`payload.action !== 'completed'` early-return** (`github-webhook-server.ts:506`),
and each reads `conclusion` as a **field** of the same payload:

```
:506  if (payload.action !== 'completed') return skipped
:511  const conclusion = suite?.conclusion…
:515  if (conclusion === 'success' && APPROVER_CI_GATE …)   → release parked
:575  …deliverGitHubPrEvent({ event: 'github.ci_failed' … }) → same action
```

`check_suite` has three actions — `completed` / `requested` / `rerequested` —
**no success or failure action.** ⇒ my **19 observed `ci_failed` routings ARE 19
observed `action=completed` deliveries**; a differing field value is not a
different event. **Delivery and subscription are proven.**

⛔**And my 0-hit control was a probe inside the phenomenon.** I grepped
`check_suite success`, `no PR parked at this head`, `not required suite`,
`releaseParked` and got 0 — but **those strings are only emitted when the gate is
ON**, so the zero was guaranteed by construction. ⚠️**My `ci_failed`=19 positive
control was real but controlled for the wrong thing** — it proves *logs exist*,
not *this line would appear if the delivery happened*. ⇒ ⭐⭐⭐**negative evidence
needs a control that COULD have come out otherwise** (cf.
[[feedback_a_positive_control_cannot_detect_an_incomplete_enumeration]]).

✅**WHAT SURVIVES, verified by me and sufficient alone:** `host-sweep.ts` has **0**
mentions of `parked` across **712** lines (control: it does sweep
`processing_ack`, `recurrence`, stale), and `pending-reviewable/store.ts` exports
only `parkReviewable` / `findParkedByHead` / `deleteParked` — **no TTL, no expiry,
no list.** ⇒ **ANY missed release, for ANY reason, is a permanent invisible wedge
whose only exit is hand-deleting a DB row.** Holds regardless of trigger
behaviour.

⇒ **CORRECTED RECOMMENDATION: gate arming on park TTL + a list/observability
path** (so a missed release degrades to a *late wake*, not a silent wedge) —
**not** on watching for a success delivery, which is already established.
`CI_GATE_REQUIRED_CHECK_RUN=shader-slang/slang=check-ci` remains the precise
lever; slangpy still needs a `needs: [build]` + `if: always()` roll-up first.

⛔⭐⭐⭐**PATTERN, third operator-facing instance in one chain: I found a TRUE
blocker and welded a FALSE mechanism to it, and the mechanism did the rhetorical
work.** (1) regression public-via-CodeRabbit → true defect, false visibility
claim; (2) clause fired on #1090 → true green-over-red, false mechanism
(waiver, not surface); (3) hold the gate → true no-TTL wedge, false
delivery asymmetry. ⇒ ⭐⭐⭐**A HOLD DESERVES THE SAME AUDIT AS AN ARM** — a
recommendation to *not act* felt safe and got shipped on a premise I hadn't
tested. And the approver's generalization: ⭐⭐⭐**a correct conclusion reached
through a wrong mechanism gets DEFENDED WITH THE WRONG EVIDENCE when
challenged.**

⚠️**Superseded on the approver's side too:** its three-outcome clause split is
**withdrawn** — `not_applicable` would fall through every summary bucket in
`eval-clauses.py` (three buckets only: FAIL→ABSTAIN_POLICY,
UNEVALUABLE→ABSTAIN_INFRA, all-PASS→continue) and read as satisfied — **a SILENT
false-safe, worse than the loud one** — while reusing `unevaluable` would make
**100% of shadow decisions ABSTAIN_INFRA**, destroying the signal the waiver was
signed to buy. ⭐⭐⭐**A status value is an INTERFACE, not a description — check
what the CONSUMER does with it.** ⚠️**I endorsed the broken plan without opening
that file either**, and ⭐⭐**"conservative" is not a synonym for "correct"**:
abstain-everything is a different failure with a real cost. Revised plan:
self-indicting evidence string + record caveat (no control-flow change) → then
`:190` verdict comparison → a fourth status only alongside a consumer change.

## Review surface

`coderabbitai` ×5 (latest 08-05T13:06:26Z @ head) · `skallweitNV` COMMENTED
04-09 · `ccummingsNV` DISMISSED 04-30, **APPROVED 07-29 (empty body)** ·
`jkiviluoto-nv` COMMENTED 04-13 · 1 issue comment (CodeRabbit walkthrough).
No production `github-actions[bot]` review exists at all; the approver built
its input fresh. Its first harvest at 13:01Z returned exit 10 (stale-only)
because CodeRabbit hadn't posted on a head pushed ~90s earlier — it posted at
13:06Z. ⚠️**exit 10 on a minutes-old head is indistinguishable from exit 22
(bot still working) at the moment of observation** — an approver-pipeline race
worth a debounce.

## RESUME

**RESUME = `ccummingsNV` or `jkiviluoto-nv` either (a) pushes the one-line
`SLANGPY_VERSION_OVERRIDE` fix to `:25`, or (b) disarms auto-merge, or (c) the
PR goes un-`BEHIND` and auto-merges with the defect** (in which case the
follow-up is a fix PR against main, not this branch). Nothing is owed from a
coworker: approver decided and recorded, read-only, correctly did not post.
Canonical thread `gh-issue-shader-slang/slangpy-925`.
