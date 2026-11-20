---
type: system
title: Messaging and routing hazards
description: Measured send/reply routing hazards — message-block delivery, pinned sends, in_reply_to precedence, mid-turn sibling fall-through, the Slang Maintainer reply edge, and premature operator approvals.
---

# Messaging and routing hazards

⚠️ **Once a final response has a `<message>` block, text outside it is not delivered (2026-10-21, slang#13789).** At 13:11Z
I put a `<message to="orchestrator-dashboard">` block and, after it, plain text meant for the fixer ("don't file,
send me the draft"). Only the dashboard row went out. Fixer session `4lrs0a` has no inbound from me, and my
own session shows one out row. Plain text goes to the current sender only when the response has no `<message>`
block. ⇒ **When a response sends to anyone with a `<message>` block, every peer instruction needs its own block
(with that task's `thread_id`).** Check: one block for each recipient I mean to reach.

⚠️ **Observed 2026-10-22: a pinned `send_message` (`thread_id` plus `target_session_id`) to a long-lived coworker session reroutes that coworker's later `to="parent"` reports onto the thread I pinned.** I sent slang-ci-babysitter a #1223 note pinned to its main session `hia2o3` with `thread_id=gh-issue-shader-slang/slangpy-1223`. After that, its 18:1x and 20:00Z sweep reports and progress pings (msgs 104/106/108) landed in my slangpy-1223 webhook session. Its 14:05Z sweep, sent before the note, went to Main's usual session (conversations/2026-10-22-conversation-3.md). Recurring task fires did not reset the route. ⇒ **Before pinning a one-off note to a coworker's long-lived main session, expect its routine reports to follow that thread until a different inbound resets it.** Handle them where they land. Prefer sending the note without a pin on the issue's own thread when the context in its main session isn't needed.

⚠️ **A `target_session_id` pin loses to the implicit `in_reply_to` (2026-10-29, slang#14006→#14007).** If `send_message`/`send_file` is called without `in_reply_to`, the runner stamps the current turn's inbound on it (`getCurrentInReplyTo()`). In the host's `resolveAgentRoute` (`agent-route.ts`), Layer 1 in_reply_to beats the Layer 0 pin. So a relay to a *different* session of the agent group I'm answering lands back in the sender's session. The D1 guard misses this whenever that sender's thread is my own. The same day, both cross-chain relays (#14007→#14006 and #14006→#14007) misrouted this way. **Fix:** pass an explicit `in_reply_to` that cannot resolve to the target group, such as this session's own webhook row (`in_reply_to=2` worked), together with `thread_id` and the pin. Peer-affinity on the stamped thread must also be empty. To confirm delivery, read the target session's newest rows. Grep only the first 300 chars: `ncl sessions messages` truncates text unless you pass `--full`.

⚠️ **Even with pin + thread_id + explicit `in_reply_to` all set correctly, a send can still fall through to a mid-turn sibling session of the same agent group (2026-11-17, slang#13833).** A relay pinned to the fixer's owning session (ln6thh) landed in the group's retry task session (3lk2yr, seq 52) that was mid-turn at send time; the owner never received it. All documented mitigations were applied — the pin still fell through. ⇒ **Verify not just that *some* session got the row, but *which* one**: when the pinned session doesn't show the inbound row, check the group's other active sessions (the two-running-sessions detector). For owner-directed messages, re-send once the sibling has gone quiet and verify the landing spot both times. Detail: [[../slang/13833-14530-borrow-param-readonly.md]] (routing-anomaly bullet); shared learning "Pinned send fell through to mid-turn sibling session despite pin + thread_id + in_reply_to" (2026-11-17).

## Plain final text does not reach the Slang Maintainer — reply via the in_reply_to edge (2026-11-17)

The Slang Maintainer group (ag-1776713258088-r8pp2t, inbound stamp `unknown:agent:...`) has **no destination name in my
destinations block** — only its own outbound rows exist (`parent` → my group, `slang-maintainer-dashboard`). Two consequences,
measured across 11-16→11-17:

1. **Unwrapped plain final text is not delivered to it.** My 11-16 20:0xZ reply to its daily report (dispositions + the
   request for the h7per/draft texts) never arrived — its 11-17 report re-asked every item and the h7per clock ran to ~503h
   on the missing handoff. On 11-17 the host began warning explicitly ("Your final text was not delivered — it was not
   wrapped in <message to=…>"), confirming the 08-06 "plain text IS delivered" measurement no longer holds under the
   current harness (those old rows were logged outputs, not delivered ones).
2. **`<message to=…>` cannot work either** — there is no name for it in my destination list.

⇒ **The only working reply path is `send_message({ in_reply_to: <its inbound row id>, text })` with no `to`** — the reply
edge resolves to the inbound's source session (send tool confirms with "Message sent to (current conversation)"). Its
sessions do not appear in `ncl sessions list`, so delivery cannot be verified from my side; the observable check is whether
its next report acknowledges the reply. Until it does, treat maintainer-facing asks (draft texts especially) as unconfirmed
and keep the operator note as the belt-and-braces channel.

⚠️ **Don't tell the operator a head is worth approving for CI before its peer review comes back (2026-10-29, #13741).**
At 13:40Z I told the operator `falcor-ci` on `c94e1d0` "makes sense again" while the delta review was still running.
An hour later the review found a segfault (B1), and I had to send a correction. ⇒ When reporting a new head, state
the review status, and say the CI/ready gate is worth acting on only after that head's review verdict is in.
