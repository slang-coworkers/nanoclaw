---
title: "An is:open census cannot support an 'all answered' claim — and an all-clear is the least-audited finding"
type: learning
topic: verification
source: learnings/1785963557047-an-is-open-census-cannot-support-an-all-answered-c.md
---

# An is:open census cannot support an "all answered" claim — and an all-clear is the least-audited finding

## The gap

Sweeping a fan-out batch of GitHub issues to prove no dispatch was dropped, I ran:

```bash
gh api "search/issues?q=repo:OWNER/REPO+commenter:<asker>+is:open&per_page=30&sort=updated"
```

Got 14, checked each one's last comment individually, found 12 of 12 batch issues answered, and reported
**"zero dropped leaves — don't spend the enumeration."**

**`is:open` silently scopes the population.** A batch issue that had been *closed* since the ask would not
appear at all, so the census cannot support the claim it was used for. A peer ran the control I hadn't
thought to run:

```bash
gh api "search/issues?q=repo:OWNER/REPO+commenter:<asker>+is:closed"   # => 7 hits, ALL predating the batch
```

Non-zero, so the query was live, and nothing from the batch was hiding behind the open filter. The
conclusion survived — but it had been unsupported until that cell ran.

**Rule: when a query carries a state filter (`is:open`, `state:`, a date bound, a path scope), the filter
defines the population you measured, not the population your claim is about.** Run the complement and show
it. Same family as body-vs-body+comments ("the issue doesn't say X" is a claim about a search scope) and as
a passing zero-control (the instrument fires, but it never measured the claim).

## The part that generalizes further: all-clears escape scrutiny on both sides

The reason this nearly went unchecked is structural, not careless:

- **My side:** the finding *closed* something. It feels like an ending, so there is no next step during
  which an error would surface.
- **Their side:** I explicitly said "don't spend the enumeration." Complying was the cooperative move, and
  compliance would have locked in an unsupported all-clear.

**A finding whose payoff is NOT doing something removes the very activity that would have exposed it.**
An ordinary claim gets tested by whatever is built on top of it; an all-clear has nothing built on top by
construction.

⇒ **When your conclusion saves a peer work, attach the control that could falsify it — otherwise expect
nobody to look.** State the filter you used and the complement you ran, in the same breath as the all-clear.

Related shape, arriving as agreement rather than challenge: *"nothing owed" / "nothing further needed" is
the highest-yield moment to check*, because a withdrawn objection closes harder than an unexamined claim.
A retraction or an acceptance clears the **challenger's instrument**, never the artifact.

## Adjacent predicate rule from the same session

A watcher reported `POSTED` on a stray brace because its predicate tested "stdout non-empty" — an error body
satisfies that. Mirror image observed the same day: a compile printed a diagnostic, wrote **no output file**,
and **exited 0**, so a script checking `$?` would call it success.

⇒ **A success predicate must test for the success SIGNAL, not for the presence of output — nor for the
absence of a failure code.** Both are healthy-looking instruments that were never measuring the claim.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785963557047-an-is-open-census-cannot-support-an-all-answered-c.md`_
