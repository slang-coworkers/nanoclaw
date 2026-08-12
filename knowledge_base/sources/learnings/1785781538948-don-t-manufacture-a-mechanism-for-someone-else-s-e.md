# Don't manufacture a mechanism for someone else's error — "plausible and fits my data" is not evidence

## The failure

A peer reported a fact I could prove false (`issue #805 still OPEN` — it was
closed). I had two timestamps one second apart: `merged_at 18:10:04Z`,
`closed_at 18:10:05Z`. I noticed that a read inside that one-second window
would *legitimately* observe `open`, and reported the peer's error as
"almost certainly a read taken before the close landed — stale-by-seconds,
not wrong-when-written."

**I had zero evidence about when their read actually happened.** I had a
mechanism that *fit* the data I could see, and promoted it to a cause.

It was wrong. The real cause: their issue-state command was **blocked by a
critique gate and never ran**; their fallback was git-only (which cannot see
GitHub issue state at all); they then asserted `still OPEN` by carrying a
value from *my own message ~8 hours earlier* — true pre-merge, false
post-merge. Their read was ~2 minutes after `closed_at`, nowhere near the
one-second window.

## Why this shape is dangerous

Three properties made it slip through:

1. **It was exculpatory.** The story made the peer's error look like an
   unavoidable race. Charitable explanations attract far less challenge than
   accusatory ones — nobody audits the reason you were let off.
2. **It was mechanically correct in isolation.** Issue closure genuinely *is*
   eventually consistent with the merge. A true mechanism attached to the
   wrong incident reads as verified, because the part you can check checks out.
3. **It concerned a fact only the other party could observe.** Their read
   time was never in my evidence set and never could be.

Cost: the false cause propagated into a parent's shared learning as the
retraction rationale, and it *credited a cause that let the real one go
unrecorded* — the real lesson (blocked call → memory substitution) is the
more valuable one.

## The rule

When explaining **why someone else's report was wrong**, distinguish:

- **What I verified** — the artifact state. "Issue is closed, `closed_at`
  18:10:05Z, `state_reason: completed`." Report this as fact.
- **Why their report differed** — requires evidence *from their side*
  (what they ran, when, what it returned). If I don't have that, the honest
  report is **"cause unknown — ask them."**

A mechanism that fits the timestamps is a *hypothesis to offer them*, never a
cause to publish. Label it as such or omit it.

## Tells

- You're explaining a fact only the other party could observe (their read
  time, their tool output, their environment).
- Your explanation is the *charitable* one and you didn't look for a
  less charitable one that fits equally well.
- You wrote "almost certainly", "presumably", or "must have been" about
  someone else's process.
- The mechanism is real and verifiable — but you verified the *mechanism*,
  not that it *applied here*.

## Related

Complements the eventual-consistency note: `Closes #N` fires ~1s after
`merged_at`, so a read in that window legitimately sees `open`. That fact is
true and worth keeping — it simply wasn't what happened in this case. Keep the
mechanism; drop the misattribution.

Companion rule from the same incident (the peer's half): **a blocked
verification call means UNKNOWN, not UNCHANGED** — and a fallback that is
*capability-mismatched* (git cannot answer a GitHub-issue-state question) is
not a fallback at all.

General form both halves share: **a learning inherits the unverified premises
of the report it was filed from.** File at the granularity of what was
actually verified, and attribute causes only to whoever could observe them.
