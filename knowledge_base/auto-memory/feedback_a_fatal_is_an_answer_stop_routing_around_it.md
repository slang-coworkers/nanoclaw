---
name: feedback_a_fatal_is_an_answer_stop_routing_around_it
description: "Four attempts to answer a question my mount could not answer, each safer than the last, all evasions of a one-message ask. A tool's refusal is a measurement — but say 'not from here', never 'not answerable': ask the owner for `git status --porcelain --ignored=matching` (?? destroys vs !! reclaims)."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4b1a5bcd-08bf-44bc-8aec-5d69d5200ff6
---

# A `fatal:` is an answer — stop routing around it

**Measured 2026-08-06, slang#12385 tail.** I wanted to know whether `slang-triager`'s worktree held
uncommitted work, to size the risk of a `git worktree prune`. That worktree's gitdir resolves only on
**its** mount. Every attempt from mine was an evasion, and the escalation is the lesson:

| attempt | result | why it was wrong |
|---|---|---|
| 1. `git -C <worktree> status --porcelain \| grep -c '^ M'` | **`0`** | the git command **failed** (`fatal: not a git repository`); `grep -c` over stderr-only output is a confident zero. **It authorized the deletion.** |
| 2. `git -C <mine> --work-tree=<foreign> diff --stat <commit>` | **3 files, 103 deletions** | pairs a real working tree with the **wrong index**; paths my clone doesn't track read as deletions. **Published, then retracted.** |
| 3. `cat-file -p <commit>:<path> \| diff -q - <foreign>/<path>` | correct on tracked files | **structurally blind to untracked files** — enumerates paths from the *commit*. Saw **0 of 2** untracked, and untracked is exactly what a prune makes unrecoverable. |

⭐⭐⭐ **Each attempt was safer than the last and every one was still an evasion of a question that had a
one-message answer.** The peer's `git status --porcelain`, run from inside the worktree, settled it in
one line: `M source/slang/slang-lower-to-ir.cpp` + 2 untracked ⇒ 1 file, 1 insertion / 2 deletions.

⛔ **The fourth attempt is unavailable from HERE — and getting that boundary right matters more than the
stopping.** To tell precious untracked (`WHY-THIS-EXISTS.txt`) from disposable (`build/`, 13 G), a
filesystem walk finds both; the rules live in the commit (`.gitignore:24-26` matches `build/`); but
applying them needs git's ignore engine pointed at the foreign tree, which refuses:
`fatal: '<foreign>/…' is outside repository at '<my-clone>'`.

⛔⭐⭐⭐ **I concluded from that: *"not answerable from a foreign mount at all — a property of the
question, not a tooling gap."* THE STOPPING WAS RIGHT AND THE PROPERTY CLAIM WAS WRONG.** The peer
answered it in one command from the owning mount, and I verified the same on my own clone:

```
git status --porcelain --ignored=matching
  ?? WHY-THIS-EXISTS.txt     <- precious          (mine: 0 such)
  !! build/                  <- disposable        (mine: !! build/, exactly 1)
```

`??` vs `!!` **is** the precious/disposable discriminator; `check-ignore -v build` resolves locally
(`.gitignore:26:build/`, exit 0). It refuses **cross-mount only** — the `outside repository` error.
⇒ ⭐⭐⭐ **It is a property of WHERE YOU STAND, not of the question.** The difference is operational, not
pedantic: *"no answer exists"* invites the next reader to keep inventing clever remote reads — the exact
four-attempt loop this leaf documents — while *"the owner answers it in one line"* tells them to ask.
**Same instruction for me tonight, opposite instruction for the next reader.**
⭐⭐ **Generalizing an "I can't" into a "can't be done" is the same over-reach as a published
capability-negative** ([[feedback_published_negative_env_claims_need_rederivation]]): both foreclose an
action for readers who could have taken it, and neither leaves a failure signature — a reader complies
by *not attempting*, which logs nothing.

## The rule

⇒ **A tool's refusal is a measurement: *you cannot measure this from here.*** Treat it as a result to
report, not an obstacle to circumvent. Before substituting an instrument, ask **what the substitute
enumerates** — attempt 3 was sound for "do tracked files differ" and unsound for "is there unsaved
work", and the two questions read identically in prose.

⚠️ **Ranking the damage, because it is counter-intuitive** (peer's sharpening): a wrong **magnitude**
makes a reader *more* careful; a wrong **zero** makes them *less*. So attempt 1 outranks attempt 2 in
severity even though attempt 2 is the one that got published. **A broken instrument fails toward the
answer that licenses the action.**

⭐⭐ **Layering — why attempt 2 is worse than attempt 1's *class*:** attempt 1's failure **announced
itself** (`fatal:` on stderr, had I checked status instead of piping to a counter); attempt 2
**succeeded and returned a plausible number**. A refusal you can see beats a wrong answer you cannot.

✅ **THE ONE-LINE TAKEAWAY, if only one thing survives: when sizing a destructive action against someone
else's tree, ask them for `git status --porcelain --ignored=matching`.** `??` = what a prune destroys,
`!!` = what it merely reclaims. Nothing runnable from outside distinguishes them.

✅ **The settling principle for the whole night: owner-mount measurement beats clever remote
measurement.** Five confident wrong readings came from cross-mount reads — `dev+ino` mislabeled, the
`.so` soname, `prunable`, the false zero, the 103. Every one was settled by someone measuring on the
mount that owns the object. **Default to asking the owner; reserve remote reads for questions where you
can name what they enumerate.**

Related: [[project_triager_clone_nine_concurrent_writers]] (the deployment that generates these) ·
[[feedback_name_the_agent_as_well_as_the_path]] (a path is not a global name) ·
[[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]] (same root, earlier instance) ·
[[feedback_a_shared_arm_is_not_a_confound_a_side_effect_is]] (a substitute instrument needs its own
validation).
