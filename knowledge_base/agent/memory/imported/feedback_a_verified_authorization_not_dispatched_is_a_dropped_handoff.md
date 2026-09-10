---
name: feedback_a_verified_authorization_not_dispatched_is_a_dropped_handoff
description: "I verified jkwak's 'make a PR' authorization on slang#12411 (no PR/branch existed, comment real) and then ENDED THE TURN without emitting the routing message. The verification felt like the action. 6h later the maintainer chased status — that gap surfaced the drop, nothing else would have."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: dd6c5348-62db-4101-8b01-d603c9d1d751
---

# Verifying an authorization is not dispatching it — the routing message must leave the same turn

**A clearance you have confirmed but not forwarded is indistinguishable, from the outside, from one
you never received.** The verification produces a feeling of completion — "I checked it, it's
clean" — that substitutes for the act it was supposed to precede. Nothing downstream moves, and no
error fires, because a dropped handoff has no failure signature: the recipient simply never hears,
and silence looks identical to work-in-progress.

## The instance (slang#12411, 2026-08-21)

jkwak-work commented *"@nv-slang-bot, please make a PR as discussed"* at **16:10Z** — explicit
authorization, and it also answered the open free-function-scope question (two `coopVecLoad`
overloads). I ran the right checks: no PR referencing 12411, no `fix/issue-12411` branch (404),
comment real. **Then I ended the turn without routing the fixer-release to the triager.** The
dispatch never left.

**6h20m later** he came back: *"can you share the status of the upcoming PR?"* — which is the only
reason I noticed. Had he not chased, the authorization would have sat indefinitely. The maintainer
did my error-detection for me.

⭐⭐⭐ **The trap is that verification and dispatch feel like one act and are two.** Confirming a
clearance is *read-only*; it changes nothing. The turn is only complete when the `<message>` that
moves work has actually been emitted — and a final-turn `<internal>` block or a bare-prose non-answer
emits **no routing at all**. I had done the hard, careful part (verifying) and let it stand in for the
cheap, load-bearing part (sending).

## How to apply

⛔ **When you verify an authorization/clearance/go-signal, the routing message that acts on it must be
in the SAME turn's final response.** Do not split "confirm it's clean" and "dispatch it" across
turns — the interval is where the handoff dies. If you find yourself ending a turn having *decided*
to dispatch, check that the `<message>` block is actually present, not merely intended.

⛔ **Before ending a turn that received an authorization: did a dispatch actually leave?** This is the
mirror of the standing end-of-turn check ("did I report up?"). Add: "did I act on every go-signal I
verified?" A verified-but-undispatched authorization is the same dark-state failure as a silent close
([[feedback_zero_output_is_not_available_scratchpad_still_delivers]]) — the difference is here the
missing message was an *action*, not an ack.

⚠️ **Disclose the gap plainly when it surfaces; do not paper it.** The honest status was
*authorized / dispatching now / no PR yet* — and that is exactly what got posted, rather than implying
6h of progress that never happened. A dropped handoff owned is recoverable; one hidden behind
fabricated status compounds ([[ANCHOR I]] family — never relay a completion that does not exist).

⇒ **Root-cause note for my own loop:** the drop happened on a turn where I had *also* correctly
decided to stay silent on a converged peer exchange. The silence discipline is right, but it must not
swallow a pending action — "nothing to say to the peer" is not "nothing to dispatch." Separate the two
questions: is there an echo to suppress (yes) AND is there an action owed (also yes).

Related: [[feedback_a_dispatch_is_a_clearance_and_decays]],
[[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]] (a gate needs a resume trigger
you control — here the "resume" was self-owned and I still didn't fire it),
[[project_12411_coopvec_bfloat16]].
</content>
