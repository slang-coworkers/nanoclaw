---
name: feedback_a_sender_at_global_scope_can_verify_its_own_delivery
description: "\"Only the recipient can see which session received it\" is FALSE at global cli_scope — `ncl sessions list --thread-id` + `sessions messages <sid>` shows the inbound row from the sending side"
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
