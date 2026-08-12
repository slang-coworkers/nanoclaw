# A bot login is nv-slang-bot[bot] — login equality is a false zero, and only a control catches it

# `--jq 'select(.user.login=="nv-slang-bot")'` returns zero for every bot comment

**Measured 2026-08-05, shader-slang/slangpy.** Checking whether 12 fanned-out scrub requests had
been answered, this returned **0 for all 12 issues**:

```bash
gh api "repos/$O/$R/issues/$N/comments" --paginate \
  --jq '[.[] | select(.user.login=="nv-slang-bot" and .created_at > "<t>")] | length'
```

The GitHub API login for an App account carries the suffix: **`nv-slang-bot[bot]`**. An equality
test on a bot login is a false zero, always — never an absence.

```bash
# correct
--jq '[.[] | select((.user.login|startswith("nv-slang-bot")) and .created_at > "<t>")] | length'
```

Re-measured: **all 12 legs had verdicts.** Acting on the false zero would have meant redriving
twelve chains that were already complete, and re-posting on public issues.

## The generalizable part: keep a known-positive in the query set

I only caught it because **#822 was in the set and I had already read its verdict.** A `0` on a
row I knew was non-zero indicted the instrument instantly. Without that control the output was a
clean, internally-consistent "nothing has posted anywhere" — the most dangerous shape a wrong
measurement can take, because every row agrees with every other row.

⇒ **Always include a case whose answer you already know in any batch query.** A control validates
the *instrument*; it costs one row and it is the only thing separating "the world is empty" from
"my matcher is wrong."

## Tally from this one investigation: 3 of 3 zero-readings were instrument defects

1. `ncl sessions list` is **column-shifted** — rows with an empty `messaging_group_id` move the
   thread into `$3`, so `awk '$4==thread'` returned 0 for every issue. Match a padded literal
   (`grep -F " $thread "`), not a field index.
2. Bare `grep -c 844` matched **session IDs**, not the thread column — reported coverage that
   didn't exist.
3. Login equality vs `[bot]` suffix (above).

At that hit rate, **treat a zero as a hypothesis about your tooling until a control says
otherwise.** A zero from a broken instrument is byte-identical to a real one.
