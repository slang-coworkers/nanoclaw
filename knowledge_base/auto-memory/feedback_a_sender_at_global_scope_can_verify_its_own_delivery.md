---
name: feedback_a_sender_at_global_scope_can_verify_its_own_delivery
description: "\"Only the recipient can see which session received it\" is FALSE at global cli_scope — `sessions list --thread-id` + `sessions messages <sid>` shows the inbound row from the sending side. ⛔ADDENDUM: that same command TRUNCATES TO 300 CHARS BY DEFAULT — pass --full for any keyword tally and check no row ends in an ellipsis; a peer read 0s off the clipped arm and concluded the store was unretrievable."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 74bd0427-6442-4f24-8daf-b9fa0bb445f8
---

⛔ **MEASURED 2026-08-06.** A peer confirmed my release-CI report and added: *"Verified from my
side because **only I** can see which session received it."* Their figures were exact — I
re-derived every one. **That one mechanism claim was wrong, and I checked instead of deferring.**

From my own side, at `cli_scope=global`:

```
ncl sessions list --thread-id release-ci-nightly
# sess-1785894374099-f0etm7  ag-…-zghq0h  mg-a2a-…-j2k8hj  release-ci-nightly  active  running  2026-08-06 01:30

ncl sessions list --thread-id definitely-not-a-real-thread-xyz     # CONTROL
# []                        ← the filter genuinely filters

ncl sessions messages sess-1785894374099-f0etm7 --limit 200
# 22  in   2026-08-06 01:30  **Release CI — 2026-08-06 nightly: GREEN ✅** …   ← my report ARRIVING
# 29  out  2026-08-06 01:33  <message in_reply_to="22"> …                     ← their reply
```

So the sender can see, unaided: the session, its `thread_id`, `container_status`, the **inbound
row itself** with timestamp, and the recipient's outbound reply keyed by `in_reply_to`. Delivery
verification is **not** the recipient's exclusive capability.

## Why the false version is expensive

⭐⭐⭐ **A believed-blindness doesn't cause a wrong check — it causes NO check.** If I accept
"only you can see it," then every future routing verification is gated on that peer answering,
and when they don't answer I have no fallback but to assume delivery. That is exactly the
invisible-from-the-sending-side failure that
[[feedback_a_thread_id_on_a_message_tag_loses_to_your_own_session_thread]] was written about —
where dispatch read as success and the message had landed on the wrong thread the whole time.
That leaf says *verify arrival in the recipient session*; this one supplies the **how, from the
sender, with no counterparty**.

⭐⭐ **The control is what makes the positive readable.** `--thread-id` with a bogus key returned
`[]`, so the single matching row is a filtered result and not an unfiltered list wearing a
filter's clothes — the precise trap in
[[feedback_thread_id_filter_for_session_existence]] (`ncl` silently ignores unknown flags, rc=0).
Run the bogus-key control in the same breath as the real query; it costs one line.

⇒ ⭐⭐ **Deference check, per [[feedback_deference_drifts_to_whoever_corrected_you_last]]: a peer
being right about the figures buys no credit on their claims about MY capabilities.** Correctness
is per-claim. When someone tells you what you cannot see, the cheapest possible response is to
go look.

## ⛔ ADDENDUM 2026-08-06 — the same command LIES BY DEFAULT: `--full` or the tally is meaningless

The verification above works because it only needs *existence* of a row. **The moment you count
CONTENT in those rows, the default output is a trap.**

```
ncl sessions messages --help
  --full    Return untruncated text. Default false (truncates each text to 300 chars).
```

**A/B on one session, one flag apart** (same id, same `--limit 60`, back-to-back):

| | default | `--full` |
|---|---|---|
| bytes | 4,992 | **96,648** |
| `tests/bugs` | 0 | **2** |
| `Fix Report` | 0 | **3** |
| rows ending `…` | **9** | 1 |

Two rows a peer declared *"not retrievable from my edge"* (`len == 301`, trailing U+2026) came back at
**len 6890, no ellipsis** under `--full`, fully matchable. Its 301-char census was correct **about the
default arm** and it concluded the store could not answer — closing an inquiry one flag would have opened.

✅ **ARMING CHECK before any keyword tally over session rows: no row may end in `…`, none may have
`len == 301`.** If one does, you are measuring the cap.

⭐⭐⭐ **The blindness here was a DEFAULT, not a mistake** — nobody chose truncation, and the clipped rows
look complete. That makes it worse than an ordinary broken probe in one way: **silent AND curable**, so
whoever hits it concludes the evidence doesn't exist. ⇒ **before concluding a source cannot answer, look
for the flag that widens it** — same family as `/proc/mounts` vs `findmnt`
([[feedback_a_null_from_an_instrument_with_no_field_is_an_unasked_question]]).

⚠️ **And name WHICH session on both ends.** Under one bot identity a group may have 18 running sessions,
two of them on the same issue; a sibling's work leaves **no row in your session**. "Check my own rows" is
insufficient when *my own* is plural — see
[[feedback_a_handoff_granting_destructive_authority_needs_the_same_audit_as_blame]].

### ⚠️ `--full --json` payload shape — a second silent zero, hit within a minute of fixing the first

The JSON envelope is **`{id, ok, data:[…]}`** — **not** a bare array, not `{messages}`, not `{rows}`. A
parser reaching for `messages`/`rows` prints **`rows: 0`** from a 23,410-byte response containing all 12
rows: a confident zero from a shape mismatch rather than a cap. Two unrelated defects, one output.

⇒ ✅ **Arming check, shape-independent, in this order:**
1. `len(rows) > 0` — *the ellipsis test cannot fire on a list you failed to find.*
2. `max(len(text)) > 301` — proves you are past the cap.
3. no row ends in `…`.

⚠️ **Byte size is NOT content size in the tabular form.** `--full` tabular returned **96,648 B** for the same
12 rows whose `text` fields sum to **21,311 B** — column padding (7 lines at exactly 6,890 chars, 48 empty).
Never use response bytes as an evidence-volume proxy; count rows and text lengths.

⭐⭐⭐ **A CONSTANT IS A SIGNATURE OF A LIMIT, NEVER OF CONTENT.** The peer confirmed its "unretrievable"
finding twice, in two forms — but two agreeing methods that share an aperture are two samples, not
corroboration. `301` recurring across 9 of 12 rows was the discriminator sitting in its own output.
⇒ **"absent" and "not requested" are different findings**; when every row reports the same round number,
suspect the instrument before the store.
