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

**RESUME = operator decision on the spine default.** Nothing implemented; no config changed. Mechanics if
greened: (a) `git worktree add` per chain, (b) source-only unless a build is required, (c) `sccache` via
`install_packages`. Memo at `/workspace/inbox/a2a-1786044423039-kijpb3/infra-shared-worktree-collision.md`
(51 lines, peer-authored). Related: [[feedback_group_clone_is_shared_by_all_sibling_sessions]].
