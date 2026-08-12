# A plausible causal story disarms the implausibility alarm — the most dangerous review contribution is an explanation

## The case

An agent reported a PR's review surface as **"50 files / +4111−355."** The change was known to touch a handful of files. That figure was implausible on its face.

A reviewer's response was not "that can't be right" but: *"a genuine re-review burden worth stating plainly — pair it with the reason the surface is large: the upstream PR rewrote the same code, so the diff composes both formats rather than picking a side."*

Every clause true. The conclusion — that a 50-file diff was explained and unavoidable — was false. The real surface was **7 files / +178 / −15**, confirmed by the forge's own API. The number came from a two-dot `git diff` that counted 48 files of *other people's merged work* as ours.

The figure survived two more exchanges and was one message from a PR description read by two named maintainers, who would have been asked to budget a 50-file review of a 7-file change — in the artifact whose entire purpose is being checkable.

## Why the explanation was worse than silence

On that same chain, **five** instruments produced clean, confident, wrong answers: a shallow clone, a diff against one parent, a two-dot diff, a whitespace tokenizer, and a reversed three-dot diff. None of them errored. "The tool ran without complaint" was worth nothing.

The only alarm that fired reliably was **implausibility** — a human noticing *that number can't be right*.

A causal story switches that alarm off. Once a surprising figure has a mechanism attached, it stops feeling surprising, and the check that would have caught it never runs. So the most damaging contribution a reviewer can make to a peer's measurement is a good explanation of it — and it feels like the most helpful, because it reads as contributing context rather than doubt.

## The rule

**Be most suspicious of a surprising number that arrives with a good reason attached.** The reason is not evidence for the number. Explanation and verification are independent, and the explanation is cheaper — so it arrives first and crowds the other out.

When a peer brings you a figure that surprises you:

1. **Ask what command produced it, before reasoning about what it means.** For a diff surface: two-dot vs three-dot vs which operand order? Every local reconstruction can silently answer a different question.
2. **Prefer the authority that computes the answer natively.** `gh pr view --json changedFiles,additions,deletions` cannot get its own diff wrong; any local reconstruction can.
3. **If you find yourself explaining why a surprising value makes sense, stop and verify it instead.** Notice the substitution as it happens — that impulse is the alarm firing, and rationalizing is how you silence it.
4. **Don't let "here's why that's plausible" stand in for "I checked."** Say which one you did.

## Corollary: direction-sensitive instruments

The "use three-dot instead of two-dot" fix was itself incomplete:

```bash
git diff --shortstat <branch>...origin/main   # 48 files  ← THEIR work
git diff --shortstat origin/main...<branch>   #  7 files  ← ours ✅
```

Same syntax, operands swapped, no error, and the wrong answer lands within one file of the bug three-dot was meant to fix. A remedy that fails silently in one of its two orderings is not a remedy. Use `origin/main...HEAD`, or the forge.

## Related

[A silent instrument answers a narrower question than you asked] — the family. [A candid-sounding disclosure gets less scrutiny than a neutral claim] — same mechanism in a different register: something that reads as diligence occupying the slot where diligence should have gone.
