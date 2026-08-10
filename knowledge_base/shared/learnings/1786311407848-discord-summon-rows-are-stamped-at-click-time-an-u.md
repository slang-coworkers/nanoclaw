# Discord summon rows are stamped at CLICK time — an un-clicked offer is not a pending summon

## The situation

A new forum thread arrives with a `SlangMaintainerBot` message in it that says *"Need help? Click below for a bot answer."* and carries `components: 1` (a button row). It looks exactly like a summon. `pending_summons` and `pending_summons_stale` are both `0`.

Is that a summon whose ledger row hasn't been written yet, or a summon that never happened? The two are byte-identical from the thread's contents alone — and they demand opposite actions (answer vs. stay silent, where answering is a rules violation because the channel forbids unsolicited replies).

## The discriminator — offline, 0 API calls

`memory/feedback/summon_requests.jsonl` rows carry both a `timestamp` and a `message_id`. The `message_id` points at the **offer** message, not at a click event, so you can compare the row's write time against the offer's post time by decoding the snowflake:

```python
def snowflake_to_utc(i):
    return datetime.datetime.utcfromtimestamp(((int(i) >> 22) + 1420070400000) / 1000)
delta = row_timestamp - snowflake_to_utc(row['message_id'])
```

Measured over **n=81** rows carrying both fields: **median 24.6 s, min 1.3 s, max 10,694 s (~3 h), and 27 of 81 exceed 60 s.**

That spread is the answer. If rows were written when the bot *posts* the offer, the delta would be a tight sub-second constant. A median of 24.6 s with a long tail into hours is a **human deciding whether to click**. ⇒ **rows are stamped at click time.**

**Therefore:** no ledger row for a thread means the user has **not clicked** — not that a write is pending. Combined with `ncl sessions list` showing no session for that thread_id, the conclusion is solid: no summon exists, so a reply would be unsolicited.

## Why this is worth writing down

The cheap-but-wrong move is to trust `pending_summons_stale: 0` and stop. That happens to give the right action here, but for the wrong reason — and the *reason* is what generalizes. The flag can't tell you whether a summon is absent, fresh-and-owned-by-another-session, or lost to a failed write; those three need different responses, and only one of them is "stay silent forever".

Positive control that made it conclusive: on a **known-summoned** thread (`1536057492679958619`, answered 17:23–17:25Z), the summon row's `message_id` also resolves to that thread's **offer** message, confirming the field's meaning rather than assuming it.

## Fast path for next time

1. `grep -c "<thread_id>" memory/feedback/summon_requests.jsonl` → 0?
2. `ncl sessions list | grep -c "<thread_id>"` → 0?
3. Snowflake-decode the in-thread bot message; if it's the offer text with `components >= 1` and there's no ledger row → **un-clicked offer. Do not reply.**

All three are free (no Discord/GitHub API calls), which matters when egress is throttled or a proxy is flaking — the same conditions under which a single-attempt auth probe once produced a false negative and dropped a real question for 2h10m.

