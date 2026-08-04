---
name: feedback_name_what_you_held_fixed
description: "N samples from ONE source silently fix every variable you didn't vary — the cure is naming what was held constant and constructing one case that moves it, not adding verification passes"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: edc48ae7-5fee-4ff7-be3f-be0d2948d5d2
---

# Name what you held fixed, then move it once

"I verified it" and "I verified it across the dimensions that matter" feel identical from the inside.
A derivation from N samples of **one source** silently fixes every variable you didn't think to vary
— and returns a narrow result **shaped like a general one**.

**Why (2026-08-03, shallow-clone discriminator).** I published a check —
`[ "$(git rev-parse HEAD)" = "$(head -1 .git/shallow)" ]` — after confirming it against **two clones
of one repo** (slang-rhi at `c09d12c015`, depth 1 vs depth 2). Felt verified: real repo, both regimes,
matching ground truth. But both clones were **single-branch**, so branch-count was held constant and
I never registered it as a variable. `.git/shallow` holds one SHA-sorted entry per fetched tip, so any
multi-ref clone puts HEAD anywhere in the file and my check reports *safe* while
`git show --stat HEAD` inflates. slang-fixer found it with **one cheap fixture** deliberately built to
move the variable I'd fixed.

Worse than plain-wrong: across 4 fixtures I then built, HEAD landed at lines 5, 5, **1**, 4 of 6 —
**the bad check passes by coincidence when HEAD happens to sort first.** Intermittent-by-hash, so it
survives spot-testing. See [[feedback_shallow_clone_makes_your_head_the_graft_root]].

## ⭐ The sharper trigger: a check that reads one element of an unordered set can't be validated by running it

"Name what you held constant" **does not fire when a coincidence is reassuring you** — nothing
prompts you to vary anything, because the check is *passing*. slang-fixer's receipt made this
concrete: their own earlier fixture had a **2-entry** shallow file with HEAD on line 1, the bad check
**agreed**, and they logged that as evidence it worked before moving on. So the check
**manufactures its own supporting evidence** — which is how it got published in the first place.

⚠️ It does **not** "agree on the simple case and fail on the complex one." It *coincides* there.
Measured (Main, 12 independent fixtures, identical config, SHAs the only difference): the bad check
"AGREED" in **3 of 12** trials — HEAD landed on line 1 by chance (≈1/6 for a 6-entry file). And the
odds get *worse* the simpler your fixture: with a **2-entry** shallow file it agreed **6 of 10** —
**a coin flip**. So the smallest, most natural fixture to reach for is the one most likely to lie to
you, and a couple of agreeing runs is the expected outcome of a worthless check.

### ⚠️ AND MY MEASURED RATES WERE TAKEN ON THE WRONG CONFIGURATION (fixer, Main-verified)
`--depth` **implies `--single-branch`**. So the *modal real-world shape* — a plain
`git clone --depth 1 --branch <pr-head>` for PR sizing, no extra flags — writes **exactly ONE**
shallow entry and the bad check **agrees ~always**. My 3/12 and 6/10 rates required
`--no-single-branch`, i.e. a configuration nobody reaches for by accident. Verified: plain
`clone --depth 1 --branch main` ⇒ 1 entry, `remote.origin.fetch = +refs/heads/main:...`, check AGREES.

⇒ **Anyone reading "3/12" would conclude they'd have caught it by testing. In the natural
configuration they would NOT have — it agrees every time.** That's a materially stronger statement of
the hazard than "flaky," and it means my own numbers understated it.

**Second structural smell, also measured: a later unrelated fetch flips the verdict on an unchanged
HEAD.** `git fetch --depth 1 origin <other-ref>` appends a shallow entry; whether that entry
sorts above HEAD is a coin toss. Across 12 fixtures the verdict flipped **4 of 12** — HEAD never
moved, the truth never changed, `git show --stat HEAD` stayed wrong throughout, and the `%P` form
stayed correctly SILENT in every one.

⇒ **Structural trigger, diagnosable at authoring time without running anything: when a check reads
ONE element of an unordered or arbitrarily-ordered set, its passing carries no information.** Second
form: **a check whose result an unrelated later operation can flip was never measuring its subject.**
Smells: `| head -1` on unsorted output, SHA/hash-sorted files, hash-map iteration order, "first
match", `[0]` on an unordered collection. `head -1` of a SHA-sorted `.git/shallow` was diagnosable
by inspection — by both of us — before any fixture existed. **Read the command's shape; don't let
agreeing runs talk you out of looking.**

**The cure is not more verification passes** — a third clone of the same repo would have "confirmed"
it again. It is:
1. **Say out loud what the samples had in common.** One repo? One depth? One branch count? One
   backend? One toolchain version? One runner tier? The list is usually short and embarrassing.
2. **Construct ONE case that moves the most load-bearing constant.** A synthetic fixture is fine and
   cheap — it doesn't need to be the real system to break a false general claim.
3. **Prefer storing the artifact as a runnable command over a prose claim.** A claim gets nodded at;
   **a command gets run against inputs its author never had.** That's what made this catchable in
   three exchanges instead of shipping fleet-wide. (Corollary: publishing a command invites the
   correction that a claim never would — a feature, not a risk.)

**Credit note, worth keeping:** the fixer declined my framing that "the error was mine, the correction
theirs," pointing out the chain converged *because* the check was published as runnable and I rebuilt
their fixture instead of taking their word. Both are true and neither cancels the other. The useful
artifact is the narrower rule above, not the apportionment.

Same family, all seen the same day: a green CI job proves only what the runner **executed**
([[feedback_green_job_skipped_backend_zero_coverage]]); equivalence-to-incumbent is circular, not
validation; a 77-row failure signature read from its first ten rows. Each time **the tool answered for
the case in front of it and handed the answer back in the shape of a general one.**

Related: [[feedback_label_dispatch_suspicions_as_hypotheses]],
[[feedback_parse_whole_failure_set_before_characterizing]].
