---
name: feedback_a_message_block_in_a_task_session_is_never_delivered
description: "In scheduled-task sessions a final-response <message to=...> block is DROPPED (runner logs \"task sessions send only via explicit tools\") — only send_message delivers; measured on two separate nights, and the drop is logged as scratchpad so it reads like success."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 53f8c29f-1cc5-47ba-9315-f9a1ddf8a6fd
---

⛔ **In a SCHEDULED-TASK session, a `<message to="…">` block in the final response is NOT
delivered.** The runner drops it and logs:

```
[poll-loop] Task run: <message to="slang-release-regression-check"> block not delivered
            — task sessions send only via explicit tools
[poll-loop] [scratchpad] [not delivered — task sessions send only via the send_message tool; …]
```

Only `mcp__nanoclaw__send_message` delivers from a task session. Measured on my own edge on **two
separate nights** (2026-08-08 and 2026-08-09) in the same nightly release-CI task — so this is the
normal behavior of task sessions, not a one-off.

## ⭐⭐⭐ Why this is dangerous rather than merely annoying

The rule I carry is *"bare prose outside a `<message>` block IS delivered"* — see
[[feedback_zero_output_is_not_available_scratchpad_still_delivers]]. **In a task session the
polarity is INVERTED for the block form:** the thing I use precisely *because* it routes is the
thing that gets dropped. So the habit that guarantees delivery in an interactive session guarantees
**silence** in a task session.

And the drop is **logged as `[scratchpad]` with the full text**, which reads like a successful send
in the transcript. ⇒ ⭐⭐ **A dropped message that is echoed into the log is indistinguishable from a
delivered one when you audit later.** The only positive proof of delivery is the tool result:
`Message sent to <dest> (id: NNNNNN)`.

## ✅ The rule

- In a task/cron session: **`send_message` for every outbound, always.** Never rely on a
  final-response `<message>` block.
- Treat `Message sent to … (id: …)` as the only delivery receipt. No id ⇒ it did not arrive.
- Auditing an old task run for "did the report go out?": grep the log for `not delivered` /
  `[scratchpad]`, not for the report text — the text is present either way.

## ⚠️ How I learned it both times: the harness told me

Tonight the host surfaced an explicit `<undelivered_message>` notice asking whether it still needed
sending, which is what saved the report. **That notice is a backstop, not a guarantee** — do not
design around it. On 08-08 the same drop happened and was only visible in the log.

Same family as the silent-non-delivery holes this nightly instrument keeps producing:
[[feedback_gh_api_has_no_arg_flag_so_the_query_never_ran]] (a guard reporting a true sentence with
the wrong cause) and [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]].
