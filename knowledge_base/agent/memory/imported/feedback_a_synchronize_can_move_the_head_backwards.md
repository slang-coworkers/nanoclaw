---
name: feedback_a_synchronize_can_move_the_head_backwards
description: "A synchronize webhook can be a FORCE-PUSH BACKWARDS that drops the commit a posted review was about. Re-measuring before posting cannot save an already-published comment; test ancestry, and a familiar SHA is the loudest signal."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c75883dc-7e40-40fe-bc16-3feb1af81a7d
---

# A `synchronize` can move the head BACKWARDS, voiding a review you already posted

Measured 2026-08-10 on `slang-coworkers/nanoclaw#1176`.

## What happened

I reviewed head `20af817f` (comment `5239722624`), then a `synchronize` brought `beba52bd`
(+63 lines: a new `python:` CI job). I re-measured and posted a second comment `5239773491`
with two findings about that job. A third `synchronize` arrived — and it was a **force-push
backwards**:

```
head_ref_force_pushed  12:09:06Z  ->  20af817f      # the head I had ALREADY reviewed
git merge-base --is-ancestor beba52bd <head>  ->  NOT an ancestor   # commit DROPPED
git cat-file -t beba52bd  ->  commit                                # object survives, unreferenced
```

So my published follow-up reviewed **code that was no longer on the PR**. I posted
`5239982568` voiding it myself.

## ⭐⭐⭐ The standing rule was necessary but NOT sufficient

The existing rule on this repo is *"never carry a verdict across a `synchronize` — re-fetch
head and re-measure before posting"* (instances: #1084, #1092, #1102, #1103, #1176). That rule
protects the comment you are **about to post**. It does nothing for a comment **already
posted**, because a backwards force-push changes the subject of past work retroactively.

⇒ **On every `synchronize`, ask two separate questions:**
1. *What must I re-measure before posting?* (the old rule)
2. *Which of my ALREADY-PUBLISHED comments just became void?* (this rule)

## The discriminators, both cheap

- **Ancestry, not equality:** `git merge-base --is-ancestor <prev-head> <new-head>`. Non-zero ⇒
  history was rewritten, not extended ⇒ go audit your posted comments. A SHA comparison only
  tells you it *changed*; ancestry tells you whether anything was **removed**.
- ⭐⭐**A `headRefOid` you recognise is the loudest possible signal, and it reads as the
  quietest.** Landing back on a SHA I had already reviewed pattern-matches to "nothing changed,
  nothing to do" — the exact opposite of the truth. **Familiarity is the alarm.**
- ⚠️**A title is not evidence of head content.** The PR was renamed 11:52Z to advertise the
  `python` job; the force-push dropped that job at 12:09Z and the title still claimed it.
  `grep -c '^  python:'` on the head blob settled it in one command.

## Why voiding it myself was the right call

Per [[MEMORY.md]]'s carve-out (silence suppresses BEATS, never FALSE FACTS): a published
comment naming a merge-order dependency and a "not byte-identical" correction, about a commit
the author had already removed, is a false fact live in the author's inbox. Striking it costs
one comment; leaving it costs the author a reconciliation against a commit that no longer
exists. **My own close is the one I am least likely to reopen** — so writing after it is not
overstepping.

⭐⭐Findings about dropped code are **moot-here, not wrong**: I said so explicitly and preserved
the one measurement that stands independently (`origin/nv-slang` reports exactly `Found 15
errors`; clean with open PR #1177 applied), so the work is reusable if the job returns.

Chain row: [[project_nanoclaw_1176_ruff_gate_composed_scope]].
