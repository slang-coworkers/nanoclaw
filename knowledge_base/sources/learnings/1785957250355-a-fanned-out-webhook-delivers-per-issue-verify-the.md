# A fanned-out webhook delivers per-issue — verify the whole set, not your own arrival

# A fanned-out webhook delivers per-issue — verify the whole set

**Measured 2026-08-05, shader-slang/slangpy.** A maintainer posted the *same* scrub request
("Mukund won't be returning to this work… assess whether still relevant / needs reassignment /
should be closed") on **6 issues** — #768, #820, #821, #822, #832, #844 — inside 7 seconds.
**Exactly one (#822) arrived as a webhook.** It was routed and answered well. The fan-out only
came to light because the triager mentioned siblings in an "out of scope" footnote.

Coverage measured afterward (`ncl sessions list` + per-issue comment check):

- #822, #832 → session + posted verdict ✅
- #820 → session, no reply yet
- #768, #821 → session, no reply yet
- **#844 → no session in ANY agent group, no reply** ❌ — and it carried a **month-stale**
  bot verdict (2026-07-08) recommending closure, so silence read as "handled".

## Why this matters

Webhook delivery is **per-issue**: an N-issue fan-out is N independent routing events with N
independent chances to drop. **Receiving one tells you nothing about the other N−1**, and a
dropped one is invisible by construction — no session, no message, no error. From inside the
chain that *did* arrive, delivered and undelivered look identical.

## What to do

When an inbound smells like a fan-out — identical body, same author, burst timestamps, an
epic/sibling structure, or a peer mentioning siblings — **enumerate the set from the source and
check each member for BOTH a session and a posted reply** before assuming coverage:

```bash
for n in <numbers>; do
  gh api "repos/<owner>/<repo>/issues/$n/comments" --paginate \
    --jq '.[] | select(.created_at > "<cutoff>") | "\(.created_at) \(.user.login)"'
done
ncl sessions list          # cross-tab thread ids against that set
```

Do not dispatch into a sibling's chain (duplicate sessions = duplicate work). Route only the
members nobody owns, and escalate the routing gap itself to the operator.

## Instrument traps — both produced false zeros

- **`ncl sessions list` is column-shifted**: rows with an empty `messaging_group_id` shift the
  thread into `$3`, so `awk '$4==thread'` returned **0 for all six issues**. Match the thread as
  a padded literal (`grep -F " $thread "`), never by field index.
- **Bare `grep -c 844` matches session IDs**, not the thread column — it reported #844 as covered
  when it had nothing.
- ⭐ **Both were caught only by running a non-zero control** (a thread known to exist). A zero
  from a mis-parsed instrument is byte-identical to a real zero.
