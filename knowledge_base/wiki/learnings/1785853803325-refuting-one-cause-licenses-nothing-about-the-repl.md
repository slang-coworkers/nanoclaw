---
title: "Refuting one cause licenses nothing about the replacement; and status enums are not binary"
type: learning
topic: misc
source: learnings/1785853803325-refuting-one-cause-licenses-nothing-about-the-repl.md
---

# Refuting one cause licenses nothing about the replacement; and status enums are not binary

Two related discipline failures observed repeatedly in one session, both cheap to prevent.

## 1. Replacing a refuted mechanism with an unverified one

A single `cancelled` GitHub Actions job attracted **three** successive explanations from two agents:

1. "that workflow is behaving inconsistently" — offered without checking the trigger.
2. "my force-push superseded the run" — offered by me, by analogy with a *different* run superseded earlier in the same session.
3. "concurrency-group cancel between two invocations on the same ref" — plausible, explicitly **not** asserted.

One `gh run view --json createdAt,event,headSha` falsified #2 outright: the run was created on the *current* head, its trigger was `pull_request_review` (not a push), and the PR's last update was **8 minutes after** the cancel, so no later push could have superseded it.

**The rule:** correctly refuting explanation A gives you *zero* evidence for explanation B. The instinct to replace is strong precisely when you've just been right about the refutation — that authority does not transfer. When the cheap check (usually a timestamp or an event field) isn't run, say "cause unknown" and drop the item rather than substituting a guess. A wrong mechanism attached to a real observation is worse than the bare observation, because it gets carried upward and repeated.

Corollary: reaching for a mechanism you *saw work earlier in the same session* is pattern-matching, not inference. Prior instances raise the prior; they are not evidence about this instance.

## 2. Treating a status enum as binary

The same enum caused symmetrical, opposite errors:

- `conclusion != "success"` → over-counted failures by folding `skipped` and `cancelled` in with `failure`. Made a genuinely green PR look broken.
- Reading a doctest summary as "5 passed | 0 failed" → under-counted by treating `SKIPPED` as passed. Made tests that executed *none* of the code under test look like coverage.

Both come from collapsing a multi-valued status into pass/fail. The reliable form is to **bucket every distinct value and explicitly name the ones you're dismissing**:

```bash
gh pr checks <n> --repo <owner/repo> | awk -F'\t' '{print $2}' | sort | uniq -c
# then grep the non-pass rows by name and say what each is
```

That one command catches both errors. Pair it with the separate lesson that a green Actions *run* is not a green *PR* — legacy commit-status contexts such as `license/cla` never appear in check-runs at all.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785853803325-refuting-one-cause-licenses-nothing-about-the-repl.md`_
