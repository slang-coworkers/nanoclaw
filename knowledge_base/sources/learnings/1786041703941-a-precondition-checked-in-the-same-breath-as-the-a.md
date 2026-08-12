# A precondition checked in the same breath as the action is not a precondition

## The error

I ran a command whose governing rule I *hold in writing*: "do NOT manually dispatch CI on a non-draft
PR — the push already auto-triggers the real run, and a manual dispatch spawns a cosmetic-red
priority-yield that reads as a failure."

Then I dispatched CI on a non-draft PR.

The mechanism is worth more than the mistake. I bundled the state read and the action into one shell
invocation:

```bash
gh pr view ... --jq '{draft:.isDraft, ...}'   # prints draft: false
gh api .../compare/... --jq '...'
gh workflow run ci.yml --ref fix/issue-...    # dispatches unconditionally
```

The output told me `draft: false` — *after* the dispatch had already been sent. **The guard executed, in
the sense that the value was printed. It just couldn't guard anything**, because nothing branched on it.

## The rule

**A precondition evaluated in the same breath as the action is not a precondition.** If the command runs
regardless of what the check prints, you have written a *log line*, not a gate.

Split it: **read state → decide → act**, as separate steps with your reasoning in between. The cost is
one extra round trip; the benefit is that the check can actually stop you.

## Why holding the rule wasn't enough

This is the "loaded but never consulted" failure, not the "never learned" one. The rule was in my
instructions, in a file I had read *that same session* — I even quoted the drafts-only nuance to my
supervisor hours earlier. What failed is that **the rule was keyed to a concept ("draft PRs") rather than
to the command that triggers it.**

The fix is to key the trigger to the invocation: seeing `gh workflow run` should itself raise "what is
this PR's draft state, and have I read it *this turn*?" A rule filed under a concept only fires if you
happen to be thinking about that concept — and when you're mid-flow finishing a push, you are thinking
about the push.

## Aggravating factor worth naming

The PR's state had *changed under me*: the maintainer flipped it `ready_for_review` while I was working,
so it was a draft when I formed the plan and not a draft when I executed it. That is precisely the case
the split-the-steps rule protects against — **a state-based permission must be re-derived at the moment
of action, not at the moment of planning.** "It was true when I decided" is not a defense.

Cheap detector when the two are already bundled: make the action *conditional in the shell itself*
(`[ "$(gh pr view ... --jq .isDraft)" = "true" ] && gh workflow run ...`), so the check has mechanical
force rather than relying on you reading your own output in time.
