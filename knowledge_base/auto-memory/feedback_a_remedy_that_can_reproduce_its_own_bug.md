---
name: feedback_a_remedy_that_can_reproduce_its_own_bug
description: Three fixes on one chain failed in the same shape as the failure they fixed — check a remedy against the original failure mode before adopting it
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 0c1e5200-765f-4703-8e18-4b677d151754
---

**2026-08-05, slangpy#1052 chain. Three instances, all confirmed:**

| original failure | the remedy | how the remedy reproduced it |
|---|---|---|
| two-dot diff `A..main` counted others' merged work as ours (49 files vs 7) | "use three-dot" | three-dot is **direction-sensitive**: `A...main` → 48 files (their work), `main...A` → 7 (ours). No error either way, and the wrong answer lands within one file of the original bug. |
| a direct dispatch **forked** the worker; attribution became unrecoverable | "enumerate your own sends" | enumeration at **session** scope is complete about a session and *partial* about an agent — I ran it and still got the wrong answer, because a sibling session wrote the message. |
| a tracked to-do was re-raised as outstanding for ~10h after being filed (#1091) | "before re-raising, run a search" | `--search "... in:title"` returned **`[]`** for an issue that exists (words absent from the title). **An over-constrained search is byte-identical to "not filed"** — exactly the signal the remedy was written to correct. |

⭐⭐⭐**A remedy that can reproduce the bug it fixes is not a remedy.** In all three cases the fix was *correct in spirit* and had a failure mode in the same family as the original — silent, clean, confident, wrong. The corrected forms: `origin/main...HEAD` or `gh pr view --json changedFiles,additions,deletions`; enumerate **sessions then sends**; plain needles or `--search "author:<bot> sort:created-desc"`.

⇒ **Routine, not incidental: after writing a remedy, run it against the original failure case and ask whether its own failure mode is distinguishable from the bug's.** If the remedy can return the same misleading signal, it needs a control or a different authority (prefer the one that computes the answer natively — a forge API over a local reconstruction).

## A WATCHER IS SESSION-SCOPED STATE — its death is silent and reads as "still running"

**2026-08-05, same chain.** slangpy-triager armed a CI monitor in an earlier session so it wouldn't have to poll. The session ended; **the monitor died with it.** No completion event ever fired. It would have sat on a fully green gate indefinitely, believing it would be told — CI was in fact **17/17 success on check-runs plus success on the legacy status surface**.

⭐⭐⭐**"I have a watcher on this" silently becomes false at a session boundary, and unlike a failed command it emits NOTHING** — so permanent silence is indistinguishable from "still running." This is the chain's signature failure in its purest form: absence of signal vs absence of event, with no error text anywhere to read.

⇒ **Treat any watcher armed in a prior session as DEAD until proven otherwise** — the failure is invisible from inside the new session, so there is no observation that will prompt you.
⇒ **Re-verify the underlying state directly rather than trusting a watcher's silence.** A monitor is an optimization over polling, never evidence.
⇒ Same reasoning applies to a peer's silence: **silence is uninformative, not "nothing happened."** (Six of this peer's outbounds landed empty on my side in one stretch — one-directional loss, no error on either end.)

## "Waiting for the next round" can be waiting for an event with no shape

Deferring a public-artifact refresh until "after round 2 settles" assumed round 2 was a discrete event. Checking the review threads: all four of the maintainer's threads were **unresolved**, and **three of four were `isOutdated: true`** — the code they pointed at had already changed. So the likely path was never a fresh round; it was him reading the current state and either resolving threads or approving. **`CHANGES_REQUESTED` persists until he acts even when the substance is answered, and no event fires in between.**

⇒ **Before deferring work to a milestone, check that the milestone is an event and not an inference.** Prefer a refresh whose text stays accurate either way — that's the property to optimize for, not "wait until more is known."

## Companion mechanism: how credit actually drifts (and my precise share of it)

The chain produced four attribution loops. slangpy-triager's summary: **credit drifts to whoever last relayed a fact.** My concrete contribution, verifiable from my own message: I read the `128 = 64 + 64` boundary finding in the fixer's #1091 comment, then restated it in my next message — accurately, and **without attribution** ("Note the boundary is exact and ugly…"). The triager, reading it there, cited it back to me as "your boundary detail."

⭐⭐**The mechanism is not claiming credit; it is omitting a source while restating.** An unattributed restatement is indistinguishable from an original contribution to the next reader, so the relay silently reassigns authorship. ⇒ **Cite the computation, or cite no one** — and when restating a peer's finding, name where you read it, in the same sentence.

⭐⭐**Countervailing (earned the hard way): my self-corrections have their own error rate** — three offered on this chain did not survive checking. So *"I got this wrong"* needs the same verification as *"you got this wrong"*, from both seats. Self-blame drifts toward whoever is currently being scrupulous.

Related: [[feedback_a_sentence_can_rot_without_becoming_false]] · [[feedback_i_broke_the_gate_i_was_enforcing]] · [[feedback_a_plausible_story_disarms_the_implausibility_alarm]] · [[technique_git_log_S_in_a_shallow_clone_returns_a_false_origin]].
