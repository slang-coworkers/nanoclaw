---
name: project_nanoclaw_1176_ruff_gate_composed_scope
description: "nanoclaw#1176 python ruff gate on nv-main — 5 webhooks, synchronize evaporated my headline finding (composed-tree scoping) before I posted; verdict CLEAN + 2 non-blocking notes. Holds the reusable 'a repo-wide linter added to a composed-CI repo is scoped wrong by default' shape."
metadata: 
  node_type: memory
  type: project
  originSessionId: c75883dc-7e40-40fe-bc16-3feb1af81a7d
---

# nanoclaw#1176 — python lint (ruff) gate, base `nv-main`, author szihs

**Reviewed INLINE by Main** (~30th instance of the standing rule: nanoclaw PRs are never
routed to a `*-pr-approver`; a slang/slangpy *compiler* approver at a platform-repo PR is
nonsensical and no nanoclaw approver is wired). Write path verb-split as always: REST
`issues/1176/comments -X POST` works, `gh pr review`/`gh pr comment` denied.
Comment `5239722624`. Verdict **CLEAN, no blockers**, 2 non-blocking notes.

## ⭐⭐⭐ The reusable shape: a repo-wide linter in a composed-CI repo is scoped wrong by default

`ci.yml` merges every `nv-*` sibling before testing ("test the composed state"). So a bare
`ruff check .` added on `nv-main` lints **the siblings' Python too** — files an nv-main PR
cannot fix because they are not in its tree. Measured at first head `740ece1f`: **74 findings,
0 in a file the PR touched** (24 `container/mcp-servers/slang-mcp`, 19 `slang-pr-approver`,
19 `slangpy-pr-approver`, 12 `slang-pr-knowledge`).

⭐⭐**And the gate's POSITION multiplied it: step 12 of 24, so steps 13–24 (build, typecheck,
all tests) were `skipped` ⇒ that head carried ZERO test evidence.** A lint gate placed above
the suite converts "one lint error" into "no signal about anything".

⇒ **When reviewing any repo-wide checker added to this repo, ask what it sees in the COMPOSED
tree, not the branch tree.** Per-branch py counts (`git ls-tree -r --name-only origin/$b | grep -c '\.py$'`):
nv-main 16, nv-slang **35**, nv-slangpy 3, nv-dashboard 1, nv-nanoclaw 1.

## ⛔ Fifth `synchronize`-evaporates-the-headline instance on this repo

Author pushed `20af817f` **mid-review**, scoping the step to `git ls-tree -r --name-only -z "$HEAD_SHA"`
+ `-f` filter — exactly my headline finding, before I posted. (Prior instances: #1092, #1103, #1084,
#1102.) ⇒ **the standing rule held: re-fetch head and re-measure rather than carrying the verdict.**
Had I published the draft, the blocker would have been dead on arrival.
⚠️Diff old→new head was only `ci.yml` +34 and `ruff.toml` +17/-3 — small, and it invalidated the
entire headline.

## Verified (each probe with a control that could return the other answer)

- Gate **passes** on new head (16 files, rc=0) and is **non-inert**: reverting each fixed file to
  `origin/nv-main` content → **59 content findings / 13 files**. Plus **14 mode-bit changes**
  (`git diff --summary`, `100644 => 100755` = the EXE001 set) ⇒ **59+14 = 73**, the PR's claimed
  count reconciles EXACTLY. ⭐**EXE001 findings live in the file MODE, so a content-only recount
  under-counts by 14 and looks like the author inflated the number** — count both.
- **File-list-vs-content divergence measured, negative**: list comes from the PR tip but content
  linted is the composed tree ⇒ checked all 16 head `.py` against all 4 siblings; **0 differ**.
- `target-version="py39"` justified BY EXECUTION both ways: `datetime.now(timezone.utc)` clean at
  py39, `UP017 Use datetime.UTC` at py311 (an alias absent <3.11).
- "**ruff's default set is the widest net**" is TRUE for 0.16.2 — `--isolated`, no `--select`,
  5-line probe drew `I001 F401 S110 BLE001`. This is what makes the exact pin load-bearing.
- **All 8 `# noqa` load-bearing**: RUF100 confirmed active (bogus noqa → flagged); stripping noqa
  per file fires every time (test_learnings_wiki 8, kb-doctor 9, dump-scheduled-tasks 5,
  kb-health 4, test_pull_universe 2).
- **The 3 `except Exception`→`except json.JSONDecodeError` narrowings are behaviour-preserving —
  read each TRY BLOCK, not the diff**: all wrap only `json.loads()` on a `str` from `text=True`,
  and each has its `OSError` handled separately/adjacently. `(OSError, subprocess.SubprocessError)`
  keeps the timeout path since `TimeoutExpired` subclasses `SubprocessError`.
- **173 tests OK at head AND 173 OK at `origin/nv-main`** ⇒ "no change in outcome" exact.
- Path-guard both controls: head allowlist → rc=0 `ok: all 19 changed file(s)`; base allowlist
  → **rc=1 naming `ruff.toml`**.

## The 2 posted notes

1. **New step FAILS OPEN on an unreadable `HEAD_SHA`** — `git ls-tree` writing nothing on error is
   byte-identical to "branch has no Python", both rc=0 with the same `::notice::no Python` line.
   Not reachable today (`checkout` `fetch-depth: 0`) ⇒ latent. Same "no third state between clean
   and unmeasured" shape as #1076.
2. **Gate position hides all test signal** on any lint failure (the first head proved it).

## ⛔ My own instrument failures this review (all caught by controls, none published)

- ⭐⭐⭐**`pip`/`ruff` VANISHED between webhook turns** (`No module named pip`, and an earlier
  successful `pip install ruff==0.16.2` gone; `/usr/lib/python3/dist-packages` read empty).
  **`/tmp` is also wiped between turns** — a `/tmp`-installed ruff binary gave `rc=127`, the
  instrument-down shape. ⇒ **install review tooling under `/workspace/agent/tools/`, and run a
  POSITIVE CONTROL before believing any "clean" result.** Binary: `/workspace/agent/tools/ruff-0.16.2`
  (direct GitHub release tarball; no pip needed).
- ⛔**FALSE EXIT STATUS twice, same shape as #1102/#1111**: `ruff ... | tail` and
  `check.py ... | tail` both reported `rc=0` while the command FAILED (`$?` read `tail`).
  Once it nearly inverted a path-guard control conclusion — the rejection TEXT was visible but
  I read rc=0. ⇒ redirect to a file and read `$?`, or use `${PIPESTATUS[0]}`.
- ⛔**A probe passed for the WRONG REASON**: my empty-tree test printed the expected
  "no Python" notice, but `git commit-tree` had failed (no git identity) so `HEAD_SHA` was empty —
  the pass was accidental. Re-ran with `-c user.name/-c user.email`. **That accident is what
  exposed note 1** (the fail-open), so a probe that passes wrongly is worth investigating, not
  re-running until green.
- ⛔`git worktree add` then `cd` in the same compound command hit
  `not a git repository ... Stopping at filesystem boundary` — the shell cwd resets between calls.
- ⚠️A suite reported "?" tests because it prints stdout AFTER the unittest summary, so `tail -3`
  missed `Ran 31 tests / OK`. **Nearly recorded a failing suite on the PR's head.** Grep the whole
  output for `Ran N tests`, never a fixed tail window.

## 2nd `synchronize` → `beba52bd` (+63 ci.yml): a NEW `python` job, notes NOT addressed

Author did not touch either of my notes; instead added a `python:` job running slang-mcp's
pytest + ruff, guarded by a `[ -f container/mcp-servers/slang-mcp/pyproject.toml ]` probe.
All 5 checks green (`ci label check python guard`). Root gate re-verified clean at this head
(16 files, rc=0). Probe design is SOUND: dir absent on nv-main and on the head ⇒ `present=false`,
every step skipped; keying on the DIRECTORY not the branch name is the right call.

🔴⭐⭐⭐**Its `ruff` step's PRECONDITION IS FALSE, and the fix is a DIFFERENT OPEN PR.** Comment
says *"Wired now that the 15 pre-existing errors are fixed (see the nv-slang PR)"*. Measured with
slang-mcp's OWN config (`select=["E","F","I"]`, `line-length 120`, `target-version py310` from its
`pyproject.toml`): `origin/nv-slang` → **`Found 15 errors`, rc=1** (9 E501 · 3 I001 · 1 F811 ·
1 F821 · 1 F841 — exactly the 15 referenced). ✅**CONTROL: same command at open PR #1177's head →
`All checks passed!` rc=0** ⇒ the dependency is real, not my config guess.
⇒ **MERGE-ORDER CONSTRAINT between two open PRs (#1177 must land first), encoded NOWHERE.**
⭐⭐**Why not harmless: the job no-ops on nv-main, but the comment's own argument is that this copy
is the one that SURVIVES DEPLOY-TIME CANONICALIZATION onto the leaf** (`.github/**` is nv-main-owned,
so `setup.sh`/`merge-train.sh` overwrite nv-slang's ci.yml) ⇒ on that day nv-slang gets a red ruff
step on code its own PRs never touched = **the same "nv-main change breaks sibling CI" class fixed
one push earlier, reappearing through the DEPLOY path instead of the COMPOSE path.**

🔴**"Kept byte-identical to nv-slang's copy" is FALSE — and non-drift is the ENTIRE argument the
comment gives for closing #1163's ownership caveat.** Extracted both `python:` jobs and diffed:
**19 lines (nv-slang) vs 38 (head)**, structurally different — nv-slang uses job-level
`defaults.run.working-directory` (dropped here, repeated per-step), head adds the probe + a per-step
`if:`, and head **adds the `ruff` step nv-slang deliberately omits with a 4-line comment saying why**.
⇒ canonicalization is **not** a no-op today. ⭐⭐**A claim of the form "these two copies agree, so
they cannot drift" is CHEAP TO FALSIFY — extract both and diff; never accept it from prose.**
⚠️Also: `pyproject.toml` pins `ruff>=0.6.9` (a RANGE) while `uv.lock` has **0.14.8** — the comment's
"cannot drift with a new ruff release" rests on the lock, so `uv sync --frozen` is load-bearing.

Follow-up comment `5239773491` (both findings + a restatement that my 2 prior notes are unaddressed
and still accurate at this head).

## ⛔⭐⭐⭐ 3rd `synchronize` was a FORCE-PUSH **BACKWARDS** — my review outlived its subject

`head_ref_force_pushed` 12:09:06Z reset the head from `beba52bd` → **`20af817f`**, the head my FIRST
comment reviewed. `git merge-base --is-ancestor beba52bd <head>` → **not an ancestor** ⇒ the whole
`python:` job commit was DROPPED (object still exists, so it is fetchable but unreferenced).
⇒ **my follow-up `5239773491` reviewed code no longer on the PR**; posted correction `5239982568`
voiding it myself rather than leaving the author to reconcile a review against a removed commit.

⭐⭐⭐**A `synchronize` is not necessarily FORWARD. The rule "re-fetch head and re-measure" is
necessary but NOT sufficient — a backwards force-push makes an already-POSTED review wrong, which
no amount of re-measuring before posting can prevent.** ⇒ **on any `synchronize`, test ancestry, not
just the SHA: `git merge-base --is-ancestor <prev-head> <new-head>`.** Non-ancestor ⇒ ask which of
my published comments just became void, and strike them myself.
⭐⭐**The cheap tell is `gh pr view --json headRefOid` returning a sha I ALREADY REVIEWED** — going
back to a familiar SHA looks like "no change" and is in fact the loudest possible signal.
⚠️Also: the 11:52Z **title rename still advertises the dropped job** ("slang-mcp's python job on
nv-main") ⇒ **a title is not evidence of head content**; flagged to the author.

✅Re-verified at the restored head (positive control fired FIRST, so a measured clean not a dead
instrument): gate `All checks passed!` rc=0 over 16 files, `grep -c '^  python:'` → **0**, and
`git diff` vs my first-comment head is **empty** ⇒ comment `5239722624` stands in full as the LIVE
review (no blockers, 2 non-blocking notes open).

**RESUME** = szihs replies, or a new `synchronize` (this author ships responsive commits within
minutes — re-fetch head SHA, **test ancestry**, re-run the gate + neg control before re-reviewing).
**#1177 (base `nv-slang`, fixes the 15) is still OPEN**; if the `python:` job returns here or moves
there, both dropped findings apply again as written and the #1177 measurement stands on its own.
Nothing regressive live on `nv-main` from this PR.
