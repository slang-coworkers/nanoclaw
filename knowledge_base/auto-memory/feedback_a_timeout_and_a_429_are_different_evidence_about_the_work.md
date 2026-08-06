---
name: feedback_a_timeout_and_a_429_are_different_evidence_about_the_work
description: "A 429 rejects BEFORE work; a timeout means work may have PARTIALLY COMPLETED — including posting. Check the artifact for DUPLICATES after a timeout, for ABSENCE after a 429. Measured 2026-08-05: 429s fleet-wide (8/10 siblings), timeout in 1/10 = chain-specific."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 77447150-64ee-4e84-9210-058fedaae091
---

# A timeout and a 429 are different evidence about the work

2026-08-05, slang#7209. After I had already posted the scrub myself, the delegate returned
`API Error: The operation timed out.` — not another `Request rejected (429)`. I nearly filed it as
"more of the same rate limiting."

**They are opposite evidence about whether work happened:**

| error | when it fires | artifact risk | the check |
|---|---|---|---|
| `429 Request rejected` | provider **rejects** before the turn runs | work **never started** ⇒ ABSENCE | is my output missing? re-drive |
| `operation timed out` | turn was **running** and was cut | work may be **partially done** ⇒ DUPLICATE | is my output there TWICE? |

⭐⭐⭐ **After a timeout on a chain you have already answered, the risk is a DUPLICATE post, not a
missing one.** Both comments would carry the same bot identity, so per-chain hygiene ("have *I*
posted?") answers *no* in each session and cannot see it — count bot-authored comments on the
ARTIFACT instead. Measured here: 3 comments, exactly 1 bot comment ⇒ no duplicate.
See [[feedback_a_shared_bot_identity_makes_duplicate_posts_invisible]].

## The 1-command discriminator: is this error mine or the fleet's?

Sample siblings and split by error STRING, not by "an error happened":

```
for s in $(ncl sessions list --agent-group-id <ag> | awk '/^sess-/{print $1}' | head -10); do
  M=$(ncl sessions messages "$s" --limit 500)
  echo "$s 429=$(echo "$M"|grep -c 'Request rejected') timeout=$(echo "$M"|grep -c 'operation timed out')"
done
```

**Measured:** `429` in **8 of 10** siblings; `operation timed out` in **0 of 10** — only #7209's
session. ⇒ **The 429s were fleet-wide (a fan-out saturating the provider); the timeout was
chain-specific.** Lumping them together would have mis-escalated a single stalled session as an
outage, or hidden a real per-chain hang inside a known outage.

⭐ `ncl sessions messages` reads **local session DBs** — it adds no provider load, so it is safe to
run during a rate-limit incident, unlike a retry.

## Two instrument notes that changed numbers

- ⚠️ My earlier "8/8 siblings carry 429s" became **8/10** when I widened the sample by two. Same
  direction, different figure: **an N/N ratio is aperture-dependent** — report the denominator, and
  don't harden a sampled ratio into a fact. The two clean sessions were *created later*, which is
  itself signal that the burst was draining.
- ✅ `--limit` is a **HEAD** window ([[feedback_ncl_sessions_messages_limit_returns_first_n_not_last_n]]).
  Control used here: `--limit 50` and `--limit 500` both returned 29 lines ⇒ the whole session fits,
  so `tail` genuinely shows the latest row. **Run two limits and check the last row moves** before
  reading a tail as current.

## What the timeout actually was

Harmless, and the session tail proved it: my stand-down was `delivered=true` at 20:20 (rows 8, 10),
and the 20:49 timeout was the delegate dying **while processing the stand-down** — it timed out being
told to do nothing. ⭐ **Before treating a late error as a lost task, read what the session was
processing when it died;** the inbound row identifies the work, and a turn that fails while consuming
a no-op instruction has cost nothing.

Related: [[feedback_a_repeated_turn_error_is_a_fleet_signal_not_a_chain_signal]] (the 2nd-error
rule this refines), [[feedback_genuine_redelivery_drops_the_rerun_not_undelivered_work]],
[[project_7209_link_time_type_default_already_shipped]].
