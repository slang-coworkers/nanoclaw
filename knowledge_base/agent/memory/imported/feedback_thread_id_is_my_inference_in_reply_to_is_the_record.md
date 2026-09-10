---
name: feedback_thread_id_is_my_inference_in_reply_to_is_the_record
description: "I obeyed 'bind claims to thread=, not from=' and still misrouted, because I RECONSTRUCTED the thread from message content instead of reading it off the inbound. Measured 2026-08-06: replied to msg 108416 on thread …-12386; the inbound came from session r6ntlr (thread …-12383), proven by its verbatim 18:15Z outbound row. in_reply_to needs no reconstruction — prefer it over any thread_id I compute."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 3d65b695-07b1-4e0f-be1f-ef59176a8b3f
---

# ⛔ The fix I had adopted did not cover the case, because I supplied the discriminator myself

**Measured 2026-08-06.** `slang-fixer` msg **108416** reported an OUTPUT_REVIEW at round 10, a 560 B
constant, 36-of-657 directives. I replied **on thread `gh-issue-shader-slang/slang-12386`**. The
#12386 session refused the credit, twice, correctly.

Verification, from my side, at global `cli_scope`:

```
ncl sessions messages sess-1786021354005-r6ntlr --limit 200
  → 75  out  2026-08-06 18:15  "**Status: OUTPUT_REVIEW is at round 10 (13 critique rounds total)…"
     that session's thread_id = gh-issue-shader-slang/slang-12383
ncl sessions messages sess-1786000403787-p4xhog   (thread …-12386)
  → last inbound is my misrouted reply; its own work is a HELD chain, no critique loop at all
```

⇒ msg 108416 originated in the **#12383** session. I sent its answer to the **#12386** session.

## ⭐⭐⭐ Why [[feedback_a_shared_name_merges_two_sessions_reports]] did not catch this

That leaf's rule is *"bind every claim to `thread=`, not to `from=`."* **I complied and still failed** —
because I did not *read* a thread, I **computed** one from the prose. The message discussed a critique
loop over a survey of test directives; I matched that to the chain I remembered doing survey work and
wrote `thread_id="…-12386"` by hand.

⛔ **A thread_id I author is a hypothesis about provenance wearing the costume of a record.** It has the
exact shape of the routing key, so nothing downstream can tell it apart from one that was read.

⛔ **And the envelope hides the discriminator in precisely this case:** inbound rows show `thread="…"`
**only when the thread differs from my own session's**. Eight `slang-fixer` sessions deliver as one
`from=`, so across a batch the attribute is present on some rows and absent on others, and absence
reads as *"same chain as the last one"* rather than *"look it up."*

## ⭐⭐⭐ The rule

**When replying to a specific inbound, use `in_reply_to=<their-msg-id>` — never a `thread_id` I
compute.** `in_reply_to` resolves the inbound row → its recorded `source_session_id` → routes down that
exact edge. It requires no reconstruction, so it cannot encode my belief about who wrote to me.

Reserve an authored `thread_id` for what it is actually for: a **fresh dispatch** where no inbound
exists to reply to, and the key comes from the task's identity (the canonical
`gh-issue-<owner>/<repo>-<num>`), not from my reading of a conversation.

⇒ ⭐⭐ **Discriminating question before any peer reply: am I answering a message, or starting one?**
Answering ⇒ `in_reply_to`. Starting ⇒ authored `thread_id`. I used the starting-form to answer, which
is how the content became the routing key.

## ⭐⭐ The peer's refusal is the model response, and worth copying

It did not accept plausible credit for adjacent work. Its evidence was **negative and cheap** — zero
critique artifacts in its scratch dir, deliverable last written five hours earlier, and the figures
located in a *sibling's* file (`wt-slang-12383-scratch-log.md`, `12383` ×9 / `12386` ×0). It explicitly
declined to guess **who**, only to establish **not me**.

⭐⭐⭐ **Its reason for refusing the substance is the deeper point: filing another session's lessons as
its own would make a future session reason from a history that never happened.** Fabricated provenance
is worse than a missing note, because the note's absence is silent while the fabrication is *acted on*.
⇒ **Do not adopt a lesson whose case detail you cannot state.** Route it to whoever holds the case.

⚠️ **"It is on my filesystem" proves nothing about ownership** — N sessions of one coworker share one
disk, so a path like `/workspace/agent/wt-slang-*` carries zero attribution. Same shape as
[[feedback_unrecognized_file_content_is_not_evidence_of_an_editor]]: a file you can *see* is not a file
you *wrote*. The discriminator is the session, and I can read it from my side with `ncl sessions
messages` ([[feedback_a_sender_at_global_scope_can_verify_its_own_delivery]]).

Siblings: [[feedback_a_thread_id_on_a_message_tag_loses_to_your_own_session_thread]] (authored
thread_id silently overridden — different failure, same false confidence in a key I wrote) ·
[[feedback_a_pending_tell_does_not_catch_the_error_it_was_designed_for]].
