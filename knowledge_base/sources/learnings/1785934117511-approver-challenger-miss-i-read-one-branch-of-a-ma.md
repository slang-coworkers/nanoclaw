# [approver/challenger-miss] I read one branch of a maintainer's disjunction as a broken promise — and attributed our own bot's commitment to a named human engineer

## Symptom

On slang#12080 I reported, and a peer relayed upward, that the PR author had **agreed to remove** a
defensive loop and then **silently reversed** — defending it across three review rounds instead. I framed
it as "a maintainer noticed an accepted commitment was reversed without notice," and said the re-gate
question was no longer *"is this guard tested?"* but *"why is it still here after you agreed to delete it?"*

Both halves were wrong, and the error was aimed at a named engineer.

## Root cause 1 — I compared our own bot's commitment against a human's code

The 07-23 four-point plan I treated as "the author's plan" is issue comment `5063298614`, authored by
**`nv-slang-bot[bot]`** — our own shared identity — not by `szihs`. Verified:

```
$ gh api repos/.../issues/comments/5063298614 --jq '{login:.user.login,type:.user.type}'
{"login":"nv-slang-bot[bot]","type":"Bot"}
```

So "the author agreed, then reversed" compared **our bot's promise** against **a human's commits**. I had
*already written the rule that catches this* ("our bot said X is a provenance claim needing resolution to
a tier") one message earlier, applied it to the question "do I owe this work?", and then failed to apply
it to the adjacent question "who promised this?" **A rule applied to one question does not transfer itself
to the next question in the same artifact.**

## Root cause 2 — I read one branch of a disjunction as non-compliance

The maintainer wrote: *"We need to either **remove** the loop **or justify it strongly**."* That is a
disjunction. I checked only the first branch, found the loop present, and scored it `❌ not done`.

Measured at head `948da4328d91`:

- **24 comment lines** of justification attached to the loop (`slang-ir-transform-params-to-constref.cpp:253`)
- **two dedicated tests**, one per decline reason, both present (HTTP 200):
  `cuda-forward-uniform-signature-preserved-callee.slang`, `cuda-forward-uniform-unprocessed-callee.slang`

The second branch was taken, deliberately and substantially. My `❌` recorded a satisfied requirement as a
broken one.

## How to catch it

- **Parse the requirement's logical form before scoring it.** "Either A or B" is satisfied by B. Scan for
  `or` / `unless` / `alternatively` / `at minimum` and enumerate every branch; a checklist that tracks only
  branch A converts a legitimate choice into non-compliance.
- **Resolve "who said this?" per utterance, not per thread.** Same bot identity spans tiers; same thread
  spans parties. Check `user.login` / `user.type` on the *specific* comment id.
- **Before reporting non-compliance about a named person, verify the obligation was theirs.** The cost is
  asymmetric: a missed gap is a review defect, an unfounded accusation is directed at a person and travels
  upward through tiers as fact.
- **Ownership of code needs the committer field, not just the author.** Author *and* committer both
  `Harsh Aggarwal` on all 7 commits settled it; our bot's 46 force-pushes bracket the commit range on both
  sides (pushes 07-13…08-03T18:22 vs commits 07-21…08-03T14:24), i.e. a sync/dispatch role, not authorship.
  `author` and `committer` both survive a force-push by design, so **neither reveals pushes** — and pushes
  alone don't establish authorship either. Three fields, three different questions.

## Fix

What survived: `BLOCKED ON AUTHOR` (the CI failure is independent and real), and the narrow open item —
an automated push path operating on a maintainer's branch with **no identified owner**
(`performed_via_github_app` null on every event). That is an unaccounted write path, not covert authorship.

What is retracted: "the author agreed then silently reversed," the `❌` on that plan step, and any framing
that treats the loop's presence as non-compliance.

**The generalizable failure is compounding two weak inferences into a confident accusation.** Fact 1: our
bot pushed the branch 46 times (true). Fact 2: the loop is still present (true). Neither supports "a human
broke his word" — that needed a third premise (whose promise it was) which I never checked, and a fourth
(that removal was the only compliant option) which was false. Two true facts plus an unchecked bridge
produced something worse than either error alone, and it reached a peer's escalation before a third tier
caught it.

**Corollary on who catches what:** this was found by the tier holding the repo, not by me re-reading my own
analysis. Consistent with the pattern that a claim about an artifact is settled by whoever can open it —
re-reading my reasoning would never have surfaced the comment's author id.
