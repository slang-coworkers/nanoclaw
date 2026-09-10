---
name: project_shared_clone_worktree_isolation_infra
description: "INFRA escalation (not a Slang defect): N sessions share one /workspace/agent/<project> checkout — 3 field instances in 2 days. Worktree isolation MEASURED as a genuine fix (source AND build). Operator cost figure is a RANGE 4-9% of headroom (submodule OBJECT stores are PRIVATE per worktree, and init CLONES — not offline). Per-worktree build = 78% ⇒ opt-in. Shared build dir IMPOSSIBLE (CMake path-binding) ⇒ lever is sccache, NOT INSTALLED. 2 leaks no worktree fixes: stash is per-clone, prunable misreports from a foreign mount. AWAITING OPERATOR."
metadata:
  node_type: memory
  type: project
  originSessionId: sess-1786037800083-onan60
---

# N sessions, one working tree — the infra escalation (measured, awaiting operator)

Surfaced from [[project_12404_slang_package_tool_maintainer_owned]] when slang-triager found 3 tracked
modifications it hadn't made in `/workspace/agent/slang` (a co-tenant session doing #12330 work). Scope:
**platform/infra, no shader-slang issue, no fixer.** Severity HIGH — it has destroyed work twice.

## The A/B that settles the remedy (peer's, throwaway `git init` in /tmp — never in the real clone)

Identical co-tenant op `git reset --hard <base> && git clean -fd` in the MAIN checkout:

| victim works in | tracked patch | untracked file | stash |
|---|---|---|---|
| the shared checkout | **GONE** | **GONE** | 0 entries ⇒ unrecoverable |
| a `git worktree` | survives | survives | intact |

Harsher case — co-tenant *advances master with a new commit* then `reset --hard && clean -fdx` — worktree
HEAD stays at base, both survive. ⇒ **`git worktree` is a genuine fix for this failure mode, not a
mitigation.** Also isolated: per-worktree `index` and `HEAD`.

## ⚠️ MY ADDITION — `clean -fdx` DOES destroy a shared `build/`, and `git status` cannot see it

The peer's matrix covered source. I ran the build-dir arm myself (own `/tmp` lab, `build/` gitignored
exactly as in the real tree, control file proving the probe reads survivors):

- co-tenant `reset --hard && clean -fd` ⇒ **`build/` SURVIVES** (`-fd` spares ignored paths)
- co-tenant `clean -fdx` ⇒ **`build/` DESTROYED** — the `-x` is the whole difference
- victim's build inside a **worktree** ⇒ **SURVIVES** the same op; the worktree dir is untouched and
  stays registered

⇒ **the `-x` variant costs a co-tenant ~3.4 GB and a ~20-min rebuild, and `git status --porcelain`
returns 0 the whole time** because `.gitignore:26` ignores `build/`. So the existing guard ("stop if
`git status` shows work you didn't make") is **structurally blind to build loss** — a session can be
robbed of its build with every visible signal clean. That is an argument for worktrees even for chains
that only *build*, not patch.

## Cost model — CORRECTED TWICE; the operator figure is a RANGE, 4–9%

Peer's edge: `/dev/vdb[/prod-groups/slang-triager]` → 1007G total, **485G avail, 50%**.
(⚠️ my edge is `/dev/vda1[…/groups/main]`, 124G/60G avail, `.git` 825 MB with `.git/modules` 596 MB — the
peer's clone reads 1018/277 MB. **Never reconcile two edges' figures as one object.**)

| worktree | total | build/ | private `.git/worktrees/<n>` | class |
|---|---|---|---|---|
| `wt-12330` | 87 M | none | 2 M | **submodule-less ⇒ CANNOT configure** |
| `wt-12155` | 3.7 G | 3.4 G | **50 M** | build-carrying, lean objects |
| `wt-12362` | 6.6 G | 6.3 G | **466 M** | build-carrying, heavy objects |

**Correction 1 (mine): 87 MB is submodule-less.** The 197 M gap to `wt-12362`'s 284 M source component is
**193 M of `external/`** — 0 of 18 submodules populated vs 18 (peer probed 4 by name: 0 entries vs
26/28/15/15; tracked-file counts 11347 vs 11337 ⇒ same repo, different submodule state). An 87 M tree dies at
`get_target_property() … non-existent target "SPIRV-Headers::SPIRV-Headers"`. ⇒ **spell the shape
"source + submodules, no `build/`"**, never "source-only".

**Correction 2 (peer's, and it corrects ME): the submodule OBJECT store is PRIVATE per worktree.**
`wt-12362/external/spirv-tools/.git` → `…/slang/.git/worktrees/wt-12362/modules/external/spirv-tools`; main →
`…/.git/modules/…`. `.git/worktrees` = 516 M for 3 (partition control 50+2+466 = 518, −2 rounding ⇒
exhaustive). So the working files are not the whole cost.

| shape | per worktree | ×59 | % of 485G | builds? |
|---|---|---|---|---|
| submodule-less | 87 MB | 5.0 G | 1.0% | **NO** |
| src+submodule files only | 284 MB | 16.4 G | 3.4% | yes |
| **+ private objects, LEAN** | **334 MB** | 19.2 G | **4.0%** | yes |
| **+ private objects, HEAVY** | **750 MB** | 43.2 G | **8.9%** | yes |
| per-worktree BUILD (rejected) | 6.3 G | 376.7 G | **78%** | — |

⚠️ The lean/heavy 9× spread is **loose/un-gc'd objects, not inherent** (imgui 5→130 M, glslang 8→82 M) on two
worktrees with *identical* submodule population. Whether heavy compacts toward lean is **UNTESTED** — `git gc`
against a shared store with 18 live sessions is the destructive-op class under review. **Quote 4–9%.**

## ⛔ "Shared build dir" is off the menu — CMake hard-binds to its source path

`build/CMakeCache.txt` carries `CMAKE_HOME_DIRECTORY:INTERNAL=/workspace/agent/slang` and
`CMAKE_CACHEFILE_DIR:INTERNAL=…/slang/build`; peer counted **33** absolute refs (must-hit control 2140
lines, bogus-path control 0). I confirmed both keys on my own edge. Both live worktree builds bind to
their own path. ⇒ a worktree pointed at the main `build/` compiles the **wrong sources**.

**The lever is the compiler CACHE, not the build dir.** `SLANG_USE_SCCACHE` is real and in-tree — I
verified independently at `d7d59f374`: `CMakeLists.txt:476-519`, 8 refs, `option(... OFF)`,
`find_program(SCCACHE_PROGRAM sccache)`, warns *"SLANG_USE_SCCACHE is ON but sccache was not found in
PATH"*, auto-disables PCH. **`which sccache ccache` ⇒ neither on PATH, on MY edge too** (control: `git`,
`cmake` both resolve). Installing it is `install_packages` ⇒ image rebuild ⇒ operator-level.

## Two leaks no worktree can fix ⇒ they must be spine RULES

1. **`git stash` is per-clone.** `refs/stash` is one namespace. Peer measured: from inside a worktree the
   co-tenant's entry sits at `stash@{0}`; a bare `pop` on a non-conflicting file printed `Dropped
   refs/stash@{0}`, entries 1→0, and the co-tenant's file **materialized in the victim's tree** — gone
   from the stash *and* landed where nobody asked. ⇒ **never bare `stash pop`/`drop` in a shared clone**;
   `stash push -m <session-tag>`, then pop by message-matched index.
2. **`prunable` misreports from a foreign mount.** `git worktree list --porcelain` emits `prunable gitdir
   file points to non-existent location` and `prune -n -v` says `Removing worktrees/<n>` for a worktree
   that is **healthy on its owning mount** (the `.git` file's gitdir is absolute). ⇒ never conclude "dead
   worktree" or run `worktree prune` against a clone reached by a foreign path.

## Field instances — FOUR now, in 2 days

1. **08-05** co-tenant `reset --hard` destroyed 3 tracked files, unrecoverable (never staged, `stash` empty,
   no reachable objects). *Perpetrator seat.*
2. **08-06 #12384** co-tenant reset silently reverted an applied patch mid-build; **4 measurements void**.
   `BUILD_EXIT=0`, `[12/12] Linking`, no error — the only tell was an empty `git diff` where a hunk was
   expected. *Victim seat, reconstructed after the fact.*
3. **08-06 #12404** the triager watched `hlsl.meta.slang` — not its file — go from MODIFIED to
   byte-identical-to-HEAD **mid-session**, no error, no log, no nameable actor. Caught only because it had
   recorded the earlier `git status` and re-ran it. *Victim seat, observed live.*
4. **08-06 #12404/#12330** — ⛔**the MECHANISM, not a consequence: I handed a peer reap authority over
   `wt-12330`/`wt-12362`, holding 5 live tracked modifications, because N sessions under one bot identity
   made a destructive hand-off read as routine.** It refused. See
   [[feedback_a_handoff_granting_destructive_authority_needs_the_same_audit_as_blame]].

5. **08-07 05:30Z — FIFTH, and the first to land AFTER the escalation was delivered.** `slang-triager`
   (session `5nim5r`, #12411) refreshed the shared clone with `reset --hard` and destroyed a sibling's
   uncommitted `[ForceUnroll]` edit in `source/slang/hlsl.meta.slang` — owned by **`4zoory`, a
   DIFFERENT SESSION OF THE SAME COWORKER** (both slang-triager; 4 of its sessions live in the
   05:00–06:30Z window). Recovery was **luck** — the sibling happened to keep `.pristine`/`.patched`
   scratch copies; unstaged edits have no object, so `fsck` cannot reach them.
   ⭐⭐⭐**MECHANISM — A GUARD WHOSE OUTPUT NOTHING BRANCHES ON IS A LOG LINE, NOT A GUARD.** The
   destructive command *contained* its check: `git status --porcelain | grep -v '^??' | wc -l` printed
   **`1`** and the `reset --hard` ran anyway, same command, because no control flow consumed the `1`.
   ⇒ `test "$(...)" -eq 0 || { echo ABORT; exit 1; }`, and prefer `merge --ff-only` over `reset --hard`
   (it *cannot* silently discard — structural, not guard-dependent).
   ⭐⭐⭐**THE DISCRIMINATOR (the genuinely new finding, triager's own):** the caution has a *strong*
   positive record — it fired correctly in **11 files across 8 prior chains**, each an explicit "a
   `--hard` here would have destroyed a peer's work; I declined." All 8 successes were **deliberate
   cleanup/revert decisions**, where stopping to think *is* the task. **Both losses came from a refresh
   recipe run as session BOILERPLATE.** ⇒ the failure is not "discipline doesn't hold" — it is that **a
   destructive verb inside routine boilerplate never reaches the deliberation the same verb gets when
   it IS the decision.** A third written caution cannot help: the caution was never missing,
   *invocation* was. ⇒ **searchable next audit target: any other destructive op living in a routine
   recipe rather than in a decision.**
   ⚠️**My own layer sweep (5 layers, armed control): `CLAUDE.md` 0 · `CLAUDE.local.md` 0 · `memory/` 2
   files · `~/.claude` memory 21 files · skills 0 — all 23 are incident PROSE, ZERO runnable recipes.**
   The unsafe default was in a coworker spine, not mine. ⭐**Print the census, never the total** — "23
   hazards in my store" would have been alarming and false.

⇒ "has destroyed work twice" understates it — **FIVE instances in 3 days, one of them after the ask was
delivered.** And #4 shows the hazard is not only *concurrent writes* — it is **attribution under a shared
identity**, which no worktree fixes. #5 sharpens that: the clobberer and victim were **the same coworker,
two sessions**, so "which agent owns this edit" is unanswerable from the tree alone.

⚠️**Two worktrees can exist for one issue**: `wt-12330` (triager) vs `wt-slang-12330` (fixer, branch
`fix/issue-12330`). Key every path claim by its FULL name; a `wt-*12330` substring merges two owners.

6. **08-07 04:27Z — SIXTH, found only on the 08-08 sweep, and it PREDATES my 09:22Z ping** (so it is new
   to the record, not new since the ask). `slang-reviewer` (`rjavdk`, #12396/#12417) ran
   `git worktree add --detach FETCH_HEAD`; a co-tenant `fetch origin master` overwrote `.git/FETCH_HEAD`
   between its fetch and its add, so the worktree materialized at **`88fa1206d` instead of the intended
   `c50ad3b3f`**. Its own unconditional commit-binding assert caught it and it re-pointed by literal SHA.
   ⭐⭐⭐**NEW FAILURE CLASS — this one does not destroy anything: it yields a VALID worktree at the WRONG
   commit, so every downstream measurement is TRUE ABOUT THE WRONG TREE and nothing contradicts it.** The
   three prior classes all leave a trace (lost file / reverted hunk / empty diff); this one leaves a clean
   tree and a confident wrong answer. ⇒ **the remedy is an assert, not a guard**:
   `git rev-parse FETCH_HEAD` → literal SHA immediately after fetch, then
   `git -C <wt> rev-parse HEAD` == that SHA. Cheap enough to be unconditional; it is what caught this.

   ⚠️**MY SCOPE CORRECTION, measured — the peer's rule is right for TODAY and wrong as a git fact, and the
   difference bears directly on ask (a).** Two shared-learnings files publish *"`FETCH_HEAD` is a single
   mutable file in the clone, not a per-invocation value."* Lab test (throwaway `/tmp`, git **2.39.5**,
   my edge only):
   - `git -C <wt> rev-parse --git-path FETCH_HEAD` → `.git/worktrees/<wt>/FETCH_HEAD`; main → `.git/FETCH_HEAD`.
     Controls `HEAD`/`index` (known per-worktree) resolve the same way.
   - A worktree fetch pinned to c2, then a co-tenant fetch of c3 **from the main checkout**: the worktree
     **still reads c2**. Positive control: two fetches in the *same* checkout **do** overwrite.
   - Physical-file control: a worktree fetch creates `.git/worktrees/<wt>/FETCH_HEAD` and **no**
     `.git/FETCH_HEAD`.
   - Repro of the actual event (fetch + co-tenant fetch + `worktree add FETCH_HEAD`, all from **main**):
     lands on the wrong SHA. Arm control (no co-tenant fetch): lands correctly. Fix control (resolve to a
     literal SHA first, then race): **holds**.
   ⇒ **`FETCH_HEAD` is per-worktree; the race is real only because every session currently shares the ONE
   main checkout.** So this class is **not** a counterexample to worktrees — **worktrees fix it too**, which
   makes ask (a) stronger, not weaker. ⚠️`gitrepository-layout` does **not** list `FETCH_HEAD` either way,
   so I state the version and the edge rather than a universal. Same family as ANCHOR C: a peer's true
   statement about its own environment arriving as a general fact about the tool.

## Recommendation carried to the operator

1. Default **write-capable** chains to a per-chain **source-only** worktree (field-proven 87 M, ~1%).
2. Do **not** default a per-worktree build (78%). Reclaim by pruning `build/` subdirs, not removing
   worktrees (prior measurement: 16 build dirs → 266M free became 108G; worktree removal ≈ 10G).
3. Operator ask: **install `sccache`** so opt-in builds share a cache instead of each paying ~6.3 G cold.
4. The two stash/prune conventions as spine rules.
5. Scale isolation to **WRITE capability, not session count** — but per my `clean -fdx` finding, "builds"
   counts as write-capable for this purpose even when the source is untouched.

## Peer's recorded error (worth keeping — same family as the shebang stub)

Its first stash cell hit a conflict, so git printed *"The stash entry is kept"* and the count stayed 2 —
and it wrote *"the co-tenant's stash is CONSUMED"* anyway. **The tool contradicted the conclusion in the
same output.** Re-ran on a non-conflicting file for the clean measurement. See
[[feedback_a_probe_that_cannot_observe_the_subject_returns_a_confident_value]].

## State

⚠️**08-07 09:0xZ fire — operator has NOT answered; incident #5 re-ping delivered as dashboard msg
`id 325` (a new data point, NOT a repeat of the ask).** ⭐**The first attempt was silently UNDELIVERED** —
it came back as an `undelivered_message` and needed an explicit `send_message(to=...)` to land. ⇒ **on
this task, a `<message>` block in the final response is not proof of delivery; confirm the returned id.** Verified no operator inbound since: the two dashboard messaging
groups (`mg-1776713211742-om8syu` main, `mg-1781699149434-jdo1uq` admin) have **no inbound chat row after
2026-08-06 19:4xZ** — the main dashboard session `9fon2n` tops out at **2026-05-21**, and every 08-07 row
across 159 main-group sessions is coworker or task traffic. Concurrency **has not** grown materially:
running sessions/group = **12 main · 7 slang-fixer · 3 slang-triager** · rest ≤2 (was 15/7/5) ⇒ the
re-ping rests on the **incident**, not the count.
⭐**The ask now has a THIRD item that is cheaper and more targeted than (a)–(c): fix the guard default in
the coworker spines.** #5 was not prevented by isolation being absent — it was caused by a
guard-beside-the-action recipe, which a one-line spine edit fixes for every coworker at once.

⚠️**08-08 09:2xZ fire — operator STILL has not answered; I sent NOTHING (no new post-ping incident).**
Armed sweep over every session active since 08-07, `--full`, timestamp-keyed on the message header row:
**zero** incidents after 09:22Z. It did surface instance **#6 above, dated 04:27Z — i.e. BEFORE my ping**,
so it is new to the record but not a new data point since the ask ⇒ **does not meet the re-ping bar.**
Concurrency **fell**: running/group = **10 main · 2 slangpy-pr-approver · 2 slang-discord · 1 each
slangpy-fixer / slang-fixer / ci-babysitter / maintainer** (was 12/7/3) — no group above ~10.
⛔**TWO INSTRUMENT DEFECTS, both of which produced a FALSE NEGATIVE first:**
1. **`ncl sessions messages` truncates text to 300 chars by default — pass `--full`.** My incident grep
   returned **0** on the escalation session (a session entirely about this topic) and **5** on another;
   with `--full` the same session returns **6**. A pattern that matches only message *openings* reads as
   "no incidents." (Already in shared learnings ×2 — I re-derived it anyway.)
2. ⭐⭐**`ncl sessions list --limit 2000` SILENTLY CAPPED AT EXACTLY 2000 rows; the store holds 2478.**
   Detector that caught it: `--limit 5000` and `--limit 4000` both return **2480 lines** ⇒ 2000 was the
   cap, not the total. It made session `9fon2n` (the main dashboard session) look **absent**, and my first
   per-group running count read **8 main** instead of **10**. ⇒ **the task's own recipe (`--limit 2000`)
   under-reports the very number it asks for.** Cheapest check: raise the limit and see whether the count
   moves. Same family as the basename/cap rule in ANCHOR-adjacent store guidance.
⚠️**08-09 09:5xZ fire — operator STILL has not answered; I sent NOTHING. No new destruction instance since the 08-08 sweep, so the re-ping bar is not met.** Sweep: 67 sessions active since 08-08T09:20Z, `--full`, timestamp-keyed, pattern armed on two known-positive sessions first (`rjavdk` 16 hits, `5nim5r` 21) ⇒ **77 in-window hits, ZERO of them a co-tenant destruction.** They split into (a) sibling-*attribution* errors under the shared bot identity — the #12431/#12432 duplicate pair filed 47 s apart, a sibling publicly claiming #12432 "closed in favour of this one" while it was open, a retraction of a true claim — and (b) three near-misses that each **failed safely**: `Edit` refused after a sibling reverted the text it was matching (loud, not silent), a `FETCH_HEAD` repoint caught by a positive control, and a cross-store `cp` caught because the target's `reindex.sh` refused to run. ⇒ **the hazard is unchanged but the visible harm this window was attribution, not loss** — which is exactly the class no worktree fixes (instance #4's point).
⛔**THE TASK'S OWN CONCURRENCY RECIPE UNDERCOUNTS EXPOSURE, and its `--limit 2000` is still the documented cap.** `container_status='running'` = **13 total** (10 Orchestrator · 1 each Discord-support / CI-babysitter / Maintainer) — nothing above ~10, so by the letter of the trigger nothing changed. **But a STOPPED session still holds uncommitted edits in the shared clone**, so "running" measures *this instant's writers*, not *who can be robbed*. Distinct sessions active in a rolling window, which is the real co-tenancy denominator: **24 h — Orchestrator 22 · slang-fixer 20 · slang-triager 9 · slang-reviewer 4; 72 h — 107 / 67 / 44 / 13.** ⇒ ⭐⭐⭐**`running` is an instantaneous gauge answering a question about accumulated state; two groups are 20× over the ~10 threshold on the measure that matches the failure mode.** I did not re-ping on it (no new incident), but **the trigger as written can read "clear" while 20 co-tenants share one tree.** Also: `--limit 2000` returned exactly 2002 lines again; `4000`/`6000` both return 2506 ⇒ cap confirmed a second time, **use `--json` and parse — column-position `awk` on the text output mis-parses because an empty `thread_id` shifts every later field** (my first tally produced a histogram of timestamps instead of statuses).
✅**NEW, and it is the `git add -A` leak MEASURED — a THIRD spine rule, and worktrees DO fix it.** A peer reported `git add -A` sweeping four files a concurrent session was writing (additive, `+N −0`, but `git log -- <their-file>` now credits *their* note to the peer's commit message). Lab (throwaway `/tmp`, git **2.39.5**, my edge; **no destructive op in any real clone**): co-tenant leaves a tracked mod + an untracked new file in the **main** checkout, victim runs `git add -A` **from inside a worktree** ⇒ stages **`victim.txt` only**. Control, same op from the **main** checkout ⇒ stages **`sibling.txt` + `sibling-new.txt`**. Isolation control: `--git-path index` → `.git/worktrees/wt/index` vs `.git/index`. ⇒ **`git add -A` is safe in a worktree and unsafe in a shared checkout, because the index is per-worktree** — so this is *not* a leak needing a rule of its own **if** ask (a) lands; it is a rule only for as long as everyone shares one tree. ⭐⭐**Note the ASYMMETRY the peer named, which is the sharp end: committing an unrecognized file is recoverable; reverting one destroys real work.** Same direction as ANCHOR A.
✅**Operator-attendance discriminator (stronger than "no inbound"):** **5 `critique_gate_bypass` approvals
sit `pending`, oldest 08-07 01:10Z, newest 08-08 07:56Z** — cards delivered to `dashboard-admin`, none
answered. So the silence is **operator away, not ask-specific rejection**; three peer chains are gated
behind those cards. Confirmed no inbound chat row on either dashboard group (`om8syu` main, `jdo1uq`
admin) after 2026-08-06 19:4xZ, armed with a threshold-shifted control that does print.
Re-confirmed 08-09 across **all** sessions on both groups: **565 inbound `chat` rows examined (control >0),
0 after the cut.** ⛔**But my earlier "neither dashboard group" phrasing was HALF VACUOUS and I should have
caught it then: `jdo1uq` (dashboard-admin) has ZERO SESSIONS — 0 rows, not 0 recent rows.** A group with no
session cannot produce an inbound row, so scanning it can only ever return 0; **it is a NULL INSTRUMENT
dressed as a negative result** — the exact "failure indistinguishable from negative" mode in the store's
maintenance rules. This matters because the 5 pending approval cards were delivered *to* `dashboard-admin`:
the evidence that the operator is away rests on `om8syu` (565-row control) and on the unanswered cards,
**never on `jdo1uq`, which cannot testify.** ⇒ ⭐⭐**State which of your two negatives had a live instrument;
a group with no sessions contributes no evidence in either direction.**

✅**08-09: the recurring task's OWN RECIPE was the defect carrier, and I fixed it in place rather than re-deriving next fire.** The prompt shipped `--limit 2000` (the documented cap) and a `running`-only concurrency measure, so a daily cron was guaranteed to re-under-report the number it exists to watch. `ncl tasks update --id infra-worktree-escalatio-8baa --prompt "$(cat file)"` now carries: the `--limit 6000` + `--json`-not-awk + `--full` traps, BOTH concurrency measures with the 08-09 baselines, the two arming session ids, the null-instrument warning, the 4th (spine-guard) ask item, and the undelivered-`<message>` note. ⇒ ⭐⭐⭐**A recurring task's prompt is CODE — an instrument defect left in it re-fires forever, and the fix belongs in the row, not in the next fire's cleverness.**
⛔**`ncl tasks list` TRUNCATES `prompt` TO 120 CHARS AND APPENDS `...` — a third member of the truncating-instrument family (`sessions messages` 300 chars, `sessions list` 2000-row cap).** My verify read `prompt len: 120` and every content probe `False` **after a write that returned `touched: 1`** — i.e. **the instrument manufactured evidence that a correct write had failed**, and the obvious next move (re-issue the write, or "fix" it by shortening) would have been damage. `ncl tasks get <series-id> --json` returns the true **4062**, all probes `True`. ⇒ ⭐⭐⭐**When a write reports success and the read-back contradicts it, SUSPECT THE READ FIRST — verify with a different verb before believing the write failed.** ⭐⭐**And the tell was in the output all along: the value ended in `...` at a suspiciously round 120.** Same family as ANCHOR-adjacent "a tool that silently collapses output reports a true number about a set you never saw", and as the peer's `git status` printing `1` while the conclusion ignored it.

⚠️**08-10 09:3x–10:0xZ fire — operator STILL has not answered; I sent NOTHING (no new destruction instance). But this fire found the hazard in MY OWN LAYER and fixed it.**
**Attendance:** 36 sessions on `om8syu`, **565 inbound `chat` rows examined (control >0), 0 after the 08-06 19:40Z cut** — identical control figure to 08-09, which is *expected*, not suspicious: no new inbound chat means the denominator cannot grow. Threshold-shifted control (cut 08-01) prints **68** ⇒ instrument live. Newest inbound of ANY kind on the group = **08-10T03:10Z, a `task` row** (my own nightly sync); the only post-cut inbounds are 4 `task` + 1 `webhook`, **zero human**. `jdo1uq` re-confirmed **0 sessions** ⇒ not cited (null instrument).
⚠️**The approval-attendance signal MOVED and it is NOT operator action: 5 pending → 2** (`appr-1786117646569-csi8iq` slangpy-pr-approver 08-07 15:47Z, `appr-1786125150241-oo6e4w` slang-fixer 08-07 17:52Z; both `critique_gate_bypass`, both delivered to `dashboard-admin`, `expires_at` **NULL**). ⛔**`ncl approvals` holds PENDING ROWS ONLY — `help` says rows are DELETED on approve/reject/expire, and `--status approved|rejected|expired` all return `[]` (control: bare list returns 2).** ⇒ ⭐⭐⭐**A shrinking pending count is NOT evidence of an answer; the table cannot distinguish approved / rejected / expired / vanished.** I nearly read 5→2 as the operator returning. Oldest surviving card is now **~66 h** unanswered with no expiry ⇒ still operator-away.
**Concurrency, both measures.** (a) `container_status='running'` = **5 total** (Orchestrator 2 · slang-pr-approver / discord-support / ci-babysitter 1 each) — was 13. (b) The measure that matches the failure mode, **rolling 24 h: Orchestrator 57 · slang-fixer 12 · slang-pr-approver 8 · slang-triager 8; 72 h: 83 / 33 / 26 / 13.**
⛔**NEW INSTRUMENT DEFECT — `last_active` IS MUTABLE, so a replayed historic window is a LOWER BOUND, never the past measurement.** Re-running the 24 h window anchored at the 08-09 fire (09:50Z) yields Orchestrator **10**, but the memo recorded **22** that day. Cause, measured: of the 12 Orchestrator sessions *created* inside that historic window, **4 have since had `last_active` move past the anchor** — they left the historic bucket by being touched again. ⇒ ⭐⭐⭐**Never "verify" a stored window figure by recomputing the same window later — the row moved. Compare only same-anchor-to-now measurements, and treat any backward replay as a floor.** So 22→57 is a **real rise on the live measure** (35 of the 57 were created in-window, 22 carried over), but the 08-09 *number* is not reproducible by construction.
✅**THE FINDING — the 08-07 layer sweep that reported "ZERO runnable recipes, all 23 hazards are prose" was TRUE ABOUT THE FIVE LAYERS IT READ AND MISSED THE ONE THAT EXECUTES: `ncl tasks` PROMPTS.** Swept all **20** of my task series via `tasks get` (not `list` — 120-char truncation): **3 carry a destructive op, 17 do not** (control: the pattern discriminates). The real one is my own nightly KB sync `task-1781522302095-mjy6s1`, **56 runs**, which ran `git checkout -f` + `git reset --hard origin/nv-coworkers` in `/workspace/agent/nanoclaw-kb` — **a clone that right now hosts two live co-tenant worktrees (`wt-1171`, `wt-1171-base`, both touched 08-10 08:5xZ, ~1 h before this fire)** — with **no guard token anywhere in the prompt** (`grep` for `-eq 0 ||`/`ABORT`/`ff-only` ⇒ absent). ⭐⭐⭐**This is instance #5's mechanism exactly, in my own layer: a destructive verb inside routine BOILERPLATE, which never reaches the deliberation the same verb gets when it IS the decision.** It has not fired destructively (0 tracked mods, 0 stash entries in all three trees; the one untracked file `scripts/scrub_kb_pii.py` survives `-f`/`--hard`, and today's branch `kb-sync-20260810` @ `2875f07a7` is pushed) — **so this is a near-miss found by shape, not by damage.** ⇒ **FIXED IN THE ROW, not noted for next fire:** the recipe now carries a gate that *exits* (`test "$MODS" -eq 0 || { echo ABORT; exit 1; }`), names the two worktrees, and ships its own must-print-ABORT control. Verified with `tasks get`: **7155 chars, all 5 content probes True.** The other 2 hits are benign (`rm -rf` on the task's own mirror dests; the literal string `git gc` inside *this* memo-task's own prohibition text — i.e. **a pattern match on a rule forbidding the op**, the false-positive class worth remembering).
⛔**AND THE WRITE ITSELF ALMOST BECAME A FALSE RECEIPT — a fourth member of the truncating/lying-instrument family, this one in MY OWN SHELL.** Patching the sibling task with `ncl tasks update --prompt "$(cat file)"` **failed with `bash: unexpected EOF while looking for matching '`'`** — the payload contains 9 backticks, and inside double quotes bash tried command-substitution on them. Two things that matter more than the syntax error: (1) **bash aborted parsing the ENTIRE compound command, so the `update` never ran *and* the verify block chained after it never ran either** — had I not re-read the live row, "I fixed both rows" was the note I would have left; (2) the failure surfaced only because the verify used a **different invocation** than the write. Fixed by writing through `subprocess.run([...])` with the payload as an **argv element**, never through a shell string. ⇒ ⭐⭐⭐**A prompt/config payload containing backticks, `$`, or `!` cannot be passed through a double-quoted shell interpolation — pass it as argv. And a write whose verify is chained in the same shell command shares the write's failure mode, so it cannot witness it.** Both rows re-verified with a standalone `tasks get`: infra **6225** chars / 7 probes True, KB-sync **7155** / 4 probes True.
⇒ **Nothing re-pinged: no new destruction instance, and the count movement is on a measure whose baseline I have just shown is not reproducible.** The 4-item ask stands unchanged.

**RESUME = operator decision on the spine default.** Nothing implemented; no config changed. Mechanics if
greened: (a) `git worktree add` per chain, (b) source-only unless a build is required, (c) `sccache` via
`install_packages`. Memo at `/workspace/inbox/a2a-1786044423039-kijpb3/infra-shared-worktree-collision.md`
(51 lines, peer-authored). Related: [[feedback_group_clone_is_shared_by_all_sibling_sessions]].
