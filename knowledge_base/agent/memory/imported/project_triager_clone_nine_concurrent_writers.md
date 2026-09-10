---
name: project_triager_clone_nine_concurrent_writers
description: "INFRA: slang-triager's single Slang clone is shared by 9 concurrently-running sessions (114 total), so its tree/binaries mutate under any one of them mid-measurement. Measured 3 expired freshness readings in one hour. Mitigations + the 3 checks that catch it."
metadata: 
  node_type: memory
  type: project
  originSessionId: 4b1a5bcd-08bf-44bc-8aec-5d69d5200ff6
---

# One clone, nine concurrent writers — a standing measurement hazard

**Measured 2026-08-06 07:37Z**, during the #12385 close-out.

`slang-triager` (`ag-1780667166418-apezq5`) has **114 sessions, 9 of them `running` simultaneously**,
all sharing **one** Slang clone at `/workspace/extra/ephemeral/prod-groups/slang-triager/slang`
(my path; on its own mount the same object is `/workspace/agent/slang` — `dev=64528 ino=41715721`,
see [[feedback_name_the_agent_as_well_as_the_path]] instance 4b):

```
gh-issue-…-12385  12386  12384  12380  12371  12367  12360  12331
system:tasks:i12371-hold-guard-1424
```

⇒ **Any of the nine can `git checkout`, apply an uncommitted edit, or relink `libslang-compiler.so`
while another is mid-measurement.** This is not a race one session can avoid by being careful; it is
the shape of the deployment.

## Three expired freshness readings in ONE hour, all from this clone

| time | reading | how it expired |
|---|---|---|
| ~06:57Z | `slangc` **exit 127**, `invalid ELF header` on all 3 arms incl. the control | a sibling was relinking; correctly refused as a null result |
| 06:41→07:02Z | *"my Debug lib linked 06:41:49Z, **before** the edit ⇒ not in my binary"* | the `.o` recompiled **06:59:58Z** *from* the edit; relink **07:02:43Z**, 6 min **before** it published |
| 07:32→07:37Z | *"a sibling's `PublicModifier` edit is in the clone **right now**"* | measured it at 07:37Z: **0 tracked mods**, file mtime **07:31:36Z** — reverted before the warning arrived |

⭐⭐⭐ **The warning about a mutating tree is itself subject to the mutation it warns about.** The third
row is the sharpest: a correctly-measured, correctly-hedged housekeeping flag was **already stale on
arrival**, because the round-trip (measure → compose → deliver → read) exceeds the edit's lifetime.
⇒ **Never act on a received tree-state warning; re-measure.** The warning is evidence that *someone
was writing*, never that they *are*.

## The three checks that catch this class

1. **Loader failure vs measured negative** — grep every cell's log for
   `invalid ELF\|error while loading shared libraries`. A control failing identically to the probe
   carries zero information.
2. **Freshness at publish time, not at check time** — re-`ls --time-style=full-iso` the binary when
   you cite its date. *"My build predates X"* is a measurement with a timestamp, not a session
   property ([[feedback_a_freshness_reading_expires_the_moment_you_stop_looking]]).
3. **Blast radius from artifact mtimes** — probe-output mtimes bound which cells ran on which binary,
   converting *"did I publish something wrong?"* from a worry into a bounded query. Then **re-run**:
   the timestamp shows which cells are suspect, only the re-run shows they were right.

## Mitigations that exist — with the cost bound

- **Worktrees:** ✅ verified a genuine one, not just a directory — `git worktree list` shows
  `wt-12362` at detached `72b528b42` alongside the primary at `9eb90c50a`, with its own
  `libslang-compiler.so.0.2026.14.1`. Per-chain build isolation is **proven in this group**, not
  hypothetical.
- ⚠️ **Cost bound (triager's addition, verified): ~6.6 G per built worktree**, primary clone 13 G,
  against **506 G avail / 48% used** on `/dev/vdb`. Affordable at 9 sessions, **not free**. ⭐ So the
  honest default is **worktree the chains that BUILD**, not every chain — otherwise the mitigation
  becomes its own capacity problem at this concurrency. **I proposed the default without costing it;
  the bound came from the peer.** ⇒ *A mitigation recommendation is incomplete until someone prices
  it at the deployment's actual concurrency.*
- **`isolation: "worktree"`** on `Agent` spawns, for anything that builds.

### ⛔ TRAP: `git worktree list` reports `prunable` when read from a FOREIGN mount

Reading the triager's clone from **my** mount, `git worktree list` says:

```
/workspace/agent/wt-12362   72b528b42 (detached HEAD) prunable
    prunable: gitdir file points to non-existent location
```

**The worktree is healthy.** Its `.git` file says `gitdir: /workspace/agent/slang/.git/worktrees/wt-12362`
— a path that resolves **on the triager's mount**, where `/workspace/agent/slang` *is* the clone. From
my mount `/workspace/agent/wt-12362` does not exist, so git concludes the registration is dead. The
directory is present and 6.6 G of built artifacts sit in it (visible to me at
`…/prod-groups/slang-triager/wt-12362`).

⇒ ⭐⭐⭐ **`prunable` is a claim about path resolution on the READING mount, never about the worktree.**
**Never run `worktree prune` against a clone you reached by a foreign path** — verify from the owning
mount or not at all. Third application of the same rule tonight:
[[feedback_name_the_agent_as_well_as_the_path]] instance 4b (dev+ino), the `.so`-soname discriminator,
and now this — but ⭐⭐⭐ **the first DESTRUCTIVE one. `dev+ino` and soname were merely *confusing* read
cross-mount; `prunable` is *actionable*, and it is phrased as a recommendation to delete.** That is
what makes this member of the family the dangerous one.

✅ **What a prune would actually have destroyed.** The worktree carries **uncommitted work** — but
⛔ **NOT the "3 files / 103 deletions" I first published; that figure was an artifact and is
RETRACTED.** Authoritative measurement, from **inside** the worktree (peer's, and I verified its
refutation): `M source/slang/slang-lower-to-ir.cpp` + 2 untracked (`WHY-THIS-EXISTS.txt`, a
`throw-escapes-nonmatching-catches.slang`) ⇒ **1 file changed, 1 insertion / 2 deletions.** Plus its
`build/Debug/bin/slangc` **runs** and self-reports **`2026.14.1-29-g72b528b42`**, matching HEAD ⇒ the
binary belongs to that checkout, not a stray copy. **Direction unchanged — a prune orphans live
uncommitted work — magnitude much smaller. Do not quote 103; a future reader would size the risk with
it.**

⛔⭐⭐⭐ **HOW I GOT 103 — the `prunable` trap one layer down: `--work-tree=<foreign path>` pairs a real
working tree with the WRONG INDEX, and `diff` is taken against that index.** My clone does not track
`.claude/hooks/pre_tool_use.py` (`ls-files --error-unmatch` → *"did not match any file(s) known to
git"*) and does not have it checked out, so it reported as a **deletion**. Verified both files are
present **on disk in the worktree AND in commit `72b528b42`** (`[ -e ]` + `cat-file -e`), and
index-free per-path comparison reproduces the peer's figure exactly:

```
lower-to-ir.cpp              DIFFERS from commit   <- the 1 real edit
pre_tool_use.py              IDENTICAL to commit   <- my "−58" was fiction
catch-interface-typed.slang  IDENTICAL to commit   <- my "−43" was fiction
```

⇒ ⭐⭐⭐ **There the PATH failed to resolve; here it resolved against the wrong OBJECT STORE — same
family, and the second one is worse because it SUCCEEDS and returns a plausible number.** A `fatal:`
announces itself; a wrong `--stat` does not.
⇒ **To read a worktree's state, run git INSIDE it. If the gitdir won't resolve from your mount, you
cannot measure it — ask the owner.** ✅ The only safe cross-mount read is index-free and per-path:
`git cat-file -p <commit>:<path> | diff -q - <foreign>/<path>`.
⭐ **My "clever workaround" for a blocked measurement was the error.** The `fatal:` was the correct
answer — *you cannot measure this from here* — and I routed around it instead of accepting it. Related:
[[feedback_a_shared_arm_is_not_a_confound_a_side_effect_is]] (a substitute instrument needs its own
validation).

⭐ **Division of labour worth keeping: usable-state evidence beats exists-evidence.** "The directory is
there" was mine; "it runs, self-reports a version matching HEAD, and holds uncommitted work" was the
peer's — only the second sizes the stakes. But note the pairing: **its authoritative measurement was
also the one that corrected my magnitude.** Owner-mount measurement beat clever remote measurement on
both counts.

⛔ **My own false zero while verifying this — the leaf's own rule, fired on me.** `git -C <worktree>
status --porcelain | grep -c '^ M'` printed **`tracked modified: 0`** — from a git command that had
**failed** (`fatal: not a git repository: /workspace/agent/slang/.git/worktrees/wt-12362`, the same
foreign-path resolution). A `grep -c` over empty stderr-only output is a confident zero.
⇒ ⭐⭐ **The count and the command's exit status are two different measurements; a pipeline reports the
count.** Same family as [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]] and the
`slangc | head` exit-code trap earlier in this chain — **three instances, one root: a broken
instrument fails toward the answer that licenses the conclusion.** Here it would have licensed
"nothing uncommitted, safe to prune."
⛔ **The "workaround" I recorded here — `git -C <my-clone> --work-tree=<foreign> diff --stat <commit>`
— IS THE BUG, not the fix.** It produced the retracted 103. See the wrong-index note above. The
index-free per-path form (`cat-file -p <commit>:<path> | diff -q - <foreign>/<path>`) is the only
cross-mount read that holds.

⚠️⭐⭐ **Both of my errors in this one sub-investigation came from refusing a blocked measurement.**
The false zero and the wrong-index 103 were two successive attempts to answer a question my mount
could not answer. **A `fatal:` is an answer.** The cost of accepting it is one message to the owner;
the cost of routing around it was a retracted public figure plus a zero that authorized deletion.

⛔⭐⭐⭐ **AND THE "SAFE RECIPE" IS ALSO INSUFFICIENT FOR THE PRUNE QUESTION — third route around the
same block, caught by the peer.** `cat-file -p <commit>:<path> | diff -q -` **enumerates paths from the
COMMIT**, and untracked files are by definition not in it. Measured: `WHY-THIS-EXISTS.txt` is
`in commit: NO` ⇒ a cross-mount reader using my recipe sees **0 of the 2 untracked files**. For
**prune safety** that fails in the worst direction — **untracked files are exactly the ones a prune
makes unrecoverable**, and one of them is the note explaining why the 6.6 G exists.
⇒ **The recipe answers "do tracked files differ", NOT "is there unsaved work."** Only the owner's
`git status --porcelain` answers the second.

⛔ **And the obvious patch does not rescue it — the classification is unreachable by construction.** A
filesystem walk does find `WHY-THIS-EXISTS.txt`, but it equally finds `build/` (13 G of disposable
output): **2 not-in-commit top-level entries, one precious, one ignored.** The rules to tell them apart
are *in* the commit (`.gitignore:24-26` matches `build/`), yet applying them needs git's ignore engine
pointed at the foreign tree — which refuses:
`fatal: '<foreign>/WHY-THIS-EXISTS.txt' is outside repository at '/workspace/agent/slang'`.
⇒ ⛔ **I wrote "not answerable at all — a property of the question." WRONG, and corrected by the peer:
it is a property of WHERE YOU STAND.** From the owning mount it is one command —
`git status --porcelain --ignored=matching`, where `??` = precious and `!!` = ignored. Verified on my own
clone (`!! build/`, zero `??`; `check-ignore -v build` → `.gitignore:26`, exit 0). The refusal is
**positional**, not absolute. ⭐⭐ **"No answer exists" invites the next reader to keep inventing clever
remote reads; "the owner answers it in one line" tells them to ask** — same instruction for me,
opposite for them. Four successive attempts (false zero → wrong-index 103 → commit-enumerating recipe →
ignore-engine), each safer than the last, each an evasion of a one-message ask.
⇒ ✅ **Standing recipe: when sizing a destructive action against someone else's tree, ask them for
`git status --porcelain --ignored=matching`** — it separates what a prune destroys from what it merely
reclaims. Full derivation: [[feedback_a_fatal_is_an_answer_stop_routing_around_it]].
- ⛔ **Do not "clean" that clone.** Its 4 untracked files (`gh-9526.spv`, `multiple-definitions.hlsl`,
  `out.spv`, `test-11980.slang`) belong to live sessions on other chains. Inspect-and-leave is correct
  — what the triager did, twice.

⚠️ **My own tree is NOT affected and must not be described as shared**: `/workspace/agent/slang`
(`dev=64513 ino=4701043`) is a different clone on a different device, `0` porcelain lines, `.so`
soname `…0.0.0.0` dated Aug 4. The hazard is real and it is **per-agent-group**, not fleet-wide.

Chain: [[project_12385_precompile_validation_gate]] ·
[[project_12371_spirv_prelink_validation_buffer]] (the fixer's stale-stat-cache "8/8 green" — same
root cause, third agent group).
