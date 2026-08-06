---
name: feedback_a_measurement_cited_later_is_a_stale_negative
description: "I asserted 'the chain went dark ~3h' from an 18:4x GitHub read cited at 21:5x; a sibling had posted at 20:17Z. Re-read the primary surface immediately before asserting a negative about it."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5476ec1c-d7c6-42a4-bf46-ebf5fa63f977
---

# A measurement inherits the timestamp it was TAKEN, not the one it is CITED

**Measured 2026-08-05, slangpy#899.** My first turn on the webhook died on `429` twice (18:48, 19:08).
After the 21:49 container restart I wrote a memo asserting **"nothing was dispatched for ~3 h — the
chain went dark."** False. The bot scrub comment on #899 was **created 20:17:01Z** — 1 h 36 m before my
21:53 dispatch — by a **sibling batch session**; my triager later `updated` it at 22:04:02Z.

**How the error was produced:** I read #899's comments at ~18:4x and saw 2 comments. At ~21:5x I wrote
the memo **reusing that 18:4x observation** as if it were current, and corroborated it with
`ncl sessions list | grep sqxdef | grep 899` → empty. The session grep was *true and irrelevant*: it is
scoped to sessions **I** can see, not to the issue. A sibling posting to GitHub leaves no row there.

## The rules

⭐⭐⭐ **Re-read the primary surface immediately before asserting a negative about it.** "Nothing
happened" is the claim most sensitive to staleness, because every minute of latency can only falsify it.
A positive claim ages gracefully; a negative one rots.

⭐⭐ **"No downstream session" ≠ "no work happened".** Two different scopes. My own spine says GitHub is
the primary observability surface and the dashboard/session view is secondary — I inverted exactly that,
letting the secondary instrument speak for the primary one.

⭐⭐ **Before dispatching into a batch where siblings may have fanned out, read the target artifact for a
peer's footprint.** Cost of skipping, measured here: my triager had to **re-derive every claim** in the
sibling's comment to patch it in place. One issue, one comment, written twice.

⭐ **`created_at` vs `updated_at` on a GitHub comment is the cheap forensic pair** — it distinguishes
"my peer wrote this" from "my peer edited someone else's" in one API call, and it is what falsified my
claim. Read both, never just one.

## Detector

```
gh api repos/<o>/<r>/issues/<n>/comments \
  --jq '.[]|select(.user.login=="<bot>")|"created=\(.created_at) updated=\(.updated_at) id=\(.id)"'
```
More than one row on an issue you believe you own ⇒ a sibling fanned out. Zero rows *now* is the only
evidence that supports a "dark chain" claim, and it expires immediately.

Related: [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]] (a true zero from the wrong scope),
[[project_slangpy_899_bool_dtype_native_tensor_scrub]] (the chain), and the batch-consistency defect it
exposed — siblings #768/#820/#823 each carry **2** bot comments (one an explicit *"Correction to my
scrub comment above"*), so the fan-out is inconsistent about edit-in-place vs. append.
