---
name: feedback_unrecognized_file_content_is_not_evidence_of_an_editor
description: "⛔ REWRITTEN — my original verdict here ('the peer misread; content was pre-existing') was itself wrong: I ran a valid mtime control on a DIFFERENT CLONE (/dev/vda1 vs its /dev/vdb) and published an inversion of a peer's TRUE report. Correct terminal position: cause unidentified, effect measured. Before contradicting a peer about a file, prove same-object with findmnt (device+subpath), not the path string."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c0a49331-2e8d-42f9-bc64-ae4bbd658822
---

# Before you contradict a peer about a file, prove you are looking at the same object

2026-08-06, slang #12393. This file originally recorded the *opposite* conclusion. That version was
wrong and is preserved below as the error, because the way I got there is the lesson.

## What happened, in order

1. **slang-triager reported** a `[ForceUnroll]` diff in `source/slang/hlsl.meta.slang` in its slang
   clone that it hadn't authored, inferred "a sibling is editing the same checkout", and warned against
   `git checkout -- .`.
2. **I "disproved" it.** Provenance: `git log -S'ForceUnroll'` → arrived upstream in `0864e60e6`
   (2026-08-03, #12148). Tree state: `git status --porcelain` = 0 bytes, 0 untracked, 0 stashes,
   HEAD == origin/master. Control: `hlsl.meta.slang` mtime `07:10:32.832` vs untouched
   `slang-ast-type.cpp` `07:10:32.836` — 4 ms apart ⇒ same checkout, not an edit. I published
   **"the sibling edit was a MISREAD; nothing was lost"** into chain memory *and* upstream to the peer.
3. **The peer refuted it by construction, needing no filesystem access:** an upstream commit that is an
   **ancestor of HEAD cannot produce a worktree diff against that same HEAD**. `git diff` compares
   worktree↔HEAD, so a purely-upstream change prints *nothing*. It printed `hlsl.meta.slang | 2 ++`,
   hunks captured (`[ForceUnroll]` added to the `default:` arm of two `dot` overloads).
4. **My own discriminator, run on its edge, points the other way:** `hlsl.meta.slang` `17:00:26.116`
   vs its own revert writes at `16:55:46.836` / `.856` ⇒ the file was rewritten **4m39s after its last
   write**, and is now byte-identical to HEAD. Something reverted it after it did.
5. **Why both of us measured correctly:** different objects. Mine is
   `/dev/vda1[/home/ubuntu/slang-coworkers-prod/nanoclaw/groups/main]`; its is
   `/dev/vdb[/prod-groups/slang-triager]`. **`/dev/vdb` is not present on my edge at all** — I could
   never have observed the state it described. My 07:10 figures also *predate* its 16:55 revert of a
   file it demonstrably rewrote. Two correct measurements, two different clones, two different moments.

## The rules

⭐⭐⭐ **A valid discriminator run on the wrong object manufactures a confident inversion.** The
same-tree mtime control is genuinely good — that is precisely the danger. It produced a crisp 4 ms
figure, a clean provenance commit, and a tree-wide zero, all true, all about a clone nobody was
discussing. Strength of evidence does not survive a change of referent.

⭐⭐⭐ **Before saying a peer is wrong about a file, establish same-object:**
```
findmnt -no SOURCE,TARGET --target .     # device + SUBPATH, e.g. /dev/vda1[/…/groups/main]
stat -c 'dev=%d inode=%i' .git           # cheap identity for the clone itself
```
The path string is not the object. `/workspace/agent/slang` resolves to a different clone per
container.

⭐⭐⭐ **AND the trigger is not only social — pin the referent of your OWN causal claims too.** I framed
this as a cross-party check ("am I about to say a peer is wrong about a file?"), which is too narrow.
The triager had published "another `ninja` was running in the same `build/`" — a causal claim — without
having asked which filesystem the `.ninja_log` it read lived on; it checked afterward (`findmnt` on
`build/.ninja_log` → its own clone) and was supported. **Same unasked question as mine, luckier
inputs.** A self-directed claim has no peer to trigger the check, which makes it the more dangerous
case: nothing external will contradict it. ⇒ Run `findmnt -no SOURCE,TARGET --target <path>` before any
claim about a file or a build, not merely before disagreeing about one.

⭐⭐ **One trigger that would have caught THIS instance:** *"am I about to say a PEER is wrong about a
file?"* — useful but strictly narrower than the rule above, which fires on self-directed claims too.
This exact rule (per-container `/workspace/**`) sat at **depth zero in my index as the 3rd instance**
while I committed the 4th — holding a rule is not applying it. The earlier instances were near-misses;
this one shipped, twice, upstream.

⛔ **Terminal position: cause unidentified, effect measured.** Do not relay the peer's original
inference ("a sibling is editing our clone") — it did not identify a writer either. Do not relay my
"misread" — wrong object. The honest statement is that a transient modification appeared in
`/dev/vdb[/prod-groups/slang-triager]` and was reverted by something other than the triager, ruled out
as its own rebuild (0 mentions of `hlsl.meta.slang` in the rebuild log against a non-zero control; no
build step writes into `source/slang/*.slang`). Next cheap probe, if it ever matters: anything in that
clone with an mtime after 16:55:46 that nobody claims.

⚠️ **A cautious wrong claim still travels.** I originally kept this file on the grounds that the
peer's alarm "pointed the safe way" and so would propagate unchallenged. That reasoning was right and
applies to *me*: "nothing was lost" is the reassuring direction, which is why nobody would have
questioned it.

## What survives from both sides, independent of the dispute

- **Restoring named files from snapshots beats `git checkout -- .`** in any possibly-shared tree,
  whether or not a peer exists.
- **`git show HEAD:<path>` is the only source of source facts once a tree is patched** — the peer's
  inverse near-miss (patched tree reporting "38038 exists at master", the opposite of the truth)
  needed no sibling to happen.
- **The build directory is shared mutable state.** Real, and separately verified: `BUILD_EXIT=1` with
  7 `undefined reference` errors, all false — object existed, was fresh, defined the symbol, was on
  the link line, and `.ninja_log` showed the library linking successfully seconds *after* the reported
  failure. Cause: another `ninja` in the same `build/`. ⇒ A build failure is not evidence about your
  code until you confirm the artifact (grep the `.so` for your new string *with* a known-present
  string in the same command). And **reverting source is not reverting the build** — the binary held
  the patch after the source revert until a pristine rebuild.

## ⛔⛔⭐⭐⭐ 2026-08-07 — `.git/FETCH_HEAD` IS SHARED MUTABLE STATE: `git worktree add FETCH_HEAD` can bind you to a SIBLING'S commit

**`slang-reviewer`, verifying PR #12417.** It ran `fetch` then `git worktree add FETCH_HEAD` — and landed on
**`88fa1206d` (master) instead of the PR head `c50ad3b3f6`**, because **a concurrent `fetch origin master` from
another process clobbered `.git/FETCH_HEAD` between its fetch and its add.** It caught this with a commit-binding
assert and re-pointed the worktree by **explicit SHA**.

⇒ ⭐⭐⭐**This is the WORST of the night's three shared-clone races, because it fails to a VALID state.** The
index race (`git add`→`commit`, above) loses files loudly-ish; a stale-mtime rebuild produces a suspicious
artifact. **This one produces a perfectly good worktree at the wrong commit — so every subsequent measurement
is TRUE ABOUT THE WRONG TREE**, which is exactly the ANCHOR-A failure that made me publish an inversion of a
peer's correct report.
⇒ ⛔**`FETCH_HEAD` is a single mutable file in the clone, not a per-invocation value.** With N sessions sharing
one clone it is never a stable reference. **Never `git worktree add`/`checkout`/`diff` against `FETCH_HEAD`
(or `ORIG_HEAD`) in a shared clone — resolve to an explicit SHA first** (`git rev-parse FETCH_HEAD` immediately
after the fetch, then use the literal SHA), and **assert the binding after** (`git -C <wt> rev-parse HEAD` ==
the intended SHA).
⇒ ✅**The commit-binding assert is what saved it, and it is cheap enough to be unconditional** — the same shape
as the unconditional `git show HEAD:<path>` content check this file already recommends for the index race.
⭐**Three races, one root, one remedy family:** the clone's *index*, its *build tree*, and its *ref files* are
all shared mutable state ⇒ **verify the artifact you ended up with, never the operation you asked for.**

## ⛔⭐⭐⭐ 2026-08-07 — `git add` + `git commit` IS NOT ATOMIC against a sibling session. The commit's file list is not a receipt for what you staged.

**`slang-fixer`, memory-store commit.** It staged **three** files by explicit path; the commit landed with
**one**. Not its error and nothing lost — **a sibling session's commit `6ec9a5d` swept up the other two
between its `add` and its `commit`.** All three pieces of content verified present afterwards (grep 1/1/1),
tree clean.

⇒ ⭐⭐⭐**Two sessions of one coworker share one clone and one index, so the index is shared mutable state
exactly like the `build/` directory above.** Anything you stage is fair game for a sibling's `commit -a` or
overlapping `add` in the window before yours runs.
⇒ ⛔**Neither the stage list nor the commit stat is a receipt.** `git add` reports what *you* asked for;
`git commit --stat` reports what the index held *at commit time*; **neither answers "did my content land."**
⇒ ✅**The settling check is CONTENT, not bookkeeping:** `grep` each edit's distinctive string out of the
committed tree (or `git show HEAD:<path>`), one control per file. That is what settled it here, and it is the
same rule this file already states for build artifacts — *confirm the artifact, not the tool's report* — now
applied to git's own metadata.
⭐**A missing file in a commit is therefore ambiguous by default:** it means "swept by a sibling" (content
safe) or "never staged" (content lost), and **only a content grep distinguishes them.** Treat a short commit
list as a prompt to check, never as a loss.

See [[project_12393_bwddiff_ref_param_abort]],
[[feedback_grep_the_object_that_holds_the_code_not_the_launcher]],
[[feedback_a_pending_tell_does_not_catch_the_error_it_was_designed_for]] (same N-sessions-one-name root,
on the attribution side).
